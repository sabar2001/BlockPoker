import { Rank, Suit } from './types';

export const INITIAL_CHIPS = 1000;
export const BIG_BLIND = 20;
export const SMALL_BLIND = 10;

export const DEFAULT_FONT = "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2";

export const SUITS = [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES];
export const RANKS = [
  Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX, Rank.SEVEN,
  Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE
];

// 9 Players on an oval table (approx radius 4.5)
const RADIUS_X = 5;
const RADIUS_Z = 3.5;
// User is at 0, 0, 4.5 (roughly) - South position
// We distribute 9 players from angle PI/2 (South) counter-clockwise
// Angles: 90, 50, 10, -30, -70, -110, -150, 170, 130
const ANGLES = [90, 50, 10, -30, -70, -110, -150, 170, 130].map(deg => deg * (Math.PI / 180));

export const PLAYER_POSITIONS = ANGLES.map(angle => [
  Math.cos(angle) * RADIUS_X,
  0,
  Math.sin(angle) * RADIUS_Z
]);

export const PLAYER_NAMES = [
  "You", 
  "xX_Slayer", 
  "CryptoKing", 
  "BluffGod", 
  "NoobSlayer", 
  "PogChamp",
  "RiverRat",
  "AllInAndy",
  "FoldMaster"
];

export const PLAYER_COLORS = [
  "#ffffff", // User
  "#ff4444", 
  "#44ff44", 
  "#4444ff", 
  "#ffff44", 
  "#ff44ff",
  "#00ffff",
  "#ff8800",
  "#8800ff"
];
