import React, { useState, useRef } from 'react';
import { socketService } from '../services/socketService';
import { EmoteType } from '../shared/protocol';

interface MobileControlsProps {
  onAction: (action: 'fold' | 'call' | 'raise', amount?: number) => void;
  isUserTurn: boolean;
  callAmount: number;
  raiseAmount: number;
  raiseLabel: string;
  onCameraRotate: (yaw: number, pitch: number) => void;
  timeRemaining?: number;
  waitingForDeal?: boolean;
  isHost?: boolean;
  roomCode?: string;
  chips?: number;
  pot?: number;
}

const EMOTES: { emote: EmoteType; icon: string }[] = [
  { emote: 'wave', icon: '👋' },
  { emote: 'thumbsup', icon: '👍' },
  { emote: 'fistslam', icon: '👊' },
  { emote: 'laugh', icon: '😂' },
  { emote: 'cry', icon: '😭' },
  { emote: 'shrug', icon: '🤷' },
];

export const MobileControls: React.FC<MobileControlsProps> = ({
  onAction, isUserTurn, callAmount, raiseAmount, raiseLabel, onCameraRotate,
  timeRemaining = 0, waitingForDeal = false, isHost = false, roomCode = '', chips = 0, pot = 0
}) => {
  const [startTouch, setStartTouch] = useState<{ x: number; y: number } | null>(null);
  const rotation = useRef({ yaw: 0, pitch: -0.3 }); // Initialize with correct starting pitch
  
  // Initialize camera rotation on mount (only once)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    console.log('[MobileControls] Mounted, initializing camera rotation');
    onCameraRotate(0, -0.3);
  }, []); // Empty deps - only run once on mount

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      setStartTouch({ x: touch.clientX, y: touch.clientY });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!startTouch || e.touches.length === 0) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - startTouch.x;
    const deltaY = touch.clientY - startTouch.y;
    
    const sensitivity = 0.003;
    rotation.current.yaw += deltaX * sensitivity;
    rotation.current.pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, rotation.current.pitch - deltaY * sensitivity));
    
    onCameraRotate(rotation.current.yaw, rotation.current.pitch);
    socketService.sendLook(rotation.current.yaw, rotation.current.pitch);
    
    setStartTouch({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = () => {
    setStartTouch(null);
  };
  
  const getTimerColor = () => {
    if (timeRemaining > 15) return 'text-green-400';
    if (timeRemaining > 5) return 'text-yellow-400';
    return 'text-red-400 animate-pulse';
  };

  return (
    <>
      {/* Touch Camera Control Area - covers most of screen */}
      <div 
        className="absolute inset-0"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ 
          zIndex: 1,
          touchAction: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
        }}
      />
      
      {/* Top HUD Info */}
      <div className="absolute top-4 left-4 right-4 flex justify-between pointer-events-none font-[VT323]" style={{ zIndex: 40 }}>
        <div className="bg-black/70 px-3 py-2 border-l-4 border-green-500">
          {roomCode && (
            <div className="text-yellow-300 text-lg font-mono">ROOM: {roomCode}</div>
          )}
          <div className="text-white text-xl">CHIPS: ${chips}</div>
        </div>
        <div className="bg-black/70 px-3 py-2 border-r-4 border-yellow-500">
          <div className="text-yellow-400 text-xl">POT: ${pot}</div>
        </div>
      </div>
      
      {/* Timer Display - Top Center */}
      {isUserTurn && timeRemaining > 0 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2" style={{ zIndex: 45 }}>
          <div className={`text-6xl font-bold ${getTimerColor()} font-[VT323] bg-black/70 px-6 py-2 rounded-lg`}>
            {timeRemaining}s
          </div>
        </div>
      )}
      
      {/* Deal Button - Center when waiting */}
      {isHost && waitingForDeal && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto" style={{ zIndex: 60 }}>
          <button
            onClick={() => socketService.dealNextRound()}
            onTouchStart={(e) => { e.stopPropagation(); socketService.dealNextRound(); }}
            className="bg-green-900 text-white text-3xl px-12 py-6 rounded-lg border-4 border-green-500 active:bg-green-800 font-[VT323] animate-pulse"
          >
            DEAL NEXT HAND
          </button>
        </div>
      )}
      
      {/* Action Buttons - Bottom right, thumb-friendly zone */}
      {isUserTurn && (
        <div className="absolute bottom-4 right-4 flex flex-col gap-3" style={{ zIndex: 50 }}>
          <button 
            onClick={() => onAction('fold')}
            onTouchStart={(e) => { e.stopPropagation(); onAction('fold'); }}
            className="bg-red-900 text-white text-xl px-8 py-4 rounded-lg border-2 border-red-500 active:bg-red-800 min-w-[120px] min-h-[60px] font-[VT323]">
            FOLD
          </button>
          <button 
            onClick={() => onAction('call')}
            onTouchStart={(e) => { e.stopPropagation(); onAction('call'); }}
            className="bg-blue-900 text-white text-xl px-8 py-4 rounded-lg border-2 border-blue-500 active:bg-blue-800 min-w-[120px] min-h-[60px] font-[VT323]">
            {callAmount > 0 ? `CALL ${callAmount}` : 'CHECK'}
          </button>
          <button 
            onClick={() => onAction('raise', raiseAmount)}
            onTouchStart={(e) => { e.stopPropagation(); onAction('raise', raiseAmount); }}
            className="bg-yellow-900 text-white text-xl px-8 py-4 rounded-lg border-2 border-yellow-500 active:bg-yellow-800 min-w-[120px] min-h-[60px] font-[VT323]">
            {raiseLabel}
          </button>
        </div>
      )}

      {/* Emote Bar - Bottom left */}
      <div className="absolute bottom-4 left-4 flex gap-2" style={{ zIndex: 50 }}>
        {EMOTES.map((em, idx) => (
          <button 
            key={idx}
            onClick={() => socketService.sendEmote(em.emote)}
            onTouchStart={(e) => { e.stopPropagation(); socketService.sendEmote(em.emote); }}
            className="bg-black/70 hover:bg-black/90 active:bg-black border border-gray-600 w-12 h-12 flex items-center justify-center text-2xl rounded"
            title={em.emote}>
            {em.icon}
          </button>
        ))}
      </div>

      {/* Mobile Start Overlay */}
      {!isUserTurn && !waitingForDeal && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none" style={{ zIndex: 2 }}>
          <div className="text-white text-lg bg-black/50 px-4 py-2 rounded">
            Swipe to look around
          </div>
        </div>
      )}
    </>
  );
};
