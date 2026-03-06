# Development Guide

## Quick Start

```bash
npm install                          # Client dependencies
cd server && npm install && cd ..    # Server dependencies
npm run dev:all                      # Both client + server
```

- Client: `http://localhost:3000`
- Server: `http://localhost:3001`
- Health check: `http://localhost:3001/health`

## Project Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Client only (Vite, port 3000) |
| `npm run dev:server` | Server only (tsx watch, port 3001) |
| `npm run dev:all` | Both concurrently |
| `npm run build` | Production client build → `dist/` |
| `npm run build:all` | Client + server build |
| `npm start` | Production start (serves built client) |

## Development Workflow

### Adding New Features

1. **Server Game Logic**: `server/GameManager.ts` — all authoritative game rules
2. **Socket Events**: `shared/protocol.ts` — add new event types (shared between client/server)
3. **Room Logic**: `server/RoomManager.ts` — socket routing and room management
4. **Client State**: `App.tsx` — subscribe to new events, add state
5. **Desktop UI**: `components/HUD.tsx` — desktop overlay elements
6. **Mobile UI**: `components/MobileControls.tsx` — touch-optimized controls
7. **3D Elements**: `components/GameScene.tsx` or `components/PlayerAvatar.tsx`

### State Management Pattern

```typescript
// All game state flows: Server → Socket.io → App.tsx → Child Components
// App.tsx subscribes to events:
socketService.on('game:state', (state) => {
  setPlayers(state.players.map(toClientPlayer));
  setPot(state.pot);
  // ...
});
```

### Adding New Socket Events

1. Define types in `shared/protocol.ts` (both `ClientToServerEvents` and `ServerToClientEvents`)
2. Emit from server in `GameManager.ts` or `RoomManager.ts`
3. Wire relay in `socketService.ts` (client)
4. Subscribe in `App.tsx` and pass to components

## Common Tasks

### Modify Table Settings
Edit `shared/protocol.ts` → `DEFAULT_TABLE_CONFIG` for defaults. Host can change per-room via Settings modal.

### Change UI Styling
- Global styles: `index.html` `<style>` block
- Component styles: TailwindCSS classes in `.tsx` files
- Font: VT323 (retro gaming font, loaded from Google Fonts CDN)

### Modify Player Ledger
- Server tracking: `server/GameManager.ts` → `playerLedger` Map
- Protocol type: `shared/protocol.ts` → `PlayerLedgerEntry`
- Desktop display: `components/HUD.tsx` → Ledger Modal
- Mobile display: `components/MobileControls.tsx` → Ledger Modal

### Add New Emotes
1. Add to `EmoteType` union in `shared/protocol.ts`
2. Add to `EMOTES` array in `HUD.tsx` and `MobileControls.tsx`
3. Add 3D display in `PlayerAvatar.tsx` if needed

## Debugging

### Console Logs
- `[App]` — State transitions, render info
- `[SocketService]` — Connection, action sends
- `[GameManager]` — Server-side game logic
- `[Room]` — Room create/join/leave
- `[MobileControls]` — Mobile-specific

### Common Issues

**Server not starting**
- Check port 3001 not in use: `lsof -i :3001`
- Ensure `cd server && npm install` was run

**TypeScript errors with `tsc --noEmit`**
- React Three Fiber JSX intrinsic elements (`<mesh>`, `<group>`) cause type errors — this is expected and does not affect Vite builds

**Audio not playing**
- AudioContext requires user gesture to resume
- Check microphone permissions for voice chat

**Mobile emotes not working**
- Ensure `onTouchStart` uses `e.stopPropagation()` to prevent camera rotation
- Check z-index ordering of touch layers

## Performance Notes

- Bot/AI chat (Gemini) is disabled/stubbed in multiplayer mode
- Hand evaluation uses combination-based scoring (efficient for 5-7 card evaluation)
- Volatile Socket.io events used for head tracking (drops allowed)
- Game logs capped at 50 entries server-side, 20 displayed

## Deployment

Configured for Render.com via `render.yaml`:
- Single service: server serves built client as static files
- Build: `npm run build:all`
- Start: `npm start`
- No database or external services required

## Code Style

- TypeScript with strict mode
- Functional React components with hooks
- Immutable state updates (spread operators)
- PascalCase for components, camelCase for services/utils
- Server code in `server/`, shared types in `shared/`
