import { expect, test } from 'bun:test';

import Game from './Game.js';
import Server from './Server.js';
import { refuse, unsaveable } from './actions.js';

const quiet = { info() {}, debug() {}, warning() {}, error() {} };

class Counter extends Game {
	static version = 3;
	static transient = ['flying'];
	static migrations = {
		2: save => (save.state = { count: save.taps ?? 0 }),
		3: save => (save.state.best = save.state.count),
	};

	constructor(options) {
		super(options);
		this.state = options.saveState?.state ?? { count: 0, best: 0, flying: [] };
	}

	actions = {
		add(player, { by }) {
			if (!Number.isInteger(by)) refuse('Add a whole number');
			this.state.count += by;
			this.state.lastBy = player.name;
		},
		broken() {
			throw new Error('a bug');
		},
		make() {
			return 'made-1';
		},
	};

	createPlayer() {
		return { color: 'teal' };
	}

	viewFor(playerId) {
		return { count: this.state.count, me: playerId };
	}

	toSaveState() {
		return { ...super.toSaveState(), state: this.savedState() };
	}
}

const pages = () => {
	const sent = [];
	const page = (presence, name) => ({ data: { presence }, send: data => sent.push({ to: name, ...JSON.parse(data) }) });

	return { sent, page };
};

test('an action runs as the player, publishes, and a refusal or a bug is answered without throwing', () => {
	const published = [];
	const game = new Counter({
		server: { games: {}, publish: g => published.push(g.id), socketBroadcast() {} },
		logger: quiet,
	});
	const ben = game.addPlayer('Ben');

	expect(ben.color).toBe('teal');
	expect(game.act(ben.id, 'add', { by: 2 })).toEqual({ ok: true });
	expect(game.act(ben.id, 'make')).toEqual({ ok: true, result: 'made-1' });
	expect(game.state).toMatchObject({ count: 2, lastBy: 'Ben' });
	expect(game.act(ben.id, 'add', { by: 'lots' })).toEqual({ ok: false, error: 'Add a whole number' });
	expect(game.act(ben.id, 'broken')).toEqual({ ok: false, error: 'Something went wrong' });
	expect(game.act(ben.id, 'toString')).toMatchObject({ ok: false });
	expect(game.act('nobody', 'add', { by: 1 })).toEqual({ ok: false, error: 'Not a player in this game' });
	expect(published).toHaveLength(2);
});

test("the server runs an action as the page's player, whatever the message claims, and tells that page alone", () => {
	const { sent, page } = pages();
	const server = { games: {}, clients: {}, socketBroadcast() {} };

	server.publish = game => Server.prototype.publish.call(server, game);
	server._sendView = Server.prototype._sendView;

	const game = new Counter({ server, logger: quiet });
	const ben = game.addPlayer('Ben');
	const ada = game.addPlayer('Ada');

	server.clients = {
		ben: page({ gameId: game.id, playerId: ben.id }, 'ben'),
		ada: page({ gameId: game.id, playerId: ada.id }, 'ada'),
		elsewhere: page({ gameId: 'other', playerId: 'x' }, 'elsewhere'),
		watcher: page({ gameId: game.id, playerId: null }, 'watcher'),
	};
	Server.prototype._onAction.call(server, server.clients.ben, {
		action: 'add',
		data: { by: 1, playerId: ada.id },
		ack: 7,
	});

	expect(game.state.lastBy).toBe('Ben');
	expect(sent.filter(m => m.update === 'acted')).toEqual([
		{ to: 'ben', update: 'acted', gameId: game.id, ack: 7, ok: true },
	]);
	expect(sent.filter(m => m.update === 'state').map(m => [m.to, m.me])).toEqual([
		['ben', ben.id],
		['ada', ada.id],
		['watcher', null],
	]);
});

test("a page speaks for a player only with that player's secret, and a player from before secrets needs none", () => {
	const { sent, page } = pages();
	const game = new Counter({ server: { games: {}, socketBroadcast() {} }, logger: quiet });
	const server = { games: { [game.id]: game }, _sendView() {} };
	const ben = game.addPlayer('Ben');
	const imposter = page(undefined, 'imposter');

	Server.prototype._onPage.call(server, imposter, { gameId: game.id, playerId: ben.id, secret: 'guess' });
	expect(imposter.data.presence).toBeUndefined();
	expect(sent.at(-1)).toMatchObject({ update: 'refused' });

	game.players.set('old', { id: 'old', name: 'From before' });
	expect(game.isPlayersSecret('old', undefined)).toBe(true);
	expect(game.isPlayersSecret(ben.id, game.secrets.get(ben.id))).toBe(true);
	expect(game.toClient().players.every(player => !('secret' in player))).toBe(true);
});

test('a save from an older version is migrated before the game reads it, and transient state is never saved', () => {
	const old = { id: 'g', name: 'Old', players: [], taps: 5 };
	const game = new Counter({ saveState: old, server: { games: {}, socketBroadcast() {} }, logger: quiet });

	expect(game.state).toEqual({ count: 5, best: 5 });
	game.state.flying = [1, 2];
	expect(game.toSaveState()).toMatchObject({ version: 3, state: { count: 5, best: 5 } });
	expect(game.toSaveState().state.flying).toBeUndefined();
});

test('says where a save would not come back as it went', () => {
	expect(unsaveable({ state: { ok: [1, 'a', null] } })).toBeNull();
	expect(unsaveable({ state: { ships: new Map() } })).toBe('save.state.ships (a Map)');
	expect(unsaveable({ list: [1, undefined] })).toBe('save.list[1] (undefined)');
	expect(unsaveable({ at: new Date() })).toBe('save.at (a Date instance)');
	expect(unsaveable({ speed: Infinity })).toBe('save.speed (Infinity)');
});
