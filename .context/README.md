# BlockPoker Context Documentation

Quick reference guide for understanding and extending the Blocky Bluff 3D multiplayer poker game.

## Contents

1. **[README.md](README.md)** - Quick overview of the project with fast facts and common entry points
2. **[ARCHITECTURE.md](ARCHITECTURE.md)** - System design, data flow, and core patterns
3. **[COMPONENTS.md](COMPONENTS.md)** - Detailed component API and function reference
4. **[DEVELOPMENT.md](DEVELOPMENT.md)** - Development workflow, debugging, and deployment

## Quick Facts

**Type**: Browser-based multiplayer poker game with proximity voice chat  
**Current Status**: Single-player with AI bots (multiplayer in development)  
**Stack**: React + TypeScript + Three.js + WebRTC (planned)  
**Game Modes**: Texas Hold'em, Omaha  
**Players**: Up to 9 players per table  

## Project Structure

```
BlockPoker/
├── components/        # React components (GameScene, HUD, PlayerAvatar)
├── services/          # Pure logic (pokerLogic, geminiService)
├── .context/          # This documentation folder
├── App.tsx            # Main game controller
├── types.ts           # TypeScript interfaces
├── constants.ts       # Game configuration
└── index.tsx/html     # Entry points
```

## Key Technologies

- **React Three Fiber** - 3D rendering in React
- **Three.js** - WebGL 3D engine with spatial audio
- **WebRTC** (planned) - P2P multiplayer and voice chat
- **Google Gemini** - AI test bots (development only)
- **Vite** - Build tool
- **TailwindCSS** - Styling

## Core Game Loop

1. Deal cards (2 for Hold'em, 4 for Omaha)
2. Post blinds (SB: $10, BB: $20)
3. Betting rounds: Preflop → Flop → Turn → River
4. Showdown: Evaluate hands, award pot
5. Rotate dealer, repeat

## Bot AI

- Evaluates hand strength based on community cards
- Makes decisions: fold/call/raise (strength + randomness)
- Generates contextual chat 15% of the time (Gemini)
- Speech synthesized to spatial audio at bot position
- **Purpose**: Testing and practice before multiplayer launch

## Common Entry Points

### Modify Game Rules
→ `constants.ts`, `services/pokerLogic.ts`

### Change UI/UX
→ `components/HUD.tsx`, `components/GameScene.tsx`

### Adjust Bot Behavior (Testing Only)
→ `App.tsx` (`handleBotTurn()`)

### Implement Multiplayer
→ Start with WebRTC signaling server, then peer connections

### Add Voice Chat
→ Extend spatial audio system to handle WebRTC streams

## Environment Setup

```bash
npm install
echo "GEMINI_API_KEY=your_key" > .env.local
npm run dev
```

## Debugging Tips

- Check browser console for API errors
- Verify `currentTurnIndex` matches expected player
- Ensure audio context is resumed (requires user gesture)
- Test both Hold'em and Omaha modes

## Architecture Highlights

- **State Management**: Centralized in `App.tsx`
- **Rendering**: React Three Fiber hooks (`useFrame`, `useThree`)
- **Audio**: Spatial audio with Three.js PositionalAudio
- **AI**: Async Gemini calls with error fallbacks
- **3D Layout**: Elliptical player positions around table

## Performance Notes

- Gemini thinking disabled for speed
- Bot chat throttled to reduce API calls
- Simple box geometry for blocky aesthetic
- Pointer lock required for FPS controls

---

For detailed information, see individual documentation files in this folder.
