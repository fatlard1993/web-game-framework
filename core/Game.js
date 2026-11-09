import { simpleId } from '../utils/identifiers.js';

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
				server.database.collections.games.set({ id: this.id, data: this.toSaveState() });
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
		};
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

		// Broadcast to all clients
		this.server.socketBroadcast(safeData);

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

		const player = {
			id,
			name,
		};

		this.players.set(id, player);
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
