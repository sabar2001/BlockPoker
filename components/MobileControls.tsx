import React, { useState, useRef, useMemo, useEffect } from 'react';
import { socketService } from '../services/socketService';
import { soundService } from '../services/soundService';
import { EmoteType } from '../shared/protocol';
import { Card, GameStage, GameVariant, ShowdownPlayerResult } from '../types';
import { MobileCardOverlay } from './MobileCardOverlay';
import { evaluateBestHand } from '../utils/handEvaluator';

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
  myHand?: Card[];
  communityCards?: Card[];
  isFolded?: boolean;
  highestBet?: number;
  currentBet?: number;
  bigBlind?: number;
  gameStage?: GameStage;
  gameVariant?: GameVariant;
  showdownResults?: ShowdownPlayerResult[];
  revealedCards?: Map<string, Card[]>;
}

const MiniCardDisplay: React.FC<{ card: Card }> = ({ card }) => {
  const isRed = card.suit === '♥' || card.suit === '♦';
  return (
    <div className={`w-8 h-12 bg-white border border-black flex items-center justify-center shadow ${isRed ? 'text-red-600' : 'text-black'}`}>
      <span className="text-xs font-bold font-mono">{card.rank}{card.suit}</span>
    </div>
  );
};

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
  timeRemaining = 0, waitingForDeal = false, isHost = false, roomCode = '', chips = 0, pot = 0,
  myHand = [], communityCards = [], isFolded = false, highestBet = 0, currentBet = 0, bigBlind = 20,
  gameStage = GameStage.PREFLOP, gameVariant = 'HOLDEM' as GameVariant,
  showdownResults = [], revealedCards = new Map()
}) => {
  const [startTouch, setStartTouch] = useState<{ x: number; y: number } | null>(null);
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);
  const [raiseValue, setRaiseValue] = useState(raiseAmount);
  const [rebuyAmount, setRebuyAmount] = useState(1000);
  const [rebuyError, setRebuyError] = useState('');
  const [rebuyPending, setRebuyPending] = useState(false);
  const [rebuyMessage, setRebuyMessage] = useState('');
  const [hasShownCards, setHasShownCards] = useState(false);
  const rotation = useRef({ yaw: 0, pitch: -0.3 }); // Initialize with correct starting pitch

  const isShowdown = gameStage === GameStage.SHOWDOWN;

  // Reset "shown cards" flag when a new round starts
  useEffect(() => {
    if (!isShowdown) setHasShownCards(false);
  }, [isShowdown]);

  // Best hand evaluation
  const bestHandName = useMemo(() => {
    if (isFolded) return null;
    return evaluateBestHand(myHand, communityCards, gameVariant);
  }, [myHand, communityCards, gameVariant, isFolded]);

  // minRaise = max(2x current bet, current bet + big blind) — ensures at least BB post-flop
  const minRaise = Math.max(highestBet * 2, highestBet + bigBlind);
  const userMaxRaise = chips + currentBet;

  // Reset raise slider when turn changes
  React.useEffect(() => {
    setRaiseValue(minRaise);
    setShowRaiseSlider(false);
  }, [isUserTurn, minRaise]);

  const handleRebuy = async () => {
    setRebuyError('');
    const result = await socketService.rebuy(rebuyAmount);
    if (result.success) {
      setRebuyPending(true);
      setRebuyMessage(result.message || 'You will be dealt in on the next hand');
    } else {
      setRebuyError(result.error || 'Rebuy failed');
    }
  };

  // Reset rebuy pending state when player gets chips (dealt into new round)
  React.useEffect(() => {
    if (chips > 0 && !isFolded) {
      setRebuyPending(false);
      setRebuyMessage('');
    }
  }, [chips, isFolded]);
  
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
      <div className="absolute top-6 left-6 right-6 flex justify-between pointer-events-none font-[VT323]" style={{ zIndex: 40 }}>
        <div className="bg-black/70 px-3 py-2 border-l-4 border-green-500">
          {roomCode && (
            <div
              className="text-yellow-300 text-lg font-mono cursor-pointer pointer-events-auto"
              onClick={() => navigator.clipboard.writeText(roomCode)}
              title="Tap to copy"
            >
              ROOM: {roomCode}
            </div>
          )}
          <div className="text-white text-xl">CHIPS: ${chips}</div>
        </div>
        <div className="bg-black/70 px-3 py-2 border-r-4 border-yellow-500">
          <div className="text-yellow-400 text-xl">POT: <span key={pot} className="inline-block animate-pot-bump">${pot}</span></div>
          {/* Best Hand Indicator */}
          {bestHandName && myHand.length > 0 && !isFolded && (
            <div className="text-cyan-400 text-lg mt-1">{bestHandName}</div>
          )}
        </div>
      </div>
      
      {/* Timer Display - positioned below HUD with safe spacing */}
      {isUserTurn && timeRemaining > 0 && (
        <div className="absolute left-1/2 -translate-x-1/2" style={{ top: '140px', zIndex: 45 }}>
          <div className={`text-5xl font-bold ${getTimerColor()} font-[VT323] bg-black/80 px-8 py-3 rounded-xl border-2 ${
            timeRemaining <= 5 ? 'border-red-500 animate-pulse' : 
            timeRemaining <= 10 ? 'border-yellow-500' : 'border-green-500'
          }`}>
            {timeRemaining}s
          </div>
        </div>
      )}
      
      {/* Deal Button - Center when waiting */}
      {isHost && waitingForDeal && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-fade-slide-up" style={{ zIndex: 65 }}>
          <button
            onClick={() => socketService.dealNextRound()}
            onTouchStart={(e) => { e.stopPropagation(); socketService.dealNextRound(); }}
            className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-3xl font-bold px-12 py-8 rounded-2xl border-4 border-green-400 shadow-2xl animate-pulse font-[VT323] active:scale-95 transition-transform"
            style={{ pointerEvents: 'auto' }}
          >
            DEAL CARDS
          </button>
        </div>
      )}
      
      {/* Rebuy UI - shown when player has 0 chips */}
      {chips === 0 && !rebuyPending && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ zIndex: 65 }}>
          <div className="bg-black/90 border-2 border-yellow-500 p-4 rounded-xl w-72 font-[VT323]" style={{ pointerEvents: 'auto' }}>
            <div className="text-yellow-400 text-2xl mb-3 text-center">REBUY</div>
            <input
              type="number"
              value={rebuyAmount}
              onChange={(e) => setRebuyAmount(Math.max(1, Number(e.target.value)))}
              className="bg-gray-900 border border-gray-600 text-white text-2xl px-3 py-2 w-full text-center outline-none mb-3 rounded"
              min={1}
              onTouchStart={(e) => e.stopPropagation()}
            />
            <button
              onClick={handleRebuy}
              onTouchStart={(e) => { e.stopPropagation(); handleRebuy(); }}
              className="bg-yellow-800 hover:bg-yellow-700 active:bg-yellow-600 text-white text-2xl py-3 w-full border border-yellow-500 rounded-xl active:scale-95 transition-transform"
            >
              BUY IN ${rebuyAmount}
            </button>
            {rebuyError && <div className="text-red-400 text-sm mt-2 text-center">{rebuyError}</div>}
          </div>
        </div>
      )}
      {/* Rebuy pending - waiting for next hand */}
      {rebuyPending && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ zIndex: 65 }}>
          <div className="bg-black/90 border-2 border-green-500 p-4 rounded-xl w-72 font-[VT323]" style={{ pointerEvents: 'auto' }}>
            <div className="text-green-400 text-2xl mb-2 text-center">REBUY SUCCESSFUL</div>
            <div className="text-green-300 text-lg text-center animate-pulse">{rebuyMessage}</div>
          </div>
        </div>
      )}

      {/* Showdown Results Panel */}
      {isShowdown && showdownResults.length > 0 && (
        <div className="absolute left-4 right-4 animate-fade-slide-up" style={{ bottom: 'max(24px, env(safe-area-inset-bottom, 24px))', zIndex: 55 }}>
          <div className="bg-black/90 border-2 border-yellow-500 rounded-xl p-3 font-[VT323]" style={{ pointerEvents: 'auto', maxHeight: '50vh', overflowY: 'auto' }}>
            {/* Winner banner */}
            {(() => {
              const winnerResults = showdownResults.filter(r => r.isWinner);
              const winnerNames = winnerResults.map(r => r.playerName).join(', ');
              const handName = winnerResults[0]?.handName || '';
              return (
                <div className="text-center mb-2 animate-pulse">
                  <div className="text-yellow-300 text-xl">
                    {winnerResults.length > 1 ? `${winnerNames} SPLIT` : `${winnerNames} WINS`}
                  </div>
                  <div className="text-yellow-100 text-sm">{handName}</div>
                </div>
              );
            })()}
            {/* Player hands */}
            <div className="flex flex-col gap-1">
              {showdownResults.map((r, idx) => (
                <div
                  key={r.playerId}
                  className={`flex items-center gap-2 px-2 py-1 rounded opacity-0 animate-fade-slide-up ${
                    r.isWinner ? 'bg-yellow-900/60 border border-yellow-600' : 'bg-black/40 border border-gray-700'
                  }`}
                  style={{ animationDelay: `${idx * 80}ms` }}
                >
                  <div className="flex flex-col min-w-[60px]">
                    <span className={`text-xs ${r.isWinner ? 'text-yellow-300' : 'text-gray-300'}`}>{r.playerName}</span>
                    <span className={`text-xs ${r.isWinner ? 'text-yellow-200' : 'text-gray-500'}`}>{r.handName}</span>
                  </div>
                  <div className="flex gap-0.5">
                    {r.cards.map((card, i) => (
                      <MiniCardDisplay key={i} card={card} />
                    ))}
                  </div>
                  {r.isWinner && <span className="text-yellow-400 text-sm ml-auto">&#9733;</span>}
                </div>
              ))}
            </div>
            {/* Show Cards for folded player */}
            {isFolded && myHand.length > 0 && !hasShownCards && (
              <button
                onClick={() => { socketService.showCards(); setHasShownCards(true); }}
                onTouchStart={(e) => { e.stopPropagation(); socketService.showCards(); setHasShownCards(true); }}
                className="mt-2 bg-pink-900/90 text-pink-100 text-lg font-bold px-6 py-2 w-full rounded-lg border border-pink-500 active:scale-95 transition-transform"
              >
                SHOW CARDS
              </button>
            )}
          </div>
        </div>
      )}

      {/* Fallback: Show cards button when no showdown results (everyone folded) */}
      {isShowdown && showdownResults.length === 0 && isFolded && myHand.length > 0 && !hasShownCards && (
        <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 'max(100px, calc(env(safe-area-inset-bottom, 24px) + 80px))', zIndex: 55 }}>
          <button
            onClick={() => { socketService.showCards(); setHasShownCards(true); }}
            onTouchStart={(e) => { e.stopPropagation(); socketService.showCards(); setHasShownCards(true); }}
            className="bg-pink-900/90 text-pink-100 text-2xl font-bold px-8 py-4 rounded-xl border-3 border-pink-500 active:scale-95 transition-transform shadow-lg font-[VT323]"
            style={{ pointerEvents: 'auto' }}
          >
            SHOW CARDS
          </button>
        </div>
      )}
      {isShowdown && hasShownCards && showdownResults.length === 0 && (
        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none" style={{ bottom: 'max(100px, calc(env(safe-area-inset-bottom, 24px) + 80px))', zIndex: 55 }}>
          <div className="bg-black/70 text-pink-400 text-xl px-6 py-3 rounded-xl border border-pink-500 font-[VT323]">
            CARDS SHOWN
          </div>
        </div>
      )}

      {/* Raise Slider Panel - Above action buttons */}
      {isUserTurn && showRaiseSlider && (
        <div
          className="absolute left-6 right-6"
          style={{ bottom: 'max(120px, calc(env(safe-area-inset-bottom, 24px) + 100px))', zIndex: 55 }}
        >
          <div className="bg-black/90 border-2 border-yellow-500 p-4 rounded-xl font-[VT323]" style={{ pointerEvents: 'auto' }}>
            <div className="text-yellow-400 text-xl mb-2 text-center">RAISE TO: ${raiseValue}</div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-gray-400 text-xs">${minRaise}</span>
              <input
                type="range"
                min={minRaise}
                max={userMaxRaise}
                step={1}
                value={raiseValue}
                onChange={(e) => setRaiseValue(Number(e.target.value))}
                onTouchStart={(e) => e.stopPropagation()}
                className="flex-1 accent-yellow-500 h-8"
              />
              <span className="text-gray-400 text-xs">${userMaxRaise}</span>
            </div>
            <button
              onClick={() => { soundService.playRaise(); onAction('raise', raiseValue); setShowRaiseSlider(false); }}
              onTouchStart={(e) => { e.stopPropagation(); soundService.playRaise(); onAction('raise', raiseValue); setShowRaiseSlider(false); }}
              className="bg-yellow-800 hover:bg-yellow-700 text-white text-xl py-3 w-full border border-yellow-500 rounded-xl active:scale-95"
              style={{ pointerEvents: 'auto' }}
            >
              RAISE ${raiseValue}
            </button>
          </div>
        </div>
      )}
      
      {/* Action Buttons - Bottom center, horizontal layout with safe areas */}
      {isUserTurn && (
        <div 
          className="absolute left-0 right-0 flex justify-center gap-4 px-6" 
          style={{ bottom: 'max(24px, env(safe-area-inset-bottom, 24px))', zIndex: 50 }}
        >
          <button 
            onClick={() => { soundService.playFold(); onAction('fold'); }}
            onTouchStart={(e) => { e.stopPropagation(); soundService.playFold(); onAction('fold'); }}
            className="bg-red-900/90 backdrop-blur text-white text-2xl font-bold px-6 py-5 rounded-xl border-3 border-red-500 active:scale-95 transition-transform shadow-lg min-w-[140px] min-h-[70px] font-[VT323]"
            style={{ pointerEvents: 'auto' }}
          >
            FOLD
          </button>
          <button 
            onClick={() => { soundService.playChip(); onAction('call'); }}
            onTouchStart={(e) => { e.stopPropagation(); soundService.playChip(); onAction('call'); }}
            className="bg-blue-900/90 backdrop-blur text-white text-2xl font-bold px-6 py-5 rounded-xl border-3 border-blue-500 active:scale-95 transition-transform shadow-lg min-w-[140px] min-h-[70px] font-[VT323]"
            style={{ pointerEvents: 'auto' }}
          >
            {callAmount > 0 ? `CALL ${callAmount}` : 'CHECK'}
          </button>
          <button 
            onClick={() => setShowRaiseSlider(prev => !prev)}
            onTouchStart={(e) => { e.stopPropagation(); setShowRaiseSlider(prev => !prev); }}
            className="bg-yellow-900/90 backdrop-blur text-white text-2xl font-bold px-6 py-5 rounded-xl border-3 border-yellow-500 active:scale-95 transition-transform shadow-lg min-w-[140px] min-h-[70px] font-[VT323]"
            style={{ pointerEvents: 'auto' }}
          >
            RAISE
          </button>
        </div>
      )}

      {/* Emote Bar - Bottom left, above action buttons */}
      <div 
        className="absolute left-6 flex gap-3" 
        style={{ bottom: 'max(100px, calc(env(safe-area-inset-bottom, 24px) + 76px))', zIndex: 50 }}
      >
        {EMOTES.map((em) => (
          <button
            key={em.emote}
            onClick={() => socketService.sendEmote(em.emote as EmoteType)}
            onTouchStart={(e) => { e.stopPropagation(); socketService.sendEmote(em.emote as EmoteType); }}
            className="bg-black/80 backdrop-blur active:bg-black/95 border-2 border-gray-500 active:border-gray-300 w-14 h-14 flex items-center justify-center text-3xl rounded-xl shadow-lg transition-all active:scale-90"
            style={{ pointerEvents: 'auto' }}
          >
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

      {/* Card Overlay - Show player hand and community cards */}
      <MobileCardOverlay 
        myHand={myHand} 
        communityCards={communityCards} 
        isFolded={isFolded} 
      />
    </>
  );
};
