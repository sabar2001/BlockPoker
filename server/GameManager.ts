import {
  Card, GameStage, GameVariant, PlayerAction, PublicPlayer,
  GameStateBroadcast, TableConfig, DEFAULT_TABLE_CONFIG, GameLogEntry,
  ShowdownResult,
} from '../shared/protocol.js';

// --- Deck & Card Logic ---
const SUITS = ['♥', '♦', '♣', '♠'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    RANKS.forEach((rank, index) => {
      deck.push({ suit, rank, value: index + 2 });
    });
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// --- Hand Evaluation (showdown only) ---
const BASE = 15;
function encodeScore(handRank: number, kickers: number[]): number {
  const k = [...kickers];
  while (k.length < 5) k.push(0);
  return handRank * (BASE ** 5) + k[0] * (BASE ** 4) + k[1] * (BASE ** 3) + k[2] * (BASE ** 2) + k[3] * BASE + k[4];
}

function scoreHand(cards: Card[]): number {
  if (cards.length !== 5) return 0;
  const values = cards.map(c => c.value).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);
  let isStraight = false;
  let straightHigh = 0;

  if (values[0] - values[4] === 4 && new Set(values).size === 5) {
    isStraight = true;
    straightHigh = values[0];
  }
  // Wheel: A-2-3-4-5
  if (!isStraight && values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) {
    isStraight = true;
    straightHigh = 5;
  }

  const valueCounts = new Map<number, number>();
  values.forEach(v => valueCounts.set(v, (valueCounts.get(v) || 0) + 1));
  const groups = Array.from(valueCounts.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const counts = groups.map(g => g[1]);
  const gv = groups.map(g => g[0]);

  if (isFlush && isStraight) return encodeScore(8, [straightHigh]);
  if (counts[0] === 4) return encodeScore(7, [gv[0], gv[1]]);
  if (counts[0] === 3 && counts[1] === 2) return encodeScore(6, [gv[0], gv[1]]);
  if (isFlush) return encodeScore(5, values);
  if (isStraight) return encodeScore(4, [straightHigh]);
  if (counts[0] === 3) return encodeScore(3, [gv[0], gv[1], gv[2]]);
  if (counts[0] === 2 && counts[1] === 2) {
    const hi = Math.max(gv[0], gv[1]), lo = Math.min(gv[0], gv[1]);
    return encodeScore(2, [hi, lo, gv[2]]);
  }
  if (counts[0] === 2) return encodeScore(1, [gv[0], gv[1], gv[2], gv[3]]);
  return encodeScore(0, values);
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  return arr.flatMap((v, i) => combinations(arr.slice(i + 1), k - 1).map(c => [v, ...c]));
}

const HAND_RANK_NAMES = [
  'High Card',
  'Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush',
];

function getHandName(score: number): string {
  const handRank = Math.floor(score / (BASE ** 5));
  // Special case: Royal Flush is a straight flush with Ace high
  if (handRank === 8) {
    const kicker0 = Math.floor((score % (BASE ** 5)) / (BASE ** 4));
    if (kicker0 === 14) return 'Royal Flush';
  }
  return HAND_RANK_NAMES[handRank] || 'Unknown';
}

function bestHandScore(hole: Card[], community: Card[], variant: GameVariant): number {
  if (variant === 'HOLDEM') {
    let max = 0;
    for (const combo of combinations([...hole, ...community], 5)) {
      const s = scoreHand(combo);
      if (s > max) max = s;
    }
    return max;
  } else {
    // Omaha: exactly 2 from hole, 3 from board
    let max = 0;
    for (const hp of combinations(hole, 2)) {
      for (const bp of combinations(community, 3)) {
        const s = scoreHand([...hp, ...bp]);
        if (s > max) max = s;
      }
    }
    return max;
  }
}

// --- Server-side Player State ---
interface ServerPlayer {
  id: string;
  name: string;
  chips: number;
  hand: Card[];         // SECRET
  isFolded: boolean;
  isAllIn: boolean;
  currentBet: number;
  seatIndex: number;
  color: string;
  hasActed: boolean;
  chatMessage?: string;
  lookYaw: number;
  lookPitch: number;
  emote?: string;
  isSpeaking: boolean;
  isReady: boolean;
  isConnected: boolean;
}

const PLAYER_COLORS = [
  "#ff4444", "#44ff44", "#4444ff", "#ffff44", "#ff44ff",
  "#00ffff", "#ff8800", "#8800ff", "#ffffff"
];

export class GameManager {
  tableConfig: TableConfig;
  stage: GameStage = GameStage.PREFLOP;
  pot: number = 0;
  communityCards: Card[] = [];
  deck: Card[] = [];
  currentTurnIndex: number = 0;
  dealerIndex: number = 0;
  highestBet: number = 0;
  minBet: number = 0;
  lastAggressorIndex: number = 0;
  winners: string[] = [];
  showdownResults: ShowdownResult[] = [];
  players: ServerPlayer[] = [];
  isPlaying: boolean = false;
  waitingForDeal: boolean = false;
  gameLogs: GameLogEntry[] = [];
  private pendingConfig: Partial<TableConfig> | null = null;

  // Action timer
  private actionTimeoutId: NodeJS.Timeout | null = null;
  private actionTimerIntervalId: NodeJS.Timeout | null = null;
  private actionStartTime: number = 0;
  private actionTimeRemaining: number = 0;

  private roundTimer: ReturnType<typeof setTimeout> | null = null;
  private onStateChange: () => void;
  private onRoundEnd: (winners: string[], winAmount: number) => void;
  private onNewRound: () => void;
  private onDealHand: (playerId: string, cards: Card[]) => void;
  private onTimerUpdate: (playerId: string, timeRemaining: number) => void;
  private onLog: (log: GameLogEntry) => void;

  constructor(callbacks: {
    onStateChange: () => void;
    onRoundEnd: (winners: string[], winAmount: number) => void;
    onNewRound: () => void;
    onDealHand: (playerId: string, cards: Card[]) => void;
    onTimerUpdate: (playerId: string, timeRemaining: number) => void;
    onLog: (log: GameLogEntry) => void;
  }, tableConfig?: Partial<TableConfig>) {
    this.tableConfig = { ...DEFAULT_TABLE_CONFIG, ...tableConfig };
    this.minBet = this.tableConfig.bigBlind;
    this.onStateChange = callbacks.onStateChange;
    this.onRoundEnd = callbacks.onRoundEnd;
    this.onNewRound = callbacks.onNewRound;
    this.onDealHand = callbacks.onDealHand;
    this.onTimerUpdate = callbacks.onTimerUpdate;
    this.onLog = callbacks.onLog;
  }

  updateConfig(config: Partial<TableConfig>): void {
    if (this.isPlaying) {
      this.pendingConfig = { ...(this.pendingConfig || {}), ...config };
    } else {
      Object.assign(this.tableConfig, config);
      this.minBet = this.tableConfig.bigBlind;
    }
  }

  // Player chooses their own buy-in within table limits
  addPlayer(id: string, name: string, buyIn: number): ServerPlayer | null {
    if (this.players.length >= 9) return null;
    if (this.players.find(p => p.id === id)) return null;

    const seatIndex = this.getNextAvailableSeat();
    if (seatIndex === -1) return null;

    // Clamp buy-in to table limits
    const chips = Math.max(this.tableConfig.minBuyIn, Math.min(this.tableConfig.maxBuyIn, buyIn));

    const player: ServerPlayer = {
      id,
      name,
      chips,
      hand: [],
      isFolded: this.isPlaying && !this.waitingForDeal, // If joining mid-game, mark as folded unless waiting for deal
      isAllIn: false,
      currentBet: 0,
      seatIndex,
      color: PLAYER_COLORS[seatIndex % PLAYER_COLORS.length],
      hasActed: false,
      lookYaw: 0,
      lookPitch: 0,
      isSpeaking: false,
      isReady: this.isPlaying, // Auto-ready if joining mid-game
      isConnected: true,
    };
    this.players.push(player);
    console.log(`[GameManager] Player ${name} (${id}) joined. isPlaying=${this.isPlaying}, waitingForDeal=${this.waitingForDeal}, isFolded=${player.isFolded}`);
    return player;
  }

  removePlayer(id: string): void {
    const idx = this.players.findIndex(p => p.id === id);
    if (idx === -1) return;

    if (this.isPlaying) {
      this.players[idx].isConnected = false;
      this.players[idx].isFolded = true;
      if (this.currentTurnIndex === idx) {
        this.advanceTurn();
      }
    } else {
      this.players.splice(idx, 1);
    }
  }

  private getNextAvailableSeat(): number {
    const taken = new Set(this.players.map(p => p.seatIndex));
    for (let i = 0; i < 9; i++) {
      if (!taken.has(i)) return i;
    }
    return -1;
  }

  startGame(): boolean {
    const active = this.players.filter(p => p.isConnected && p.chips > 0);
    if (active.length < 1) return false;
    this.isPlaying = true;
    this.startNewRound();
    return true;
  }

  startNewRound(): void {
    if (this.pendingConfig) {
      Object.assign(this.tableConfig, this.pendingConfig);
      this.pendingConfig = null;
    }
    this.deck = createDeck();
    this.stage = GameStage.PREFLOP;
    this.communityCards = [];
    this.pot = 0;
    this.highestBet = this.tableConfig.bigBlind;
    this.minBet = this.tableConfig.bigBlind;
    this.winners = [];
    this.showdownResults = [];
    this.waitingForDeal = false;
    this.clearActionTimer();

    for (const p of this.players) {
      p.hand = [];
      p.isFolded = p.chips <= 0 || !p.isConnected;
      p.isAllIn = false;
      p.currentBet = 0;
      p.hasActed = false;
      p.chatMessage = undefined;
    }

    const active = this.players.filter(p => !p.isFolded);
    if (active.length < 1) {
      this.isPlaying = false;
      this.onStateChange();
      return;
    }

    this.addLog('deal', `New ${this.tableConfig.variant} round started`);

    // Signal new round FIRST so client clears old hand/winners before receiving new cards
    this.onNewRound();

    // THEN deal cards (client receives game:hand AFTER game:new-round)
    const cardsPerPlayer = this.tableConfig.variant === 'OMAHA' ? 4 : 2;
    for (const p of this.players) {
      if (!p.isFolded) {
        p.hand = this.deck.splice(0, cardsPerPlayer);
        this.onDealHand(p.id, p.hand);
      }
    }

    // Blinds (only if 2+ players)
    if (active.length >= 2) {
      const sbIdx = this.findNextActive(this.dealerIndex);
      const bbIdx = this.findNextActive(sbIdx);

      const sbAmount = Math.min(this.players[sbIdx].chips, this.tableConfig.smallBlind);
      this.players[sbIdx].chips -= sbAmount;
      this.players[sbIdx].currentBet = sbAmount;

      const bbAmount = Math.min(this.players[bbIdx].chips, this.tableConfig.bigBlind);
      this.players[bbIdx].chips -= bbAmount;
      this.players[bbIdx].currentBet = bbAmount;

      this.pot = sbAmount + bbAmount;
      this.lastAggressorIndex = bbIdx;
      this.currentTurnIndex = this.findNextActive(bbIdx);

      this.addLog('blinds', `${this.players[sbIdx].name} posts SB $${sbAmount}, ${this.players[bbIdx].name} posts BB $${bbAmount}`);
    } else {
      // Solo play: skip blinds, start at index 0
      this.pot = 0;
      this.currentTurnIndex = 0;
      this.lastAggressorIndex = 0;
    }

    this.onStateChange();
    this.startActionTimer();
  }

  processAction(playerId: string, action: PlayerAction, amount?: number): boolean {
    const playerIdx = this.players.findIndex(p => p.id === playerId);
    if (playerIdx === -1 || playerIdx !== this.currentTurnIndex) return false;

    const player = this.players[playerIdx];
    if (player.isFolded || player.isAllIn || this.stage === GameStage.SHOWDOWN) return false;

    this.clearActionTimer();
    player.hasActed = true;

    if (action === 'fold') {
      player.isFolded = true;
      this.addLog('action', `${player.name} folds`, player.id);
    } else if (action === 'call') {
      const callAmt = this.highestBet - player.currentBet;
      const actualBet = Math.min(player.chips, callAmt);
      player.chips -= actualBet;
      player.currentBet += actualBet;
      this.pot += actualBet;
      if (player.chips === 0) player.isAllIn = true;
      
      if (callAmt === 0) {
        this.addLog('action', `${player.name} checks`, player.id);
      } else {
        this.addLog('action', `${player.name} calls $${actualBet}`, player.id);
      }
    } else if (action === 'raise') {
      const raiseTotal = amount || (this.highestBet * 2);
      const needed = raiseTotal - player.currentBet;
      const actualBet = Math.min(player.chips, needed);
      player.chips -= actualBet;
      player.currentBet += actualBet;
      this.pot += actualBet;
      if (player.chips === 0) player.isAllIn = true;

      if (player.currentBet > this.highestBet) {
        this.highestBet = player.currentBet;
        this.lastAggressorIndex = playerIdx;
        for (let i = 0; i < this.players.length; i++) {
          if (i !== playerIdx && !this.players[i].isFolded && !this.players[i].isAllIn) {
            this.players[i].hasActed = false;
          }
        }
      }
      
      this.addLog('action', `${player.name} raises to $${player.currentBet}`, player.id);
    }

    this.onStateChange();
    this.checkRoundCompletion();
    return true;
  }

  private checkRoundCompletion(): void {
    const active = this.players.filter(p => !p.isFolded);
    if (active.length === 1) { this.handleShowdown(); return; }

    const canAct = active.filter(p => !p.isAllIn);
    const unacted = canAct.filter(p => !p.hasActed);
    const unmatched = canAct.filter(p => p.currentBet !== this.highestBet);

    if (unacted.length === 0 && unmatched.length === 0) {
      this.advanceStage();
    } else {
      this.advanceTurn();
    }
  }

  private advanceTurn(): void {
    this.currentTurnIndex = this.findNextActive(this.currentTurnIndex);
    this.onStateChange();
    this.startActionTimer();
  }

  private advanceStage(): void {
    for (const p of this.players) { p.currentBet = 0; p.hasActed = false; }
    this.highestBet = 0;
    this.lastAggressorIndex = 999;

    if (this.stage === GameStage.PREFLOP) {
      this.stage = GameStage.FLOP;
      this.communityCards = this.deck.splice(0, 3);
      this.addLog('stage', 'Flop dealt');
    } else if (this.stage === GameStage.FLOP) {
      this.stage = GameStage.TURN;
      this.communityCards.push(this.deck.splice(0, 1)[0]);
      this.addLog('stage', 'Turn dealt');
    } else if (this.stage === GameStage.TURN) {
      this.stage = GameStage.RIVER;
      this.communityCards.push(this.deck.splice(0, 1)[0]);
      this.addLog('stage', 'River dealt');
    } else if (this.stage === GameStage.RIVER) {
      this.handleShowdown();
      return;
    }

    this.currentTurnIndex = this.findNextActive(this.dealerIndex);

    const canAct = this.players.filter(p => !p.isFolded && !p.isAllIn);
    if (canAct.length <= 1) { this.runOutBoard(); return; }

    this.onStateChange();
    this.startActionTimer();
  }

  private runOutBoard(): void {
    while (this.communityCards.length < 5) {
      this.communityCards.push(this.deck.splice(0, 1)[0]);
    }
    this.stage = GameStage.RIVER;
    this.onStateChange();
    setTimeout(() => this.handleShowdown(), 1000);
  }

  private handleShowdown(): void {
    this.clearActionTimer();
    this.stage = GameStage.SHOWDOWN;
    const active = this.players.filter(p => !p.isFolded);

    if (active.length === 1) {
      const winner = active[0];
      winner.chips += this.pot;
      this.winners = [winner.id];
      this.showdownResults = [];
      this.addLog('winner', `${winner.name} wins $${this.pot} (everyone else folded)`, winner.id);
      this.onRoundEnd([winner.id], this.pot);
    } else {
      let bestScore = -1;
      let winnerIds: string[] = [];
      const playerScores = new Map<string, number>();

      for (const p of active) {
        const score = bestHandScore(p.hand, this.communityCards, this.tableConfig.variant);
        playerScores.set(p.id, score);
        if (score > bestScore) {
          bestScore = score;
          winnerIds = [p.id];
        } else if (score === bestScore) {
          winnerIds.push(p.id);
        }
      }

      const winAmount = Math.floor(this.pot / winnerIds.length);
      for (const id of winnerIds) {
        const p = this.players.find(pl => pl.id === id);
        if (p) p.chips += winAmount;
      }

      this.winners = winnerIds;

      // Build showdown results with full card data for all active players
      this.showdownResults = active.map(p => {
        const score = playerScores.get(p.id) || 0;
        return {
          playerId: p.id,
          playerName: p.name,
          cards: [...p.hand],
          handName: getHandName(score),
          isWinner: winnerIds.includes(p.id),
        };
      });

      for (const r of this.showdownResults) {
        const cards = r.cards.map(c => `${c.rank}${c.suit}`).join(' ');
        this.addLog(
          r.isWinner ? 'winner' : 'action',
          `${r.playerName}: ${cards} (${r.handName})${r.isWinner ? ' ** WINNER **' : ''}`,
          r.playerId
        );
      }

      const winnerNames = winnerIds.map(id => this.players.find(p => p.id === id)?.name).filter(Boolean).join(', ');
      const winningHandName = getHandName(bestScore);
      if (winnerIds.length === 1) {
        this.addLog('winner', `${winnerNames} wins $${winAmount} with ${winningHandName}`, winnerIds[0]);
      } else {
        this.addLog('winner', `${winnerNames} split $${this.pot} ($${winAmount} each) with ${winningHandName}`);
      }
      
      this.onRoundEnd(winnerIds, winAmount);
    }

    this.onStateChange();

    // Auto-deal after showing results (7s so players can see showdown)
    this.roundTimer = setTimeout(() => {
      this.dealerIndex = this.findNextActive(this.dealerIndex);
      this.players = this.players.filter(p => p.isConnected);

      const alive = this.players.filter(p => p.chips > 0 && p.isConnected);
      if (alive.length >= 1) {
        this.addLog('deal', 'Auto-dealing next hand...');
        this.startNewRound(); // Auto-deal instead of waiting
      } else {
        this.isPlaying = false;
        this.onStateChange();
      }
    }, 7000);
  }

  private findNextActive(fromIndex: number): number {
    let idx = (fromIndex + 1) % this.players.length;
    let guard = 0;
    while (guard < this.players.length) {
      if (!this.players[idx].isFolded && !this.players[idx].isAllIn && this.players[idx].chips > 0) return idx;
      idx = (idx + 1) % this.players.length;
      guard++;
    }
    idx = (fromIndex + 1) % this.players.length;
    guard = 0;
    while (guard < this.players.length) {
      if (!this.players[idx].isFolded) return idx;
      idx = (idx + 1) % this.players.length;
      guard++;
    }
    return 0;
  }

  // --- Public accessors ---
  getPublicPlayers(): PublicPlayer[] {
    return this.players.map(p => ({
      id: p.id, name: p.name, chips: p.chips,
      isFolded: p.isFolded, isAllIn: p.isAllIn,
      currentBet: p.currentBet, seatIndex: p.seatIndex,
      color: p.color, hasActed: p.hasActed,
      chatMessage: p.chatMessage, isReady: p.isReady,
      lookYaw: p.lookYaw, lookPitch: p.lookPitch,
      emote: p.emote as any, isSpeaking: p.isSpeaking,
    }));
  }

  getGameState(): GameStateBroadcast {
    const effectiveConfig = this.pendingConfig
      ? { ...this.tableConfig, ...this.pendingConfig }
      : this.tableConfig;
    return {
      stage: this.stage, pot: this.pot,
      communityCards: this.communityCards,
      currentTurnIndex: this.currentTurnIndex,
      dealerIndex: this.dealerIndex,
      highestBet: this.highestBet, minBet: this.minBet,
      players: this.getPublicPlayers(),
      variant: this.tableConfig.variant,
      winners: this.winners.length > 0 ? this.winners : undefined,
      showdownResults: this.showdownResults.length > 0 ? this.showdownResults : undefined,
      waitingForDeal: this.waitingForDeal,
      gameLogs: this.gameLogs.slice(-20),
      tableConfig: effectiveConfig,
    };
  }

  updateLook(playerId: string, yaw: number, pitch: number): void {
    const p = this.players.find(pl => pl.id === playerId);
    if (p) { p.lookYaw = yaw; p.lookPitch = pitch; }
  }

  setEmote(playerId: string, emote: string): void {
    const p = this.players.find(pl => pl.id === playerId);
    if (p) {
      p.emote = emote;
      setTimeout(() => { if (p.emote === emote) p.emote = undefined; }, 3000);
    }
  }

  setChatMessage(playerId: string, message: string): void {
    const p = this.players.find(pl => pl.id === playerId);
    if (p) {
      p.chatMessage = message;
      setTimeout(() => { if (p.chatMessage === message) p.chatMessage = undefined; }, 5000);
    }
  }

  setSpeaking(playerId: string, isSpeaking: boolean): void {
    const p = this.players.find(pl => pl.id === playerId);
    if (p) p.isSpeaking = isSpeaking;
  }

  // --- Rebuy ---
  rebuy(playerId: string, amount: number): { success: boolean; error?: string; message?: string } {
    const p = this.players.find(pl => pl.id === playerId);
    if (!p) return { success: false, error: 'Player not found' };
    if (p.chips > 0) return { success: false, error: 'You still have chips' };

    const chips = Math.max(this.tableConfig.minBuyIn, Math.min(this.tableConfig.maxBuyIn, amount));
    p.chips = chips;
    // Do NOT set isFolded = false here. startNewRound() already checks
    // p.isFolded = p.chips <= 0 || !p.isConnected, so the player will
    // naturally be included in the next hand once they have chips.
    this.addLog('rebuy', `${p.name} rebuys for $${chips}`, p.id);
    this.onStateChange();
    return { success: true, message: 'You will be dealt in on the next hand' };
  }

  // --- Show Cards (post-hand reveal) ---
  showCards(playerId: string): { cards: Card[]; playerName: string } | null {
    if (this.stage !== GameStage.SHOWDOWN) return null;
    const p = this.players.find(pl => pl.id === playerId);
    if (!p || p.hand.length === 0) return null;
    const cards = p.hand.map(c => `${c.rank}${c.suit}`).join(' ');
    this.addLog('show', `${p.name} shows: ${cards}`, p.id);
    return { cards: p.hand, playerName: p.name };
  }

  // --- Game Log Helpers ---
  private addLog(type: GameLogEntry['type'], message: string, playerId?: string): void {
    const log: GameLogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      type,
      message,
      playerId,
      playerColor: playerId ? this.players.find(p => p.id === playerId)?.color : undefined,
    };
    this.gameLogs.push(log);
    if (this.gameLogs.length > 50) {
      this.gameLogs.shift();
    }
    this.onLog(log);
  }

  // --- Action Timer Helpers ---
  private startActionTimer(): void {
    this.clearActionTimer();
    
    const currentPlayer = this.players[this.currentTurnIndex];
    if (!currentPlayer || currentPlayer.isFolded || currentPlayer.isAllIn) {
      return;
    }

    this.actionStartTime = Date.now();
    this.actionTimeRemaining = this.tableConfig.actionTimeout;
    
    // Broadcast timer updates every second
    this.actionTimerIntervalId = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.actionStartTime) / 1000);
      this.actionTimeRemaining = Math.max(0, this.tableConfig.actionTimeout - elapsed);
      this.onTimerUpdate(currentPlayer.id, this.actionTimeRemaining);
      
      if (this.actionTimeRemaining === 0) {
        this.clearActionTimer();
      }
    }, 1000);

    // Set timeout to auto-fold
    this.actionTimeoutId = setTimeout(() => {
      if (this.currentTurnIndex !== -1 && this.players[this.currentTurnIndex]?.id === currentPlayer.id) {
        this.addLog('timeout', `${currentPlayer.name} timed out and folded`, currentPlayer.id);
        this.processAction(currentPlayer.id, 'fold');
      }
    }, this.tableConfig.actionTimeout * 1000);
  }

  private clearActionTimer(): void {
    if (this.actionTimeoutId) {
      clearTimeout(this.actionTimeoutId);
      this.actionTimeoutId = null;
    }
    if (this.actionTimerIntervalId) {
      clearInterval(this.actionTimerIntervalId);
      this.actionTimerIntervalId = null;
    }
    this.actionTimeRemaining = 0;
  }

  cleanup(): void {
    if (this.roundTimer) clearTimeout(this.roundTimer);
    this.clearActionTimer();
  }
}
