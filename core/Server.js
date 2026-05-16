/**
 * Minimal WebSocket server for multiplayer games
 *
 * Features:
 * - Automatic WebSocket upgrade (at /ws by default)
 * - WebSocket client tracking
 * - Broadcasting to all clients
 * - Hot reload in development
 * - Optional health monitoring
 * - Optional database integration
 * @example
 * ```js
 * const server = new Server({
 *   port: 3000,
 *   Game: MyGameClass,
 *   router: (server) => (req) => { ... }, // optional
 * });
 * ```
 */
export default class Server {
	/**
	 * @param {object} options
	 * @param {number} options.port - Port to listen on
	 * @param {string} [options.hostname] - Hostname to bind to
	 * @param {Function} [options.router] - Optional HTTP request router function
	 * @param {string} [options.wsPath] - WebSocket upgrade path
	 * @param {class} [options.Game] - Game class to instantiate
	 * @param {object} [options.database] - Optional database instance
	 * @param {object} [options.logger] - Optional logger (console-compatible)
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
		this.database = database;
		this.wsPath = wsPath;

		// Simple logger fallback
		this.logger = logger || {
			info: (...args) => verbosity >= 1 && console.log('[INFO]', ...args),
			warning: (...args) => verbosity >= 2 && console.warn('[WARN]', ...args),
			error: (...args) => console.error('[ERROR]', ...args),
			debug: (...args) => verbosity >= 3 && console.log('[DEBUG]', ...args),
		};

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
				const savedGames = database.collections?.games?.read() || {};
				Object.values(savedGames).forEach(saveState => {
					new Game({ saveState, server: this });
				});
				this.logger.info(`Loaded ${Object.keys(savedGames).length} games from database`);
			});
		}

		// Start health monitoring if logger supports it
		if (verbosity >= 1) {
			this.startHealthMonitoring();
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
	 * Reload all connected clients (hot reload)
	 */
	reloadClients() {
		Object.entries(this.clients).forEach(([clientId, socket]) => {
			this.logger.info(`[dev] Reloading client ${clientId}`);
			socket.send('hotReload');
		});
	}

	/**
	 * Start periodic health monitoring
	 * Logs system stats every 5 minutes
	 */
	startHealthMonitoring() {
		const INTERVAL = 5 * 60 * 1000; // 5 minutes

		const logHealth = () => {
			const mem = process.memoryUsage();
			const uptime = process.uptime();

			this.logger.info('Health check', {
				uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
				memory: {
					rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
					heap: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
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
		return req => {
			const url = new URL(req.url);

			// Handle WebSocket upgrade
			if (url.pathname === this.wsPath) {
				const upgraded = this.httpServer.upgrade(req, {
					data: { clientId: this._generateClientId() },
				});
				if (upgraded) return; // WebSocket handled
			}

			// Delegate to custom router if provided
			if (customRouter) {
				return customRouter(this)(req);
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
