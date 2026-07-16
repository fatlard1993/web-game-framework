import { requestMatch } from '../../utils/index.js';

/**
 * Basic game CRUD routes for web-game-framework
 *
 * Provides standard REST endpoints for game management:
 * - GET /games - List all games
 * - GET /games/:id - Get game details
 * - POST /games - Create new game
 * - POST /games/:id/join - Join game
 * - POST /games/:gameId/:playerId/exit - Exit game
 * - DELETE /games/:id - Delete game
 * @param {object} options - Configuration options
 * @param {object} options.logger - Optional logger with info/error methods (defaults to console)
 * @param {string} [options.basePath] - Prefix for all routes (e.g. '/api')
 * @returns {Function} Router middleware function
 * @example
 * import { Server } from '@fatlard1993/web-game-framework';
 * import basicGameRoutes from '@fatlard1993/web-game-framework/core/router/basicGameRoutes';
 *
 * const router = server => async request => {
 *   const response = await basicGameRoutes({ logger: myLogger })(request, server);
 *   if (response) return response;
 *   // ... handle other routes
 * };
 */
export default function basicGameRoutes(options = {}) {
	const logger = options.logger || console;
	const basePath = options.basePath || '';

	return async (request, server) => {
		let match;

		// GET /games - List all games
		match = requestMatch('GET', `${basePath}/games`, request);
		if (match) {
			const games = Object.values(server.games).filter(game => game);
			return Response.json(games.map(game => game.toClient()));
		}

		// GET /games/:gameId - Get game details
		match = requestMatch('GET', `${basePath}/games/:gameId`, request);
		if (match) {
			const game = server.games[match.gameId];
			if (!game) {
				return Response.json({ message: 'Game not found' }, { status: 404 });
			}
			return Response.json(game.toClient());
		}

		// POST /games - Create new game
		match = requestMatch('POST', `${basePath}/games`, request);
		if (match) {
			try {
				const body = await request.json();
				const game = new server.Game({ ...body, server });

				logger.info?.('Game created', { gameId: game.id, name: game.name }) ||
					console.log('[info] Game created', { gameId: game.id, name: game.name });

				server.socketBroadcast({ update: 'newGame', game: game.toClient() });

				return Response.json(game.toClient(), { status: 201 });
			} catch (error) {
				logger.error?.('Failed to create game', { error: error.message }) ||
					console.error('[error] Failed to create game', error.message);
				return Response.json({ message: 'Failed to create game', error: error.message }, { status: 500 });
			}
		}

		// POST /games/:gameId/join - Join game
		match = requestMatch('POST', `${basePath}/games/:gameId/join`, request);
		if (match) {
			const game = server.games[match.gameId];
			if (!game) {
				return Response.json({ message: 'Game not found' }, { status: 404 });
			}

			try {
				const body = await request.json();
				const { playerId, name } = body;

				// If player already exists, return existing player
				if (playerId && game.players.has(playerId)) {
					return Response.json(game.players.get(playerId), { status: 200 });
				}

				const newPlayer = game.addPlayer(name);
				logger.info?.('Player joined', { gameId: game.id, playerId: newPlayer.id, name: newPlayer.name }) ||
					console.log('[info] Player joined', { gameId: game.id, playerId: newPlayer.id, name: newPlayer.name });

				return Response.json(newPlayer, { status: 201 });
			} catch (error) {
				logger.error?.('Failed to join game', { gameId: match.gameId, error: error.message }) ||
					console.error('[error] Failed to join game', error.message);
				return Response.json({ message: 'Failed to join game', error: error.message }, { status: 500 });
			}
		}

		// POST /games/:gameId/:playerId/exit - Exit game
		match = requestMatch('POST', `${basePath}/games/:gameId/:playerId/exit`, request);
		if (match) {
			const { gameId, playerId } = match;
			const game = server.games[gameId];

			if (!game) {
				return Response.json({ message: 'Game not found' }, { status: 404 });
			}

			if (!game.players.has(playerId)) {
				return Response.json({ message: 'Player not in game' }, { status: 404 });
			}

			try {
				const removedPlayerId = game.removePlayer(playerId);
				logger.info?.('Player exited game', { gameId, playerId: removedPlayerId }) ||
					console.log('[info] Player exited game', { gameId, playerId: removedPlayerId });
				return Response.json({ id: removedPlayerId }, { status: 200 });
			} catch (error) {
				logger.error?.('Failed to exit game', { gameId, playerId, error: error.message }) ||
					console.error('[error] Failed to exit game', error.message);
				return Response.json({ message: 'Failed to exit game', error: error.message }, { status: 500 });
			}
		}

		// DELETE /games/:gameId - Delete game
		match = requestMatch('DELETE', `${basePath}/games/:gameId`, request);
		if (match) {
			const game = server.games[match.gameId];
			if (!game) {
				return Response.json({ message: 'Game not found' }, { status: 404 });
			}

			if (server.database) {
				server.database.collections.games.delete({ id: match.gameId });
			}

			delete server.games[match.gameId];

			server.socketBroadcast({ update: 'removedGame', gameId: match.gameId });
			logger.info?.('Game deleted', { gameId: match.gameId }) ||
				console.log('[info] Game deleted', { gameId: match.gameId });

			return new Response(null, { status: 204 });
		}

		return null; // No match, let other routes handle it
	};
}
