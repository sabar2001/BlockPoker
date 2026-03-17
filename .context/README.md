# PokerPov Context Documentation

Quick reference guide for understanding and extending the PokerPov multiplayer poker game.

## Contents

1. **[README.md](README.md)** - Quick overview (you are here)
2. **[ARCHITECTURE.md](ARCHITECTURE.md)** - System design, data flow, and core patterns
3. **[COMPONENTS.md](COMPONENTS.md)** - Detailed component API and function reference
4. **[DEVELOPMENT.md](DEVELOPMENT.md)** - Development workflow, debugging, and deployment
5. **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Lookup tables, file map, constants
6. **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - High-level overview, decisions, roadmap

## Quick Facts

**Type**: Browser-based multiplayer poker game with proximity voice chat  
**Status**: Fully functional multiplayer via Socket.io + WebRTC voice  
**Stack**: React 18.2 + TypeScript 5.8 + Three.js/R3F (client) | Node.js + Express + Socket.io (server)  
**Game Modes**: Texas Hold'em, Omaha  
**Players**: Up to 9 per table  
**Voice**: Peer-to-peer WebRTC with spatial audio processing

## Project Structure

```
PokerPov/
├── components/
│   ├── GameScene.tsx        # 3D scene, camera, table, avatars
│   ├── HUD.tsx              # Desktop UI overlay (actions, emotes, ledger, keybinds)
│   ├── MobileControls.tsx   # Mobile touch controls, actions, emotes, ledger
│   ├── MobileCardOverlay.tsx# Mobile card display
│   ├── PlayerAvatar.tsx     # 3D player models with head tracking
│   ├── Lobby.tsx            # Room create/join, buy-in, ready state
│   └── SettingsModal.tsx    # Table settings (host-only)
├── services/
│   ├── socketService.ts     # Socket.io client wrapper
│   ├── voiceService.ts      # WebRTC peer-to-peer voice chat
│   ├── soundService.ts      # Game sound effects
│   └── pokerLogic.ts        # Client-side poker helpers
├── utils/
│   ├── handEvaluator.ts     # Hand evaluation for display
│   └── deviceDetection.ts   # Mobile/touch detection
├── shared/
│   └── protocol.ts          # Shared types and Socket.io event contracts
├── server/
│   ├── index.ts             # Express + Socket.io entry point
│   ├── GameManager.ts       # Authoritative poker logic + player ledger
│   └── RoomManager.ts       # Room/lobby management
├── App.tsx                  # Main app, server-driven state
├── types.ts                 # Client types
├── constants.ts             # Table positions, colors
└── vite.config.ts           # Vite config
```

## Core Game Loop

1. Host creates room with table settings (blinds, buy-in range, variant)
2. Players join via 6-character room code, choose buy-in
3. All ready up → host starts game
4. Server deals cards, posts blinds, manages betting rounds
5. Preflop → Flop → Turn → River → Showdown
6. Winner(s) awarded pot, ledger updated, auto-deals next hand

## Key Features

- **Player Ledger**: Tracks hands played, hands won, chips won, buy-in totals, and net profit/loss for all players including disconnected ones
- **Actions History**: Real-time game log (formerly "Game Log") showing all actions, deals, and results
- **Emote Menu**: Expandable click-to-open menu (mobile-friendly, replaces keybind-only emotes)
- **Keybinds Panel**: Accessible via button on desktop, hidden on mobile
- **Proximity Voice**: WebRTC spatial audio with distance-based volume
- **Configurable Tables**: Blinds, buy-in range, action timeout, variant selection

## Environment Setup

```bash
npm install                          # Client deps
cd server && npm install && cd ..    # Server deps
npm run dev:all                      # Both (client :3000, server :3001)
```

No database, Docker, or environment variables required for local development.

---

For detailed information, see individual documentation files in this folder.
