# BlockPoker Context Index

Navigation guide for the `.context/` documentation folder.

## 📚 Documentation Files

### 🎯 [README.md](README.md)
**Start here!** Quick overview of the project with fast facts and common entry points.

**Best for**: First-time readers, quick orientation

---

### 🏗️ [ARCHITECTURE.md](ARCHITECTURE.md)
System design, application flow, component hierarchy, and core patterns.

**Topics**:
- Application type and tech stack
- State management patterns
- Game loop mechanics
- Data flow diagrams
- 3D rendering architecture
- Audio system design

**Best for**: Understanding how the system works, making architectural decisions

---

### 📦 [COMPONENTS.md](COMPONENTS.md)
Detailed API reference for all components and services.

**Contents**:
- `App.tsx` - Game controller functions
- `GameScene.tsx` - 3D environment components
- `HUD.tsx` - UI overlay elements
- `PlayerAvatar.tsx` - Bot rendering and audio
- `pokerLogic.ts` - Poker rules engine
- `geminiService.ts` - AI integration
- `types.ts` - TypeScript interfaces
- `constants.ts` - Configuration values

**Best for**: Looking up specific functions, understanding component APIs

---

### 🛠️ [DEVELOPMENT.md](DEVELOPMENT.md)
Development workflow, debugging tips, and deployment guides.

**Topics**:
- Quick start commands
- Common tasks (modify constants, change UI, adjust bots)
- Debugging checklist
- Performance optimization
- Testing strategy
- Deployment instructions
- API considerations
- Code style conventions

**Best for**: Active development, troubleshooting, deploying to production

---

### ⚡ [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
Tables and quick lookups for files, functions, constants, and controls.

**Contents**:
- File map with key exports
- State structure
- Function signatures
- Constants table
- Game stages enum
- Bot decision logic
- Hand scoring values
- UI controls
- Dependencies list
- API models

**Best for**: Quick lookups while coding, reference during debugging

---

### 📊 [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)
High-level overview with context on decisions, achievements, and future directions.

**Topics**:
- What makes this project unique
- Technology decision rationale
- Technical achievements
- Code quality features
- Performance characteristics
- Limitations and tradeoffs
- Future enhancement ideas
- Project metrics
- Key insights

**Best for**: Understanding project goals, explaining to others, planning features

---

## 🗺️ Reading Paths

### Path 1: New to the Project
1. [README.md](README.md) - Get oriented
2. [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) - Understand the vision
3. [ARCHITECTURE.md](ARCHITECTURE.md) - Learn the structure
4. [COMPONENTS.md](COMPONENTS.md) - Explore the code

### Path 2: Need to Fix a Bug
1. [DEVELOPMENT.md](DEVELOPMENT.md) - Debugging section
2. [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Find the function
3. [COMPONENTS.md](COMPONENTS.md) - Understand the component
4. Source code - Make the fix

### Path 3: Adding a Feature
1. [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) - Check if it fits
2. [ARCHITECTURE.md](ARCHITECTURE.md) - Understand the system
3. [DEVELOPMENT.md](DEVELOPMENT.md) - Follow patterns
4. [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Reference as needed

### Path 4: Quick Question
1. [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Lookup table
2. Done! (or dive deeper if needed)

## 🔍 Search Tips

All markdown files support `Ctrl+F` (or `Cmd+F`) search. Common terms:

- **"gameState"** → State structure in QUICK_REFERENCE.md
- **"handleBotTurn"** → Function details in COMPONENTS.md
- **"spatial audio"** → Audio system in ARCHITECTURE.md
- **"Gemini"** → AI integration across multiple files
- **"debugging"** → Troubleshooting in DEVELOPMENT.md
- **"deploy"** → Deployment guide in DEVELOPMENT.md

## 📏 Documentation Stats

| File | Lines | Purpose |
|------|-------|---------|
| README.md | 100 | Quick orientation |
| ARCHITECTURE.md | 109 | System design |
| COMPONENTS.md | 162 | API reference |
| DEVELOPMENT.md | 196 | Dev workflow |
| QUICK_REFERENCE.md | 192 | Lookup tables |
| PROJECT_SUMMARY.md | 148 | High-level context |
| **Total** | **907** | Complete documentation |

## 🎓 Learning Checklist

Use this to track your understanding:

- [ ] Read README.md for project overview
- [ ] Understand core game loop (ARCHITECTURE.md)
- [ ] Know where game state lives (COMPONENTS.md: App.tsx)
- [ ] Understand poker logic (COMPONENTS.md: pokerLogic.ts)
- [ ] Grasp 3D rendering approach (ARCHITECTURE.md + GameScene.tsx)
- [ ] Learn how bots make decisions (COMPONENTS.md: handleBotTurn)
- [ ] Understand AI chat flow (geminiService.ts)
- [ ] Know how to modify constants (DEVELOPMENT.md)
- [ ] Can debug common issues (DEVELOPMENT.md)
- [ ] Ready to add features! 🎉

## 🤝 Contributing

When adding new features, please update relevant documentation:

1. Add function signatures to **COMPONENTS.md**
2. Update architecture if flow changes (**ARCHITECTURE.md**)
3. Add new constants/commands to **QUICK_REFERENCE.md**
4. Document testing steps in **DEVELOPMENT.md**
5. Update feature list in **README.md** and main **README.md**

## 💡 Tips

- Keep context docs synced with code changes
- Use examples from COMPONENTS.md as patterns
- Reference QUICK_REFERENCE.md while coding
- Check DEVELOPMENT.md before deploying
- Read PROJECT_SUMMARY.md before big refactors

---

**Context Docs Version**: 1.0  
**Last Updated**: February 12, 2026  
**Maintained By**: Development Team
