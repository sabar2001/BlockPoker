# Architecture Overview

## Application Type
First-person 3D multiplayer poker game with proximity voice chat

## Primary Goal
Browser-based multiplayer poker where players can hear each other via spatial audio based on their position at the table. AI bots serve as testing/practice opponents while multiplayer features are being developed.

## Core Technologies
- **React 18. 2** - UI framework
- **TypeScript 5.8** - Type safety
- **Three.js 0.161** - 3D rendering engine
- **React Three Fiber** - React renderer for Three.js
- **Vite 6.2** - Build tool and dev server
- **Google Gemini AI** - Bot testing (chat generation and TTS)
- **WebRTC** (planned) - Multiplayer networking and voice chat

## Application Flow

### Entry Point
`index.tsx` → `App.tsx` → `GameScene.tsx` + `HUD.tsx`

### State Management
Centralized in `App.tsx`:
- `players[]` - All player data (chips, hands, bets, positions)
- `gameState` - Current stage, pot, community cards, turn tracking
- `hasStarted` - Audio/game initialization flag
- `micVolume` - Audio visualization state

### Game Loop
1. **Initialization**: `initAudioAndGame()` - Sets up audio context and starts first round
2. **New Round**: `startNewRound()` - Deals cards, posts blinds, resets state
3. **Bot Turns**: `useEffect` triggers `handleBotTurn()` when bot is current player
4. **Actions**: `processAction()` - Handles fold/call/raise, updates state
5. **Round Completion**: `checkRoundCompletion()` - Advances stages or triggers showdown
6. **Showdown**: `handleShowdown()` - Determines winners, distributes pot, starts new round

## Component Hierarchy

```
App
├── GameScene
│   ├── PointerLockControls
│   ├── PokerTable (community cards, pot display)
│   ├── FirstPersonHand (user's cards rendered as weapon)
│   ├── PlayerAvatar[] (8 bots with spatial audio)
│   ├── Floor + Walls
│   └── Lighting (Sky, Ambient, Point)
└── HUD
    ├── Info Panel (game mode, FPS display)
    ├── Chat Feed (bot messages)
    ├── Chips/HP Display (user stats)
    ├── Community Cards Preview
    └── Action Buttons (fold/call/raise)
```

## Data Flow

### Poker Logic
`services/pokerLogic.ts` provides pure functions:
- `createDeck()` - Shuffled 52-card deck
- `dealCards()` - Extract N cards from deck
- `evaluateHandStrength()` - Calculates hand score (supports Hold'em/Omaha)
- `determineWinners()` - Compares all active player hands

### AI Integration
`services/geminiService.ts` (for test bots only):
- `generateBotChat()` - Text generation with personality/context
- `generateBotSpeech()` - PCM audio data for TTS

### Multiplayer System (in development)
- WebRTC peer connections for real-time state sync
- Voice chat using WebRTC audio streams
- Spatial audio processing for proximity-based volume
- Game state synchronization across clients

### Audio System
`PlayerAvatar.tsx` handles spatial audio:
- For bots: Decodes base64 PCM from Gemini TTS
- For multiplayer: Processes WebRTC audio streams
- Creates Three.js PositionalAudio buffer
- Plays audio from player's 3D position

## Key Design Patterns

### State Updates
- Immutable updates with spread operators
- Sequential updates for betting round logic
- Delayed state changes (setTimeout) for UX pacing

### 3D Rendering
- `useFrame()` for animation loops (bobbing, idle animations)
- `useThree()` for camera/context access
- `useRef()` for Three.js object manipulation

### Event Handling
- Keyboard listeners for action buttons (keys 1-3)
- Pointer lock events for FPS controls
- Audio context resumption for browser policies

## Configuration

### Constants (`constants.ts`)
- Blinds, starting chips
- Player positions (elliptical layout around table)
- Player names and colors (for test bots)

### Environment
- `GEMINI_API_KEY` injected via Vite as `process.env.API_KEY` (for bot testing)
- WebRTC configuration (planned) for multiplayer signaling

## Build System

### Vite Config
- Dev server on port 3000
- Environment variable injection
- Path alias `@/` for root imports

### Import Maps (`index.html`)
- ESM packages loaded from esm.sh CDN
- React, Three.js, Gemini client as external modules

## Future Multiplayer Architecture

### WebRTC Integration
- Peer-to-peer connections for game state
- Signaling server for initial connection
- STUN/TURN servers for NAT traversal
- Media streams for voice chat

### Voice Chat Processing
- Capture local microphone input
- Send to peers via WebRTC data channels
- Process remote streams with spatial audio
- Apply distance-based volume attenuation

### Game State Sync
- Host/client model or peer-to-peer consensus
- Action validation and conflict resolution
- Latency compensation
- Reconnection handling
