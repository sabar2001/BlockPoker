# Quick Reference

## File Map

| File | Purpose | Key Exports |
|------|---------|-------------|
| `App.tsx` | Game state & controller | App component, socket event subscriptions |
| `types.ts` | Client type definitions | Card, Player, GameState, GameStage, GameVariant |
| `constants.ts` | Configuration values | PLAYER_POSITIONS, PLAYER_COLORS, SUITS, RANKS |
| `shared/protocol.ts` | Shared types (client+server) | Socket events, PlayerLedgerEntry, TableConfig |
| `components/GameScene.tsx` | 3D environment | GameScene, PokerTable, FirstPersonHand |
| `components/HUD.tsx` | Desktop UI overlay | HUD (actions, ledger, emotes, keybinds) |
| `components/MobileControls.tsx` | Mobile touch controls | MobileControls (actions, emotes, ledger) |
| `components/MobileCardOverlay.tsx` | Mobile card display | MobileCardOverlay |
| `components/PlayerAvatar.tsx` | 3D player models | PlayerAvatar with head tracking |
| `components/Lobby.tsx` | Pre-game room management | Lobby |
| `components/SettingsModal.tsx` | Table settings (host) | SettingsModal |
| `services/socketService.ts` | Socket.io client | socketService singleton |
| `services/voiceService.ts` | WebRTC voice chat | voiceService singleton |
| `services/soundService.ts` | Game sound effects | soundService singleton |
| `services/pokerLogic.ts` | Client poker helpers | (legacy, minimal usage) |
| `utils/handEvaluator.ts` | Hand name display | evaluateBestHand |
| `utils/deviceDetection.ts` | Mobile detection | isMobileDevice, isTouchDevice |
| `server/index.ts` | Server entry point | Express + Socket.io setup |
| `server/GameManager.ts` | Poker logic (authoritative) | GameManager class |
| `server/RoomManager.ts` | Room management | RoomManager class |

## Game Stages

```typescript
enum GameStage {
  PREFLOP = 0,  // Initial betting (0 community cards)
  FLOP = 1,     // 3 community cards
  TURN = 2,     // 4 community cards
  RIVER = 3,    // 5 community cards
  SHOWDOWN = 4  // Reveal hands, determine winner
}
```

## Socket Events (Client → Server)

| Event | Payload | Purpose |
|-------|---------|---------|
| `room:create` | `{ playerName, buyIn, tableConfig? }` | Create room |
| `room:join` | `{ roomCode, playerName, buyIn }` | Join room |
| `room:leave` | — | Leave room |
| `room:ready` | `{ ready }` | Toggle ready |
| `room:settings` | `{ tableConfig? }` | Update settings (host) |
| `game:start` | — | Start game (host) |
| `game:action` | `{ action, amount? }` | Fold/call/raise |
| `game:deal` | — | Deal next round (host) |
| `game:rebuy` | `{ amount }` | Rebuy chips |
| `game:show-cards` | — | Reveal hand at showdown |
| `player:look` | `{ yaw, pitch }` | Head direction |
| `player:emote` | `{ emote }` | Send emote |
| `player:chat` | `{ message }` | Chat message |

## Socket Events (Server → Client)

| Event | Payload | Purpose |
|-------|---------|---------|
| `room:state` | `RoomState` | Room info update |
| `game:state` | `GameStateBroadcast` | Full game state (includes ledger) |
| `game:hand` | `HandDeal` | Private hand dealt |
| `game:round-end` | `{ winners, winAmount }` | Hand result |
| `game:new-round` | — | New round started |
| `game:timer-update` | `{ playerId, timeRemaining }` | Action timer |
| `game:log` | `GameLogEntry` | Actions history entry |
| `game:cards-revealed` | `{ playerId, playerName, cards }` | Card reveal |

## UI Controls

### Desktop (Keyboard)
| Key | Action |
|-----|--------|
| Mouse | Look around (pointer locked) |
| 1 | Fold |
| 2 | Call / Check |
| 3 | Raise (opens slider) |
| 4-9 | Emotes (wave, thumbsup, fistslam, laugh, cry, shrug) |
| S | Show cards (showdown, folded) |
| ← → | Adjust raise amount |
| Shift + ← → | Big raise steps |
| Enter | Confirm raise |
| Escape | Close slider / unlock pointer |

### Mobile (Touch)
| Gesture | Action |
|---------|--------|
| Swipe | Look around |
| Tap buttons | Fold / Call / Raise |
| Tap emote toggle | Expand emote menu |
| Tap ledger button | Open player ledger |

## Player Ledger Fields

| Field | Type | Description |
|-------|------|-------------|
| `playerName` | string | Player display name |
| `playerColor` | string | Avatar hex color |
| `handsPlayed` | number | Total hands dealt into |
| `handsWon` | number | Hands where player won pot |
| `chipsWon` | number | Total chips awarded from pots |
| `chipsBuyIn` | number | Total chips bought (initial + rebuys) |
| `chipsNet` | number | Current chips minus total buy-in |
| `isConnected` | boolean | Currently in room |
| `currentChips` | number | Current chip count |

## Table Config Defaults

| Setting | Default |
|---------|---------|
| Small Blind | 10 |
| Big Blind | 20 |
| Min Buy-In | 200 |
| Max Buy-In | 5000 |
| Action Timeout | 30s |
| Variant | Hold'em |

## Emotes

| Emote | Icon | Desktop Key |
|-------|------|-------------|
| wave | 👋 | 4 |
| thumbsup | 👍 | 5 |
| fistslam | 👊 | 6 |
| laugh | 😂 | 7 |
| cry | 😭 | 8 |
| shrug | 🤷 | 9 |

## Ports

| Port | Service |
|------|---------|
| 3000 | Vite dev server (client) |
| 3001 | Express + Socket.io (server) |

## Dependencies

### Client (root package.json)
| Package | Version | Purpose |
|---------|---------|---------|
| react | 18.2.0 | UI framework |
| react-dom | 18.2.0 | DOM rendering |
| three | 0.161.0 | 3D engine |
| @react-three/fiber | 8.15.16 | React Three.js renderer |
| @react-three/drei | 9.102.6 | Three.js helpers |
| socket.io-client | ^4.7.5 | Socket.io client |
| uuid | 9.0.1 | ID generation |
| vite | ^6.2.0 | Build tool |
| typescript | ~5.8.2 | Type checking |
| concurrently | ^9.1.0 | Run multiple commands |

### Server (server/package.json)
| Package | Version | Purpose |
|---------|---------|---------|
| express | ^4.21.0 | HTTP server |
| socket.io | ^4.7.5 | WebSocket server |
| uuid | ^9.0.1 | ID generation |
| cors | ^2.8.5 | CORS middleware |
| tsx | ^4.19.0 | TypeScript execution |
