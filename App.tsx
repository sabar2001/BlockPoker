import React, { useState, useEffect, useCallback, useRef } from 'react';
import { socketService } from './services/socketService';
import { voiceService } from './services/voiceService';
import { soundService } from './services/soundService';
import { GameStateBroadcast, HandDeal, PublicPlayer, Card as ProtoCard, GameStage as ProtoGameStage, GameLogEntry, TableConfig, DEFAULT_TABLE_CONFIG, PlayerLedgerEntry } from './shared/protocol';
import { PLAYER_POSITIONS } from './constants';
import { Player, GameStage, Card, ShowdownPlayerResult } from './types';
import GameScene from './components/GameScene';
import HUD from './components/HUD';
import Lobby from './components/Lobby';
import { MobileControls } from './components/MobileControls';
import { isMobileDevice } from './utils/deviceDetection';

// Convert server player data to client Player type
// mySeatIndex is used to rotate positions so the current user always sits at PLAYER_POSITIONS[0]
function toClientPlayer(p: PublicPlayer, mySeatIndex: number): Player {
  const effectiveIndex = (p.seatIndex - mySeatIndex + 9) % 9;
  const pos = PLAYER_POSITIONS[effectiveIndex] || PLAYER_POSITIONS[0];
  return {
    id: p.id,
    name: p.name,
    chips: p.chips,
    hand: [],
    isBot: false,
    isFolded: p.isFolded,
    isAllIn: p.isAllIn,
    currentBet: p.currentBet,
    position: pos as [number, number, number],
    color: p.color,
    hasActed: p.hasActed,
    chatMessage: p.chatMessage,
    lookYaw: p.lookYaw,
    lookPitch: p.lookPitch,
    isSpeaking: p.isSpeaking,
    emote: p.emote,
    isReady: p.isReady,
  };
}

function toClientCard(c: ProtoCard): Card {
  return { suit: c.suit as any, rank: c.rank as any, value: c.value };
}

type AppScreen = 'lobby' | 'game';

