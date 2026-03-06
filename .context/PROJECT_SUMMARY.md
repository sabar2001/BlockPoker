# Project Summary

## Overview
**PokerPov** is a first-person 3D multiplayer poker game that merges FPS gaming aesthetics (inspired by Krunker.io) with competitive poker gameplay. The core innovation is **proximity-based voice chat** that lets players hear each other based on their spatial position at the poker table, creating an immersive social poker experience in the browser.

## What Makes This Project Unique

1. **FPS Perspective**: Cards rendered as weapons in first-person view
2. **Proximity Voice Chat**: Real-time spatial audio between players via WebRTC
3. **Browser Multiplayer**: No downloads, play directly in your browser via Socket.io
4. **Dual Poker Variants**: Seamless toggle between Hold'em and Omaha
5. **3D Social Experience**: Blocky player avatars with head tracking around a physical poker table
6. **Player Ledger**: Cumulative session stats tracking wins, losses, and net profit for all players
7. **Mobile Support**: Touch-optimized controls with expandable menus

## Technology Decisions

### Why React Three Fiber?
- Declarative 3D rendering in React
- Component-based architecture for 3D objects
- Hooks for animations (`useFrame`) and context (`useThree`)
- Easy integration with React state management

### Why Socket.io?
- Real-time bidirectional communication
- Room-based multiplayer with automatic reconnection
- Typed events shared between client and server
- Reliable delivery for game actions, volatile for head tracking

### Why WebRTC?
- Peer-to-peer voice chat with low latency
- Built-in audio capture and spatial processing
- NAT traversal with STUN servers
- No plugin or download required

### Why Server-Authoritative?
- Prevents cheating — all game logic validated server-side
- Simplifies client code — just render and send actions
- Consistent state across all connected clients
- Easy to add spectator mode or replays

## Technical Achievements

### Poker Logic
- Complete Hold'em and Omaha hand evaluation (server-side)
- Combination-based scoring with proper hand ranking
- Side pot calculation for multi-way all-in scenarios
- Betting round management with action timer and auto-fold

### Player Ledger
- Cumulative session stats: hands played, hands won, chips won, buy-in totals, net profit/loss
- Persists across disconnections — disconnected players still visible in ledger
- Accessible via modal on both desktop and mobile
- Updates in real-time after each hand

### UI/UX
- **Responsive Design**: Separate desktop (HUD with keybinds) and mobile (touch controls) interfaces
- **Expandable Emote Menu**: Click-to-open for mobile compatibility (replaces keybind-only emotes)
- **Keybinds Panel**: Accessible via button on desktop, hidden on mobile
- **Actions History**: Real-time game log with color-coded entries

### 3D Rendering
- Elliptical player layout with seat-relative camera positioning
- FPS-style hand rendering with bobbing animation
- Network-driven head tracking (~15fps)
- Emote sprites and chat bubbles above avatars

### Audio System
- WebRTC peer-to-peer voice chat
- Spatial audio via Web Audio API (distance-based volume, directional panning)
- Push-to-talk (V key) support
- Game sound effects (deal, chip, fold, raise, win, tick)

## Code Quality

- TypeScript strict mode (client + server)
- Functional React components with hooks
- Server-authoritative design prevents client-side cheating
- Shared protocol types ensure type safety across client/server
- Clean separation: components → services → server
- Responsive design with desktop/mobile code paths

## Current Status

### Implemented
- Complete multiplayer poker (Hold'em & Omaha)
- Room system with codes, host controls, table settings
- WebRTC voice chat with spatial audio
- Player ledger with cumulative session stats
- Expandable emote menu (mobile-friendly)
- Desktop keybinds panel
- Actions history (game log)
- Side pot support
- Rebuy system
- Showdown with card reveals
- Mobile touch controls

### Potential Enhancements
- Persistent accounts and stats across sessions
- Tournament mode
- Spectator mode
- Chat history and muting
- Leaderboards
- Custom avatar skins

## Key Insights

1. **Proximity Chat is the Killer Feature**: Voice-based bluffing adds psychological depth
2. **FPS Perspective Increases Tension**: First-person view makes poker more immersive
3. **Mobile Support Matters**: Expandable menus and large touch targets make the game accessible
4. **Server Authority is Essential**: Prevents cheating and simplifies client logic
5. **Ledger Adds Stakes**: Tracking cumulative wins/losses makes casual games feel consequential

---

**Last Updated**: March 2026
**Status**: Feature Complete, Production Ready
**License**: MIT
