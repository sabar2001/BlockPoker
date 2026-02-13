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

const shuffle = <T>(array: T[]): T[] => {
  const arr = [...array];
  let currentIndex = arr.length;
  while (currentIndex !== 0) {
    const randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [arr[currentIndex], arr[randomIndex]] = [arr[randomIndex], arr[currentIndex]];
  }
  return arr;
};

export const dealCards = (deck: Card[], count: number): { hand: Card[], remainingDeck: Card[] } => {
  const hand = deck.slice(0, count);
  const remainingDeck = deck.slice(count);
  return { hand, remainingDeck };
};

// Helper to generate combinations of k elements from an array
function getCombinations<T>(array: T[], k: number): T[][] {
  if (k === 0) return [[]];
  return array.flatMap((v, i) =>
    getCombinations(array.slice(i + 1), k - 1).map(c => [v, ...c])
  );
}

// Hand rank constants
const HAND_HIGH_CARD = 0;
const HAND_PAIR = 1;
const HAND_TWO_PAIR = 2;
const HAND_TRIPS = 3;
const HAND_STRAIGHT = 4;
const HAND_FLUSH = 5;
const HAND_FULL_HOUSE = 6;
const HAND_QUADS = 7;
const HAND_STRAIGHT_FLUSH = 8;

// Encode hand rank + kickers into a single comparable number
// Using base 15 (card values 2-14 fit in 0-14 range)
const BASE = 15;
function encodeScore(handRank: number, kickers: number[]): number {
  // Pad kickers to 5 values
  const k = [...kickers];
  while (k.length < 5) k.push(0);

  return handRank * (BASE ** 5)
    + k[0] * (BASE ** 4)
    + k[1] * (BASE ** 3)
    + k[2] * (BASE ** 2)
    + k[3] * BASE
    + k[4];
}

// Score a 5-card hand with proper kicker comparison
const calculateScore = (cards: Card[]): number => {
  if (cards.length !== 5) return 0;

  const values = cards.map(c => c.value).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);

  // Check flush (all same suit)
  const isFlush = suits.every(s => s === suits[0]);

  // Check straight (including wheel: A-2-3-4-5)
  let isStraight = false;
  let straightHigh = 0;

  // Normal straight check
  if (values[0] - values[4] === 4 && new Set(values).size === 5) {
    isStraight = true;
    straightHigh = values[0];
  }
  // Wheel: A(14), 5, 4, 3, 2
  if (!isStraight && values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) {
    isStraight = true;
    straightHigh = 5; // 5-high straight
  }

  // Count value occurrences
  const valueCounts: Map<number, number> = new Map();
  values.forEach(v => valueCounts.set(v, (valueCounts.get(v) || 0) + 1));

  // Sort groups: first by count desc, then by value desc
  const groups = Array.from(valueCounts.entries())
    .sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  const counts = groups.map(g => g[1]);
  const groupValues = groups.map(g => g[0]);

  // Straight flush
  if (isFlush && isStraight) {
    return encodeScore(HAND_STRAIGHT_FLUSH, [straightHigh]);
  }

  // Four of a kind
  if (counts[0] === 4) {
    return encodeScore(HAND_QUADS, [groupValues[0], groupValues[1]]);
  }

  // Full house
  if (counts[0] === 3 && counts[1] === 2) {
    return encodeScore(HAND_FULL_HOUSE, [groupValues[0], groupValues[1]]);
  }

  // Flush
  if (isFlush) {
    return encodeScore(HAND_FLUSH, values);
  }

  // Straight
  if (isStraight) {
    return encodeScore(HAND_STRAIGHT, [straightHigh]);
  }

  // Three of a kind
  if (counts[0] === 3) {
    return encodeScore(HAND_TRIPS, [groupValues[0], groupValues[1], groupValues[2]]);
  }

  // Two pair
  if (counts[0] === 2 && counts[1] === 2) {
    const highPair = Math.max(groupValues[0], groupValues[1]);
    const lowPair = Math.min(groupValues[0], groupValues[1]);
    return encodeScore(HAND_TWO_PAIR, [highPair, lowPair, groupValues[2]]);
  }

  // One pair
  if (counts[0] === 2) {
    return encodeScore(HAND_PAIR, [groupValues[0], groupValues[1], groupValues[2], groupValues[3]]);
  }

  // High card
  return encodeScore(HAND_HIGH_CARD, values);
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
    for (const hand of combos) {
      const s = calculateScore(hand);
      if (s > max) max = s;
    }
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
