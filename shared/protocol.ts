// Shared types between client and server for the Socket.io protocol

export interface Card {
  suit: string;
  rank: string;
  value: number;
}

export type GameVariant = 'HOLDEM' | 'OMAHA';

export enum GameStage {
  PREFLOP = 0,
  FLOP = 1,
  TURN = 2,
  RIVER = 3,
  SHOWDOWN = 4,
}

export type PlayerAction = 'fold' | 'call' | 'raise';

export type EmoteType = 'wave' | 'thumbsup' | 'fistslam' | 'laugh' | 'cry' | 'shrug';

// Table stakes configuration
export interface TableConfig {
  minBuyIn: number;    // minimum chips to sit
  maxBuyIn: number;    // maximum chips to sit
  smallBlind: number;
  bigBlind: number;
  variant: GameVariant;
  actionTimeout: number; // seconds per action (5-120)
}

export const DEFAULT_TABLE_CONFIG: TableConfig = {
  minBuyIn: 200,
  maxBuyIn: 5000,
  smallBlind: 10,
  bigBlind: 20,
  variant: 'HOLDEM',
  actionTimeout: 30,
};

// Game log entry
export type GameLogType = 'deal' | 'action' | 'stage' | 'winner' | 'blinds' | 'timeout' | 'rebuy' | 'show';

export interface GameLogEntry {
  id: string;
  timestamp: number;
  type: GameLogType;
  message: string;
  playerId?: string;
  playerColor?: string;
}

// Public player data (visible to everyone)
export interface PublicPlayer {
  id: string;
  name: string;
  chips: number;
  isFolded: boolean;
  isAllIn: boolean;
  currentBet: number;
  seatIndex: number;
  color: string;
  hasActed: boolean;
  chatMessage?: string;
  isReady: boolean;
  // Real-time look direction
  lookYaw: number;
  lookPitch: number;
  // Active emote
  emote?: EmoteType;
  // Voice activity
  isSpeaking: boolean;
}

// Room status
export type RoomStatus = 'waiting' | 'playing' | 'between_rounds';

export interface RoomState {
  roomCode: string;
  status: RoomStatus;
  players: PublicPlayer[];
  hostId: string;
  tableConfig: TableConfig;
  maxPlayers: number;
}

// Game state broadcast to all players
export interface GameStateBroadcast {
  stage: GameStage;
  pot: number;
  communityCards: Card[];
  currentTurnIndex: number;
  dealerIndex: number;
  highestBet: number;
  minBet: number;
  players: PublicPlayer[];
  variant: GameVariant;
  winners?: string[]; // player IDs
  waitingForDeal?: boolean; // true when host needs to click deal
  gameLogs?: GameLogEntry[]; // recent game logs
}

// Private hand dealt to a specific player
export interface HandDeal {
  cards: Card[];
}

// --- Socket.io Event Types ---

// Client -> Server events
export interface ClientToServerEvents {
  // Room management
  'room:create': (data: { playerName: string; buyIn: number; tableConfig?: Partial<TableConfig> }, callback: (response: { success: boolean; roomCode?: string; error?: string }) => void) => void;
  'room:join': (data: { roomCode: string; playerName: string; buyIn: number }, callback: (response: { success: boolean; error?: string }) => void) => void;
  'room:leave': () => void;
  'room:ready': (data: { ready: boolean }) => void;
  'room:settings': (data: { tableConfig?: Partial<TableConfig> }) => void;

  // Game actions
  'game:start': () => void;
  'game:action': (data: { action: PlayerAction; amount?: number }) => void;
  'game:deal': () => void; // host triggers next round
  'game:rebuy': (data: { amount: number }, callback: (response: { success: boolean; error?: string }) => void) => void;
  'game:show-cards': () => void;

  // Real-time interaction
  'player:look': (data: { yaw: number; pitch: number }) => void;
  'player:emote': (data: { emote: EmoteType }) => void;
  'player:chat': (data: { message: string }) => void;

  // Voice signaling
  'voice:offer': (data: { to: string; sdp: RTCSessionDescriptionInit }) => void;
  'voice:answer': (data: { to: string; sdp: RTCSessionDescriptionInit }) => void;
  'voice:ice-candidate': (data: { to: string; candidate: RTCIceCandidateInit }) => void;
  'voice:speaking': (data: { isSpeaking: boolean }) => void;
}

// Server -> Client events
export interface ServerToClientEvents {
  // Room events
  'room:state': (state: RoomState) => void;
  'room:player-joined': (player: PublicPlayer) => void;
  'room:player-left': (data: { playerId: string }) => void;
  'room:error': (data: { message: string }) => void;

  // Game events
  'game:state': (state: GameStateBroadcast) => void;
  'game:hand': (hand: HandDeal) => void;
  'game:round-end': (data: { winners: string[]; winAmount: number }) => void;
  'game:new-round': () => void;
  'game:timer-update': (data: { playerId: string; timeRemaining: number }) => void;
  'game:log': (log: GameLogEntry) => void;
  'game:cards-revealed': (data: { playerId: string; playerName: string; cards: Card[] }) => void;

  // Real-time interaction
  'player:look-update': (data: { playerId: string; yaw: number; pitch: number }) => void;
  'player:emote-update': (data: { playerId: string; emote: EmoteType }) => void;
  'player:chat-update': (data: { playerId: string; message: string }) => void;

  // Voice signaling
  'voice:offer': (data: { from: string; sdp: RTCSessionDescriptionInit }) => void;
  'voice:answer': (data: { from: string; sdp: RTCSessionDescriptionInit }) => void;
  'voice:ice-candidate': (data: { from: string; candidate: RTCIceCandidateInit }) => void;
  'voice:speaking-update': (data: { playerId: string; isSpeaking: boolean }) => void;
}
