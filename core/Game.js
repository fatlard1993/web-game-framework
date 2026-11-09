import { simpleId } from '../utils/identifiers.js';

import { ActionRefused, unsaveable } from './actions.js';

import Players from './Players.js';
import EventRouter from './EventRouter.js';
import consoleLogger from './consoleLogger.js';

/**
 * Base Game class with player management, broadcasting, and save/load
 *
 * Extension points (override in subclass):
 * - toClient() - Customize what data is sent to clients
 * - toSaveState() - Customize what data is persisted
 * - validateBroadcastData(key, data) - Validate broadcast data before sending
 * - augmentBroadcastData(key, data) - Add additional data to broadcasts
 *
 * Lifecycle hooks (override in subclass):
 * - onPlayerAdded(player) - Called after player is added
 * - onPlayerRemoved(playerId) - Called after player is removed
 * - onPresence(playerId, online) - Called when a player's page opens on the game or the last one closes
 * - onDispose() - Called when the game is removed, after its loops (every) have stopped
 * - createPlayer({ id, name }) - What a new player starts with, merged into them
 * - onPlayerRejoined(player) - Called when a player joins again with the id they had
 *
 * Statics: `version` and `migrations` (saves brought up to date), `transient` (state keys never saved); and an
 * `actions` object of what players can do (see act)
 * @example
 * ```js
 * class MyGame extends Game {
 *   constructor(options) {
 *     super(options);
 *     this.customState = {};
 *   }
 *
 *   toClient() {
 *     return {
 *       ...super.toClient(),
 *       customState: this.customState
 *     };
 *   }
 * }
 * ```
 */
export default class Game {
	/** The longest a change waits to be saved */
	static SAVE_WITHIN_MS = 2000;

	/**
	 * @param {object} options - Game configuration
	 * @param {object} [options.saveState] - Previous game state to restore
	 * @param {object} options.server - Server instance
	 * @param {object} [options.logger] - Optional logger
	 * @param {string} [options.name] - Game name
	 * @param {...*} options.rest - Additional game-specific options
	 */
	constructor({ saveState = {}, server, logger, ...options }) {
		// A save from an older version of the game is brought up to this one before anything reads it: the subclass's
		// constructor sees it migrated, through the same object
		this.constructor.migrate(saveState);

		// Generate unique ID
		this.id = saveState.id || this._generateId();
		this.name = saveState.name || options.name || this.id;
		this.options = saveState.options || options;

		this.server = server;

		this.logger = logger || server?.logger || consoleLogger();

		// Player management
		this.players = new Players();
		// Who has a page open on the game now (see setOnline): kept apart from the players, so a save never carries it
		this.online = new Set();

		// Event routing
		this.events = new EventRouter({
			context: this,
			logger: this.logger,
			emitFn: (event, data) => this.broadcast(event, data),
		});

		// Saving: soon after a change, and no later than SAVE_WITHIN_MS after the first one however busy the game (a debounce
		// would wait for a quiet moment that a game broadcasting every tick never has); saveNow writes at once, for the
		// Server's flush on the way out
		if (server?.database) {
			this.save = () => {
				if (this._saveTimer) return;
				this._saveTimer = setTimeout(() => this.saveNow(), Game.SAVE_WITHIN_MS);
				this._saveTimer.unref?.();
			};
			this.saveNow = () => {
				clearTimeout(this._saveTimer);
				this._saveTimer = null;

				const data = this.toSaveState();

				// In development, a save that won't come back as it went (a Map, a Set, a function, a class instance) is
				// said once, where it is, rather than found missing after a restart
				if (process.env.NODE_ENV === 'development' && !this._warnedUnsaveable) {
					const where = unsaveable(data);

					if (where) {
						this._warnedUnsaveable = true;
						this.logger.warning(`The save won't survive a restart as it is: ${where}`, { gameId: this.id });
					}
				}
				server.database.collections.games.set({ id: this.id, data });
			};
		} else {
			this.save = () => {}; // No-op if no database
			this.saveNow = () => {};
		}

		// Restore players from save state
		if (saveState.players) {
			saveState.players.forEach(player => {
				this.players.set(player.id, player);
			});
		}
		// Each player's secret, known to the server and to that player's own page alone (see join)
		this.secrets = new Map(Object.entries(saveState.secrets ?? {}));

		// Register game with server
		if (server) {
			server.games[this.id] = this;
		}

		// Create initial save if this is a new game
		// Deferred a microtask so subclass constructors finish initializing state before toSaveState runs; a game whose
		// construction failed has been unregistered by then, and is not saved
		if (!saveState.id && server?.database) {
			queueMicrotask(() => {
				if (server.games[this.id] === this) server.database.collections.games.create(this.toSaveState());
			});
		}
	}

	/**
	 * Generate a unique game ID
	 * Override this to use a custom ID generator
	 * @returns {string} Unique game ID
	 */
	_generateId() {
		return simpleId();
	}

