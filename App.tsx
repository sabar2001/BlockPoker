import React, { useState, useEffect, useCallback } from 'react';
import { socketService } from './services/socketService';
import { voiceService } from './services/voiceService';
import { GameStateBroadcast, HandDeal, PublicPlayer, Card as ProtoCard, GameStage as ProtoGameStage } from './shared/protocol';
import { PLAYER_POSITIONS } from './constants';
import { Player, GameStage, Card } from './types';
import GameScene from './components/GameScene';
import HUD from './components/HUD';
import Lobby from './components/Lobby';
import { MobileControls } from './components/MobileControls';
import { isMobileDevice } from './utils/deviceDetection';

// Convert server player data to client Player type
function toClientPlayer(p: PublicPlayer): Player {
  const pos = PLAYER_POSITIONS[p.seatIndex] || PLAYER_POSITIONS[0];
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
  const [myHand, setMyHand] = useState<Card[]>([]);
  const [communityCards, setCommunityCards] = useState<Card[]>([]);
  const [pot, setPot] = useState(0);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [gameStage, setGameStage] = useState<GameStage>(GameStage.PREFLOP);
  const [gameVariant, setGameVariant] = useState<'HOLDEM' | 'OMAHA'>('HOLDEM');
  const [highestBet, setHighestBet] = useState(0);
  const [winners, setWinners] = useState<string[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [isMobile] = useState(() => isMobileDevice());
  const [cameraRotation, setCameraRotation] = useState({ yaw: 0, pitch: -0.3 }); // Start looking slightly down at table

  // Subscribe to server events
  useEffect(() => {
    const unsubs = [
      socketService.on('game:state', (state: GameStateBroadcast) => {
        const clientPlayers = state.players.map(toClientPlayer);

        // Inject our hand into our player
        const myId = socketService.id;
        const meIdx = clientPlayers.findIndex(p => p.id === myId);
        if (meIdx !== -1) {
          clientPlayers[meIdx].hand = myHand;
        }

        setPlayers(clientPlayers);
        setCommunityCards(state.communityCards.map(toClientCard));
        setPot(state.pot);
        setCurrentTurnIndex(state.currentTurnIndex);
        setGameStage(state.stage as number as GameStage);
        setGameVariant(state.variant);
        setHighestBet(state.highestBet);
        setWinners(state.winners || []);
      }),

      socketService.on('game:hand', (hand: HandDeal) => {
        const cards = hand.cards.map(toClientCard);
        setMyHand(cards);
      }),

      socketService.on('game:new-round', () => {
        setMyHand([]);
        setWinners([]);
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
  }, [myHand]);

  // Also update our hand in the players array when myHand changes
  useEffect(() => {
    if (myHand.length > 0) {
      setPlayers(prev => prev.map(p =>
        p.id === socketService.id ? { ...p, hand: myHand } : p
      ));
    }
  }, [myHand]);

  const handleGameStart = useCallback(async () => {
    setScreen('game');
    // Initialize voice chat
    try {
      await voiceService.init();
    } catch (e) {
      console.warn('Voice chat init failed:', e);
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
  }, []);

  if (screen === 'lobby') {
    return <Lobby onGameStart={handleGameStart} />;
  }

  // Find the current user
  const myId = socketService.id;
  const me = players.find(p => p.id === myId);

  const isUserTurn = me && players[currentTurnIndex]?.id === me.id && !me.isFolded && gameStage !== GameStage.SHOWDOWN;
  const callAmount = me ? highestBet - me.currentBet : 0;
  const maxRaise = pot + (callAmount * 2);
  const raiseAmount = gameVariant === 'OMAHA' ? maxRaise : highestBet * 2;
  const raiseLabel = gameVariant === 'OMAHA' ? 'POT' : 'MIN';

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
      />

      {isMobile ? (
        <MobileControls
          onAction={handleUserAction}
          isUserTurn={!!isUserTurn}
          callAmount={callAmount}
          raiseAmount={raiseAmount}
          raiseLabel={raiseLabel}
          onCameraRotate={handleCameraRotate}
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
          onToggleVariant={handleToggleVariant}
          onLeave={() => { socketService.leaveRoom(); setScreen('lobby'); }}
          isLocked={isLocked}
        />
      )}
    </div>
  );
};

export default App;
