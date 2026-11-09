import { getGame } from './api.js';
import gameContext from './gameContext.js';
import socket, { announce, onMessage } from './socket.js';

/**
 * Opens a game on this page, the way every game's Play view starts: as the player this browser joined as (kept by
 * joinGame), or to watch. The server is told at once (presence), sends this page its view of the game, and sends it
 * again whenever the game publishes; after a lost connection comes back, the page says where it is again and gets
 * the view anew. Messages about other games never reach `onUpdate`.
 * @example
 * const { leave } = await enterGame(gameId, {
 *   onState: view => draw(view),
 *   notMember: () => (window.location.hash = '#/'),
 * });
 * @param {string} gameId - The game
 * @param {object} [options] - Options
 * @param {Function} [options.onState] - (view, message) for each view of the game this page is sent (Game.viewFor)
 * @param {Function} [options.onUpdate] - (message) for the game's other broadcasts (presence, a custom update)
 * @param {Function} [options.notMember] - This browser isn't a player in it (and isn't watching): where to go instead
 * @param {Function} [options.gone] - The game doesn't exist (or was deleted while open)
 * @param {boolean} [options.watch] - Watch it rather than play
 * @param {string} [options.playerId] - Who this browser is in it (default: what joining kept, localStorage[gameId])
 * @returns {Promise<{ game?: object, playerId?: string, leave: Function }>} The game as first fetched, who this page
 * is in it, and leave() to stop following it
 */
const enterGame = async (
	gameId,
	{ onState, onUpdate, notMember, gone, watch = false, playerId = localStorage.getItem(gameId) } = {},
) => {
	const nothing = { leave: () => {} };
	const { body: game, response } = await getGame(gameId, { invalidateAfter: 0 });

	if (response?.status === 404 || !game) {
		gone?.();

		return nothing;
	}
	if (!watch && !game.players?.some(({ id }) => id === playerId)) {
		notMember?.(game);

		return nothing;
	}

	Object.assign(gameContext, { gameId, playerId: watch ? '' : playerId, watch });

	const stopListening = onMessage(message => {
		if (message.gameId !== gameId) return;
		if (message.update === 'state') onState?.(message, message);
		else if (message.update === 'removedGame') gone?.();
		else onUpdate?.(message);
	});
	// Back from a lost connection: say where this page is again, and the view comes with the answer
	const reconnected = () => announce(true);

	socket.addEventListener('open', reconnected);
	announce(true);

	return {
		game,
		playerId: watch ? undefined : playerId,
		leave: () => {
			stopListening();
			socket.removeEventListener('open', reconnected);
			if (gameContext.gameId === gameId) Object.assign(gameContext, { gameId: '', playerId: '', watch: false });
		},
	};
};

export default enterGame;
