import { Card, Player, Rank, Suit } from '../types';
import { RANKS, SUITS } from '../constants';

export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  SUITS.forEach(suit => {
    RANKS.forEach((rank, index) => {
      deck.push({ suit, rank, value: index + 2 });
    });
  });
  return shuffle(deck);
};

const shuffle = (array: any[]) => {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
};

export const dealCards = (deck: Card[], count: number): { hand: Card[], remainingDeck: Card[] } => {
  const hand = deck.slice(0, count);
  const remainingDeck = deck.slice(count);
  return { hand, remainingDeck };
};

// Helper to generate combinations of k elements from an array
function getCombinations(array: Card[], k: number): Card[][] {
    if (k === 0) return [[]];
    return array.flatMap((v, i) =>
        getCombinations(array.slice(i + 1), k - 1).map(c => [v, ...c])
    );
}

// Internal score calculator for a 5-card hand
const calculateScore = (cards: Card[]): number => {
    if (cards.length === 0) return 0;

    const values = cards.map(c => c.value).sort((a, b) => b - a);
    const suits = cards.map(c => c.suit);
    
    // Check Flush
    const suitCounts: {[key: string]: number} = {};
    suits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
    const isFlush = Object.values(suitCounts).some(count => count >= 5);

    // Check Pairs/Trips/Quads
    const valueCounts: {[key: number]: number} = {};
    values.forEach(v => valueCounts[v] = (valueCounts[v] || 0) + 1);
    
    const counts = Object.values(valueCounts);
    const isQuads = counts.includes(4);
    const isTrips = counts.includes(3);
    const pairCount = counts.filter(c => c === 2).length;
    
    // Check Straight (simplified)
    const uniqueValues = Array.from(new Set(values));
    let isStraight = false;
    if (uniqueValues.length >= 5) {
        for(let i=0; i<=uniqueValues.length-5; i++) {
            if (uniqueValues[i] - uniqueValues[i+4] === 4) isStraight = true;
        }
    }

    let score = 0;
    // Base score on high card (simplified ranking)
    score += values[0];

    // Rank logic (Values significantly separated to avoid overlap issues in simple score)
    if (isFlush && isStraight) score += 9000;
    else if (isQuads) score += 7000;
    else if (isTrips && pairCount >= 1) score += 6000; // Full House
    else if (isFlush) score += 5000;
    else if (isStraight) score += 4000;
    else if (isTrips) score += 3000;
    else if (pairCount >= 2) score += 2000;
    else if (pairCount === 1) score += 1000;

    return score;
};

export const evaluateHandStrength = (holeCards: Card[], communityCards: Card[], variant: 'HOLDEM' | 'OMAHA'): number => {
  // If not enough cards to make a hand, return raw high card value of hole cards
  if (communityCards.length < 3) {
      return holeCards.reduce((acc, c) => acc + c.value, 0);
  }

  if (variant === 'HOLDEM') {
      // Best 5 cards out of (Hole + Community)
      const allCards = [...holeCards, ...communityCards];
      const combos = getCombinations(allCards, 5);
      let max = 0;
      combos.forEach(hand => {
          const s = calculateScore(hand);
          if (s > max) max = s;
      });
      return max;
  } else {
      // OMAHA: Exactly 2 from Hole, 3 from Community
      const holePairs = getCombinations(holeCards, 2);
      const boardTrips = getCombinations(communityCards, 3);
      
      let max = 0;
      for (const hp of holePairs) {
          for (const bt of boardTrips) {
              const hand = [...hp, ...bt];
              const s = calculateScore(hand);
              if (s > max) max = s;
          }
      }
      return max;
  }
};

export const determineWinners = (players: Player[], communityCards: Card[], variant: 'HOLDEM' | 'OMAHA'): Player[] => {
  const activePlayers = players.filter(p => !p.isFolded);
  if (activePlayers.length === 0) return [];
  if (activePlayers.length === 1) return activePlayers;

  let bestScore = -1;
  let winners: Player[] = [];

  activePlayers.forEach(p => {
    const score = evaluateHandStrength(p.hand, communityCards, variant);
    if (score > bestScore) {
      bestScore = score;
      winners = [p];
    } else if (score === bestScore) {
      winners.push(p);
    }
  });

  return winners;
};
