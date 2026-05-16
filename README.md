# web-game-framework

A lightweight, batteries-included framework for building multiplayer web games with Bun and WebSockets. Provides everything needed for real-time multiplayer without the complexity.

## Key Features

- **Bun-first runtime** - Optimized for Bun with minimal overhead and fast startup
- **WebSocket-based multiplayer** - Real-time communication out of the box
- **Plugin architecture** - Opt-in features keep the core minimal
- **Optional persistence** - Built-in save/load with JSON file database
- **Hot reload development** - Auto-refresh clients during development
- **Reference UI components** - Lobby components you copy and customize
- **Battle-tested** - Powers void-driller, sorcery-and-savagery, and humanity games

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [EventRouter](#eventrouter)
- [Core Architecture](#core-architecture)
- [Module Reference](#module-reference)
- [UI Components](#ui-components)
- [Examples](#examples)
- [Development](#development)
- [Contributing](#contributing)

## Installation

Install from npm:

```bash
bun add @fatlard1993/web-game-framework
```

Import in your application:

```js
// Core server modules
import { Server, Game, Database, EventRouter } from '@fatlard1993/web-game-framework';

// Client modules
import socket, { onMessage } from '@fatlard1993/web-game-framework/client/socket';
import { gameContext } from '@fatlard1993/web-game-framework/client/gameContext';
import { createClientEventRouter } from '@fatlard1993/web-game-framework/client';

// Utilities
import { simpleId, randInt, shuffleArray } from '@fatlard1993/web-game-framework/utils';
```

## Quick Start

### Minimal Server (~3 lines)

The simplest possible multiplayer server with WebSocket support:

```js
import { Server } from '@fatlard1993/web-game-framework';

// WebSocket automatically available at ws://localhost:3000/ws
const server = new Server({ port: 3000 });
```

That's it! WebSocket connections are handled automatically.

### With Game Class

Add game state management and player tracking:

```js
import { Server, Game } from '@fatlard1993/web-game-framework';

class MyGame extends Game {
	constructor(options) {
		super(options);
		this.score = 0;

		// Setup event handlers
		this.events.on('player:action', data => {
			this.incrementScore();
		});
	}

	toClient() {
		return {
			...super.toClient(),
			score: this.score,
		};
	}

	incrementScore() {
		this.score++;
		this.broadcast('scoreUpdated', { score: this.score });
	}
}

const server = new Server({
	port: 3000,
	Game: MyGame,
});
```

### With Database Persistence

Add automatic save/load for game state:

```js
import { Server, Game, Database } from '@fatlard1993/web-game-framework';

class MyGame extends Game {
	constructor(options) {
		super(options);
		this.score = options.saveState?.score || 0;
	}

	toSaveState() {
		return {
			...super.toSaveState(),
			score: this.score,
		};
	}
}

const database = new Database({ filePath: './data/games.json' });

const server = new Server({
	port: 3000,
	Game: MyGame,
	database,
});
```

Games automatically save on every `broadcast()` and load on server start.

### Client-Side Connection

**Recommended: Use EventRouter** for clean, declarative event handling:

```js
import { createClientEventRouter } from '@fatlard1993/web-game-framework/client';

const router = createClientEventRouter({ gameId: 'abc123' });

router.on('scoreUpdated', data => {
	console.log('New score:', data.score);
});

// Cleanup when done
router.destroy();
```

<details>
<summary>Alternative: Manual WebSocket handling (for simple cases)</summary>

```js
import socket, { onMessage } from '@fatlard1993/web-game-framework/client/socket';

const cleanup = onMessage(data => {
	if (data.update === 'scoreUpdated') {
		console.log('New score:', data.score);
	}
});

cleanup();
```

</details>

## EventRouter

Event-based message routing - cleaner alternative to switch statements. The Game class includes `this.events` (an EventRouter instance) for declarative event handling.

**Server-side:**

```js
class MyGame extends Game {
	constructor(options) {
		super(options);

		this.events.on('player:move', data => {
			const player = this.players.get(data.playerId);
			player.position = data.position;
			this.broadcast('playerMoved', data);
		});
	}
}
```

**Client-side:**

```js
import { createClientEventRouter } from '@fatlard1993/web-game-framework/client';

const router = createClientEventRouter({ gameId });
router.on('playerMoved', data => updatePlayerUI(data));
```

**API:**

- `this.events.on(eventName, handler)` - Register handler
- `this.events.defineEvent(name, { validate, throttle, transform })` - Define event
- `this.events.use(middleware)` - Add middleware
- `router.destroy()` - Cleanup

See [EventRouter.js](./core/EventRouter.js) source for full API.

## Core Architecture

### Design Philosophy

1. **Minimal Core** - Works for simple games without any plugins
2. **Plugin Everything** - Advanced features are opt-in (coming Phase 2)
3. **Zero Lock-in** - Easy to eject and customize any part
4. **Incremental Adoption** - Use only what you need

### Module Overview

| Module | Purpose | Key Features |
| --- | --- | --- |
| **[Server](./core/Server.js)** | WebSocket server with Bun | Client tracking, broadcasting, hot reload, health |
| **[Game](./core/Game.js)** | Base game state management | Player management, save/load, broadcasting hooks |
| **[EventRouter](./core/EventRouter.js)** | Event-based message routing | Validation, middleware, wildcards, throttling |
| **[Database](./core/Database.js)** | JSON file persistence | Collection-based CRUD, async init, auto-save |
| **[Players](./core/Players.js)** | Extended Map for player data | Convenience `update()` method |
| **[socket](./client/socket.js)** | Client WebSocket wrapper | Auto-reconnection, listener tracking, hot reload |
| **[gameContext](./client/gameContext.js)** | Reactive game state container | Player management, `currentPlayer` access |
| **[utils](./utils/)** | Helper functions | ID generation, random, validation |
| **[UI components](./ui/README.md)** | Optional lobby UI (copy & customize) | Layout, GameRoom views (Hub, Join, Create) |

All modules work independently. Use `Server` alone for raw WebSocket handling, or combine for complete game framework.

## Module Reference

### Server

WebSocket server with Bun runtime optimizations.

```js
import { Server } from '@fatlard1993/web-game-framework';

const server = new Server({
	port: 3000,
	hostname: '0.0.0.0',
	router: server => req => {
		/* ... */
	},
	Game: MyGameClass, // Optional
	database: dbInstance, // Optional
	logger: console, // Optional
	verbosity: 3, // 0-3, controls logging detail
});

// Broadcast to all connected clients
server.socketBroadcast({ type: 'announcement', message: 'Hello!' });

// Hot reload clients during development
server.reloadClients();
```

**Features:**

- WebSocket client connection tracking
- Broadcasting to all clients
- Hot reload in development mode
- Health monitoring with periodic stats
- Optional database integration
- Optional Game class integration

**[Full Server API Documentation →](./docs/API.md#server)**

### Game

Base class for game state management with player tracking and save/load.

```js
import { Game } from '@fatlard1993/web-game-framework';

class MyGame extends Game {
	constructor(options) {
		super(options);
		this.customState = {};
	}

	// Customize client data
	toClient() {
		return {
			...super.toClient(),
			customState: this.customState,
		};
	}

	// Customize save data
	toSaveState() {
		return {
			...super.toSaveState(),
			customState: this.customState,
		};
	}

	// Lifecycle hooks
	onPlayerAdded(player) {
		console.log('Player joined:', player.name);
	}

	onPlayerRemoved(playerId) {
		console.log('Player left:', playerId);
	}

	// Validation hook
	validateBroadcastData(key, data) {
		return typeof data === 'object';
	}

	// Augmentation hook
	augmentBroadcastData(key, data) {
		return { ...data, timestamp: Date.now() };
	}
}
```

**Built-in Features:**

- Player management (add, remove, update)
- Broadcasting with validation hooks
- Auto-debounced save (5 second delay)
- Extensible via lifecycle hooks

**[Full Game API Documentation →](./docs/API.md#game)**

### Database

JSON file-based persistence with collection CRUD operations.

```js
import { Database } from '@fatlard1993/web-game-framework';

const db = new Database({
	filePath: './data/games.json',
	logger: console,
	onReady: db => {
		console.log('Database ready!');
	},
});

// CRUD operations
db.collections.games.create({ id: 'abc', name: 'Game 1' });
const game = db.collections.games.read({ id: 'abc' });
db.collections.games.update({ id: 'abc', update: { name: 'Updated Game' } });
db.collections.games.delete({ id: 'abc' });
db.collections.games.set({ id: 'abc', data: { id: 'abc', name: 'Replaced' } });

// Read all records
const allGames = db.collections.games.read();
```

**[Full Database API Documentation →](./docs/API.md#database)**

### Client Modules

#### Socket

WebSocket wrapper with automatic reconnection and listener management.

```js
import socket, { onMessage } from '@fatlard1993/web-game-framework/client/socket';

// Add message listener
const cleanup = onMessage(data => {
	console.log('Received:', data);
});

// Send messages
socket.send(JSON.stringify({ type: 'action', data: 'value' }));

// Check connection state
if (socket.readyState === socket.OPEN) {
	// Send data
}

// Cleanup listener
cleanup();
```

**Features:**

- Automatic reconnection with exponential backoff (3 attempts)
- Connection status notifications (requires `vanilla-bean-components/Notify`)
- Hot reload in development mode
- Listener tracking survives reconnections

**[Full Socket API Documentation →](./docs/API.md#client-socket)**

#### Game Context

Reactive game state container for client-side state management.

```js
import { gameContext } from '@fatlard1993/web-game-framework/client/gameContext';

// Access game state
console.log(gameContext.id);
console.log(gameContext.name);
console.log(gameContext.players);

// Access current player
console.log(gameContext.currentPlayer);

// Subscribe to changes (requires vanilla-bean-components Context)
gameContext.subscribe({
	key: 'players',
	callback: players => console.log('Players updated:', players),
});
```

**[Full Game Context API Documentation →](./docs/API.md#game-context)**

### Utilities

#### ID Generation

```js
import { simpleId } from '@fatlard1993/web-game-framework/utils';

const id = simpleId(); // "aB3xY" (5-char alphanumeric)
```

#### Random Utilities

```js
import { randInt, shuffleArray, weightedChance, chance } from '@fatlard1993/web-game-framework/utils';

// Random integer (inclusive min, exclusive max)
const num = randInt(1, 10); // 1-9

// Shuffle array in-place (Fisher-Yates)
const deck = [1, 2, 3, 4, 5];
shuffleArray(deck); // [3, 1, 5, 2, 4]

// Weighted random selection (must sum to 100)
const item = weightedChance({
	common: 70,
	rare: 25,
	legendary: 5,
}); // "common" (70% chance)

// Percentage chance test
if (chance(25)) {
	console.log('25% chance triggered!');
}
```

#### Socket Validation

```js
import {
	validateMessage,
	validatePlayerMessage,
	validatePositionMessage,
	createMessageValidator,
} from '@fatlard1993/web-game-framework/utils';

// Basic message validation
if (validateMessage(data, gameId)) {
	// Process message
}

// Player-specific validation
if (validatePlayerMessage(data)) {
	// Update player
}

// Position data validation
if (validatePositionMessage(data)) {
	// Move entity
}

// Create bound validator
const validator = createMessageValidator('game123');
if (validator(data)) {
	// Process message
}
```

**[Full Utils API Documentation →](./docs/API.md#utilities)**

## UI Components

Reference implementation of lobby UI components. **Not meant for direct use** - copy and customize for your game.

### Philosophy

Rather than being a universal UI kit, these components serve as **templates** you should copy and customize. Every game's UI needs differ, so the framework provides starting points instead of rigid components.

### What's Included

**Layout Components:**

- [View.js](./ui/layout/View.js) - Base view with toolbar + body
- [Toolbar.js](./ui/layout/Toolbar.js) - Top navigation bar
- [Body.js](./ui/layout/Body.js) - Content area with styled background

**GameRoom Components:**

- [Hub.js](./ui/GameRoom/Hub.js) - Game list/lobby
- [Join.js](./ui/GameRoom/Join.js) - Join existing game
- [Create.js](./ui/GameRoom/Create.js) - Create new game

### Usage Patterns

#### Option 1: Copy & Customize (Recommended)

```bash
# Copy components as templates into your game
cp -r node_modules/@fatlard1993/web-game-framework/ui my-game/client/ui

# Customize styles, functionality, and structure for your needs
```

#### Option 2: Import Directly (Simple games only)

```js
import { Hub, Join, Create } from '@fatlard1993/web-game-framework/ui/GameRoom';

// Use directly (requires vanilla-bean-components and matching API structure)
```

**Direct import assumptions:**

- `vanilla-bean-components` installed
- API routes match expected structure (`/games`, `/games/:id`, etc.)
- Hash-based routing (`#/hub`, `#/join/:id`, etc.)

### Required API Structure

If using components directly, your server needs these routes:

```
GET  /games           # List all games
GET  /games/:id       # Get game details
POST /games           # Create new game
POST /games/:id/join  # Join game
```

### When NOT to Use UI Components

- Your game doesn't need a lobby
- You're using a different UI framework (React, Vue, etc.)
- You want significantly different UX
- You're building a single-player game

In these cases, use the core framework (Server, Game, socket) and build your own UI from scratch.

**[Full UI Components Documentation →](./ui/README.md)**

## Examples

### Minimal Server

Demonstrates the absolute minimum setup - just WebSocket support without Game class.

```bash
cd examples/minimal
bun server.js
```

**[View minimal example →](./examples/minimal/README.md)**

### More Examples

Additional examples coming in Phase 2:

- Full game with lobby UI
- Real-time multiplayer with spatial grid
- Turn-based game with persistence
- Card game with validation plugins

## Development

### Local Development

```bash
# Clone and install
git clone https://github.com/fatlard1993/web-game-framework
cd web-game-framework
bun install

# Run examples
cd examples/minimal
bun server.js

# Development (with your game)
bun --hot server.js   # Auto-restart on changes
```

### Project Structure

```
@fatlard1993/web-game-framework/
├── core/              # Server, Game, Database, Players
│   ├── Server.js      # WebSocket server with Bun
│   ├── Game.js        # Base game state management
│   ├── Database.js    # JSON file persistence
│   ├── Players.js     # Extended Map for players
│   └── index.js       # Core exports
├── client/            # Client-side modules
│   ├── socket.js      # WebSocket with auto-reconnect
│   ├── gameContext.js # Reactive game state
│   ├── api.js         # REST API helpers
│   └── index.js       # Client exports
├── plugins/           # (Phase 2) Optional plugins
│   ├── gameLoop.js    # Fixed timestep game loop
│   ├── validation.js  # Input validation middleware
│   └── spatialGrid.js # Spatial partitioning
├── ui/                # Reference UI components
│   ├── layout/        # View, Toolbar, Body
│   └── GameRoom/      # Hub, Join, Create
├── utils/             # Helper utilities
│   ├── identifiers.js # ID generation
│   ├── random.js      # Random helpers
│   ├── socketValidation.js # Message validation
│   └── index.js       # Utils exports
├── examples/          # Example implementations
│   └── minimal/       # Minimal server example
└── docs/              # Documentation
    ├── API.md         # Complete API reference
    ├── GETTING_STARTED.md # Step-by-step tutorial
    └── ARCHITECTURE.md # Design patterns
```

### Running Tests

```bash
# Run test suite (Phase 2)
bun test

# Watch mode
bun test:watch

# Coverage report
bun test:coverage
```

## Migration Guides

### From byod-web-game

1. Install package:
   ```bash
   bun add @fatlard1993/web-game-framework
   ```
2. Replace imports:

   ```js
   // Before
   import Game from '../byod-web-game/server/Game';
   import Server from '../byod-web-game/server/Server';

   // After
   import { Game, Server } from '@fatlard1993/web-game-framework';
   ```

3. Update Database imports if using persistence
4. Copy UI components if needed (don't import directly)

**[Full migration guide →](./docs/MIGRATION.md)**

## Roadmap

**Phase 1 (✅ Complete):**

- Core Server, Game, Database
- Client socket with reconnection
- Utils (ID, random, validation)
- UI reference components
- Documentation

**Phase 2 (✅ EventRouter Complete):**

- ✅ EventRouter system - Event-based message routing
- ✅ Middleware support - Validation, logging, throttling
- ✅ All three games migrated (87 events total)
- ✅ Comprehensive test suite (23 tests passing)
- 🚧 Plugin system architecture (in progress)
- 🚧 Built-in plugins: gameLoop, persistence, validation, spatialGrid

**Phase 3 (Future):**

- Advanced documentation
- More examples and tutorials
- Performance benchmarks
- Community plugins

## Browser Compatibility

**Server-side (Bun):**

- Bun 1.0.0+
- Node.js support not guaranteed (Bun-specific APIs used)

**Client-side (Browsers):**

- Chrome/Edge 49+
- Firefox 18+
- Safari 10+
- Modern browsers with WebSocket support

No polyfills provided. Use transpilation for legacy browser support if needed.

## Contributing

1. **Fork and clone** the repository
2. **Create feature branch** from `main`
3. **Follow existing patterns** - Check similar modules for code style
4. **Add JSDoc comments** - Document all public APIs
5. **Update documentation** - Include README updates and examples
6. **Test thoroughly** - Run examples and validate changes

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed development guidelines.

## Status

🚧 **Alpha v0.1.0** - Core extraction complete. API may change. Battle-tested in production games.

## License

MIT License - see [LICENSE](./LICENSE) file for details.

---

**[Getting Started Guide](./docs/GETTING_STARTED.md)** • **[API Documentation](./docs/API.md)** • **[Architecture Guide](./docs/ARCHITECTURE.md)** • **[Examples](./examples/)**
