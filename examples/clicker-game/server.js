/**
 * Clicker Game Server
 *
 * Demonstrates complete framework usage:
 * - Server with WebSocket
 * - Game class with state management
 * - Database persistence
 * - REST API routes
 * - Message handling
 */
import Server from '../../core/Server.js';
import Database from '../../core/Database.js';
import ClickerGame from './ClickerGame.js';

// Initialize database
const database = new Database({
	filePath: './data/clicker-games.json',
	logger: console,
	onReady: db => {
		console.log('✅ Database ready!');
		const gameCount = Object.keys(db.data.games || {}).length;
		console.log(`📦 Loaded ${gameCount} saved game(s)`);
	},
});

// Router for HTTP requests (WebSocket handled automatically)
const router = server => async req => {
	const url = new URL(req.url);

	// Serve static files in development
	if (url.pathname === '/' || url.pathname === '/index.html') {
		return new Response(Bun.file('./client/dist/indexWithVBC.html'));
	}

	// Legacy version
	if (url.pathname === '/legacy') {
		return new Response(Bun.file('./client/index.html'));
	}

	// Serve bundled client chunks
	if (url.pathname.startsWith('/chunk-')) {
		const ext = url.pathname.endsWith('.js.map') ? '.js.map' : '.js';
		const contentType = ext === '.js' ? 'application/javascript' : 'application/json';
		return new Response(Bun.file(`./client/dist${url.pathname}`), {
			headers: { 'Content-Type': contentType },
		});
	}

	// Serve CSS dependencies from node_modules
	if (url.pathname.startsWith('/@fortawesome/')) {
		const filePath = url.pathname.replace(/^\/@fortawesome\//, '../../node_modules/@fortawesome/');
		return new Response(Bun.file(filePath), {
			headers: { 'Content-Type': 'text/css' },
		});
	}

	if (url.pathname.startsWith('/@fontsource-variable/')) {
		const filePath = url.pathname.replace(/^\/@fontsource-variable\//, '../../node_modules/@fontsource-variable/');
		return new Response(Bun.file(filePath), {
			headers: { 'Content-Type': 'text/css' },
		});
	}

	if (url.pathname.startsWith('/augmented-ui/')) {
		const filePath = url.pathname.replace(/^\/augmented-ui\//, '../../node_modules/augmented-ui/');
		return new Response(Bun.file(filePath), {
			headers: { 'Content-Type': 'text/css' },
		});
	}

	if (url.pathname === '/client.js') {
		return new Response(Bun.file('./client/client.js'), {
			headers: { 'Content-Type': 'application/javascript' },
		});
	}

	// Serve VBC client bundle
	if (url.pathname === '/clientVBC.js') {
		return new Response(Bun.file('./client/dist/clientVBC.js'), {
			headers: { 'Content-Type': 'application/javascript' },
		});
	}

	if (url.pathname === '/clientVBC.js.map') {
		return new Response(Bun.file('./client/dist/clientVBC.js.map'), {
			headers: { 'Content-Type': 'application/json' },
		});
	}

	if (url.pathname === '/styles.css') {
		return new Response(Bun.file('./client/styles.css'), {
			headers: { 'Content-Type': 'text/css' },
		});
	}

	// API Routes

	// GET /api/games - List all games
	if (url.pathname === '/api/games' && req.method === 'GET') {
		const games = Object.values(server.games).map(game => game.toClient());
		return Response.json(games);
	}

	// POST /api/games - Create new game
	if (url.pathname === '/api/games' && req.method === 'POST') {
		try {
			const game = new ClickerGame({
				server,
				name: `Game ${Object.keys(server.games).length + 1}`,
			});

			return Response.json({
				success: true,
				game: game.toClient(),
			});
		} catch (error) {
			return Response.json(
				{
					success: false,
					error: error.message,
				},
				{ status: 500 },
			);
		}
	}

	// GET /api/games/:id - Get specific game
	const gameMatch = url.pathname.match(/^\/api\/games\/([^/]+)$/);
	if (gameMatch && req.method === 'GET') {
		const gameId = gameMatch[1];
		const game = server.games[gameId];

		if (!game) {
			return Response.json(
				{
					success: false,
					error: 'Game not found',
				},
				{ status: 404 },
			);
		}

		return Response.json(game.toClient());
	}

	// POST /api/games/:id/join - Join a game
	const joinMatch = url.pathname.match(/^\/api\/games\/([^/]+)\/join$/);
	if (joinMatch && req.method === 'POST') {
		const gameId = joinMatch[1];
		const game = server.games[gameId];

		if (!game) {
			return Response.json(
				{
					success: false,
					error: 'Game not found',
				},
				{ status: 404 },
			);
		}

		try {
			const body = await req.json();
			const playerName = body.playerName || 'Anonymous';

			const player = game.addPlayer(playerName);

			return Response.json({
				success: true,
				player,
				game: game.toClient(),
			});
		} catch (error) {
			return Response.json(
				{
					success: false,
					error: error.message,
				},
				{ status: 500 },
			);
		}
	}

	// DELETE /api/games/:id - Delete a game
	const deleteMatch = url.pathname.match(/^\/api\/games\/([^/]+)$/);
	if (deleteMatch && req.method === 'DELETE') {
		const gameId = deleteMatch[1];
		const game = server.games[gameId];

		if (!game) {
			return Response.json(
				{
					success: false,
					error: 'Game not found',
				},
				{ status: 404 },
			);
		}

		// Remove from server
		delete server.games[gameId];

		// Remove from database
		if (database) {
			database.collections.games.delete({ id: gameId });
		}

		return Response.json({ success: true });
	}

	// Health check
	if (url.pathname === '/health') {
		return Response.json({
			status: 'ok',
			games: Object.keys(server.games).length,
			connections: Object.keys(server.clients).length,
		});
	}

	return new Response('Not Found', { status: 404 });
};

// Create server with custom WebSocket message handler
const server = new Server({
	port: 3000,
	Game: ClickerGame,
	database,
	router,
	verbosity: 3,
	websocket: {
		message: (socket, message) => {
			// Handle game-specific messages
			try {
				const data = typeof message === 'string' ? JSON.parse(message) : message;

				// Handle different message types
				switch (data.type) {
					case 'click': {
						const game = server.games[data.gameId];
						if (!game) {
							socket.send(JSON.stringify({ error: 'Game not found' }));
							return;
						}

						const result = game.click(data.playerId);
						if (result.error) {
							socket.send(JSON.stringify({ error: result.error }));
						}
						break;
					}

					case 'startGame': {
						const game = server.games[data.gameId];
						if (!game) {
							socket.send(JSON.stringify({ error: 'Game not found' }));
							return;
						}

						const result = game.startGame();
						if (result.error) {
							socket.send(JSON.stringify({ error: result.error }));
						}
						break;
					}

					case 'resetGame': {
						const game = server.games[data.gameId];
						if (!game) {
							socket.send(JSON.stringify({ error: 'Game not found' }));
							return;
						}

						game.resetGame();
						break;
					}

					case 'leaveGame': {
						const game = server.games[data.gameId];
						if (game && data.playerId) {
							game.removePlayer(data.playerId);
						}
						break;
					}

					default:
						// Unknown message type, already logged by default handler
						break;
				}
			} catch (error) {
				console.error('Error handling WebSocket message:', error);
				socket.send(JSON.stringify({ error: 'Invalid message format' }));
			}
		},
	},
});

console.log('🎮 Clicker Game Server');
console.log(`🌐 Server running at ${server.url}`);
console.log(`💾 Database: ./data/clicker-games.json`);
console.log('');
console.log('📖 API Endpoints:');
console.log('  GET    /api/games        - List all games');
console.log('  POST   /api/games        - Create new game');
console.log('  GET    /api/games/:id    - Get game details');
console.log('  POST   /api/games/:id/join - Join a game');
console.log('  DELETE /api/games/:id    - Delete a game');
console.log('  GET    /health           - Health check');
console.log('');
console.log('🎯 Open http://localhost:3000 in your browser to play!');
