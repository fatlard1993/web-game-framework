import os from 'os';

import { devConsole, handleExit, serve, serveStatic } from '@vanilla-bean/components/app';

import { simpleId } from '../utils/identifiers.js';
import { autoPort } from '../utils/port.js';

import consoleLogger from './consoleLogger.js';
import Database from './Database.js';

// Where every game says how it's doing, the same on each so one watcher reads them all
export const STATUS_PATH = '/.well-known/web-game';

/**
 * Minimal WebSocket server for multiplayer games, on the server kit's `serve` (from `@vanilla-bean/components/app`)
 *
 * Features:
 * - Automatic WebSocket upgrade (at /ws by default)
 * - WebSocket client tracking
 * - Broadcasting to all clients
 * - From `serve`: cross-origin refusal, a thrown error answered (withErrors), 404 for what the router leaves, and in
 *   development the client watched and rebuilt, with its pages reloaded
 * - In development, the terminal's `b` (build) and `stop`, plus the game's own commands
 * - Optional health monitoring
 * - Optional database integration
 * @example
 * ```js
 * const server = new Server({
 *   port: 3000,
 *   Game: MyGameClass,
 *   router: (server) => (request) => { ... }, // optional
 *   devConsole: (command, server) => { ... }, // optional
 * });
 * ```
 */
export default class Server {
	/** How long a closed page's player stays here, for a reload to come back within */
	static LEFT_AFTER_MS = 5000;

	/**
	 * @param {object} options - Server configuration
	 * @param {number} options.port - Port to listen on
	 * @param {string} [options.hostname] - Hostname to bind to
	 * @param {Function} [options.router] - Optional HTTP request router: (server) => (request, bunServer) => Response
	 * @param {string} [options.wsPath] - WebSocket upgrade path
	 * @param {Function} [options.Game] - Game class to instantiate
	 * @param {object|string} [options.database] - Database instance, or a file path to create one from
	 * @param {boolean} [options.exit] - Install the exit handler that saves what's pending first (default true)
	 * @param {boolean|object} [options.static] - Serve the client's build for what the router leaves (serveStatic's options)
	 * @param {object} [options.logger] - Optional logger with info, warning, error and debug
	 * @param {number} [options.verbosity] - Log verbosity level (0-3)
	 * @param {object} [options.build] - Client build options for development's watch (buildClient's; its defaults if
	 *   omitted)
	 * @param {Function} [options.devConsole] - (command, server) => anything, for a line typed into the dev server's
	 *   terminal that isn't `b` or `stop`
	 * @param {Function} [options.status] - (server) => [{ label, value }]: the game's own numbers worth watching from
	 *   outside, added to what /.well-known/web-game says of every game
	 * @param {object} [options.websocket] - Optional websocket handlers
	 * @param {Function} [options.websocket.message] - Custom message handler (socket, message)
	 * @param {Function} [options.websocket.open] - Custom open handler (socket)
	 * @param {Function} [options.websocket.close] - Custom close handler (socket, code, reason)
	 */
	constructor({
		port,
		hostname = '0.0.0.0',
		router,
		wsPath = '/ws',
		Game,
		database,
		logger,
		verbosity,
		build,
		devConsole: commands,
		status,
		websocket,
		exit = true,
		static: statics,
	}) {
		this.clients = {};
		this.games = {};
		this.Game = Game;
		this.wsPath = wsPath;
		// 'auto': PORT, else the port this game had last, else 3000, else any free one (see utils/port)
		if (port === 'auto') port = autoPort();
		this.requestedPort = port;
		// Built-in files (the client's build) for what the router leaves: true for client/build, or serveStatic's options
		this.statics = statics === true ? {} : statics;
		this.status = status;

		this.logger = logger || consoleLogger({ verbosity });

		if (typeof database === 'string') database = new Database({ filePath: database, logger: this.logger });
		else if (database && !(database instanceof Database)) {
			throw new Error('Server option "database" must be a Database instance or a file path string');
		}

		this.database = database;

		// The saved games, loaded as soon as the database is read: a request about games waits for it (gamesLoaded), so
		// nothing is told a game is missing in the moment before it comes back
		this.gamesLoaded =
			database && Game
				? new Promise(resolve =>
						database.onReady(() => {
							this._loadSavedGames();
							resolve();
						}),
					)
				: Promise.resolve();

		// On the way out (stopped, or a crash), what's waiting to be saved is written first; `exit: false` leaves the
		// process's ending to whoever runs it (a test)
		if (database && exit) handleExit({ flush: () => this.flush() });

		if (!database) this.logger.info('No database configured - games will not persist across restarts');

		// Store verbosity
		if (verbosity !== undefined) {
			this.verbosity = verbosity;
		}

		/**
		 * Settles once listening, and in development once the client's first build is done; rejects when the port is
		 * taken
		 * @type {Promise<Server>}
		 */
		this.ready = serve({
			port,
			hostname,
			build,
			router: this._createDefaultRouter(router),
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
					this._leftPage(socket.data.presence);
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

						// A page saying which game and player it is, and a player's action: the framework's own, not the
						// game's to receive
						if (parsed.type === 'presence') {
							this._onPage(socket, parsed);

							return;
						}
						if (parsed.type === 'act') {
							this._onAction(socket, parsed);

							return;
						}

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
		}).then(httpServer => {
			this.httpServer = httpServer;

			return this;
		});

		devConsole(commands && (command => commands(command, this)));

		// Start health monitoring if logger supports it
		if (verbosity >= 1) {
			this.startHealthMonitoring();
		}
	}

