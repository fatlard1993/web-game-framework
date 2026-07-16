import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

/**
 * Simple JSON file-based database with collections
 *
 * Built on lowdb for simple persistence of game state.
 * Each collection supports CRUD operations: create, read, update, delete, set.
 * @example
 * ```js
 * const db = new Database({
 *   filePath: './data/games.json',
 *   logger: console,
 *   onReady: (db) => {
 *     console.log('Database loaded!');
 *   }
 * });
 *
 * // Use collections
 * db.collections.games.create({ id: 'abc', name: 'My Game' });
 * const game = db.collections.games.read({ id: 'abc' });
 * ```
 */
export default class Database extends Low {
	/**
	 * @param {object} options - Database configuration
	 * @param {string} options.filePath - Path to JSON file
	 * @param {object} [options.logger] - Optional logger
	 * @param {Function} [options.onReady] - Callback when database is ready
	 */
	constructor(options) {
		const { filePath, logger, onReady } = options;

		super(new JSONFile(filePath), { games: {} });

		this.options = options;
		this.collections = {};
		this._onReady = onReady;

		// Simple logger fallback
		this.logger = logger || {
			info: (...args) => console.log('[DB-INFO]', ...args),
			warning: (...args) => console.warn('[DB-WARN]', ...args),
			error: (...args) => console.error('[DB-ERROR]', ...args),
			debug: () => {}, // Suppress debug by default
		};

		this.logger.info(`Database connecting to ${filePath}`);

		this.init();
	}

	/**
	 * Initialize database and load collections
	 */
	async init() {
		const startTime = performance.now();
		try {
			this.logger.info('Database initialization started', {
				filePath: this.options.filePath,
			});

			await this.read();

			const collectionNames = Object.keys(this.data);
			this.logger.info('Database loaded', {
				collections: collectionNames.length,
				collectionNames,
			});

			// Initialize all collections
			const results = await Promise.allSettled(collectionNames.map(key => this.addCollection(key)));
			const failed = results.filter(r => r.status === 'rejected').length;

			if (failed > 0) {
				this.logger.warning('Some collections failed to initialize', {
					failed,
					total: collectionNames.length,
				});
			}

			const duration = performance.now() - startTime;
			this.logger.info('Database initialization completed', {
				duration: `${duration.toFixed(2)}ms`,
				collectionsLoaded: collectionNames.length - failed,
			});

			// Call onReady callback
			if (this._onReady) {
				this._onReady(this);
			}
		} catch (error) {
			this.logger.error('Database initialization failed', {
				error: error.message,
				stack: error.stack,
				filePath: this.options.filePath,
			});
			throw error;
		}
	}

	/**
	 * Add a collection to the database
	 * @param {string} key - Collection name
	 */
	async addCollection(key) {
		await this.read();

		if (!this.data[key]) {
			this.data[key] = {};
		}

		this.logger.debug('Adding collection', { key });

		const db = this;

		// Create collection interface with CRUD operations
		this.collections[key] = {
			/**
			 * Create a new record
			 * @param {object} data - Record data (must have 'id' field)
			 * @returns {object} Created record
			 */
			create(data) {
				const startTime = performance.now();
				try {
					db.logger.debug('Create operation', {
						collection: key,
						id: data.id,
					});

					db.data[key][data.id] = data;
					db.write();

					const duration = performance.now() - startTime;
					db.logger.info('Record created', {
						collection: key,
						id: data.id,
						duration: `${duration.toFixed(2)}ms`,
					});

					return data;
				} catch (error) {
					db.logger.error('Create failed', {
						collection: key,
						id: data.id,
						error: error.message,
					});
					throw error;
				}
			},

			/**
			 * Read record(s)
			 * @param {object} [options] - Query options
			 * @param {string} [options.id] - Specific record ID
			 * @returns {object|boolean} Record or false if not found (or all records if no ID)
			 */
			read({ id } = {}) {
				try {
					const result = id ? db.data[key][id] || false : db.data[key];

					if (id) {
						db.logger.debug('Read operation', {
							collection: key,
							id,
							found: !!result,
						});
					}

					return result;
				} catch (error) {
					db.logger.error('Read failed', {
						collection: key,
						id,
						error: error.message,
					});
					throw error;
				}
			},

			/**
			 * Update a record (merges with existing)
			 * @param {object} options - Update parameters
			 * @param {string} options.id - Record ID
			 * @param {object} options.update - Fields to update
			 * @returns {object|boolean} Updated record or false if not found
			 */
			update({ id, update }) {
				const startTime = performance.now();
				try {
					if (!db.data[key][id]) {
						db.logger.warning('Update failed - record not found', {
							collection: key,
							id,
						});
						return false;
					}

					db.logger.debug('Update operation', {
						collection: key,
						id,
						fields: Object.keys(update),
					});

					const updated = { ...db.data[key][id], ...update };
					db.data[key][id] = updated;
					db.write();

					const duration = performance.now() - startTime;
					db.logger.info('Record updated', {
						collection: key,
						id,
						fields: Object.keys(update),
						duration: `${duration.toFixed(2)}ms`,
					});

					return updated;
				} catch (error) {
					db.logger.error('Update failed', {
						collection: key,
						id,
						error: error.message,
					});
					throw error;
				}
			},

			/**
			 * Delete a record
			 * @param {object} options - Delete parameters
			 * @param {string} options.id - Record ID
			 * @returns {string|boolean} Deleted ID or false if not found
			 */
			delete({ id }) {
				const startTime = performance.now();
				try {
					if (!db.data[key][id]) {
						db.logger.warning('Delete failed - record not found', {
							collection: key,
							id,
						});
						return false;
					}

					db.logger.debug('Delete operation', { collection: key, id });

					delete db.data[key][id];
					db.write();

					const duration = performance.now() - startTime;
					db.logger.info('Record deleted', {
						collection: key,
						id,
						duration: `${duration.toFixed(2)}ms`,
					});

					return id;
				} catch (error) {
					db.logger.error('Delete failed', {
						collection: key,
						id,
						error: error.message,
					});
					throw error;
				}
			},

			/**
			 * Set a record (replaces existing)
			 * @param {object} options - Set parameters
			 * @param {string} options.id - Record ID
			 * @param {object} options.data - Record data
			 * @returns {object} Set record
			 */
			set({ id, data }) {
				const startTime = performance.now();
				try {
					const isNewRecord = !db.data[key][id];

					db.logger.debug('Set operation', {
						collection: key,
						id,
						isNewRecord,
					});

					db.data[key][id] = data;
					db.write();

					const duration = performance.now() - startTime;
					db.logger.info(isNewRecord ? 'Record created (set)' : 'Record replaced (set)', {
						collection: key,
						id,
						duration: `${duration.toFixed(2)}ms`,
					});

					return data;
				} catch (error) {
					db.logger.error('Set failed', {
						collection: key,
						id,
						error: error.message,
					});
					throw error;
				}
			},
		};

		await this.write();
	}
}
