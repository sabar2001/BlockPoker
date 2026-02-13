export enum Suit {
  HEARTS = '♥',
  DIAMONDS = '♦',
  CLUBS = '♣',
  SPADES = '♠',
}

export enum Rank {
  TWO = '2', THREE = '3', FOUR = '4', FIVE = '5', SIX = '6', SEVEN = '7',
  EIGHT = '8', NINE = '9', TEN = '10', JACK = 'J', QUEEN = 'Q', KING = 'K', ACE = 'A'
}

export interface Card {
  suit: Suit;
  rank: Rank;
  value: number; // for comparison
}

export interface Player {
  id: string;
  name: string;
  chips: number;
  hand: Card[];
  isBot: boolean;
  isFolded: boolean;
  isAllIn: boolean;
  currentBet: number; // Bet in the current round
  position: [number, number, number]; // 3D position
  color: string;
  chatMessage?: string;
  lastChatTime?: number;
  hasActed: boolean; // Track if player acted in current street
  lastAudioData?: string; // Base64 PCM audio data
}

export enum GameStage {
  PREFLOP,
  FLOP,
  TURN,
  RIVER,
  SHOWDOWN
}

export type GameVariant = 'HOLDEM' | 'OMAHA';

export interface GameState {
  variant: GameVariant;
  stage: GameStage;
  pot: number;
  communityCards: Card[];
  deck: Card[];
  currentTurnIndex: number;
  dealerIndex: number;
  highestBet: number;
  minBet: number;
  lastAggressorIndex: number; // To track when a round of betting ends
  winners: Player[];
}