	/**
	 * A page's announcement of the game it's open on: as a player (with that player's secret, if they have one), or to
	 * watch. That player is here, and the page is sent its view of the game at once.
	 * @param {object} socket - The page's socket
	 * @param {{ gameId: string, playerId?: string, secret?: string, watch?: boolean }} presence - Which game and player
	 */
	_onPage(socket, { gameId, playerId, secret, watch }) {
		const game = typeof gameId === 'string' ? this.games[gameId] : undefined;

		if (!game) return;
		if (watch) socket.data.presence = { gameId, playerId: null };
		else {
			if (typeof playerId !== 'string' || !(game.isPlayersSecret?.(playerId, secret) ?? true)) {
				socket.send(JSON.stringify({ update: 'refused', gameId, error: 'That page is not that player' }));

				return;
			}
			socket.data.presence = { gameId, playerId };
			game.setOnline?.(playerId, true);
		}
		if (game.viewFor) this._sendView(socket, game, { first: true });
	}

	/**
	 * A player's action from their page: run as the page's player, whatever the message says, and answered to that page
	 * alone: { update: 'acted', ack, ok, error? }
	 * @param {object} socket - The page's socket
	 * @param {{ action: string, data: *, ack?: * }} message - The action
	 */
	_onAction(socket, { action, data, ack }) {
		const { gameId, playerId } = socket.data.presence ?? {};
		const game = gameId && this.games[gameId];
		const result =
			game && playerId ? game.act(playerId, action, data) : { ok: false, error: 'This page is not in a game' };

		socket.send(JSON.stringify({ update: 'acted', gameId, ack, ...result }));
	}

	_sendView(socket, game, { first = false } = {}) {
		const { playerId } = socket.data.presence;

		socket.send(
			JSON.stringify({ update: 'state', id: game.id, gameId: game.id, ...game.viewFor(playerId, { first }) }),
		);
	}

	/**
	 * Every page open on `game` sent its own view (Game.viewFor), and no other page
	 * @param {object} game - The game
	 */
	publish(game) {
		for (const socket of Object.values(this.clients))
			if (socket.data.presence?.gameId === game.id) this._sendView(socket, game);
	}

	/**
	 * What a game broadcasts goes to the pages open on it and to pages that haven't said where they are (the lobby, or
	 * a game's page from before it said), not to pages open on another game
	 * @param {string} gameId - The game's
	 * @param {object} data - What's sent
	 */
	gameBroadcast(gameId, data) {
		const serialized = JSON.stringify(data);

		for (const socket of Object.values(this.clients)) {
			const at = socket.data.presence?.gameId;

			if (!at || at === gameId) socket.send(serialized);
		}
	}

