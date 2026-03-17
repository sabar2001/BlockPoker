# Architecture Overview

## Application Type
First-person 3D multiplayer poker game with proximity voice chat, running entirely in the browser.

## Primary Goal
Browser-based multiplayer poker where players sit around a virtual 3D table and communicate via spatial audio. The server is authoritative for all game logic; clients render state and send actions.

## Core Technologies
- **React 18.2** - UI framework
- **TypeScript 5.8** - Type safety (client + server)
- **Three.js 0.161** - 3D rendering engine
- **React Three Fiber 8.15** - React renderer for Three.js
- **Vite 6.2** - Build tool and dev server
- **Node.js + Express** - Backend HTTP server
- **Socket.io 4.7** - Real-time bidirectional communication
- **WebRTC** - Peer-to-peer voice chat with spatial audio

## Application Flow

### Entry Point
`index.tsx` → `App.tsx` → `Lobby.tsx` (pre-game) or `GameScene.tsx` + `HUD.tsx`/`MobileControls.tsx` (in-game)

### State Management
Centralized in `App.tsx`, driven by Socket.io events from server:
- `players[]` - All player data (chips, bets, positions, emotes)
- `gameStage` - Current stage (PREFLOP through SHOWDOWN)
- `communityCards`, `pot`, `myHand` - Game state
- `gameLogs` - Actions history feed
- `ledger` - Player stats (hands, wins, chips, net profit/loss)
- `roomCode`, `hostId` - Room management
- `revealedCards`, `showdownResults`, `sidePots` - Showdown data

### Game Loop (Server-Authoritative)
1. **Room Setup**: Host creates room → players join → all ready up
2. **Deal**: `GameManager.startNewRound()` - shuffles, deals, posts blinds
3. **Betting**: Players send actions via Socket.io → server validates and broadcasts
4. **Progression**: Server advances stages (flop/turn/river) automatically
5. **Showdown**: Server evaluates hands, distributes pots (including side pots), updates ledger
6. **Auto-Deal**: After 7s delay, next hand auto-deals

## Component Hierarchy

```
App
├── Lobby (pre-game)
│   ├── Name Entry
│   ├── Create/Join Room
│   ├── Table Settings
│   └── Ready/Start
└── Game (in-game)
    ├── GameScene (3D canvas)
    │   ├── CameraPositioner
    │   ├── PokerTable (felt, community cards, pot)
    │   ├── FirstPersonHand (user's cards as FPS weapon)
    │   ├── PlayerAvatar[] (other players with head tracking)
    │   ├── Floor + Arena
    │   └── Lighting (Sky, Ambient, Point)
    ├── HUD (desktop overlay)
    │   ├── Info Panel (room code, player count, variant)
    │   ├── Actions History Feed (top-right, formerly "Game Log")
    │   ├── Chips/Bet Display + Best Hand (bottom-left)
    │   ├── Emote Menu (expandable, bottom-left)
    │   ├── Action Buttons (fold/call/raise, bottom-right)
    │   ├── Raise Slider Panel
    │   ├── Ledger Modal (player stats table)
    │   ├── Keybinds Panel (floating reference)
    │   └── Settings Modal (host-only)
    └── MobileControls (touch interface)
        ├── Touch Camera Area
        ├── Top HUD (room code, chips, pot, ledger button)
        ├── Emote Menu (expandable toggle)
        ├── Action Buttons (bottom, large touch targets)
        ├── Raise Slider Panel
        ├── Ledger Modal
        └── MobileCardOverlay
```

## Data Flow

### Client → Server → Client
1. User taps action button → `socketService.sendAction()`
2. Socket.io emits `game:action` to server
3. `GameManager.processAction()` validates and updates state
4. Server broadcasts `game:state` to all clients in room
5. `App.tsx` updates React state → components re-render

### Real-Time Features
- **Head Tracking**: `player:look` events at ~15fps, volatile delivery
- **Emotes**: `player:emote` → 3s display above avatar
- **Voice**: WebRTC peer connections, spatial audio via Web Audio API
- **Timer**: Server broadcasts countdown, client shows visual + sound

## Server Architecture

### GameManager (Authoritative)
- Manages deck, dealing, betting rounds, showdowns
- Tracks player ledger (cumulative stats: hands, wins, buy-ins, net)
- Handles side pots for all-in scenarios
- Action timer with auto-fold on timeout
- Emits callbacks for state changes, round ends, hand deals

### RoomManager
- Room creation/joining with 6-character codes
- Host management (auto-transfer on disconnect)
- Socket event routing to correct GameManager
- WebRTC signaling relay (offer/answer/ICE)

## Key Design Patterns

- **Server-Authoritative**: All game logic server-side, clients are thin renderers
- **Event-Driven**: Socket.io events drive all state changes
- **Immutable State Updates**: React state via functional `setState`
- **Responsive Design**: Separate desktop (HUD) and mobile (MobileControls) paths
- **Expandable Menus**: Emotes and keybinds are toggleable for mobile compatibility

## Configuration

### Table Settings (per-room, host-configurable)
- Small/Big Blind, Min/Max Buy-In, Action Timeout, Variant (Hold'em/Omaha)

### Environment
- No `.env` required for local dev
- `VITE_SERVER_URL` defaults to `http://localhost:3001` in dev
- Production: server serves built client as static files

## Build System

### Vite Config
- Dev server on port 3000 with proxy awareness
- React plugin with HMR
- Production build to `dist/`

### Import Maps (`index.html`)
- React, Three.js, R3F loaded from esm.sh CDN in dev
- Vite bundles everything for production
