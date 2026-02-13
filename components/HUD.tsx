import React, { useEffect, useState, useRef } from 'react';
import { Player, Card, GameStage, GameVariant } from '../types';
import { socketService } from '../services/socketService';
import { EmoteType, GameLogEntry } from '../shared/protocol';
import SettingsModal from './SettingsModal';

interface HUDProps {
  user: Player | undefined;
  gameState: GameStage;
  gameVariant: GameVariant;
  currentTurnIndex: number;
  players: Player[];
  communityCards: Card[];
  pot: number;
  onAction: (action: 'fold' | 'call' | 'raise', amount?: number) => void;
  minBet: number;
  onToggleVariant: () => void;
  onLeave?: () => void;
  isLocked: boolean;
  isMobile?: boolean;
  roomCode: string;
  gameLogs: GameLogEntry[];
  timeRemaining: number;
  waitingForDeal: boolean;
  isHost: boolean;
}

const CardDisplay: React.FC<{ card: Card; size?: 'sm' | 'md' }> = ({ card, size = 'md' }) => {
  const isRed = card.suit === '♥' || card.suit === '♦';
  const h = size === 'sm' ? 'h-16' : 'h-24';
  const w = size === 'sm' ? 'w-10' : 'w-16';
  const textSize = size === 'sm' ? 'text-xl' : 'text-3xl';

  return (
    <div className={`${w} ${h} bg-white border-2 border-black flex flex-col items-center justify-center shadow-lg ${isRed ? 'text-red-600' : 'text-black'}`}>
      <span className={`${textSize} font-bold font-mono`}>{card.rank}{card.suit}</span>
    </div>
  );
};

const EMOTES: { key: string; emote: EmoteType; icon: string }[] = [
  { key: '4', emote: 'wave', icon: '👋' },
  { key: '5', emote: 'thumbsup', icon: '👍' },
  { key: '6', emote: 'fistslam', icon: '👊' },
  { key: '7', emote: 'laugh', icon: '😂' },
  { key: '8', emote: 'cry', icon: '😭' },
  { key: '9', emote: 'shrug', icon: '🤷' },
];

