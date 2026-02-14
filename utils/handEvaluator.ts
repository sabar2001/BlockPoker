// Client-side hand evaluation — mirrors server logic in GameManager.ts

import { Card } from '../types';

const BASE = 15;

function encodeScore(handRank: number, kickers: number[]): number {
  const k = [...kickers];
  while (k.length < 5) k.push(0);
  return handRank * (BASE ** 5) + k[0] * (BASE ** 4) + k[1] * (BASE ** 3) + k[2] * (BASE ** 2) + k[3] * BASE + k[4];
}

function scoreHand(cards: Card[]): number {
  if (cards.length !== 5) return 0;
  const values = cards.map(c => c.value).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit as string);

  const isFlush = suits.every(s => s === suits[0]);
  let isStraight = false;
  let straightHigh = 0;

  if (values[0] - values[4] === 4 && new Set(values).size === 5) {
    isStraight = true;
    straightHigh = values[0];
  }
  // Wheel: A-2-3-4-5
  if (!isStraight && values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) {
    isStraight = true;
    straightHigh = 5;
  }

  const valueCounts = new Map<number, number>();
  values.forEach(v => valueCounts.set(v, (valueCounts.get(v) || 0) + 1));
  const groups = Array.from(valueCounts.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const counts = groups.map(g => g[1]);
  const gv = groups.map(g => g[0]);

  if (isFlush && isStraight) return encodeScore(8, [straightHigh]);
  if (counts[0] === 4) return encodeScore(7, [gv[0], gv[1]]);
  if (counts[0] === 3 && counts[1] === 2) return encodeScore(6, [gv[0], gv[1]]);
  if (isFlush) return encodeScore(5, values);
  if (isStraight) return encodeScore(4, [straightHigh]);
  if (counts[0] === 3) return encodeScore(3, [gv[0], gv[1], gv[2]]);
  if (counts[0] === 2 && counts[1] === 2) {
    const hi = Math.max(gv[0], gv[1]), lo = Math.min(gv[0], gv[1]);
    return encodeScore(2, [hi, lo, gv[2]]);
  }
  if (counts[0] === 2) return encodeScore(1, [gv[0], gv[1], gv[2], gv[3]]);
  return encodeScore(0, values);
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  return arr.flatMap((v, i) => combinations(arr.slice(i + 1), k - 1).map(c => [v, ...c]));
}

const HAND_RANK_NAMES = [
  'High Card',
  'Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush',
];

export function getHandName(score: number): string {
  const handRank = Math.floor(score / (BASE ** 5));
  if (handRank === 8) {
    const kicker0 = Math.floor((score % (BASE ** 5)) / (BASE ** 4));
    if (kicker0 === 14) return 'Royal Flush';
  }
  return HAND_RANK_NAMES[handRank] || 'Unknown';
}

/**
 * Evaluate the best 5-card hand from hole cards + community cards.
 * Returns the hand name string, or null if not enough cards to evaluate.
 */
export function evaluateBestHand(
  holeCards: Card[],
  communityCards: Card[],
  variant: 'HOLDEM' | 'OMAHA' = 'HOLDEM'
): string | null {
  if (holeCards.length === 0) return null;

  const allCards = [...holeCards, ...communityCards];

  // Need at least 5 cards to make a hand
  if (allCards.length < 5) {
    // With fewer than 5 cards, give a basic description
    if (holeCards.length >= 2) {
      const values = holeCards.map(c => c.value).sort((a, b) => b - a);
      if (holeCards.length >= 2 && values[0] === values[1]) {
        return 'Pocket Pair';
      }
      const suited = holeCards.length >= 2 && holeCards[0].suit === holeCards[1].suit;
      if (suited) return 'Suited';
    }
    return null;
  }

  let bestScore = 0;

  if (variant === 'HOLDEM') {
    for (const combo of combinations(allCards, 5)) {
      const s = scoreHand(combo);
      if (s > bestScore) bestScore = s;
    }
  } else {
    // Omaha: exactly 2 from hole, 3 from board
    if (holeCards.length < 2 || communityCards.length < 3) return null;
    for (const hp of combinations(holeCards, 2)) {
      for (const bp of combinations(communityCards, 3)) {
        const s = scoreHand([...hp, ...bp]);
        if (s > bestScore) bestScore = s;
      }
    }
  }

  return getHandName(bestScore);
}
