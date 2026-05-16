# Clicker Game

A multiplayer clicking competition demonstrating web-game-framework basics.

## Quick Start

```bash
cd examples/clicker-game
bun server.js
```

Open http://localhost:3000 and click away.

## Project Structure

```
clicker-game/
├── ClickerGame.js     # Game class with click logic
├── server.js          # Server setup with routes and websocket
├── client/
│   ├── index.html
│   ├── client.js
│   └── styles.css
└── data/              # Auto-created for persistence
```

## How It Works

- `ClickerGame` extends the framework's `Game` class
- Players join via REST API, interact via WebSocket
- `broadcast()` pushes real-time updates to all clients
- State auto-saves to `data/clicker-games.json`