const HUD: React.FC<HUDProps> = ({
  user, gameState, gameVariant, currentTurnIndex, players, communityCards, pot, onAction, minBet, onToggleVariant, onLeave, isLocked, isMobile,
  roomCode, gameLogs, timeRemaining, waitingForDeal, isHost
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  
  const isUserTurn = user && players[currentTurnIndex]?.id === user.id && !user.isFolded && gameState !== GameStage.SHOWDOWN;
  const callAmount = user ? minBet - user.currentBet : 0;

  const maxRaise = pot + (callAmount * 2);
  const raiseAmount = gameVariant === 'OMAHA' ? maxRaise : minBet * 2;
  const raiseLabel = gameVariant === 'OMAHA' ? 'POT' : 'MIN';

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [gameLogs]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Poker actions
      if (isUserTurn) {
        switch (e.key) {
          case '1': onAction('fold'); return;
          case '2': onAction('call'); return;
          case '3': onAction('raise', raiseAmount); return;
        }
      }
      // Emotes (always available)
      const emote = EMOTES.find(em => em.key === e.key);
      if (emote) {
        socketService.sendEmote(emote.emote);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUserTurn, onAction, raiseAmount]);

  if (!user) return null;

  const playerCount = players.length;
  
  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
  };
  
  const getLogColor = (type: GameLogEntry['type']) => {
    switch (type) {
      case 'deal': return 'text-blue-400';
      case 'blinds': return 'text-blue-300';
      case 'action': return 'text-yellow-400';
      case 'stage': return 'text-green-400';
      case 'winner': return 'text-yellow-300';
      case 'timeout': return 'text-red-400';
      default: return 'text-gray-300';
    }
  };
  
  // Timer color based on time remaining
  const getTimerColor = () => {
    if (timeRemaining > 15) return 'text-green-400';
    if (timeRemaining > 5) return 'text-yellow-400';
    return 'text-red-400 animate-pulse';
  };

  return (
    <>
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 font-[VT323]">

        {/* Crosshair - only visible when pointer is locked */}
        {isLocked && (
          <div className="absolute top-1/2 left-1/2 w-5 h-5 -translate-x-1/2 -translate-y-1/2 z-50">
            <div className="absolute top-[9px] left-0 w-5 h-0.5 bg-green-500" />
            <div className="absolute top-0 left-[9px] w-0.5 h-5 bg-green-500" />
          </div>
        )}

        {/* Top Left: Info + Room Code */}
        <div className="flex flex-col gap-1 pointer-events-auto items-start" style={{ zIndex: 100 }}>
          <div className="bg-black/60 px-4 py-2 border-l-4 border-green-500">
            <h1 className="text-3xl text-white krunker-text tracking-widest">POKERPOV</h1>
            <div className="text-green-400 text-lg">PLAYERS: {playerCount} | {gameVariant}</div>
            {roomCode && (
              <div 
                className="text-yellow-300 text-xl font-mono tracking-wider cursor-pointer hover:text-yellow-200"
                onClick={copyRoomCode}
                title="Click to copy"
              >
                ROOM: {roomCode}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {onLeave && (
              <button onClick={onLeave} className="bg-red-900/80 hover:bg-red-800 text-white text-sm px-3 py-1 border border-red-500">
                LEAVE TABLE
              </button>
            )}
            {isHost && (
              <button onClick={() => setShowSettings(true)} className="bg-blue-900/80 hover:bg-blue-800 text-white text-sm px-3 py-1 border border-blue-500">
                ⚙️ SETTINGS
              </button>
            )}
          </div>
        </div>

        {/* Top Right: Game Log Feed */}
        <div className="absolute top-4 right-4 w-96 pointer-events-auto" style={{ zIndex: 100 }}>
          <div className="bg-black/60 border-l-4 border-yellow-500 p-3">
            <div className="text-yellow-400 text-xl mb-2 krunker-text">GAME LOG</div>
            <div ref={logRef} className="h-48 overflow-y-auto space-y-1">
              {gameLogs.slice(-20).map((log) => (
                <div key={log.id} className={`text-sm ${getLogColor(log.type)}`}>
                  {log.message}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Left: Chips */}
        <div className="absolute bottom-8 left-8 flex flex-col gap-2">
          <div className="bg-black/70 p-4 border-l-8 border-green-500 w-64">
            <div className="text-green-400 text-sm mb-1">CHIPS</div>
            <div className="text-5xl text-white krunker-text">{user.chips}</div>
          </div>
          <div className="text-white text-2xl krunker-text drop-shadow-lg">
            BET: ${user.currentBet}
          </div>
          {/* Emote bar */}
          <div className="flex gap-1 mt-2">
            {EMOTES.map(em => (
              <button key={em.key} onClick={() => socketService.sendEmote(em.emote)}
                className="pointer-events-auto bg-black/50 hover:bg-black/80 border border-gray-700 w-8 h-8 flex items-center justify-center text-sm"
                title={`[${em.key}] ${em.emote}`}>
                {em.icon}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Center: Pot, Board, and Deal Button */}
        <div className="absolute bottom-40 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-3" style={{ zIndex: 100 }}>
          <div className="text-yellow-400 text-2xl mb-2 krunker-text bg-black/50 px-2 pointer-events-none">
            POT: ${pot}
          </div>
          
          {/* Deal Button - only for host when waiting - HIGH Z-INDEX */}
          {isHost && waitingForDeal && (
            <button
              onClick={() => socketService.dealNextRound()}
              className="pointer-events-auto bg-green-900/90 hover:bg-green-800 text-white text-3xl px-8 py-4 border-4 border-green-500 animate-pulse krunker-text shadow-xl"
            >
              DEAL NEXT HAND
            </button>
          )}
          
          <div className="flex gap-2 p-2 bg-black/30 rounded-lg pointer-events-none">
            {communityCards.map((card, i) => (
              <CardDisplay key={i} card={card} size="sm" />
            ))}
            {Array.from({ length: 5 - communityCards.length }).map((_, i) => (
              <div key={i} className="w-10 h-16 bg-black/40 border-2 border-white/10" />
            ))}
          </div>
        </div>

        {/* Bottom Right: Actions + Timer */}
        <div className="absolute bottom-8 right-8 flex flex-col items-end gap-2 pointer-events-auto">
          {isUserTurn ? (
            <div className="flex flex-col gap-2 items-end">
              {/* Timer Display */}
              {timeRemaining > 0 && (
                <div className={`text-6xl font-bold ${getTimerColor()} krunker-text`}>
                  {timeRemaining}s
                </div>
              )}
              <div className="text-white text-xl animate-pulse">YOUR TURN</div>
              <button onClick={() => onAction('fold')} className="bg-red-900/90 text-red-100 border-2 border-red-500 px-6 py-2 text-2xl hover:bg-red-800 w-48 text-right">
                [1] FOLD
              </button>
              <button onClick={() => onAction('call')} className="bg-blue-900/90 text-blue-100 border-2 border-blue-500 px-6 py-2 text-2xl hover:bg-blue-800 w-48 text-right">
                [2] {callAmount > 0 ? `CALL ${callAmount}` : 'CHECK'}
              </button>
              <button onClick={() => onAction('raise', raiseAmount)} className="bg-yellow-900/90 text-yellow-100 border-2 border-yellow-500 px-6 py-2 text-2xl hover:bg-yellow-800 w-48 text-right">
                [3] {raiseLabel}
              </button>
            </div>
          ) : (
            <div className="bg-black/70 px-4 py-2 text-gray-400 text-xl border-r-4 border-gray-500">
              WAITING FOR {players[currentTurnIndex]?.name || '...'}
            </div>
          )}
        </div>

        {/* Click to Play Overlay */}
        {!isLocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50 pointer-events-none">
            <div className="text-center">
              <h2 className="text-6xl text-green-500 krunker-text mb-4 animate-bounce">CLICK TO PLAY</h2>
              <div className="text-white text-2xl">Click the screen to lock pointer</div>
              {!isMobile && (
                <>
                  <div className="text-gray-400 mt-2">Keys 1-3: Actions | Keys 4-9: Emotes</div>
                  <div className="text-yellow-400 mt-3 text-xl">Press ESC to unlock and access UI</div>
                </>
              )}
            </div>
          </div>
        )}
        
        {/* Hint when locked */}
        {isLocked && !isMobile && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center pointer-events-none" style={{ zIndex: 60 }}>
            <div className="bg-black/60 px-4 py-2 text-yellow-400 text-lg border border-yellow-500">
              Press ESC to unlock pointer and access buttons
            </div>
          </div>
        )}
      </div>
      
      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        currentConfig={{
          smallBlind: 10,
          bigBlind: 20,
          minBuyIn: 200,
          maxBuyIn: 5000,
          actionTimeout: 30,
          variant: gameVariant,
        }}
        isPlaying={gameState !== GameStage.SHOWDOWN && players.some(p => !p.isFolded)}
      />
    </>
  );
};

export default HUD;
