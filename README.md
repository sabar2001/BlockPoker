# PokerPov

A first-person multiplayer poker game with proximity voice chat. Play Texas Hold'em and Omaha around a 3D table with real-time voice that gets louder when players are closer and directional based on where you're looking.

## Tech Stack

- **Frontend**: React 18.2, TypeScript 5.8, Three.js + React Three Fiber
- **Server**: Node.js, Express, Socket.io (authoritative game state)
- **Voice**: WebRTC peer-to-peer audio with Web Audio API spatial processing
- **Build**: Vite 6.2
- **Style**: TailwindCSS (CDN), VT323 font

## Project Structure

```
BlockPoker/
├── components/
│   ├── GameScene.tsx      # 3D scene, camera, lighting, spatial audio updater
│   ├── HUD.tsx            # First-person UI overlay, actions, emotes
│   ├── PlayerAvatar.tsx   # 3D player models with network-driven head tracking
│   └── Lobby.tsx          # Room create/join, buy-in selection, ready state
├── services/
│   ├── socketService.ts   # Socket.io client wrapper
│   └── voiceService.ts    # WebRTC peer connections + spatial audio pipeline
├── shared/
│   └── protocol.ts        # Shared types and Socket.io event contracts
├── server/
│   ├── index.ts           # Express + Socket.io entry point
│   ├── GameManager.ts     # Authoritative poker logic
│   └── RoomManager.ts     # Room/lobby management
├── App.tsx                # Main app, server-driven state
├── types.ts               # Client types
├── constants.ts           # Table positions, colors
└── vite.config.ts         # Vite config
```

## Setup

### Prerequisites

- Node.js 18+

### Install & Run

```bash
# Install client deps
npm install

# Install server deps
cd server && npm install && cd ..

# Run both client + server
npm run dev:all
```

Client: `http://localhost:3000` | Server: `http://localhost:3001`

## How to Play

1. Enter your name
2. Create a room (set table blinds, min/max buy-in) or join with a room code
3. Choose your buy-in amount within the table limits
4. Ready up -- host starts the game when all players are ready
5. Click to lock pointer and play

### Controls

| Key | Action |
|-----|--------|
| Mouse | Look around |
| 1 | Fold |
| 2 | Call / Check |
| 3 | Raise |
| 4-9 | Emotes |
| V (hold) | Push-to-talk |

### Features

- **Configurable buy-ins**: Each player picks their chip amount within the table's min/max range
- **Proximity voice**: Volume based on distance between avatars
- **Directional audio**: Louder when facing toward a speaker, stereo panned left/right
- **Real-time head tracking**: See where other players are looking (~15fps broadcast)
- **Emote system**: Wave, thumbs up, fist slam, laugh, cry, shrug
- **Room codes**: Share a 6-character code to invite friends

## Development

```bash
# Client only
npm run dev

# Server only
npm run dev:server

# Both
npm run dev:all

# Build
npm run build
```

## License

MIT
