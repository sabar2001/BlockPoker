import React, { useEffect, useState } from 'react';
import { Player, Card, GameStage, GameVariant } from '../types';
import { socketService } from '../services/socketService';
import { EmoteType } from '../shared/protocol';

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
  user, gameState, gameVariant, currentTurnIndex, players, communityCards, pot, onAction, minBet, onToggleVariant, onLeave, isLocked, isMobile
}) => {
  const isUserTurn = user && players[currentTurnIndex]?.id === user.id && !user.isFolded && gameState !== GameStage.SHOWDOWN;
  const callAmount = user ? minBet - user.currentBet : 0;

  const maxRaise = pot + (callAmount * 2);
  const raiseAmount = gameVariant === 'OMAHA' ? maxRaise : minBet * 2;
  const raiseLabel = gameVariant === 'OMAHA' ? 'POT' : 'MIN';

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

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 font-[VT323]">

      {/* Crosshair - only visible when pointer is locked */}
      {isLocked && (
        <div className="absolute top-1/2 left-1/2 w-5 h-5 -translate-x-1/2 -translate-y-1/2 z-50">
          <div className="absolute top-[9px] left-0 w-5 h-0.5 bg-green-500" />
          <div className="absolute top-0 left-[9px] w-0.5 h-5 bg-green-500" />
        </div>
      )}

      {/* Top Left: Info */}
      <div className="flex flex-col gap-1 pointer-events-auto items-start">
        <div className="bg-black/60 px-4 py-2 border-l-4 border-green-500">
          <h1 className="text-3xl text-white krunker-text tracking-widest">POKERPOV</h1>
          <div className="text-green-400 text-lg">PLAYERS: {playerCount} | {gameVariant}</div>
        </div>
        <div className="flex gap-2">
          {onLeave && (
            <button onClick={onLeave} className="bg-red-900/80 hover:bg-red-800 text-white text-sm px-3 py-1 border border-red-500">
              LEAVE TABLE
            </button>
          )}
          <button onClick={onToggleVariant} className="bg-yellow-900/80 hover:bg-yellow-800 text-white text-sm px-3 py-1 border border-yellow-500">
            SWITCH: {gameVariant === 'HOLDEM' ? 'OMAHA' : 'HOLDEM'}
          </button>
        </div>
      </div>

      {/* Top Right: Chat Feed */}
      <div className="absolute top-4 right-4 flex flex-col items-end gap-1 w-80">
        <div className="bg-black/40 p-2 w-full h-32 overflow-y-auto flex flex-col justify-end">
          {players.filter(p => p.chatMessage).map((p, i) => (
            <div key={i} className="text-white text-lg drop-shadow-md">
              <span style={{ color: p.color }}>[{p.name}]</span>: {p.chatMessage}
            </div>
          ))}
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

      {/* Bottom Center: Pot & Board */}
      <div className="absolute bottom-40 left-1/2 transform -translate-x-1/2 flex flex-col items-center">
        <div className="text-yellow-400 text-2xl mb-2 krunker-text bg-black/50 px-2">
          POT: ${pot}
        </div>
        <div className="flex gap-2 p-2 bg-black/30 rounded-lg pointer-events-auto">
          {communityCards.map((card, i) => (
            <CardDisplay key={i} card={card} size="sm" />
          ))}
          {Array.from({ length: 5 - communityCards.length }).map((_, i) => (
            <div key={i} className="w-10 h-16 bg-black/40 border-2 border-white/10" />
          ))}
        </div>
      </div>

      {/* Bottom Right: Actions */}
      <div className="absolute bottom-8 right-8 flex flex-col items-end gap-2 pointer-events-auto">
        {isUserTurn ? (
          <div className="flex flex-col gap-2 items-end">
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
              <div className="text-gray-400 mt-2">Keys 1-3: Actions | Keys 4-9: Emotes</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HUD;
