# {{name}}

A web game on `@fatlard1993/web-game-framework` and `@vanilla-bean/components`. One Bun server (`server.js`) serves the page and holds every game's state; each player's page draws that state and sends what its player does. Anyone with the address can open the lobby, make a game, and join one from their phone.

## Running it

- `bun run dev`: the server at http://localhost:3000 (or `PORT`), rebuilding the page and reloading open browsers as files change. Under paude it's already running as the project's `dev` task and its page is shared: don't start a second one.
- `bun run build` then `bun start`: production.
- `bun test`

## Where things are

- `server.js`: the `Server`, its routes (`basicGameRoutes`: list, create, join, exit, delete), the built page, and the socket handing each player's message to its game's `receive`.
- `Game.js`: one running game. `state` is what's true for everyone; `receive` acts on a player's message; `announce` broadcasts the whole picture; `toClient` and `toSaveState` say what a page gets and what survives a restart (`data/games.json`).
- `client/index.js`: the page's routes: the framework's hub, create and join views, and this game's `Play`.
- `client/Play.js`: what a player sees and does. It sends `{ gameId, playerId, type }` on the socket and redraws on each `update: 'state'`.

## The libraries, by their docs

Read these before building anything the framework or the component library might already do:

- `node_modules/@fatlard1993/web-game-framework/README.md`, then `docs/GETTING_STARTED.md`; `ui/README.md` for the lobby views and how to customize them.
- `node_modules/@vanilla-bean/components/README.md` and `docs/GETTING_STARTED.md`; every component's folder holds a `<Name>.lld.md` stating what it does and why (`components/Button/Button.lld.md`, `components/Dialog/Dialog.lld.md`, ...); the server helpers are in `app/README.md`.

## How this project is written

- Views and controls are the library's components, styled with `styled()` and the theme's tokens (`colors`, `space`, `radius`), not stylesheets or hex colors in the code.
- The truth of a game lives in its `Game` on the server. A page never changes what it shows on its own; it sends a message and draws what comes back, so every player sees the same thing.
- One file per view, each small. New kinds of thing a player can do are new `type`s in `receive` and new state in `state`, with `Play` drawing them.
- A change that can be seen is checked by looking: the page reloads itself on every save.
