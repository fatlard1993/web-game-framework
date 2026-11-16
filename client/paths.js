/**
 * Every screen's path: the lobby's (hub, create, join) and the game's own (start, play, watch). The router's views are
 * keyed by these, and every way to a screen is built from them, so a path changed here changes everywhere. A game whose
 * paths differ hands the lobby's views the ones that differ, as their `paths` option.
 */
export const paths = Object.freeze({
	start: '/',
	hub: '/hub',
	create: '/create',
	join: '/join/:gameId',
	play: '/play/:gameId',
	watch: '/watch/:gameId',
});

/**
 * A screen's address, its params filled in, as a link's href
 * @param {string} path - One of paths, or a game's own
 * @param {object} [params] - The path's params, by name
 * @returns {string} The address: `#/join/abc`
 * @example href(paths.play, { gameId })
 */
export const href = (path, params = {}) =>
	`#${path.replace(/:(\w+)/g, (match, key) => encodeURIComponent(params[key]))}`;

/**
 * The paths a lobby view goes by: the framework's, with a game's own over them
 * @param {object} [own] - The paths that differ, by name
 * @returns {object} Every path, by name
 */
export const pathsWith = own => ({ ...paths, ...own });