	/**
	 * Serialize game state for client
	 * Override this to customize what data is sent to clients
	 * @returns {object} Game state for client
	 */
	toClient() {
		return {
			id: this.id,
			name: this.name,
			options: this.options,
			players: [...this.players.values()].map(player => ({ ...player, online: this.online.has(player.id) })),
		};
	}

	/**
	 * Serialize game state for persistence
	 * Override this to customize what data is saved
	 * @returns {object} Game state for database
	 */
	toSaveState() {
		return {
			id: this.id,
			name: this.name,
			options: this.options,
			players: [...this.players.values()],
			secrets: Object.fromEntries(this.secrets),
			...(this.constructor.version && { version: this.constructor.version }),
		};
	}

	/**
	 * The game's `state` as it should be saved: without the keys named in `static transient` (what's rebuilt on load, or
	 * changes every tick: grains of sand in flight, a timer handle)
	 * @returns {object} The state to save
	 */
	savedState() {
		const { transient = [] } = this.constructor;
		const state = { ...this.state };

		for (const key of transient) delete state[key];

		return state;
	}

	/**
	 * Brings a save up to the game's `static version` by its `static migrations` ({ [version]: save => void }, each
	 * changing the save in place from the version before), in order. A save with no version is version 1.
	 * @param {object} save - A save state, changed in place
	 * @returns {object} The same save
	 */
	static migrate(save) {
		const { version, migrations = {} } = this;

		if (!version || !save?.id) return save;

		for (let at = (save.version ?? 1) + 1; at <= version; at++) migrations[at]?.(save);
		save.version = version;

		return save;
	}

	/**
	 * What one player's page is shown of the game (or a watcher's, with null): everything by default. Override it to keep
	 * what a player shouldn't see off their screen (other players' hands, what's under the fog), and to send each page
	 * only what it draws.
	 * @param {string|null} _playerId - Whose page, or null for someone watching
	 * @returns {object} The view
	 */
	viewFor(_playerId) {
		return { ...this.toClient(), state: this.state };
	}

	/**
	 * Every page open on this game is sent its own view (viewFor) as `state`, and no page elsewhere. The way to show a
	 * change; it happens by itself after each action.
	 */
	publish() {
		this.server?.publish?.(this);
		this.save();
	}

	/**
	 * A player's action, from their page (the Server ties it to the page's player; the message can't claim another):
	 * runs the game's `actions[name](player, data)` with `this` the game, then publishes. An action throws
	 * refuse('why') to turn it down, which the player's page is told.
	 * @param {string} playerId - Whose
	 * @param {string} name - Which action
	 * @param {*} data - What it carries
	 * @returns {{ ok: true } | { ok: false, error: string }} What came of it
	 */
	act(playerId, name, data) {
		const action = Object.hasOwn(this.actions ?? {}, name) ? this.actions[name] : null;
		const player = this.players.get(playerId);

		if (typeof action !== 'function') return { ok: false, error: `No such action: ${name}` };
		if (!player) return { ok: false, error: 'Not a player in this game' };

		try {
			action.call(this, player, data);
		} catch (error) {
			if (error instanceof ActionRefused) return { ok: false, error: error.message };
			this.logger.error('An action failed', { gameId: this.id, action: name, error: error.stack ?? error.message });

			return { ok: false, error: 'Something went wrong' };
		}

		this.publish();

		return { ok: true };
	}

	/**
	 * Whether `secret` is the player's: a player who joined before secrets existed has none and needs none
	 * @param {string} playerId - Whose
	 * @param {string} [secret] - What the page says
	 * @returns {boolean} Whether the page may speak for that player
	 */
	isPlayersSecret(playerId, secret) {
		const known = this.secrets.get(playerId);

		return this.players.has(playerId) && (!known || known === secret);
	}

	/**
	 * Validate broadcast data before sending
	 * Override this to add custom validation
	 * @param {string} _key - Broadcast event key
	 * @param {object} _data - Data to broadcast
	 * @returns {boolean} Whether data is valid
	 */
	validateBroadcastData(_key, _data) {
		return true; // Default: allow all
	}

	/**
	 * Augment broadcast data with additional fields
	 * Override this to add game state or other data to broadcasts
	 * @param {string} _key - Broadcast event key
	 * @param {object} data - Original data
	 * @returns {object} Augmented data
	 */
	augmentBroadcastData(_key, data) {
		return data; // Default: no augmentation
	}

