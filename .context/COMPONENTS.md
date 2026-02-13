# Component Reference

## App.tsx
**Purpose**: Main game controller and state manager

**State**:
- `players` - Array of 9 players (index 0 = user)
- `gameState` - Stage, pot, cards, turn tracking
- `hasStarted` - Init flag
- `micVolume` - Audio level for visualization

**Key Functions**:
- `initAudioAndGame()` - Audio setup + game start
- `startNewRound()` - Deal cards, post blinds, reset betting
- `handleBotTurn()` - AI decision making (fold/call/raise)
- `processAction()` - Execute player action, update state
- `nextStage()` - Advance preflop→flop→turn→river→showdown
- `handleShowdown()` - Winner determination, pot distribution
- `checkRoundCompletion()` - Validate if betting round is complete
- `moveToNextPlayer()` - Increment turn index
- `updatePlayerChat()` - Display/clear chat messages

**Bot Behavior**:
- Hand strength threshold: 500 for Omaha, 100 for Hold'em
- Randomized actions with strength-based weights
- 15% chance to generate chat message on action

---

## GameScene.tsx
**Purpose**: 3D environment and rendering

**Sub-Components**:
- `CardMesh` - 3D card with rank/suit text
- `FirstPersonHand` - User's cards positioned like FPS weapon (bobbing, sway)
- `PokerTable` - Octagonal table with felt, community cards, floating pot display
- `Floor` - Grid-based ground plane
- `Walls` - Arena boundary boxes
- `SceneContent` - Main scene wrapper with controls and lighting

**Features**:
- Pointer lock controls for FPS camera
- Dynamic Sky with low turbidity
- Shadows enabled on table and avatars
- Audio listener attached to camera

---

## HUD.tsx
**Purpose**: 2D UI overlay (FPS-style HUD)

**Sections**:
1. **Top-Left**: Game title, mode toggle, FPS/ping display
2. **Top-Right**: Chat feed (scrollable, colored by player)
3. **Bottom-Left**: User chips (HP bar style), current bet
4. **Bottom-Center**: Pot amount, community card preview (5 slots)
5. **Bottom-Right**: Action buttons (fold/call/raise) with keyboard shortcuts

**Interaction**:
- Keyboard: 1=Fold, 2=Call, 3=Raise
- Mouse: Toggle game mode button
- Pointer lock overlay when camera not locked

**Styling**: VT323 font, Krunker-inspired borders, shadow effects

---

## PlayerAvatar.tsx
**Purpose**: 3D blocky player models with spatial audio

**Visual**:
- Torso (box, player color)
- Head (box, flesh tone) with visor/sunglasses
- Legs (2 boxes, black)
- Floating nameplate with level
- Bet amount text (if active)
- Chat bubble (HTML overlay)

**Audio**:
- Decodes base64 PCM from `player.lastAudioData`
- Creates Three.js PositionalAudio buffer
- Ref distance: 2, rolloff: 1, volume: 1.5

**Animation**:
- Idle float (sin wave on Y axis)
- Faces table center (lookAt)

**Notes**: User avatar not rendered (first-person view)

---

## services/pokerLogic.ts
**Purpose**: Pure poker game logic

**Functions**:
- `createDeck()` - 52 cards, shuffled
- `dealCards(deck, count)` - Extract N cards
- `evaluateHandStrength(hole, community, variant)` - Returns numeric score
  - Hold'em: Best 5 from 7 cards
  - Omaha: Exactly 2 from hand + 3 from board
- `determineWinners(players, community, variant)` - Highest score wins

**Scoring System**:
- High card: +value (2-14)
- Pair: +1000
- Two pair: +2000
- Trips: +3000
- Straight: +4000
- Flush: +5000
- Full house: +6000
- Quads: +7000
- Straight flush: +9000

**Helpers**:
- `getCombinations()` - Generate k-combinations from array
- `calculateScore()` - Internal 5-card hand evaluator

---

## services/geminiService.ts
**Purpose**: AI chat and TTS integration

**Functions**:
- `generateBotChat(botName, context, personality)` - Returns short chat message
  - Model: gemini-3-flash-preview
  - Max tokens: 20
  - Temperature: 0.9
  - Thinking budget: 0 (faster responses)
  - System prompt: Gamer slang, trash-talk, 6 words max

- `generateBotSpeech(text)` - Returns base64 PCM audio
  - Model: gemini-2.5-flash-preview-tts
  - Voice: Kore
  - Handles "non-audio response" errors gracefully

**Error Handling**: Fallback to default messages if API fails

---

## types.ts
**Purpose**: TypeScript interfaces

**Key Types**:
- `Card` - suit, rank, value
- `Player` - id, name, chips, hand, position, betting state, chat, audio
- `GameStage` - enum (PREFLOP, FLOP, TURN, RIVER, SHOWDOWN)
- `GameVariant` - 'HOLDEM' | 'OMAHA'
- `GameState` - variant, stage, pot, cards, turn tracking, winners

---

## constants.ts
**Purpose**: Game configuration

**Values**:
- `INITIAL_CHIPS`: 1000
- `BIG_BLIND`: 20
- `SMALL_BLIND`: 10
- `PLAYER_POSITIONS`: Elliptical layout (9 positions)
- `PLAYER_NAMES`: ["You", "xX_Slayer", "CryptoKing", ...]
- `PLAYER_COLORS`: 9 hex colors
- `DEFAULT_FONT`: Roboto WOFF2 URL
