import { hotReload, sameOrigin } from '@vanilla-bean/components/app';

import consoleLogger from './consoleLogger.js';
import Database from './Database.js';

/**
 * Minimal WebSocket server for multiplayer games
 *
 * Features:
 * - Automatic WebSocket upgrade (at /ws by default)
 * - WebSocket client tracking
 * - Broadcasting to all clients
 * - Takes the page reload sockets of `hotReload` (from `@vanilla-bean/components/app`)
 * - Optional health monitoring
 * - Optional database integration
 * @example
 * ```js
 * const server = new Server({
 *   port: 3000,
 *   Game: MyGameClass,
 *   router: (server) => (request) => { ... }, // optional
 * });
 * ```
 */
export default class Server {
	/**
	 * @param {object} options - Server configuration
	 * @param {number} options.port - Port to listen on
	 * @param {string} [options.hostname] - Hostname to bind to
	 * @param {Function} [options.router] - Optional HTTP request router function
	 * @param {string} [options.wsPath] - WebSocket upgrade path
	 * @param {Function} [options.Game] - Game class to instantiate
	 * @param {object|string} [options.database] - Database instance, or a file path to create one from
	 * @param {object} [options.logger] - Optional logger with info, warning, error and debug
	 * @param {number} [options.verbosity] - Log verbosity level (0-3)
	 * @param {object} [options.websocket] - Optional websocket handlers
	 * @param {Function} [options.websocket.message] - Custom message handler (socket, message)
	 * @param {Function} [options.websocket.open] - Custom open handler (socket)
	 * @param {Function} [options.websocket.close] - Custom close handler (socket, code, reason)
	 */
	constructor({ port, hostname = '0.0.0.0', router, wsPath = '/ws', Game, database, logger, verbosity, websocket }) {
		this.clients = {};
		this.games = {};
		this.Game = Game;
		this.wsPath = wsPath;

		this.logger = logger || consoleLogger({ verbosity });

		if (typeof database === 'string') database = new Database({ filePath: database, logger: this.logger });
		else if (database && !(database instanceof Database)) {
			throw new Error('Server option "database" must be a Database instance or a file path string');
		}

		this.database = database;

		if (!database) this.logger.info('No database configured - games will not persist across restarts');

		// Store verbosity
		if (verbosity !== undefined) {
			this.verbosity = verbosity;
		}

		// Create default router that handles WebSocket upgrade
		const defaultRouter = this._createDefaultRouter(router);

		// Initialize Bun server
		this.httpServer = Bun.serve({
			port,
			hostname,
			fetch: defaultRouter,
			websocket: {
				open: socket => {
					if (socket.data.hotReload) return hotReload.websocket.open(socket);

					const clientId = socket.data.clientId;
					this.clients[clientId] = socket;
					this.logger.info('WebSocket connected', {
						clientId,
						totalConnections: Object.keys(this.clients).length,
					});

					// Call custom open handler if provided
					if (websocket?.open) {
						websocket.open(socket);
					}
				},
				close: (socket, code, reason) => {
					if (socket.data.hotReload) return hotReload.websocket.close(socket);

					const clientId = socket.data.clientId;
					delete this.clients[clientId];
					this.logger.info('WebSocket closed', {
						clientId,
						code,
						reason: reason?.toString(),
						totalConnections: Object.keys(this.clients).length,
					});

					// Call custom close handler if provided
					if (websocket?.close) {
						websocket.close(socket, code, reason);
					}
				},
				message: (socket, message) => {
					const clientId = socket.data.clientId;
					try {
						const parsed = typeof message === 'string' ? JSON.parse(message) : message;
						this.logger.debug('WebSocket message', {
							clientId,
							type: parsed.type || 'unknown',
						});

						// Call custom message handler if provided
						if (websocket?.message) {
							websocket.message(socket, message);
						}
					} catch (error) {
						this.logger.warning('Invalid WebSocket message', {
							clientId,
							error: error.message,
						});
					}
				},
			},
		});

		this.port = this.httpServer.port;
		this.url = this.httpServer.url;
		this.hostname = this.httpServer.hostname;

		this.logger.info(`Server listening on ${this.hostname}:${this.port}`);

		// Load games from database if available
		if (database && Game) {
			database.onReady?.(() => {
				const savedGames = Object.values(database.collections?.games?.read() || {});
				let loaded = 0;

				// One record that can't be restored skips that game, not the rest of them, nor the server
				for (const saveState of savedGames) {
					try {
						this._constructGame({ saveState });
						loaded++;
					} catch (error) {
						this.logger.warning('Skipping a saved game that could not be restored', {
							gameId: saveState?.id,
							error: error.message,
						});
					}
				}

				this.logger.info(`Loaded ${loaded} of ${savedGames.length} games from database`);
			});
		}

		// Start health monitoring if logger supports it
		if (verbosity >= 1) {
			this.startHealthMonitoring();
		}
	}

