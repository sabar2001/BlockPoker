import React, { useEffect, useState } from 'react';
import { Player, Card, GameStage, GameVariant } from '../types';

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

const HUD: React.FC<HUDProps> = ({ 
    user, gameState, gameVariant, currentTurnIndex, players, communityCards, pot, onAction, minBet, onToggleVariant 
}) => {
  const isUserTurn = user && players[currentTurnIndex]?.id === user.id && !user.isFolded && gameState !== GameStage.SHOWDOWN;
  const callAmount = user ? minBet - user.currentBet : 0;
  
  const maxRaise = pot + (callAmount * 2); 
  const raiseAmount = gameVariant === 'OMAHA' ? maxRaise : minBet * 2;
  const raiseLabel = gameVariant === 'OMAHA' ? 'POT' : 'MIN';

  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const handleLockChange = () => {
        setIsLocked(!!document.pointerLockElement);
    };
    setIsLocked(!!document.pointerLockElement);
    document.addEventListener('pointerlockchange', handleLockChange);
    return () => document.removeEventListener('pointerlockchange', handleLockChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isUserTurn) return;
      switch (e.key) {
        case '1': onAction('fold'); break;
        case '2': onAction('call'); break;
        case '3': onAction('raise', raiseAmount); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUserTurn, onAction, minBet, raiseAmount]);

  if (!user) return null;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 font-[VT323]">
      
      {/* Top Left: Info */}
      <div className="flex flex-col gap-1 pointer-events-auto items-start">
         <div className="bg-black/60 px-4 py-2 border-l-4 border-green-500">
            <h1 className="text-3xl text-white krunker-text tracking-widest">BLOCKY BLUFF</h1>
            <div className="text-green-400 text-lg">FPS: 60 | PING: 12ms</div>
         </div>
         <button 
             onClick={onToggleVariant}
             className="bg-yellow-600 hover:bg-yellow-500 text-white text-lg px-3 py-1 border-2 border-black shadow-md mt-2 krunker-text"
         >
             MODE: {gameVariant}
         </button>
      </div>

      {/* Top Right: Chat Feed */}
      <div className="absolute top-4 right-4 flex flex-col items-end gap-1 w-80">
        <div className="bg-black/40 p-2 w-full h-32 overflow-y-auto flex flex-col justify-end">
            {players.filter(p => p.chatMessage).map((p, i) => (
                <div key={i} className="text-white text-lg drop-shadow-md">
                    <span style={{color: p.color}}>[{p.name}]</span>: {p.chatMessage}
                </div>
            ))}
        </div>
      </div>

      {/* Bottom Left: Health/Chips */}
      <div className="absolute bottom-8 left-8 flex flex-col gap-2">
          <div className="bg-black/70 p-4 border-l-8 border-green-500 w-64">
              <div className="text-green-400 text-sm mb-1">CHIPS / HP</div>
              <div className="text-5xl text-white krunker-text">{user.chips}</div>
              <div className="w-full bg-gray-700 h-2 mt-2">
                  <div className="bg-green-500 h-full" style={{width: `${Math.min(100, (user.chips / 1000) * 100)}%`}}></div>
              </div>
          </div>
          <div className="text-white text-2xl krunker-text drop-shadow-lg">
              BET: ${user.currentBet}
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

      {/* Bottom Right: Ammo/Actions */}
      <div className="absolute bottom-8 right-8 flex flex-col items-end gap-2 pointer-events-auto">
        {/* Weapon/Hand Cards Hidden in HUD because they are in 3D view now as "gun" */}
        
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
                WAITING FOR {players[currentTurnIndex]?.name}...
            </div>
        )}
      </div>

      {/* Click to Play Overlay */}
      {!isLocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50 pointer-events-none">
              <div className="text-center">
                  <h2 className="text-6xl text-green-500 krunker-text mb-4 animate-bounce">CLICK TO PLAY</h2>
                  <div className="text-white text-2xl">WASD not needed. Mouse to aim.</div>
                  <div className="text-gray-400 mt-2">Bluff your way to victory.</div>
              </div>
          </div>
      )}
    </div>
  );
};

export default HUD;