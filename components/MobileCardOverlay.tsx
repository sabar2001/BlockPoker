import React from 'react';
import { Card, Suit } from '../types';

interface MobileCardOverlayProps {
  myHand: Card[];
  communityCards: Card[];
  isFolded: boolean;
}

const CompactCard: React.FC<{ card: Card; size?: 'small' | 'large' }> = ({ card, size = 'large' }) => {
  const isRed = card.suit === Suit.HEARTS || card.suit === Suit.DIAMONDS;
  const colorClass = isRed ? 'text-red-600' : 'text-black';
  
  if (size === 'small') {
    return (
      <div className={`bg-white rounded-lg border-2 border-gray-300 ${colorClass} flex flex-col items-center justify-center px-2 py-1 shadow-lg font-[VT323]`}
           style={{ width: '50px', height: '70px' }}>
        <div className="text-xl font-bold leading-none">{card.rank}</div>
        <div className="text-2xl leading-none">{card.suit}</div>
      </div>
    );
  }
  
  // Large card
  return (
    <div className={`bg-white rounded-xl border-3 border-gray-400 ${colorClass} flex flex-col items-center justify-center px-3 py-2 shadow-xl font-[VT323]`}
         style={{ width: '70px', height: '100px' }}>
      <div className="text-3xl font-bold leading-none">{card.rank}</div>
      <div className="text-4xl leading-none mt-1">{card.suit}</div>
    </div>
  );
};

export const MobileCardOverlay: React.FC<MobileCardOverlayProps> = ({ myHand, communityCards, isFolded }) => {
  return (
    <>
      {/* Player Hand Cards - Bottom left, above action buttons */}
      {myHand.length > 0 && !isFolded && (
        <div 
          className="absolute left-6 flex gap-3" 
          style={{ bottom: 'max(120px, calc(env(safe-area-inset-bottom, 24px) + 96px))', zIndex: 35 }}
        >
          {myHand.map((card, i) => (
            <CompactCard key={i} card={card} size="large" />
          ))}
        </div>
      )}

      {/* Community Cards - Bottom center, smaller */}
      {communityCards.length > 0 && (
        <div 
          className="absolute left-1/2 -translate-x-1/2 flex gap-2" 
          style={{ bottom: 'max(200px, calc(env(safe-area-inset-bottom, 24px) + 176px))', zIndex: 35 }}
        >
          <div className="bg-black/70 backdrop-blur px-3 py-2 rounded-xl border-2 border-yellow-500/50 flex gap-2">
            {communityCards.map((card, i) => (
              <CompactCard key={i} card={card} size="small" />
            ))}
          </div>
        </div>
      )}
    </>
  );
};
