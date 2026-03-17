# Component Reference

## App.tsx
**Purpose**: Main game controller and state manager. All game state is driven by Socket.io events from the server.

**State** (key fields):
- `screen` - 'lobby' | 'game'
- `players` - Array of connected players (client representation)
- `myHand` - Current player's hole cards
- `communityCards`, `pot`, `currentTurnIndex` - Game state
- `gameStage` - PREFLOP through SHOWDOWN
- `gameLogs` - Actions history entries
- `ledger` - Player ledger entries (cumulative stats)
- `roomCode`, `hostId` - Room management
- `showdownResults`, `revealedCards`, `sidePots` - Showdown display

**Key Functions**:
- `handleGameStart()` - Transition to game, init voice chat
- `handleUserAction(action, amount?)` - Send action to server
- `handleToggleVariant()` - Switch Hold'em ↔ Omaha
- `handleCameraRotate(yaw, pitch)` - Mobile camera control

**Data Flow**: Subscribes to socket events in `useEffect` → updates state → passes down to HUD/MobileControls/GameScene

---

## components/HUD.tsx
**Purpose**: Desktop UI overlay with game controls and information panels

**Sections**:
1. **Top-Left**: Game info (title, players, variant, room code), buttons (Leave, Settings, Ledger, Keybinds)
2. **Top-Right**: Actions History feed (formerly "Game Log") — color-coded, last 20 entries
3. **Bottom-Left**: Chips display, current bet, best hand indicator, rebuy UI, expandable emote menu
4. **Bottom-Center**: Pot display, side pots, community cards, deal button, showdown results
5. **Bottom-Right**: Action buttons (fold/call/raise), raise slider, timer

**Modals/Panels**:
- **Ledger Modal**: Table showing all players' hands played, hands won, chips won, buy-in, net profit/loss (includes disconnected players)
- **Keybinds Panel**: Floating reference panel showing all keyboard shortcuts (desktop only)
- **Settings Modal**: Table configuration (host-only)
- **Emote Menu**: Expandable button → emoji grid (replaces always-visible bar)

**Props**: `user`, `players`, `gameState`, `pot`, `gameLogs`, `ledger`, `tableConfig`, `sidePots`, etc.

---

## components/MobileControls.tsx
**Purpose**: Touch-optimized controls for mobile devices

**Features**:
- Full-screen touch area for camera rotation (swipe to look)
- Large action buttons with touch-optimized sizing
- Expandable emote menu (toggle button → emoji grid)
- Ledger button in top-right area
- Ledger modal (card-based layout for small screens)
- Timer display, deal button, rebuy UI
- No keybind references (touch-only interface)

---

## components/Lobby.tsx
**Purpose**: Pre-game room management

**Screens**:
- Name entry + Create/Join buttons
- Table settings form (blinds, buy-in range, variant)
- Waiting room (player list, ready states, room code, start button)

---

## components/GameScene.tsx
**Purpose**: 3D environment and rendering

**Sub-Components**:
- `CameraPositioner` - FPS camera with pointer lock, seat-relative rotation
- `PokerTable` - Octagonal table with felt and community cards
- `FirstPersonHand` - User's cards as FPS weapon (bobbing, sway)
- `SpatialAudioUpdater` - Updates spatial audio based on camera position
- `Floor` + arena geometry
- Dynamic Sky lighting

---

## components/PlayerAvatar.tsx
**Purpose**: 3D blocky player models

**Visual**: Torso + head (with visor) + legs, colored per player
**Features**:
- Floating nameplate with chip count
- Bet amount display
- Chat bubble overlay
- Emote sprite (3s duration, shown above head)
- Network-driven head tracking (yaw/pitch from server)
- Speaking indicator

---

## components/SettingsModal.tsx
**Purpose**: Host-only table configuration modal

**Fields**: Small blind, big blind, min/max buy-in, action timeout, variant toggle
**Behavior**: Changes applied immediately if between hands, or pending next hand if mid-game

---

## components/MobileCardOverlay.tsx
**Purpose**: Mobile-optimized display of player's hole cards and community cards

---

## server/GameManager.ts
**Purpose**: Authoritative poker game logic (server-side)

**Key Features**:
- Complete deck management, dealing, betting round progression
- Hand evaluation (Hold'em and Omaha) with combination-based scoring
- Side pot calculation for all-in scenarios
- Action timer with auto-fold
- **Player Ledger**: Tracks per-player cumulative stats (handsPlayed, handsWon, chipsWon, chipsBuyIn, chipsNet, isConnected) including disconnected players
- Game log management (last 50 entries)

**Public Methods**:
- `addPlayer(id, name, buyIn)` - Join game
- `removePlayer(id)` - Leave/disconnect (preserves ledger)
- `startGame()`, `startNewRound()` - Game flow
- `processAction(playerId, action, amount?)` - Validate and execute action
- `rebuy(playerId, amount)` - Re-buy with ledger tracking
- `showCards(playerId)` - Voluntary card reveal at showdown
- `getGameState()` - Full state broadcast (includes ledger)
- `getLedger()` - All ledger entries

---

## server/RoomManager.ts
**Purpose**: Room lifecycle and socket event routing

**Features**:
- Room creation with 6-character codes
- Player join/leave with host auto-transfer
- Socket event routing to GameManager
- WebRTC signaling relay (voice:offer/answer/ice-candidate)
- Room cleanup when empty

---

## services/socketService.ts
**Purpose**: Socket.io client wrapper (singleton)

**Methods**: `connect()`, `createRoom()`, `joinRoom()`, `sendAction()`, `sendEmote()`, `sendLook()`, `rebuy()`, `showCards()`, `dealNextRound()`, `updateSettings()`

---

## services/voiceService.ts
**Purpose**: WebRTC peer-to-peer voice chat with spatial audio

---

## services/soundService.ts
**Purpose**: Game sound effects (deal, chip, fold, raise, win, tick, etc.)

---

## shared/protocol.ts
**Purpose**: Shared TypeScript types for Socket.io events

**Key Types**: `Card`, `PublicPlayer`, `GameStateBroadcast`, `GameLogEntry`, `TableConfig`, `PlayerLedgerEntry`, `ShowdownResult`, `SidePotInfo`, `RoomState`

**Events**: `ClientToServerEvents`, `ServerToClientEvents` (fully typed Socket.io)

---

## types.ts
**Purpose**: Client-side TypeScript interfaces

**Key Types**: `Card`, `Player`, `GameStage`, `GameVariant`, `ShowdownPlayerResult`, `GameState`