const App: React.FC = () => {
  const [screen, setScreen] = useState<AppScreen>('lobby');
  const [players, setPlayers] = useState<Player[]>([]);
  const playersRef = useRef<Player[]>([]);
  const [myHand, setMyHand] = useState<Card[]>([]);
  const myHandRef = useRef<Card[]>([]);
  const [communityCards, setCommunityCards] = useState<Card[]>([]);
  const [pot, setPot] = useState(0);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [gameStage, setGameStage] = useState<GameStage>(GameStage.PREFLOP);
  const [gameVariant, setGameVariant] = useState<'HOLDEM' | 'OMAHA'>('HOLDEM');
  const [highestBet, setHighestBet] = useState(0);
  const [bigBlind, setBigBlind] = useState(20);
  const [winners, setWinners] = useState<string[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [isMobile] = useState(() => isMobileDevice());
  const [cameraRotation, setCameraRotation] = useState({ yaw: 0, pitch: -0.3 });
  
  // New state for game UI improvements
  const [tableConfig, setTableConfig] = useState<TableConfig>(DEFAULT_TABLE_CONFIG);
  const [gameLogs, setGameLogs] = useState<GameLogEntry[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [currentTimerPlayerId, setCurrentTimerPlayerId] = useState<string>('');
  const [waitingForDeal, setWaitingForDeal] = useState(false);
  const [roomCode, setRoomCode] = useState<string>('');
  const [hostId, setHostId] = useState<string>(''); // Track who is the host
  const [revealedCards, setRevealedCards] = useState<Map<string, Card[]>>(new Map());
  const [showdownResults, setShowdownResults] = useState<ShowdownPlayerResult[]>([]);
  const [sidePots, setSidePots] = useState<{ amount: number; label: string }[]>([]);
  const [ledger, setLedger] = useState<PlayerLedgerEntry[]>([]);

  // Refs for tracking state changes to trigger sounds
  const prevCommunityCountRef = useRef(0);
  const prevTurnPlayerIdRef = useRef<string | null>(null);

  // Subscribe to server events
  useEffect(() => {
    const unsubs = [
      socketService.on('game:state', (state: GameStateBroadcast) => {
        // Find my seat index to rotate positions so I'm always at seat 0
        const myId = socketService.id;
        const myServerPlayer = state.players.find(p => p.id === myId);
        const mySeatIndex = myServerPlayer?.seatIndex ?? 0;

        const clientPlayers = state.players.map(p => toClientPlayer(p, mySeatIndex));

        // Inject our hand into our player using ref (avoids stale closure)
        const meIdx = clientPlayers.findIndex(p => p.id === myId);
        if (meIdx !== -1) {
          clientPlayers[meIdx].hand = myHandRef.current;
        }

        // Sound: community card revealed
        if (state.communityCards.length > prevCommunityCountRef.current) {
          soundService.playCardFlip();
        }
        prevCommunityCountRef.current = state.communityCards.length;

        // Sound: it's now your turn
        const currentTurnPlayer = state.players[state.currentTurnIndex];
        if (currentTurnPlayer && currentTurnPlayer.id === myId && prevTurnPlayerIdRef.current !== myId) {
          soundService.playYourTurn();
        }
        prevTurnPlayerIdRef.current = currentTurnPlayer?.id ?? null;

        setPlayers(clientPlayers);
        setCommunityCards(state.communityCards.map(toClientCard));
        setPot(state.pot);
        setCurrentTurnIndex(state.currentTurnIndex);
        setGameStage(state.stage as number as GameStage);
        setGameVariant(state.variant);
        setHighestBet(state.highestBet);
        setBigBlind(state.minBet || 20);
        setWinners(state.winners || []);
        if (state.showdownResults) {
          setShowdownResults(state.showdownResults.map(r => ({
            ...r,
            cards: r.cards.map(toClientCard),
          })));
        }
        setWaitingForDeal(state.waitingForDeal || false);
        if (state.sidePots && state.sidePots.length > 1) {
          setSidePots(state.sidePots.map(sp => ({ amount: sp.amount, label: sp.label })));
        } else {
          setSidePots([]);
        }
        if (state.tableConfig) {
          setTableConfig(state.tableConfig);
        }
        if (state.gameLogs) {
          setGameLogs(state.gameLogs);
        }
        if (state.ledger) {
          setLedger(state.ledger);
        }
      }),

      socketService.on('game:round-end', (data: { winners: string[]; winAmount: number }) => {
        // Sound: win celebration if we're a winner
        if (data.winners.includes(socketService.id || '')) {
          soundService.playWin();
        }
      }),

      socketService.on('game:hand', (hand: HandDeal) => {
        const cards = hand.cards.map(toClientCard);
        setMyHand(cards);
        soundService.playDeal();
      }),

      socketService.on('game:new-round', () => {
        setMyHand([]);
        setWinners([]);
        setShowdownResults([]);
        setRevealedCards(new Map());
        setSidePots([]);
        soundService.playNewRound();
      }),

      socketService.on('game:timer-update', (data: { playerId: string; timeRemaining: number }) => {
        setCurrentTimerPlayerId(data.playerId);
        setTimeRemaining(data.timeRemaining);
        // Tick sound when timer is low and it's your turn
        if (data.timeRemaining <= 5 && data.timeRemaining > 0 && data.playerId === socketService.id) {
          soundService.playTick();
        }
      }),

      socketService.on('game:log', (log: GameLogEntry) => {
        setGameLogs(prev => [...prev, log].slice(-50)); // Keep last 50
      }),

      socketService.on('game:cards-revealed', (data: { playerId: string; playerName: string; cards: ProtoCard[] }) => {
        setRevealedCards(prev => {
          const next = new Map(prev);
          next.set(data.playerId, data.cards.map(toClientCard));
          return next;
        });
      }),

      socketService.on('room:state', (state) => {
        setRoomCode(state.roomCode);
        setHostId(state.hostId);
      }),

      socketService.on('player:look-update', (data: { playerId: string; yaw: number; pitch: number }) => {
        setPlayers(prev => prev.map(p =>
          p.id === data.playerId ? { ...p, lookYaw: data.yaw, lookPitch: data.pitch } : p
        ));
      }),

      socketService.on('player:emote-update', (data: { playerId: string; emote: string }) => {
        setPlayers(prev => prev.map(p =>
          p.id === data.playerId ? { ...p, emote: data.emote } : p
        ));
        // Clear emote after 3s
        setTimeout(() => {
          setPlayers(prev => prev.map(p =>
            p.id === data.playerId && p.emote === data.emote ? { ...p, emote: undefined } : p
          ));
        }, 3000);
      }),

      socketService.on('player:chat-update', (data: { playerId: string; message: string }) => {
        setPlayers(prev => prev.map(p =>
          p.id === data.playerId ? { ...p, chatMessage: data.message } : p
        ));
        setTimeout(() => {
          setPlayers(prev => prev.map(p =>
            p.id === data.playerId && p.chatMessage === data.message ? { ...p, chatMessage: undefined } : p
          ));
        }, 5000);
      }),

      socketService.on('voice:speaking-update', (data: { playerId: string; isSpeaking: boolean }) => {
        setPlayers(prev => prev.map(p =>
          p.id === data.playerId ? { ...p, isSpeaking: data.isSpeaking } : p
        ));
      }),

      // Voice peer connections: connect to new players, disconnect from leaving ones
      socketService.on('room:player-joined', (p: PublicPlayer) => {
        if (p.id !== socketService.id && voiceService.isActive) {
          voiceService.connectToPeer(p.id);
        }
      }),

      socketService.on('room:player-left', (data: { playerId: string }) => {
        voiceService.disconnectPeer(data.playerId);
      }),
    ];

    return () => unsubs.forEach(u => u());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Subscribe once - myHand accessed via ref

  // Keep refs in sync and inject hand into players array
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    myHandRef.current = myHand;
    if (myHand.length > 0) {
      setPlayers(prev => prev.map(p =>
        p.id === socketService.id ? { ...p, hand: myHand } : p
      ));
    }
  }, [myHand]);

  const handleGameStart = useCallback(async () => {
    setScreen('game');
    // Unlock audio context on user gesture (required for mobile browsers)
    soundService.unlock();
    // Initialize voice chat (non-blocking - never use alert() which freezes rendering)
    try {
      await voiceService.init();
      console.log('[App] Voice service initialized successfully');
      // Connect to all existing players in the room (not just future joiners)
      const myId = socketService.id;
      for (const p of playersRef.current) {
        if (p.id !== myId) {
          console.log('[App] Connecting voice to existing player:', p.name);
          voiceService.connectToPeer(p.id);
        }
      }
    } catch (e) {
      console.warn('[App] Voice chat initialization failed:', e);
      // Voice disabled but game continues - no alert() to avoid blocking Canvas render
    }
  }, []);

  const handleUserAction = useCallback((action: 'fold' | 'call' | 'raise', amount?: number) => {
    socketService.sendAction(action, amount);
  }, []);

  const handleToggleVariant = useCallback(() => {
    const newVariant = gameVariant === 'HOLDEM' ? 'OMAHA' : 'HOLDEM';
    socketService.updateSettings({ variant: newVariant });
  }, [gameVariant]);

  const handleCameraRotate = useCallback((yaw: number, pitch: number) => {
    setCameraRotation({ yaw, pitch });
  }, []); // Empty deps - this callback is stable

  // Called from CameraPositioner when it computes the initial yaw for the player's seat
  const handleInitialYaw = useCallback((yaw: number) => {
    setCameraRotation(prev => ({ ...prev, yaw }));
  }, []);

  if (screen === 'lobby') {
    return <Lobby onGameStart={handleGameStart} />;
  }

  // Find the current user
  const myId = socketService.id;
  const me = players.find(p => p.id === myId);

  // Show loading state if game screen but no players yet
  if (screen === 'game' && players.length === 0) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-xl">Loading game state...</div>
      </div>
    );
  }

  const isUserTurn = me && players[currentTurnIndex]?.id === me.id && !me.isFolded && gameStage !== GameStage.SHOWDOWN;
  const callAmount = me ? highestBet - me.currentBet : 0;
  const maxRaise = pot + (callAmount * 2);
  const raiseAmount = gameVariant === 'OMAHA' ? maxRaise : highestBet * 2;
  const raiseLabel = gameVariant === 'OMAHA' ? 'POT' : 'MIN';
  
  // Check if current user is host
  const isHost = myId === hostId;
  
  console.log('[App] Render state:', { screen, isMobile, myId, hostId, isHost, playersCount: players.length });

  return (
    <div className="w-full h-full relative">
      <GameScene
        players={players}
        communityCards={communityCards}
        pot={pot}
        currentTurnIndex={currentTurnIndex}
        myId={myId}
        onLockChange={setIsLocked}
        isMobile={isMobile}
        cameraRotation={cameraRotation}
        onInitialYaw={handleInitialYaw}
        gameStage={gameStage}
      />

      {isMobile ? (
        <MobileControls
          onAction={handleUserAction}
          isUserTurn={!!isUserTurn}
          callAmount={callAmount}
          raiseAmount={raiseAmount}
          raiseLabel={raiseLabel}
          onCameraRotate={handleCameraRotate}
          timeRemaining={isUserTurn && currentTimerPlayerId === myId ? timeRemaining : 0}
          waitingForDeal={waitingForDeal}
          isHost={isHost}
          roomCode={roomCode}
          chips={me?.chips || 0}
          pot={pot}
          myHand={myHand}
          communityCards={communityCards}
          isFolded={me?.isFolded || false}
          highestBet={highestBet}
          currentBet={me?.currentBet || 0}
          bigBlind={bigBlind}
          gameStage={gameStage}
          gameVariant={gameVariant}
          showdownResults={showdownResults}
          revealedCards={revealedCards}
          ledger={ledger}
        />
      ) : (
        <HUD
          user={me}
          gameState={gameStage}
          gameVariant={gameVariant}
          currentTurnIndex={currentTurnIndex}
          players={players}
          communityCards={communityCards}
          pot={pot}
          onAction={handleUserAction}
          minBet={highestBet}
          bigBlind={bigBlind}
          onToggleVariant={handleToggleVariant}
          onLeave={() => { socketService.leaveRoom(); setScreen('lobby'); }}
          isLocked={isLocked}
          roomCode={roomCode}
          gameLogs={gameLogs}
          timeRemaining={isUserTurn && currentTimerPlayerId === myId ? timeRemaining : 0}
          waitingForDeal={waitingForDeal}
          isHost={isHost}
          myHand={myHand}
          revealedCards={revealedCards}
          showdownResults={showdownResults}
          tableConfig={tableConfig}
          sidePots={sidePots}
          ledger={ledger}
        />
      )}
    </div>
  );
};

export default App;
