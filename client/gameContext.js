import { Oxject as Context } from '@vanilla-bean/components';
import Players from '../core/Players.js';

/**
 * Reactive game context for client-side state
 *
 * Extends Players Map with helper to get current player
 * @example
 * ```js
 * import gameContext from '@fatlard1993/web-game-framework/client/gameContext';
 *
 * gameContext.gameId = 'abc123';
 * gameContext.playerId = 'player1';
 *
 * // Access current player
 * const me = gameContext.players.currentPlayer;
 * ```
 */
class GamePlayers extends Players {
	constructor(context) {
		super();
		this.context = context;
	}

	/**
	 * Get the current player (based on context.playerId)
	 * @returns {object|undefined} Current player object
	 */
	get currentPlayer() {
		return this.get(this.context.playerId);
	}
}

/**
 * Global game context (reactive)
 * @type {{
 *   players: GamePlayers,
 *   gameId: string,
 *   playerId: string
 * }}
 */
const gameContext = new Context({
	gameId: '',
	playerId: '',
});

// Initialize players after context is created
gameContext.players = new GamePlayers(gameContext);

export default gameContext;