	/**
	 * Create a new game. When its constructor throws, nothing of it stays registered or gets saved.
	 * @param {object} options - Game options
	 * @returns {object} The new game
	 */
	createGame(options) {
		return this._constructGame(options);
	}

	/**
	 * Construct a game, undoing what a failed construction registered: the base Game constructor registers the game
	 * before a subclass constructor runs, so one that throws would otherwise leave a broken game listed.
	 * @param {object} options - Game options
	 * @returns {object} The constructed game
	 */
	_constructGame(options) {
		const registered = new Set(Object.keys(this.games));

		try {
			return new this.Game({ ...options, server: this });
		} catch (error) {
			for (const id of Object.keys(this.games)) if (!registered.has(id)) delete this.games[id];

			throw error;
		}
	}

	/**
	 * Broadcast data to all connected clients
	 * @param {object} data - Data to broadcast (will be JSON stringified)
	 */
	socketBroadcast(data) {
		let serialized;
		try {
			serialized = JSON.stringify(data);
		} catch (error) {
			if (error.message.includes('cyclic')) {
				this.logger.error('Cyclic structure in broadcast data', { keys: Object.keys(data) });
				serialized = JSON.stringify({ error: 'Cyclic structure detected' });
			} else {
				throw error;
			}
		}

		Object.values(this.clients).forEach(socket => {
			socket.send(serialized);
		});
	}

	/**
	 * Start periodic health monitoring
	 * Logs system stats every 5 minutes
	 */
	startHealthMonitoring() {
		const INTERVAL = 5 * 60 * 1000; // 5 minutes

		const logHealth = () => {
			const memory = process.memoryUsage();
			const uptime = process.uptime();

			this.logger.info('Health check', {
				uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
				memory: {
					rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
					heap: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
				},
				connections: Object.keys(this.clients).length,
				games: Object.keys(this.games).length,
			});
		};

		// Initial log
		logHealth();

		// Periodic logging
		setInterval(logHealth, INTERVAL);
	}

	/**
	 * Create default router that handles WebSocket upgrade and delegates to custom router
	 * @private
	 * @param {Function} customRouter - Optional custom router function
	 * @returns {Function} Combined router function
	 */
	_createDefaultRouter(customRouter) {
		return request => {
			// A socket opened, or a write sent, by another site's page in a player's browser: refused before anything
			// hears it. WebSockets get no CORS protection of their own.
			if (!sameOrigin(request)) return new Response('Cross-origin request refused', { status: 403 });

			if (hotReload.upgrade(request, this.httpServer)) return;

			const url = new URL(request.url);

			// Handle WebSocket upgrade
			if (url.pathname === this.wsPath) {
				const upgraded = this.httpServer.upgrade(request, {
					data: { clientId: this._generateClientId() },
				});
				if (upgraded) return; // WebSocket handled
			}

			// Delegate to custom router if provided
			if (customRouter) {
				return customRouter(this)(request);
			}

			// Default 404 if no custom router
			return new Response('Not Found', { status: 404 });
		};
	}

	/**
	 * Generate unique client ID
	 * @private
	 * @returns {string} Client ID
	 */
	_generateClientId() {
		return Math.random().toString(36).substring(2, 9);
	}
}
