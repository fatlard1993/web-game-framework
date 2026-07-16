# Getting Started

This guide walks you through building your first multiplayer web game with @fatlard1993/web-game-framework. The framework is designed for incremental adoption - start simple and add complexity as needed.

## Table of Contents

- [Installation](#installation)
- [Your First Server](#your-first-server)
- [Adding Game State](#adding-game-state)
- [Client-Side Connection](#client-side-connection)
- [Using EventRouter](#using-eventrouter)
- [Adding Persistence](#adding-persistence)
- [Building a Lobby UI](#building-a-lobby-ui)
- [Next Steps](#next-steps)

## Installation

```bash
# Using Bun (recommended)
bun add @fatlard1993/web-game-framework

# Using npm
npm install @fatlard1993/web-game-framework
```

## Your First Server

Create a minimal multiplayer server (`server.js`):

```js
import { Server } from '@fatlard1993/web-game-framework';

const server = new Server({ port: 3000 });

console.log(`Server running at ${server.url}`);
console.log(`WebSocket available at ws://localhost:3000/ws`);
```

Run the server:

```bash
bun server.js
```

**What's Happening:**

- `Server` creates a Bun HTTP server with WebSocket support
- WebSocket upgrade handled automatically at `/ws`
- Client connections tracked automatically
- Broadcasting available via `server.socketBroadcast()`

**Add custom routes (optional):**

```js
const router = server => request => {
	const url = new URL(request.url);

	if (url.pathname === '/health') {
		return new Response('OK');
	}

	return new Response('Not Found', { status: 404 });
};

const server = new Server({
	port: 3000,
	router, // Custom routes
});
```

## Adding Game State

Create a Game class with event handlers (`MyGame.js`):

```js
import { Game } from '@fatlard1993/web-game-framework';

export default class MyGame extends Game {
	constructor(options) {
		super(options);
		this.score = 0;

		// Setup EventRouter handlers
		this.events.on('player:incrementScore', data => {
			this.incrementScore(data.points || 1);
		});
	}

	toClient() {
		return {
			...super.toClient(),
			score: this.score,
		};
	}

	incrementScore(points = 1) {
		this.score += points;
		this.broadcast('scoreUpdated', { score: this.score });
	}

	onPlayerAdded(player) {
		console.log(`${player.name} joined game ${this.id}`);
		this.broadcast('playerJoined', { player });
	}
}
```

Update `server.js`:

```js
import { Server } from '@fatlard1993/web-game-framework';
import MyGame from './MyGame.js';

const server = new Server({
	port: 3000,
	Game: MyGame,
});
```

**What's Happening:**

- `Game` provides player management and broadcasting
- `this.events` (EventRouter) handles game actions
- `broadcast()` sends updates to all clients and triggers auto-save
- Lifecycle hooks handle player join/leave events

## Client-Side Connection

**Recommended: Use EventRouter** for clean event handling (`client.js`):

```js
import { createClientEventRouter } from '@fatlard1993/web-game-framework/client';

const router = createClientEventRouter({ gameId: 'abc123' });

// Handle game events
router.on('scoreUpdated', data => {
	document.getElementById('score').textContent = data.score;
	document.getElementById('round').textContent = data.round;
});

router.on('roundStarted', data => {
	console.log(`Round ${data.round} started!`);
	document.getElementById('status').textContent = 'playing';
});

router.on('roundEnded', data => {
	console.log(`Final score: ${data.finalScore}`);
	document.getElementById('status').textContent = 'finished';
});

router.on('playerJoined', data => {
	console.log(`${data.player.name} joined`);
});

// Cleanup when leaving
window.addEventListener('beforeunload', () => {
	router.destroy();
});
```

Create a simple HTML file (`index.html`):

```html
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>My Game</title>
		<script type="module" src="./client.js"></script>
	</head>
	<body>
		<h1>My Multiplayer Game</h1>
		<div id="game-info">
			<p>Score: <span id="score">0</span></p>
			<p>Round: <span id="round">1</span></p>
			<p>Status: <span id="status">waiting</span></p>
		</div>
		<button id="start-round">Start Round</button>
		<button id="add-points">Add Points</button>
		<button id="end-round">End Round</button>
	</body>
</html>
```

**What's Happening:**

- `createClientEventRouter()` sets up WebSocket listener with auto-reconnection
- `router.on()` registers clean, declarative event handlers
- EventRouter handles validation and reconnection automatically
- `router.destroy()` cleans up all listeners

## EventRouter Features

The EventRouter (used above) provides additional features for complex games:

**Validation:**

```js
this.events.defineEvent('player:move', {
	validate: data => data.playerId && data.position,
	throttle: 50, // Prevent spam
});
```

**Middleware:**

```js
import { createValidationMiddleware } from '@fatlard1993/web-game-framework/client';

router.use(
	createValidationMiddleware({
		requiredFields: ['id', 'update'],
	}),
);
```

**Wildcards:**

```js
router.on('player:*', (data, context) => {
	console.log(`[Event] ${context.eventName}`);
});
```

**API:** `on()`, `once()`, `off()`, `defineEvent()`, `use()`, `emit()`. See [EventRouter.js](../core/EventRouter.js) for full details.

## Adding Persistence

Add automatic save/load with the Database module. Update `MyGame.js`:

```js
import { Game } from '@fatlard1993/web-game-framework';

export default class MyGame extends Game {
	constructor(options) {
		super(options);

		// Restore saved state or use defaults
		this.score = options.saveState?.score || 0;
		this.round = options.saveState?.round || 1;
		this.status = options.saveState?.status || 'waiting';
	}

	toClient() {
		return {
			...super.toClient(),
			score: this.score,
			round: this.round,
			status: this.status,
		};
	}

	// Customize what data is persisted
	toSaveState() {
		return {
			...super.toSaveState(),
			score: this.score,
			round: this.round,
			status: this.status,
		};
	}

	// Game methods automatically trigger save() via broadcast()
	startRound() {
		this.status = 'playing';
		this.broadcast('roundStarted', { round: this.round });
		// broadcast() calls save() automatically
	}

	incrementScore(points = 1) {
		this.score += points;
		this.broadcast('scoreUpdated', {
			score: this.score,
			round: this.round,
		});
		// broadcast() calls save() automatically
	}

	endRound() {
		this.round++;
		this.status = 'waiting';
		this.broadcast('roundEnded', {
			round: this.round,
			finalScore: this.score,
		});
		// broadcast() calls save() automatically
	}

	// For non-broadcast updates, call save() manually
	updateScore(newScore) {
		this.score = newScore;
		this.save(); // Manually trigger save
	}
}
```

Update `server.js` to add database:

```js
import { Server, Game, Database, simpleId } from '@fatlard1993/web-game-framework';
import MyGame from './MyGame.js';

// Initialize database
const database = new Database({
	filePath: './data/games.json',
	logger: console,
	onReady: db => {
		console.log('Database ready!');
		console.log('Loaded games:', Object.keys(db.data.games || {}).length);
	},
});

const router = server => request => {
	const url = new URL(request.url);

	if (url.pathname === '/ws') {
		const upgraded = server.httpServer.upgrade(request, {
			data: { clientId: simpleId() },
		});
		if (upgraded) return;
	}

	if (url.pathname === '/health') {
		return new Response('OK', {
			headers: { 'Content-Type': 'text/plain' },
		});
	}

	// Get all games
	if (url.pathname === '/api/games' && request.method === 'GET') {
		const games = Object.values(server.games).map(game => game.toClient());
		return Response.json(games);
	}

	// Create new game
	if (url.pathname === '/api/games' && request.method === 'POST') {
		const game = new MyGame({ server, name: 'New Game' });
		return Response.json(game.toClient());
	}

	return new Response('Not Found', { status: 404 });
};

const server = new Server({
	port: 3000,
	Game: MyGame,
	database, // Add database
	router,
	verbosity: 3,
});

// Games are automatically loaded from database on startup
console.log(`Server running at ${server.url}`);
```

Create the data directory:

```bash
mkdir -p data
```

**What's Happening:**

- `Database` provides JSON file persistence with lowdb
- `toSaveState()` customizes what data is saved
- `save()` is automatically called after `broadcast()` (debounced to 5 seconds)
- Games are automatically loaded on server startup if database has saved state
- `onReady` callback fires when database finishes loading

## Building a Lobby UI

The framework includes reference UI components you can copy and customize. **These are templates, not production components.**

### Option 1: Copy Components (Recommended)

```bash
# Copy UI components to your project
cp -r node_modules/@fatlard1993/web-game-framework/ui ./client/ui

# Now customize them for your game
```

### Option 2: Import Directly (Quick Start)

For quick prototyping, you can import directly:

```js
import { Hub, Join, Create } from '@fatlard1993/web-game-framework/ui/GameRoom';

// Hub shows list of games
new Hub({
	appendTo: document.body,
});

// Join lets players join an existing game
new Join({
	gameId: 'abc123',
	appendTo: document.body,
});

// Create lets players create new games
new Create({
	appendTo: document.body,
});
```

**Requirements for direct import:**

- `@vanilla-bean/components` installed
- API routes: `/games`, `/games/:id`, `/games/:id/join`
- Hash-based routing: `#/hub`, `#/join/:id`, `#/create`

### Customizing UI Components

When you copy components, customize them for your game:

```js
// client/ui/GameRoom/Hub.js (customized)
import { Component, styled } from '@vanilla-bean/components';
import { GET } from '@vanilla-bean/hypertether';

const GameCard = styled(
	Component,
	({ colors }) => `
	/* Your custom styles */
	background: ${colors.darker(colors.gray)};
	padding: 20px;
	border-radius: 8px;

	/* Add game-specific styling */
	.player-count {
		color: ${colors.green};
		font-weight: bold;
	}
`,
);

export default class Hub extends Component {
	constructor(options = {}) {
		super({
			tag: 'div',
			className: 'game-hub',
			...options,
		});

		this.loadGames();
	}

	async loadGames() {
		const { body: games } = await GET('/api/games');

		// Clear existing content
		this.empty();

		// Render game list with your custom layout
		games.forEach(game => {
			new GameCard({
				append: [
					new Component({ tag: 'h3', textContent: game.name }),
					new Component({
						tag: 'p',
						className: 'player-count',
						textContent: `${game.players.length} players`,
					}),
					// Add game-specific info
					new Component({
						tag: 'p',
						textContent: `Score: ${game.score} | Round: ${game.round}`,
					}),
					new Component({
						tag: 'button',
						textContent: 'Join',
						onPointerPress: () => (window.location.hash = `#/join/${game.id}`),
					}),
				],
				appendTo: this,
			});
		});
	}
}
```

## Next Steps

Now that you have a working multiplayer game:

### Learn More

- **[Source Code](../core/)** - All modules have JSDoc comments
- **[EventRouter](../core/EventRouter.js)** - Event routing API
- **[UI Components](../ui/README.md)** - Reference lobby components
- **[Examples](../examples/)** - Working examples

### Add Features

- **Validation** - Use `validateBroadcastData()` hook to validate game actions
- **Authorization** - Add player authentication and game ownership

### Deploy Your Game

```bash
# Build for production
bun build server.js --target=bun --outfile=dist/server.js

# Run in production
NODE_ENV=production bun dist/server.js
```

### Join the Community

- Report issues: [GitHub Issues](https://github.com/fatlard1993/web-game-framework/issues)
- Share your game in discussions
- Contribute improvements back to the framework

---

**Happy game building!** 🎮
