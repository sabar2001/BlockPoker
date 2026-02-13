import { Rank, Suit } from './types';

export const DEFAULT_FONT = "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2";

export const SUITS = [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES];
export const RANKS = [
  Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX, Rank.SEVEN,
  Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE
];

// 9 seats on an oval table
const RADIUS_X = 7;
const RADIUS_Z = 5;
const ANGLES = [90, 50, 10, -30, -70, -110, -150, 170, 130].map(deg => deg * (Math.PI / 180));

export const PLAYER_POSITIONS = ANGLES.map(angle => [
  Math.cos(angle) * RADIUS_X,
  0,
  Math.sin(angle) * RADIUS_Z
]);

export const PLAYER_COLORS = [
  "#ffffff",
  "#ff4444",
  "#44ff44",
  "#4444ff",
  "#ffff44",
  "#ff44ff",
  "#00ffff",
  "#ff8800",
  "#8800ff"
];
