# {{name}}

A multiplayer web game on [web-game-framework](https://github.com/fatlard1993/web-game-framework) and [@vanilla-bean/components](https://github.com/fatlard1993/vanilla-bean-components).

```sh
bun install
bun run dev
```

Then open http://localhost:3000, make a game, and join it from any device on the network.

- `server.js` runs the server and routes; `Game.js` is a game's state and rules.
- `client/` is the page: the framework's lobby, and `Play.js` for the game itself.
- `data/games.json` holds the games between restarts.
