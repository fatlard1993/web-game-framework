# Clicker Game

A multiplayer clicking competition demonstrating web-game-framework basics.

## Quick Start

```bash
cd examples/clicker-game
NODE_ENV=development bun --hot server.js
```

Open http://localhost:3000 and click away. In development the Server builds the client and rebuilds it on a change, reloading the page; type `b` to rebuild or `stop` to quit. For production, `bun build.js` once, then `bun server.js`. `PORT` picks another port.

## Project Structure

```
clicker-game/
├── ClickerGame.js     # Game class with click logic
├── server.js          # Server setup with routes and websocket
├── build.js           # Production client build
├── client/
│   ├── index.html
│   └── client.js      # The lobby and game, in @vanilla-bean/components
└── data/              # Created on start, for persistence (not committed)
```

## How It Works

- `ClickerGame` extends the framework's `Game` class
- Players join via REST API, interact via WebSocket
- `broadcast()` pushes real-time updates to all clients
- State auto-saves to `data/clicker-games.json`