	/**
	 * Broadcast an update to all clients
	 * Automatically validates and augments data via hooks
	 * @param {string} key - Event key/type
	 * @param {object} data - Data to broadcast
	 */
	broadcast(key, data) {
		// Validate data (hook)
		if (!this.validateBroadcastData(key, data)) {
			this.logger.error('Invalid broadcast data', { key, data });
			return;
		}

		// Augment data (hook)
		const augmentedData = this.augmentBroadcastData(key, data);

		// Prepare safe data structure. `id` is the game's unless the data brings its own (removePlayer's is the
		// player's), so `gameId` always names the game
		const safeData = { id: this.id, gameId: this.id, update: key };

		// Copy properties, avoiding cyclic references
		if (augmentedData && typeof augmentedData === 'object') {
			Object.keys(augmentedData).forEach(prop => {
				try {
					JSON.stringify(augmentedData[prop]);
					safeData[prop] = augmentedData[prop];
				} catch (error) {
					if (error.message.includes('cyclic')) {
						this.logger.warning(`Skipping cyclic property '${prop}' in broadcast '${key}'`);
						// Try toClient() method if available
						if (augmentedData[prop] && typeof augmentedData[prop].toClient === 'function') {
							safeData[prop] = augmentedData[prop].toClient();
						}
					} else {
						throw error;
					}
				}
			});
		}

		// To the pages open on this game, and those that haven't said where they are (Server.gameBroadcast)
		if (this.server.gameBroadcast) this.server.gameBroadcast(this.id, safeData);
		else this.server.socketBroadcast(safeData);

		// Trigger save
		this.save();
	}

	/**
	 * Add a player to the game
	 * @param {string} name - Player name
	 * @returns {object} The created player
	 */
	addPlayer(name) {
		const id = this._generateId();

		const made = { id, name };
		// Hook: createPlayer, for what each player starts with (a color, a seat, a score of zero)
		const player = typeof this.createPlayer === 'function' ? { ...made, ...this.createPlayer(made), id } : made;

		this.players.set(id, player);
		this.secrets.set(id, crypto.randomUUID());
		// Joining is being here
		this.online.add(id);

		// Hook: onPlayerAdded
		if (typeof this.onPlayerAdded === 'function') {
			this.onPlayerAdded(player);
		}

		this.broadcast('addPlayer', { newPlayer: player });

		return player;
	}

	/**
	 * Runs `tick` every `ms` for as long as the game exists: stopped when it's removed (dispose), so a deleted game's loop
	 * doesn't run on. An error in one tick is logged and the loop carries on.
	 * @param {number} ms - How often
	 * @param {Function} tick - What runs
	 * @returns {object} The timer, for stopping it sooner with clearInterval
	 */
	every(ms, tick) {
		const timer = setInterval(() => {
			try {
				tick();
			} catch (error) {
				this.logger.error('A game loop failed', { gameId: this.id, error: error.stack ?? error.message });
			}
		}, ms);

		timer.unref?.();
		(this._loops ??= new Set()).add(timer);

		return timer;
	}

	/**
	 * The game is going away (deleted, or replaced): its loops stop and a save still pending is dropped, so it can't
	 * write the game back after it's gone. Calls the onDispose() hook, for anything else the game started.
	 */
	dispose() {
		for (const timer of this._loops ?? []) clearInterval(timer);
		this._loops?.clear();
		clearTimeout(this._saveTimer);
		this._saveTimer = null;
		this.save = () => {};

		if (typeof this.onDispose === 'function') this.onDispose();
	}

	/**
	 * Whether a player has a page open on the game: the Server says so as their page announces itself and when its last
	 * connection closes. A player who closed the page stays a player (their place and score kept for when they're back)
	 * but is no longer here. Broadcasts `presence` ({ id, online }) on a change, and calls the onPresence(id, online)
	 * hook, where a game takes a ship out of space or a hand off the table.
	 * @param {string} id - Player ID
	 * @param {boolean} online - Whether they're here
	 */
	setOnline(id, online) {
		if (!this.players.has(id) || online === this.online.has(id)) return;
		if (online) this.online.add(id);
		else this.online.delete(id);

		if (typeof this.onPresence === 'function') this.onPresence(id, online);

		this.broadcast('presence', { id, online });
	}

	/**
	 * Remove a player from the game
	 * @param {string} id - Player ID
	 * @returns {string} The removed player ID
	 */
	removePlayer(id) {
		this.players.delete(id);
		this.online.delete(id);
		this.secrets.delete(id);

		// Hook: onPlayerRemoved
		if (typeof this.onPlayerRemoved === 'function') {
			this.onPlayerRemoved(id);
		}

		this.broadcast('removePlayer', { id });

		return id;
	}

	/**
	 * Helper method for broadcasting with additional game state
	 * Useful for including derived/computed state with updates
	 * @param {string} event - Event key
	 * @param {object} data - Event data
	 * @param {Array<string>} stateFields - Additional state fields to include
	 * @param {string} stateKey - Key name for state object (default: 'gameState')
	 */
	broadcastWithGameState(event, data, stateFields = [], stateKey = 'gameState') {
		const gameState = {};

		stateFields.forEach(field => {
			if (this[field] !== undefined) {
				gameState[field] = this[field];
			}
		});

		const enhancedData = Object.keys(gameState).length > 0 ? { ...data, [stateKey]: gameState } : data;

		this.broadcast(event, enhancedData);
	}
}
