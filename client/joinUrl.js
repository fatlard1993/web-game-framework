import { href, paths } from './paths.js';

// The address a phone on the same network opens to join a game: this page's own, unless the page was opened as this
// machine itself (localhost), which a phone can't reach; then the server's network address (GET /join-url)
const LOCAL = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/;

/**
 * @param {string} gameId - The game to join
 * @param {string} [path] - The join screen's path, for a game whose differs from paths.join
 * @returns {Promise<string>} Like http://192.168.1.20:3000/#/join/abc
 */
export const joinUrl = async (gameId, path = paths.join) => {
	let base = window.location.origin;

	if (LOCAL.test(window.location.hostname)) {
		const found = await fetch('/join-url')
			.then(response => response.json())
			.catch(() => null);

		if (found?.url) base = found.url;
	}

	return `${base}/${href(path, { gameId })}`;
};
