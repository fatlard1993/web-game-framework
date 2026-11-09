import { expect, test } from 'bun:test';

import Game from './Game.js';
import Server from './Server.js';

const quietGame = () => {
	const sent = [];
	const game = new Game({
		server: { games: {}, socketBroadcast: data => sent.push(data) },
		logger: { info() {}, error() {} },
	});

	return { game, sent };
};

test('a player who joins is here; one whose page closes is still a player, but not here', () => {
	const { game, sent } = quietGame();
	const seen = [];

	game.onPresence = (id, online) => seen.push([id, online]);

	const { id } = game.addPlayer('Ben');

	expect(game.toClient().players).toEqual([{ id, name: 'Ben', online: true }]);
	game.setOnline(id, false);
	expect(game.toClient().players).toEqual([{ id, name: 'Ben', online: false }]);
	expect(game.players.has(id)).toBe(true);
	expect(seen).toEqual([[id, false]]);
	expect(sent.at(-1)).toMatchObject({ update: 'presence', id, online: false });

	game.setOnline(id, false);
	expect(seen).toHaveLength(1);
	game.setOnline('nobody', true);
	expect(game.online.has('nobody')).toBe(false);
});

test("a page's announcement makes its player here, and its last page closing makes them gone after a moment", async () => {
	const { game } = quietGame();
	const { id } = game.addPlayer('Ada');
	const server = { games: { [game.id]: game }, clients: {}, _sendView() {} };
	const page = { data: {}, send() {} };

	game.setOnline(id, false);
	Server.prototype._onPage.call(server, page, { gameId: game.id, playerId: id, secret: game.secrets.get(id) });
	expect(game.online.has(id)).toBe(true);

	const wait = Server.LEFT_AFTER_MS;

	Server.LEFT_AFTER_MS = 10;
	try {
		// Another page still open on the same player: still here
		server.clients.other = { data: { presence: { gameId: game.id, playerId: id } } };
		Server.prototype._leftPage.call(server, page.data.presence);
		await Bun.sleep(30);
		expect(game.online.has(id)).toBe(true);

		delete server.clients.other;
		Server.prototype._leftPage.call(server, page.data.presence);
		await Bun.sleep(30);
		expect(game.online.has(id)).toBe(false);
	} finally {
		Server.LEFT_AFTER_MS = wait;
	}
});
