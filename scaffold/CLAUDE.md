# {{name}}

A web game on `@fatlard1993/web-game-framework` and `@vanilla-bean/components`. One Bun server (`server.js`) serves the page and holds every game's state; each player's page draws that state and sends what its player does. Anyone with the address can open the lobby, make a game, and join one from their phone.

## Running it

- `bun run dev`: the server at http://localhost:3000 (or `PORT`), rebuilding the page and reloading open browsers as files change. Under paude it's already running as the project's `dev` task and its page is shared: don't start a second one.
- `bun run build` then `bun start`: production.
- `bun test`

## Where things are

- `server.js`: the `Server`, its routes (`basicGameRoutes`: list, create, join, exit, delete), the built page, and the socket handing each player's message to its game's `receive`.
- `Game.js`: one running game. `state` is what's true for everyone; `receive` acts on a player's message; `announce` broadcasts the whole picture; `toClient` and `toSaveState` say what a page gets and what survives a restart (`data/games.json`).
- `client/index.js`: the page's routes: this game's `Start` and `Play`, and the framework's hub, create and join views at `#/hub` for grown-ups and phones.
- `client/Start.js`: the first screen. The player picks an animal and presses play; everyone joins the one game on this server, made the first time someone plays.
- `client/Play.js`: what a player sees and does. It sends `{ gameId, playerId, type }` on the socket and redraws on each `update: 'state'`.

## The libraries, by their docs

Read these before building anything the framework or the component library might already do:

- `node_modules/@fatlard1993/web-game-framework/README.md`, then `docs/GETTING_STARTED.md`; `ui/README.md` for the lobby views and how to customize them.
- `node_modules/@vanilla-bean/components/README.md` and `docs/GETTING_STARTED.md`; every component's folder holds a `<Name>.lld.md` stating what it does and why (`components/Button/Button.lld.md`, `components/Dialog/Dialog.lld.md`, ...); the server helpers are in `app/README.md`.

## Who plays it

The players may be young and may not read yet. Every control is a picture (an emoji) with few or no words, big enough for a thumb, and the game explains itself by being played, not by text. Keep it that way as the game grows: a new thing to do is a new big picture to tap, a new thing to see is drawn, not described.

## How this project is written

- Views and controls are the library's components, styled with `styled()` and the theme's tokens (`colors`, `space`, `radius`), not stylesheets or hex colors in the code.
- The truth of a game lives in its `Game` on the server. A page never changes what it shows on its own; it sends a message and draws what comes back, so every player sees the same thing.
- One file per view, each small. New kinds of thing a player can do are new `type`s in `receive` and new state in `state`, with `Play` drawing them.
- A change that can be seen is checked by looking: the page reloads itself on every save.

## What makes it feel good

What players asked for over and over in the first games built this way, so start there rather than waiting to be told:

- The game takes the whole screen. The play area grows to fill everything below the top bar (the `Board` does); the score, level and buttons that aren't part of playing live in the top bar, and the tools a player plays with sit right beside the play area.
- A press or drag that starts just outside the play area still counts, held to its edge: fingers miss.
- On a computer, the keyboard plays it (arrow keys and WASD to move, space for the main action) and the mouse aims; on-screen touch controls show only on touch devices (`matchMedia('(pointer: coarse)')`).
- Everything that acts on the game is seen acting: wind blows visibly, a current flows, a timer drains. A force a player can't see is a rule they can't learn.
- A player whose page closed is gone from the table (`online` is false on them, and `onPresence` hears it): take their ship out of space, their hand off the board, until they're back.
- Saved games (`data/games.json`) outlive changes to the game: when `state` changes shape, a game saved the old way still loads (fill in what's new, carry over what moved).
- The README says what the game is and how to play it, its rules as they are now: when a rule changes, so does the README.
