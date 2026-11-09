// What the game is: shared by the server, which runs it, and the page, which draws it, so the two can't disagree.
// Catch the stars: every player is their animal in one field; move into a star to catch it, and another appears.

/** The field, in its own units: the page scales it to fit the screen */
export const FIELD = { width: 160, height: 100 };
/** How far a player moves in a second, in field units */
export const SPEED = 45;
/** How often the game moves on, in ms */
export const TICK_MS = 50;
/** How many stars are out at once */
export const STARS = 5;
/** How close a player has to come to catch a star */
export const REACH = 7;
/** How far from the field's edge a player stays, so they're never drawn half off it */
const EDGE = 4;

const somewhere = () => ({ x: 8 + Math.random() * (FIELD.width - 16), y: 8 + Math.random() * (FIELD.height - 16) });

/** A new game's state: where each player is and how many they've caught, and the stars out now */
export const newState = () => ({ spots: {}, scores: {}, stars: Array.from({ length: STARS }, somewhere) });

/** A player arriving: somewhere in the field, nothing caught yet */
export const addPlayer = (state, id) => {
	state.spots[id] ??= somewhere();
	state.scores[id] ??= 0;
};

/**
 * One tick: each player here moves the way they're heading, held inside the field, and catches any star they reach,
 * which comes back somewhere else. Returns who caught what, for sounds and sparkles.
 * @param {object} state - The game's state, changed in place
 * @param {object} headings - { [playerId]: { x, y } }, each axis -1 to 1
 * @param {number} seconds - How long the tick was
 * @returns {{ moved: boolean, caught: Array<{ playerId: string, star: object }> }} What happened
 */
export const step = (state, headings, seconds) => {
	const caught = [];
	let moved = false;

	for (const [id, { x, y }] of Object.entries(headings)) {
		const spot = state.spots[id];

		if (!spot || (!x && !y)) continue;
		spot.x = Math.min(Math.max(spot.x + x * SPEED * seconds, EDGE), FIELD.width - EDGE);
		spot.y = Math.min(Math.max(spot.y + y * SPEED * seconds, EDGE), FIELD.height - EDGE);
		moved = true;

		state.stars.forEach((star, at) => {
			if (Math.hypot(star.x - spot.x, star.y - spot.y) > REACH) return;
			state.scores[id] = (state.scores[id] ?? 0) + 1;
			caught.push({ playerId: id, star });
			state.stars[at] = somewhere();
		});
	}

	return { moved, caught };
};
