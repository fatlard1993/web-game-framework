/**
 * Extended Map for managing players with convenience methods
 * @example
 * ```js
 * const players = new Players();
 * players.set('abc', { id: 'abc', name: 'Alice' });
 * players.update('abc', current => ({ ...current, score: 10 }));
 * ```
 */
export default class Players extends Map {
	constructor() {
		super();
	}

	/**
	 * Update a player using an updater function
	 * @param {string} playerId - Player ID
	 * @param {Function} updater - Function that receives current player and returns updated player
	 * @example
	 * players.update('abc', current => ({ ...current, score: current.score + 1 }))
	 */
	update(playerId, updater = current => current) {
		const current = this.get(playerId);
		if (current) {
			this.set(playerId, updater(current));
		}
	}
}
