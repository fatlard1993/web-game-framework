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
import { mkdirSync } from 'fs';

import { serveStatic } from '@vanilla-bean/components/app';

import Server from '../../core/Server.js';
import Database from '../../core/Database.js';
import ClickerGame from './ClickerGame.js';

// Initialize database
mkdirSync('./data', { recursive: true });

const database = new Database({
	filePath: './data/clicker-games.json',
	onReady: db => {
		console.log('✅ Database ready!');
		const gameCount = Object.keys(db.data.games || {}).length;
		console.log(`📦 Loaded ${gameCount} saved game(s)`);
	},
});

// Router for HTTP requests (WebSocket handled automatically)
const router = server => async request => {
	const url = new URL(request.url);

	// API Routes

	// GET /api/games - List all games
	if (url.pathname === '/api/games' && request.method === 'GET') {
		const games = Object.values(server.games).map(game => game.toClient());
		return Response.json(games);
	}

	// POST /api/games - Create new game
	if (url.pathname === '/api/games' && request.method === 'POST') {
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
	if (gameMatch && request.method === 'GET') {
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
	if (joinMatch && request.method === 'POST') {
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
			const body = await request.json();
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
	if (deleteMatch && request.method === 'DELETE') {
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

	// The built client, and the icon and font stylesheets its Page loads
	return serveStatic(request, { root: './client/dist' });
};

// Create server with custom WebSocket message handler
const server = new Server({
	port: Number(process.env.PORT) || 3000,
	Game: ClickerGame,
	build: { entrypoints: ['./client/index.html'], outdir: './client/dist' },
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

await server.ready;

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
console.log(`🎯 Open ${server.url} in your browser to play!`);
