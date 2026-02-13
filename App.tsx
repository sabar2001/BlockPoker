import React, { useState, useEffect, useRef } from 'react';
import { GameState, Player, GameStage, Card, GameVariant } from './types';
import { INITIAL_CHIPS, PLAYER_POSITIONS, PLAYER_NAMES, PLAYER_COLORS, BIG_BLIND, SMALL_BLIND } from './constants';
import { createDeck, dealCards, evaluateHandStrength, determineWinners } from './services/pokerLogic';
import { generateBotChat, generateBotSpeech } from './services/geminiService';
import GameScene from './components/GameScene';
import HUD from './components/HUD';

// Generate initial players
const initPlayers = (): Player[] => {
  return PLAYER_POSITIONS.map((pos, index) => ({
    id: index.toString(),
    name: PLAYER_NAMES[index],
    chips: INITIAL_CHIPS,
    hand: [],
    isBot: index !== 0,
    isFolded: false,
    isAllIn: false,
    currentBet: 0,
    position: pos as [number, number, number],
    color: PLAYER_COLORS[index],
    hasActed: false
  }));
};

const App: React.FC = () => {
  const [hasStarted, setHasStarted] = useState(false);
  const [players, setPlayers] = useState<Player[]>(initPlayers());
  const [gameState, setGameState] = useState<GameState>({
    variant: 'HOLDEM',
    stage: GameStage.PREFLOP,
    pot: 0,
    communityCards: [],
    deck: [],
    currentTurnIndex: 0,
    dealerIndex: 0,
    highestBet: BIG_BLIND,
    minBet: BIG_BLIND,
    lastAggressorIndex: 0,
    winners: []
  });

  const [micVolume, setMicVolume] = useState(0);

  // Initialize Game Logic (only once)
  useEffect(() => {
    // Only start round logic if we haven't already (controlled by hasStarted mostly, but we can prep logic)
    // Actually, we'll trigger startNewRound when hasStarted becomes true
  }, []);

  const initAudioAndGame = async () => {
    try {
        setHasStarted(true);
        startNewRound(gameState.variant);

        // Resume AudioContext if it exists globally or create new
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContextClass();
        await audioContext.resume();

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const analyser = audioContext.createAnalyser();
            const microphone = audioContext.createMediaStreamSource(stream);
            const scriptProcessor = audioContext.createScriptProcessor(2048, 1, 1);

            analyser.smoothingTimeConstant = 0.8;
            analyser.fftSize = 1024;

            microphone.connect(analyser);
            analyser.connect(scriptProcessor);
            scriptProcessor.connect(audioContext.destination);

            scriptProcessor.onaudioprocess = () => {
                const array = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(array);
                let values = 0;
                const length = array.length;
                for (let i = 0; i < length; i++) {
                    values += array[i];
                }
                const average = values / length;
                setMicVolume(average);
            };
        }
    } catch (e) {
        console.error("Audio init failed", e);
        // Still start game even if audio fails
        setHasStarted(true);
    }
  };

  const handleToggleVariant = () => {
      const newVariant = gameState.variant === 'HOLDEM' ? 'OMAHA' : 'HOLDEM';
      setGameState(prev => ({ ...prev, variant: newVariant }));
      setTimeout(() => startNewRound(newVariant), 100);
  };

  const startNewRound = (variant: GameVariant) => {
    const deck = createDeck();
    let currentPlayers = [...players].map(p => ({
       ...p, 
       hand: [], 
       isFolded: p.chips <= 0, 
       isAllIn: false, 
       currentBet: 0,
       chatMessage: undefined,
       hasActed: false
    }));

    const cardsPerPlayer = variant === 'OMAHA' ? 4 : 2;
    currentPlayers.forEach(p => {
        if (p.chips > 0) {
            const { hand, remainingDeck } = dealCards(deck, cardsPerPlayer);
            p.hand = hand;
            deck.splice(0, cardsPerPlayer); 
        }
    });

    const activeCount = currentPlayers.filter(p => p.chips > 0).length;
    if (activeCount < 2) return; 

    let sbIndex = (gameState.dealerIndex + 1) % currentPlayers.length;
    while (currentPlayers[sbIndex].chips === 0) sbIndex = (sbIndex + 1) % currentPlayers.length;
    
    let bbIndex = (sbIndex + 1) % currentPlayers.length;
    while (currentPlayers[bbIndex].chips === 0) bbIndex = (bbIndex + 1) % currentPlayers.length;

    const sbAmount = Math.min(currentPlayers[sbIndex].chips, SMALL_BLIND);
    currentPlayers[sbIndex].chips -= sbAmount;
    currentPlayers[sbIndex].currentBet = sbAmount;
    
    const bbAmount = Math.min(currentPlayers[bbIndex].chips, BIG_BLIND);
    currentPlayers[bbIndex].chips -= bbAmount;
    currentPlayers[bbIndex].currentBet = bbAmount;

    let utgIndex = (bbIndex + 1) % currentPlayers.length;
    while (currentPlayers[utgIndex].chips === 0) utgIndex = (utgIndex + 1) % currentPlayers.length;

    setPlayers(currentPlayers);
    setGameState(prev => ({
      ...prev,
      variant,
      stage: GameStage.PREFLOP,
      pot: sbAmount + bbAmount,
      communityCards: [],
      deck,
      currentTurnIndex: utgIndex,
      highestBet: BIG_BLIND,
      minBet: BIG_BLIND,
      lastAggressorIndex: bbIndex, 
      winners: []
    }));
  };

  const nextStage = () => {
    let { stage, deck, communityCards } = gameState;
    let nextStage = stage;
    let newCommunityCards = [...communityCards];

    if (stage === GameStage.PREFLOP) {
      nextStage = GameStage.FLOP;
      const deal = dealCards(deck, 3);
      newCommunityCards = deal.hand;
      deck.splice(0, 3);
    } else if (stage === GameStage.FLOP) {
      nextStage = GameStage.TURN;
      const deal = dealCards(deck, 1);
      newCommunityCards = [...newCommunityCards, ...deal.hand];
      deck.splice(0, 1);
    } else if (stage === GameStage.TURN) {
      nextStage = GameStage.RIVER;
      const deal = dealCards(deck, 1);
      newCommunityCards = [...newCommunityCards, ...deal.hand];
      deck.splice(0, 1);
    } else if (stage === GameStage.RIVER) {
      nextStage = GameStage.SHOWDOWN;
    }

    if (nextStage === GameStage.SHOWDOWN) {
      handleShowdown(players, newCommunityCards);
    } else {
        const updatedPlayers = players.map(p => ({ ...p, currentBet: 0, hasActed: false }));
        
        let firstIndex = (gameState.dealerIndex + 1) % players.length;
        while (updatedPlayers[firstIndex].isFolded || updatedPlayers[firstIndex].chips === 0) {
            firstIndex = (firstIndex + 1) % players.length;
        }

        setPlayers(updatedPlayers);
        setGameState(prev => ({
            ...prev,
            stage: nextStage,
            communityCards: newCommunityCards,
            currentTurnIndex: firstIndex,
            lastAggressorIndex: 999, 
            highestBet: 0,
            minBet: BIG_BLIND 
        }));
    }
  };

  const handleShowdown = (currentPlayers: Player[], cards: Card[]) => {
      const winners = determineWinners(currentPlayers, cards, gameState.variant);
      const winAmount = Math.floor(gameState.pot / Math.max(1, winners.length));
      
      const updatedPlayers = currentPlayers.map(p => {
          if (winners.find(w => w.id === p.id)) {
              return { ...p, chips: p.chips + winAmount, chatMessage: 'EZ MONEY!' };
          }
          return p;
      });

      setPlayers(updatedPlayers);
      
      setTimeout(() => {
          setGameState(prev => ({ ...prev, dealerIndex: (prev.dealerIndex + 1) % players.length }));
          startNewRound(gameState.variant);
      }, 6000);
  };

  // Bot Logic Loop
  useEffect(() => {
    if (!hasStarted) return;
    if (gameState.stage === GameStage.SHOWDOWN) return;

    const currentPlayer = players[gameState.currentTurnIndex];
    if (currentPlayer && currentPlayer.isBot && !currentPlayer.isFolded && !currentPlayer.isAllIn) {
      const timer = setTimeout(() => {
        handleBotTurn(currentPlayer);
      }, 1000 + Math.random() * 1000); 
      return () => clearTimeout(timer);
    }
  }, [gameState.currentTurnIndex, gameState.stage, players, hasStarted]);

  const handleBotTurn = async (bot: Player) => {
    const callAmount = gameState.highestBet - bot.currentBet;
    const handStrength = evaluateHandStrength(bot.hand, gameState.communityCards, gameState.variant);
    const random = Math.random();

    let action: 'fold' | 'call' | 'raise' = 'fold';
    let raiseAmt = 0;
    const strengthThreshold = gameState.variant === 'OMAHA' ? 500 : 100;

    if (handStrength > strengthThreshold && random > 0.3) {
        const limitRaise = gameState.pot + (callAmount * 2);
        const minRaise = gameState.highestBet + BIG_BLIND;
        const wantRaise = minRaise * 2;
        raiseAmt = gameState.variant === 'OMAHA' ? limitRaise : wantRaise;
        action = 'raise';
    } else if (handStrength > (strengthThreshold / 4) || callAmount === 0 || random > 0.6) {
       action = 'call';
    } else {
       action = 'fold';
    }

    processAction(bot.id, action, raiseAmt);

    if (random > 0.85) {
        const context = `${bot.name} ${action}s. Pot: ${gameState.pot}. Variant: ${gameState.variant}`;
        const chatText = await generateBotChat(bot.name, context, action === 'fold' ? 'fearful' : 'confident');
        updatePlayerChat(bot.id, chatText);
    }
  };

  const processAction = (playerId: string, action: 'fold' | 'call' | 'raise', amount: number = 0) => {
    let nextHighestBet = gameState.highestBet;
    let nextLastAggressor = gameState.lastAggressorIndex;

    const newPlayers = players.map((p, idx) => {
        if (p.id !== playerId) return p;

        const updatedPlayer = { ...p, hasActed: true };

        if (action === 'fold') {
            updatedPlayer.isFolded = true;
        } else if (action === 'call') {
            const callAmt = nextHighestBet - p.currentBet;
            const actualBet = Math.min(p.chips, callAmt);
            updatedPlayer.chips -= actualBet;
            updatedPlayer.currentBet += actualBet;
            if (updatedPlayer.chips === 0) updatedPlayer.isAllIn = true;
        } else if (action === 'raise') {
            let needed = amount - p.currentBet;
            const actualBet = Math.min(p.chips, needed);
            updatedPlayer.chips -= actualBet;
            updatedPlayer.currentBet += actualBet;
            if (updatedPlayer.chips === 0) updatedPlayer.isAllIn = true;
            
            if (updatedPlayer.currentBet > nextHighestBet) {
                nextHighestBet = updatedPlayer.currentBet;
                nextLastAggressor = idx; 
            }
        }
        return updatedPlayer;
    });

    const newPot = newPlayers.reduce((acc, p) => acc + (p.currentBet - (players.find(old => old.id === p.id)?.currentBet || 0)), gameState.pot);

    setPlayers(newPlayers);
    setGameState(prev => ({ 
        ...prev, 
        pot: newPot, 
        highestBet: nextHighestBet, 
        lastAggressorIndex: nextLastAggressor 
    }));

    checkRoundCompletion(newPlayers, nextHighestBet, nextLastAggressor, playerId);
  };

  const checkRoundCompletion = (currentPlayers: Player[], highBet: number, lastAggressor: number, lastActorId: string) => {
      const activePlayers = currentPlayers.filter(p => !p.isFolded);
      if (activePlayers.length === 1) {
          handleShowdown(currentPlayers, gameState.communityCards);
          return;
      }

      const unacted = activePlayers.filter(p => !p.hasActed && !p.isAllIn);
      const unmatched = activePlayers.filter(p => p.currentBet !== highBet && !p.isAllIn);

      if (unacted.length === 0 && unmatched.length === 0) {
          setTimeout(nextStage, 500);
      } else {
          moveToNextPlayer(currentPlayers);
      }
  };

  const moveToNextPlayer = (currentPlayers: Player[]) => {
    setGameState(prev => {
        let nextIndex = (prev.currentTurnIndex + 1) % currentPlayers.length;
        let loopCount = 0;
        while (
            (currentPlayers[nextIndex].isFolded || currentPlayers[nextIndex].isAllIn) 
            && loopCount < currentPlayers.length
        ) {
            nextIndex = (nextIndex + 1) % currentPlayers.length;
            loopCount++;
        }
        return { ...prev, currentTurnIndex: nextIndex };
    });
  };

  const updatePlayerChat = (id: string, text: string) => {
      setPlayers(prev => prev.map(p => p.id === id ? { ...p, chatMessage: text } : p));
      setTimeout(() => {
        setPlayers(prev => prev.map(p => p.id === id && p.chatMessage === text ? { ...p, chatMessage: undefined } : p));
      }, 4000);
  };

  const handleUserAction = (action: 'fold' | 'call' | 'raise', amount?: number) => {
    processAction("0", action, amount);
  };

  if (!hasStarted) {
      return (
          <div className="w-full h-full flex items-center justify-center bg-black">
              <div className="text-center cursor-pointer" onClick={initAudioAndGame}>
                  <h1 className="text-6xl text-green-500 font-[VT323] mb-4 krunker-text animate-pulse">BLOCKY BLUFF 3D</h1>
                  <div className="text-white text-2xl font-[VT323] border-2 border-green-500 px-8 py-4 hover:bg-green-900 transition-colors">
                      CLICK TO CONNECT
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="w-full h-full relative">
      <GameScene 
        players={players} 
        communityCards={gameState.communityCards} 
        pot={gameState.pot}
        currentTurnIndex={gameState.currentTurnIndex}
      />
      
      {micVolume > 0 && (
          <div className="absolute top-4 left-4 flex gap-2 items-center pointer-events-none z-50">
              <div className={`w-3 h-3 rounded-full ${micVolume > 20 ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
              <span className="text-white text-xs opacity-50">VOICE ACTIVE</span>
          </div>
      )}

      <HUD 
        user={players[0]} 
        gameState={gameState.stage}
        gameVariant={gameState.variant}
        currentTurnIndex={gameState.currentTurnIndex}
        players={players}
        communityCards={gameState.communityCards}
        pot={gameState.pot}
        onAction={handleUserAction}
        minBet={gameState.highestBet}
        onToggleVariant={handleToggleVariant}
      />
    </div>
  );
};

export default App;