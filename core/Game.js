import { debounce } from '@vanilla-bean/components/utils';
import Players from './Players.js';
import EventRouter from './EventRouter.js';

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

		// Simple logger fallback
		this.logger = logger || server?.logger || console;

		// Player management
		this.players = new Players();

		// Event routing
		this.events = new EventRouter({
			context: this,
			logger: this.logger,
			emitFn: (event, data) => this.broadcast(event, data),
		});

		// Setup auto-save (debounced to prevent excessive writes)
		if (server?.database) {
			this.save = debounce(() => {
				server.database.collections.games.set({
					id: this.id,
					data: this.toSaveState(),
				});
			}, 5000);
		} else {
			this.save = () => {}; // No-op if no database
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
		if (!saveState.id && server?.database) {
			server.database.collections.games.create(this.toSaveState());
		}
	}

	/**
	 * Generate a unique game ID
	 * Override this to use a custom ID generator
	 * @returns {string} Unique game ID
	 */
	_generateId() {
		// Simple fallback ID generator
		return Math.random().toString(36).substring(2, 7);
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
			players: [...this.players.values()],
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

		// Prepare safe data structure
		const safeData = { id: this.id, update: key };

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

		// Hook: onPlayerAdded
		if (typeof this.onPlayerAdded === 'function') {
			this.onPlayerAdded(player);
		}

		this.broadcast('addPlayer', { newPlayer: player });

		return player;
	}

	/**
	 * Remove a player from the game
	 * @param {string} id - Player ID
	 * @returns {string} The removed player ID
	 */
	removePlayer(id) {
		this.players.delete(id);

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
