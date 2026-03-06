# PokerPov Context Index

Navigation guide for the `.context/` documentation folder.

## Documentation Files

### [README.md](README.md)
**Start here!** Quick overview of the project with fast facts and common entry points.

### [ARCHITECTURE.md](ARCHITECTURE.md)
System design, application flow, component hierarchy, and core patterns.

**Topics**: Tech stack, state management, game loop, data flow, server architecture, component hierarchy

### [COMPONENTS.md](COMPONENTS.md)
Detailed API reference for all components and services.

**Contents**: App.tsx, HUD.tsx, MobileControls.tsx, GameScene.tsx, PlayerAvatar.tsx, Lobby.tsx, SettingsModal.tsx, GameManager.ts, RoomManager.ts, socketService.ts, protocol.ts, types.ts

### [DEVELOPMENT.md](DEVELOPMENT.md)
Development workflow, debugging tips, and deployment guides.

**Topics**: Quick start, adding features, common tasks, debugging, deployment, code style

### [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
Tables and quick lookups for files, functions, constants, events, and controls.

**Contents**: File map, game stages, socket events, UI controls, ledger fields, config defaults, emotes, dependencies

### [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)
High-level overview with context on decisions, achievements, and future directions.

**Topics**: Unique features, tech decisions, achievements, code quality, status, insights

## Reading Paths

### New to the Project
1. [README.md](README.md) - Get oriented
2. [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) - Understand the vision
3. [ARCHITECTURE.md](ARCHITECTURE.md) - Learn the structure
4. [COMPONENTS.md](COMPONENTS.md) - Explore the code

### Need to Fix a Bug
1. [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Find the file/function
2. [COMPONENTS.md](COMPONENTS.md) - Understand the component
3. [DEVELOPMENT.md](DEVELOPMENT.md) - Debugging section

### Adding a Feature
1. [ARCHITECTURE.md](ARCHITECTURE.md) - Understand the system
2. [DEVELOPMENT.md](DEVELOPMENT.md) - Follow patterns
3. [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Socket events, types

### Quick Question
1. [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Lookup table

## Contributing

When adding new features, update relevant documentation:
1. Add component/function details to **COMPONENTS.md**
2. Update architecture if flow changes (**ARCHITECTURE.md**)
3. Add new events/constants to **QUICK_REFERENCE.md**
4. Document dev tasks in **DEVELOPMENT.md**
5. Update feature list in **README.md**

---

**Context Docs Version**: 2.0  
**Last Updated**: March 2026  
**Maintained By**: Development Team
