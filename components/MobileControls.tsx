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
  onAction, isUserTurn, callAmount, raiseAmount, raiseLabel, onCameraRotate
}) => {
  const [startTouch, setStartTouch] = useState<{ x: number; y: number } | null>(null);
  const rotation = useRef({ yaw: 0, pitch: 0 });

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
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none" style={{ zIndex: 2 }}>
        <div className="text-white text-lg bg-black/50 px-4 py-2 rounded">
          Swipe to look around
        </div>
      </div>
    </>
  );
};
