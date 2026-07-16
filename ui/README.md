# UI Components (Optional)

**Status**: Reference implementation - customize for your game

These components provide a starting point for game lobby UI. They're heavily opinionated and depend on:

- `@vanilla-bean/components` for UI primitives
- Client-side routing (hash-based)
- Specific API structure

## Philosophy

Rather than trying to be a universal UI kit, these components serve as **templates** you should copy and customize for your game. The framework intentionally doesn't include pre-built UI because every game's needs differ.

## What's Included

### Layout Components

- [View.js](layout/View.js) - Base view with toolbar + body
- [Toolbar.js](layout/Toolbar.js) - Top navigation bar
- [Body.js](layout/Body.js) - Content area with styled background

### GameRoom Components

- [Hub.js](GameRoom/Hub.js) - Game list/lobby
- [Join.js](GameRoom/Join.js) - Join existing game
- [Create.js](GameRoom/Create.js) - Create new game

## Usage Patterns

### Option 1: Copy & Customize (Recommended)

```bash
# Copy these as templates into your game
cp -r node_modules/@fatlard1993/web-game-framework/ui my-game/client/ui
# Then customize for your needs
```

### Option 2: Import Directly (Simple games only)

```js
import { Hub, Join, Create } from '@fatlard1993/web-game-framework/ui/GameRoom';
```

**Note**: Direct imports assume you have:

- `@vanilla-bean/components` installed
- API routes matching the expected structure
- Hash-based routing (#/hub, #/join/:id, etc.)

## Required API Structure

If using these components directly, your server needs these routes:

```
GET  /games           # List all games
GET  /games/:id       # Get game details
POST /games           # Create new game
POST /games/:id/join  # Join game
```

## Customization Points

Each component accepts options for customization:

**Hub.js**:

- `containerComponent` - Custom wrapper for game list
- `noGamesText` - Message when no games exist
- `buttons` - Customize button labels

**Join.js**:

- `formInputs` - Form field configuration
- `containerComponent` - Custom wrapper
- `playUrl` - Where to redirect after joining

**Create.js**:

- `formInputs` - Form field configuration
- `containerComponent` - Custom wrapper

## Examples

See [examples/with-ui/](../examples/with-ui/) for a complete working example.

## When NOT to Use These

- Your game doesn't need a lobby
- You're using a different UI framework (React, Vue, etc.)
- You want significantly different UX
- You're building a single-player game

In these cases, use the core framework (Server, Game, socket) and build your own UI from scratch.
