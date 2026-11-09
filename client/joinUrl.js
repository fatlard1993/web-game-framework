// The address a phone on the same network opens to join a game: this page's own, unless the page was opened as this
// machine itself (localhost), which a phone can't reach; then the server's network address (GET /join-url)
const LOCAL = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/;

/**
 * @param {string} gameId - The game to join
 * @returns {Promise<string>} Like http://192.168.1.20:3000/#/join/abc
 */
export const joinUrl = async gameId => {
	let base = window.location.origin;

	if (LOCAL.test(window.location.hostname)) {
		const found = await fetch('/join-url')
			.then(response => response.json())
			.catch(() => null);

		if (found?.url) base = found.url;
	}

	return `${base}/#/join/${gameId}`;
};
