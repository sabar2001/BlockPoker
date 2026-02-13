# Development Guide

## Quick Start

```bash
npm install
echo "GEMINI_API_KEY=your_key_here" > .env.local
npm run dev
```

Access at `http://localhost:3000`

## Project Commands

- `npm run dev` - Start dev server (port 3000)
- `npm run build` - Production build → `dist/`
- `npm run preview` - Preview production build

## Development Workflow

### Adding New Features

1. **New Game Mechanic**: Update `App.tsx` game loop
2. **UI Element**: Add to `HUD.tsx` (2D) or `GameScene.tsx` (3D)
3. **Bot Behavior**: Modify `handleBotTurn()` in `App.tsx`
4. **Poker Logic**: Extend `services/pokerLogic.ts`
5. **AI Chat**: Update prompts in `services/geminiService.ts`

### State Management Pattern

```typescript
// Always use immutable updates
setPlayers(prev => prev.map(p => 
  p.id === targetId ? { ...p, chips: newChips } : p
));

// Use functional setState for dependent updates
setGameState(prev => ({ ...prev, pot: prev.pot + bet }));
```

### 3D Component Pattern

```typescript
const MyComponent = () => {
  const ref = useRef<THREE.Mesh>(null);
  
  // Animation loop
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime;
    }
  });
  
  return <mesh ref={ref}>...</mesh>;
};
```

## Common Tasks

### Modify Game Constants

Edit `constants.ts`:
- Blinds: `BIG_BLIND`, `SMALL_BLIND`
- Starting chips: `INITIAL_CHIPS`
- Player names: `PLAYER_NAMES[]`
- Colors: `PLAYER_COLORS[]`

### Change Bot Personalities

Edit `services/geminiService.ts`:
- System prompt in `generateBotChat()`
- Voice preset in `generateBotSpeech()` (Puck, Charon, Kore, Fenrir, Zephyr)

### Adjust UI Styling

- Global styles: `index.html` `<style>` block
- Component styles: TailwindCSS classes in `.tsx` files
- Font: VT323 (retro gaming font)

### Modify Table Layout

Edit `constants.ts`:
- `RADIUS_X`, `RADIUS_Z` - Ellipse dimensions
- `ANGLES[]` - Player position angles

## Debugging

### Console Logs

Key debug points:
- `App.tsx` - Bot decisions, state transitions
- `PlayerAvatar.tsx` - Audio playback issues
- `geminiService.ts` - API errors

### Common Issues

**Pointer Lock Not Working**
- Must be triggered by user gesture (click)
- Check `PointerLockControls` in `GameScene.tsx`

**Audio Not Playing**
- Verify microphone permission granted
- Check `AudioContext` state in browser console
- Ensure Gemini API key is valid

**Bots Not Acting**
- Check `currentTurnIndex` matches bot player
- Verify `gameState.stage !== SHOWDOWN`
- Look for infinite loops in `moveToNextPlayer()`

**Hand Evaluation Errors**
- Ensure enough community cards dealt before evaluation
- Check variant-specific logic (Hold'em vs Omaha)

## Performance Optimization

### Current Optimizations
- Thinking budget disabled in Gemini (faster responses)
- Bot chat throttled to 15% chance per action
- Audio ref distance limited to prevent performance drop
- Card meshes use simple box geometry

### Potential Improvements
- Memoize hand strength calculations
- Throttle `useFrame()` animations
- Implement object pooling for cards
- Lazy load 3D assets

## Testing Strategy

### Manual Testing Checklist
- [ ] Game starts without errors
- [ ] Cards deal correctly (2 for Hold'em, 4 for Omaha)
- [ ] Blinds post correctly (SB/BB)
- [ ] Betting rounds advance properly
- [ ] Winner determination accurate
- [ ] Bots generate chat occasionally
- [ ] Audio plays from correct positions
- [ ] UI updates reflect game state
- [ ] Mode toggle works (Hold'em ↔ Omaha)

### Edge Cases
- All players fold except one
- All players all-in
- Multiple winners (split pot)
- Player runs out of chips
- Rapid mode switching

## Deployment

### Environment Variables
Set `GEMINI_API_KEY` in deployment platform:
- Vercel: Project Settings → Environment Variables
- Netlify: Site Settings → Build & Deploy → Environment
- Cloudflare Pages: Settings → Environment Variables

### Build Configuration
- Vite automatically bundles for production
- Import maps in `index.html` handle ESM dependencies
- No server-side code (static hosting compatible)

## API Considerations

### Gemini Rate Limits
- Free tier: 60 requests/minute
- Bot chat triggered ~15% of actions
- Consider caching common responses

### Error Handling
Both Gemini functions have fallbacks:
- Chat: Returns "Lag..." on error
- TTS: Returns `undefined`, skips audio

### Cost Optimization
- Reduce bot chat frequency (lower random threshold)
- Use thinking budget: 0 for faster/cheaper responses
- Cache generated audio for repeated phrases

## Code Style

### Conventions
- TypeScript strict mode
- Functional components with hooks
- Immutable state updates
- Pure functions in services/
- Component file names: PascalCase
- Service file names: camelCase

### File Organization
```
components/    # React components (3D and UI)
services/      # Pure business logic
*.ts           # Types, constants, configs
*.tsx          # React components
index.*        # Entry points
```
