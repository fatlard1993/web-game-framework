# {{name}}

A web game on `@fatlard1993/web-game-framework` and `@vanilla-bean/components`. One Bun server (`server.js`) serves the page and holds every game's state; each player's page draws that state and sends what its player does. Anyone with the address can open the lobby, make a game, and join one from their phone.

## Running it

- `bun run dev`: the server at http://localhost:3000 (or `PORT`), rebuilding the page and reloading open browsers as files change. Under paude it's already running as the project's `dev` task and its page is shared: don't start a second one.
- `bun run build` then `bun start`: production.
- `bun test`

## Where things are

- `rules.js`: what the game is (the field, speeds, how a tick moves things on), shared by the server, which runs it, and the page, which draws it. Rules live here, never twice.
- `Game.js`: one running game, on the server. `state` is what's true; `actions` are what a player can do (each runs as the player whose page sent it, and `refuse('why')` turns one down); `every(ms, ...)` is its loop, stopped when the game is deleted; `viewFor(playerId)` is what each page is sent, and `publish()` sends it (by itself after every action); `onPresence` hears a player's page open or close. `static version` and `migrations` keep old saves loading, `static transient` names state that's never saved.
- `Game.test.js`: the rules and actions tested without a browser (`bun test`). A new rule gets a test here.
- `server.js`: the `Server`, a few lines: the games' routes, the save file, the built page, and its port.
- `client/index.js`: the page's routes: this game's `Start`, `Play` and watch views, and the framework's lobby at `#/hub`.
- `client/Start.js`: the first screen. Pick an animal and press play; everyone joins the one game on this server, made the first time someone plays.
- `client/Play.js`: what a player sees and does: `enterGame` opens the game and hands each view the server sends to `draw`; the `Stage` is the play area, filling the screen; `createInput` turns keys, a finger or the mouse into `act('steer', ...)`; `createSound` plays the game's sounds; the ➕👫 button shows a `JoinCard` a phone can scan.

## The libraries, by their docs

Read these before building anything the framework or the component library might already do:

- `node_modules/@fatlard1993/web-game-framework/README.md`, then `docs/GETTING_STARTED.md`; `ui/README.md` for the lobby views and how to customize them.
- `node_modules/@vanilla-bean/components/README.md` and `docs/GETTING_STARTED.md`; every component's folder holds a `<Name>.lld.md` stating what it does and why (`components/Button/Button.lld.md`, `components/Dialog/Dialog.lld.md`, ...); the server helpers are in `app/README.md`.

## Who plays it

Anyone, including people who don't read: by default every control is a picture (an emoji) with few or no words, big enough for a thumb, and the game explains itself by being played, not by text. Keep it that way as the game grows: a new thing to do is a new big picture to tap, a new thing to see is drawn, not described. A game whose idea is words (players write the rhymes, guess the word, type the answer) takes words where the idea needs them, the way the game it's like does; pictures stay for everything else.

Often one person tries it first, alone. Alone, it says what it's waiting for (👥 1/2) and offers what they can do meanwhile: invite someone (the ➕👫 `JoinCard`), or play or practice on their own when the game can be played that way.

## How this project is written

- Views and controls are the library's components, styled with `styled()` and the theme's tokens (`colors`, `space`, `radius`), not stylesheets or hex colors in the code.
- The truth of a game lives in its `Game` on the server. A page never changes what it shows on its own: it calls `act(name, data)` and draws the view that comes back, so every player sees the same thing. Never trust a player id a page sends; the action already knows its player.
- A new thing a player can do is a new entry in `actions`, new state in `state`, and `draw` showing it. A rule both sides need goes in `rules.js`.
- One file per view, each small.
- A component's own lifecycle names are the library's: don't give a view a method called `render` (the library calls it to build and attach the component, so yours runs in its place), and read a component's `.lld.md` before naming fields on it.
- A change that can be seen is checked by looking: the page reloads itself on every save.

## What makes it feel good

What players asked for over and over in the first games built this way, so start there rather than waiting to be told:

- The game takes the whole screen. The play area grows to fill everything below the top bar (the `Stage` does); the score, level and buttons that aren't part of playing live in the top bar, and the tools a player plays with sit right beside the play area.
- A press or drag that starts just outside the play area still counts, held to its edge: fingers miss. `input.pointer(stage.elem)` does it.
- On a computer, the keyboard plays it (arrow keys and WASD to move, space for the main action) and the mouse aims; on-screen touch controls show only on touch devices. `createInput` does all of this (`direction()`, `hold(button, name)`, `pointer(area)`), and `isTouch()` says which device it is.
- Everything that acts on the game is seen acting: wind blows visibly, a current flows, a timer drains. A force a player can't see is a rule they can't learn.
- A player whose page closed is gone from the table (`online` is false on them, and `onPresence` hears it): take their ship out of space, their hand off the board, until they're back.
- Saved games (`data/games.json`) outlive changes to the game: when `state` changes shape, a game saved the old way still loads (fill in what's new, carry over what moved).
- The README says what the game is and how to play it, its rules as they are now: when a rule changes, so does the README.
- Sounds and music play through `createSound` (effects overlap, music loops and crossfades, volume and mute are kept, and nothing is lost to the browser's wait for a first tap); a `SoundToggle` in the bar mutes it.
