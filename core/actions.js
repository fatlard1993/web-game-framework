/** What an action throws to turn a player down: the message is what their page is told */
export class ActionRefused extends Error {}

/**
 * Turns down the action being run, saying why
 * @example
 * actions = { move(player, { to }) { if (!this.board.free(to)) refuse('Something is already there'); ... } };
 * @param {string} message - What the player is told
 */
export const refuse = message => {
	throw new ActionRefused(message);
};

const plain = value => {
	const prototype = Object.getPrototypeOf(value);

	return prototype === Object.prototype || prototype === null;
};

/**
 * Where a save would come back different from how it went, or null: a Map or Set (saved as {}), a function or
 * undefined in an array (dropped or null), a class instance (saved without its class), NaN or Infinity (null)
 * @param {*} value - What would be saved
 * @param {string} [path] - Where it is, for the answer
 * @returns {string|null} The first place, like "state.ships.abc (a Map)"
 */
export const unsaveable = (value, path = 'save') => {
	if (value === null || typeof value === 'string' || typeof value === 'boolean') return null;
	if (typeof value === 'number') return Number.isFinite(value) ? null : `${path} (${value})`;
	if (typeof value === 'function') return `${path} (a function)`;
	if (typeof value !== 'object') return null;
	if (value instanceof Map) return `${path} (a Map)`;
	if (value instanceof Set) return `${path} (a Set)`;
	if (Array.isArray(value)) {
		for (let at = 0; at < value.length; at++) {
			const found = value[at] === undefined ? `${path}[${at}] (undefined)` : unsaveable(value[at], `${path}[${at}]`);

			if (found) return found;
		}

		return null;
	}
	if (!plain(value)) return `${path} (a ${value.constructor?.name ?? 'class'} instance)`;

	for (const [key, inner] of Object.entries(value)) {
		const found = unsaveable(inner, `${path}.${key}`);

		if (found) return found;
	}

	return null;
};