	/**
	 * Where a phone on the same network reaches this server: this machine's first network address and the port. A page
	 * opened as localhost can't put localhost in a QR code; it asks this (GET /join-url).
	 * @returns {string|null} Like http://192.168.1.20:3000, or null with no network
	 */
	lanUrl() {
		const address = Object.values(os.networkInterfaces())
			.flat()
			.find(found => found?.family === 'IPv4' && !found.internal)?.address;

		return address ? `http://${address}:${this.port}` : null;
	}

	/**
	 * A page's connection closed: once a moment has passed with no other page open on that player (a reload comes back
	 * within it), they're no longer here
	 * @param {{ gameId: string, playerId: string }} [presence] - Which game and player the page was
	 */
	_leftPage(presence) {
		if (!presence) return;

		setTimeout(() => {
			const still = Object.values(this.clients).some(
				other => other.data.presence?.gameId === presence.gameId && other.data.presence?.playerId === presence.playerId,
			);

			if (!still) this.games[presence.gameId]?.setOnline?.(presence.playerId, false);
		}, Server.LEFT_AFTER_MS).unref?.();
	}

	/** @returns {number} The port listened on, or the one asked for until listening */
	get port() {
		return this.httpServer?.port ?? this.requestedPort;
	}

	/** @returns {URL|undefined} The server's URL, once listening */
	get url() {
		return this.httpServer?.url;
	}

	/** @returns {string|undefined} The hostname bound, once listening */
	get hostname() {
		return this.httpServer?.hostname;
	}

	/**
	 * Restore the saved games. One record that can't be restored skips that game, not the rest of them, nor the server.
	 * @private
	 */
	_loadSavedGames() {
		const savedGames = Object.values(this.database.collections?.games?.read() || {});
		let loaded = 0;

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
	}

	/**
	 * Remove a game: it stops (its loops, a save still pending), its record goes from the database, and every page hears
	 * `removedGame`
	 * @param {string} id - Game ID
	 * @returns {boolean} Whether there was such a game
	 */
	removeGame(id) {
		const game = this.games[id];

		if (!game) return false;
		game.dispose?.();
		delete this.games[id];
		this.database?.collections.games?.delete({ id });
		this.socketBroadcast({ update: 'removedGame', gameId: id });

		return true;
	}

	/**
	 * Every game's pending save written now, and the database with it: for the way out
	 * @returns {Promise<void>}
	 */
	async flush() {
		for (const game of Object.values(this.games)) game.saveNow?.();
		await this.database?.write();
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
	 * How the game is doing, in numbers, for whatever watches it (web-game-mother-hub): who has it open, how many games
	 * are going and the players in them, and anything the game adds through its `status` option. Counts only, never
	 * names: an exposed game answers this to anyone.
	 * @returns {object} The status
	 */
	statusReport() {
		const games = Object.values(this.games).filter(Boolean);
		let metrics = [];

		try {
			metrics = (this.status?.(this) ?? []).filter(metric => metric && metric.label !== undefined);
		} catch (error) {
			this.logger.warning('The status option threw', { error: error.message });
		}

		return {
			connections: Object.keys(this.clients).length,
			games: games.length,
			players: games.reduce((total, game) => total + (game.players?.size ?? 0), 0),
			uptime: Math.round(process.uptime()),
			memory: process.memoryUsage().rss,
			metrics,
		};
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
	 * @returns {Function} Combined router function, for serve
	 */
	_createDefaultRouter(customRouter) {
		return (request, httpServer) => {
			// In development serve settles after the client's first build, and requests arrive before that
			this.httpServer ??= httpServer;

			const { pathname } = new URL(request.url);

			if (pathname === this.wsPath) {
				if (httpServer.upgrade(request, { data: { clientId: simpleId() } })) return;
			}

			if (pathname === STATUS_PATH && request.method === 'GET') return Response.json(this.statusReport());
			if (pathname === '/join-url' && request.method === 'GET') return Response.json({ url: this.lanUrl() });

			return this.gamesLoaded.then(async () => {
				const answered = await customRouter?.(this)(request, httpServer);

				return answered ?? (this.statics ? serveStatic(request, this.statics) : undefined);
			});
		};
	}
}
