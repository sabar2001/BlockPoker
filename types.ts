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
  value: number;
}

export interface Player {
  id: string;
  name: string;
  chips: number;
  hand: Card[];
  isBot: boolean;
  isFolded: boolean;
  isAllIn: boolean;
  currentBet: number;
  position: [number, number, number];
  color: string;
  hasActed: boolean;
  chatMessage?: string;
  // Multiplayer: real-time look direction
  lookYaw?: number;
  lookPitch?: number;
  // Multiplayer: voice activity
  isSpeaking?: boolean;
  // Multiplayer: emotes
  emote?: string;
  // Multiplayer: ready state
  isReady?: boolean;
}

export enum GameStage {
  PREFLOP,
  FLOP,
  TURN,
  RIVER,
  SHOWDOWN
}

export type GameVariant = 'HOLDEM' | 'OMAHA';

export interface ShowdownPlayerResult {
  playerId: string;
  playerName: string;
  cards: Card[];
  handName: string;
  isWinner: boolean;
}

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
  lastAggressorIndex: number;
  winners: Player[];
}
