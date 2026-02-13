# Quick Reference

## File Map

| File | Purpose | Key Exports |
|------|---------|-------------|
| `App.tsx` | Game state & controller | App component, game loop logic |
| `types.ts` | Type definitions | Card, Player, GameState, GameStage, GameVariant |
| `constants.ts` | Configuration values | INITIAL_CHIPS, BIG_BLIND, PLAYER_POSITIONS |
| `components/GameScene.tsx` | 3D environment | GameScene, CardMesh, PokerTable, FirstPersonHand |
| `components/HUD.tsx` | 2D UI overlay | HUD component with action buttons |
| `components/PlayerAvatar.tsx` | Bot 3D models | PlayerAvatar with spatial audio |
| `services/pokerLogic.ts` | Poker rules engine | createDeck, evaluateHandStrength, determineWinners |
| `services/geminiService.ts` | AI integration | generateBotChat, generateBotSpeech |
| `index.tsx` | React mount point | ReactDOM.render |
| `index.html` | HTML shell | Import maps, TailwindCSS CDN |
| `vite.config.ts` | Build config | Environment variable injection |

## State Structure

```typescript
// App.tsx main state
players: Player[] // 9 players (index 0 = user)
gameState: {
  variant: 'HOLDEM' | 'OMAHA'
  stage: GameStage // PREFLOP, FLOP, TURN, RIVER, SHOWDOWN
  pot: number
  communityCards: Card[]
  deck: Card[]
  currentTurnIndex: number
  dealerIndex: number
  highestBet: number
  minBet: number
  lastAggressorIndex: number
  winners: Player[]
}
hasStarted: boolean
micVolume: number
```

## Function Reference

### App.tsx

| Function | Parameters | Description |
|----------|------------|-------------|
| `initAudioAndGame()` | - | Setup audio context, start game |
| `handleToggleVariant()` | - | Switch Hold'em ↔ Omaha |
| `startNewRound(variant)` | GameVariant | Deal cards, post blinds, reset state |
| `nextStage()` | - | Advance game stage, deal community cards |
| `handleShowdown(players, cards)` | Player[], Card[] | Determine winners, award pot |
| `handleBotTurn(bot)` | Player | Bot AI decision making |
| `processAction(id, action, amt)` | string, 'fold'\|'call'\|'raise', number | Execute player action |
| `checkRoundCompletion(...)` | - | Check if betting round complete |
| `moveToNextPlayer(players)` | Player[] | Increment turn index |
| `updatePlayerChat(id, text)` | string, string | Display chat bubble |
| `handleUserAction(action, amt)` | 'fold'\|'call'\|'raise', number | User action handler |

### services/pokerLogic.ts

| Function | Return Type | Description |
|----------|-------------|-------------|
| `createDeck()` | Card[] | Shuffled 52-card deck |
| `dealCards(deck, count)` | {hand, remainingDeck} | Extract N cards |
| `evaluateHandStrength(hole, comm, variant)` | number | Calculate hand score |
| `determineWinners(players, comm, variant)` | Player[] | Find best hand(s) |

### services/geminiService.ts

| Function | Return Type | Description |
|----------|-------------|-------------|
| `generateBotChat(name, context, personality)` | Promise\<string\> | Generate chat text |
| `generateBotSpeech(text)` | Promise\<string\|undefined\> | Generate audio PCM |

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `INITIAL_CHIPS` | 1000 | Starting chip count |
| `BIG_BLIND` | 20 | Big blind amount |
| `SMALL_BLIND` | 10 | Small blind amount |
| `PLAYER_POSITIONS` | [x,y,z][] | 9 positions around table |
| `PLAYER_NAMES` | string[] | Bot names |
| `PLAYER_COLORS` | string[] | Hex colors for avatars |

## Game Stages

```typescript
enum GameStage {
  PREFLOP,   // Initial betting (0 community cards)
  FLOP,      // 3 community cards
  TURN,      // 4 community cards
  RIVER,     // 5 community cards
  SHOWDOWN   // Reveal hands, determine winner
}
```

## Bot Decision Logic

```typescript
// In handleBotTurn()
if (handStrength > threshold && random > 0.3) {
  action = 'raise'
} else if (handStrength > threshold/4 || callAmount === 0 || random > 0.6) {
  action = 'call'
} else {
  action = 'fold'
}

// Chat generation: 15% chance (random > 0.85)
```

## Hand Strength Thresholds

- **Hold'em**: 100 (base), 25 (min for call)
- **Omaha**: 500 (base), 125 (min for call)

## Scoring Values

| Hand | Score Modifier |
|------|----------------|
| High Card | +value (2-14) |
| Pair | +1000 |
| Two Pair | +2000 |
| Three of a Kind | +3000 |
| Straight | +4000 |
| Flush | +5000 |
| Full House | +6000 |
| Four of a Kind | +7000 |
| Straight Flush | +9000 |

## UI Controls

| Input | Action |
|-------|--------|
| Click | Lock pointer (FPS mode) |
| Mouse Move | Look around |
| Key `1` | Fold |
| Key `2` | Call/Check |
| Key `3` | Raise |
| ESC | Release pointer |
| Yellow Button | Toggle game mode |

## 3D Scene Layout

```
Camera (FPS view at [0, 2, 6])
├── Table (cylinder at [0, -0.2, 0])
├── Players (ellipse around table, radius X: 5, Z: 3.5)
├── Floor (grid at Y: -3)
├── Walls (4 box meshes at ±20 units)
└── Sky (shader background)
```

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | 18.2.0 | UI framework |
| react-dom | 19.2.4 | DOM rendering |
| three | 0.161.0 | 3D engine |
| @react-three/fiber | 8.15.16 | React renderer for Three.js |
| @react-three/drei | 9.102.6 | Three.js helpers |
| @google/genai | 0.2.1 | Gemini AI client |
| typescript | 5.8.2 | Type checking |
| vite | 6.2.0 | Build tool |

## API Models

| Model | Purpose |
|-------|---------|
| gemini-3-flash-preview | Chat generation |
| gemini-2.5-flash-preview-tts | Text-to-speech |

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `GEMINI_API_KEY` | Yes | Google AI API authentication |

## Ports

| Port | Service |
|------|---------|
| 3000 | Vite dev server |

## Build Output

| Command | Output Directory |
|---------|------------------|
| `npm run build` | `dist/` |
| `npm run dev` | In-memory (HMR) |
