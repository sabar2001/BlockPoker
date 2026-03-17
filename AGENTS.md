# AGENTS.md

## Cursor Cloud specific instructions

**PokerPov** is a first-person 3D multiplayer poker game. Two services must run for development:

| Service | Command | Port |
|---------|---------|------|
| Vite dev server (frontend) | `npm run dev` | 3000 |
| Express/Socket.io (backend) | `npm run dev:server` | 3001 |
| Both together | `npm run dev:all` | 3000 + 3001 |

See `README.md` for full setup/run instructions and project structure.

### Non-obvious notes

- **No database or Docker required.** All game state is in-memory on the server.
- **No `.env` file needed** for local dev. The Vite config defaults `VITE_SERVER_URL` to `http://localhost:3001`.
- **TypeScript strict checking (`tsc --noEmit`) will report errors** due to React Three Fiber JSX intrinsic elements (`<mesh>`, `<group>`, etc.) not being in the default JSX type namespace. This is expected and does not affect the Vite build.
- **No ESLint or dedicated lint script** is configured. The only lint-like check is `tsc --noEmit`.
- **Two separate `npm install` runs are needed** — one in the repo root (frontend) and one in `server/` (backend). Both use `package-lock.json`.
- **Backend health check**: `curl http://localhost:3001/health`
- **Multiplayer testing** requires at least 2 browser tabs/windows connected to the same room code. A single player can create a room and ready up, but the game cannot start without a second player.
