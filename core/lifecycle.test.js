import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterAll, expect, test } from 'bun:test';

import Game from './Game.js';
import Server from './Server.js';

const dirs = [];
const quiet = { info() {}, debug() {}, warning() {}, error() {} };

afterAll(async () => {
	for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

const recordingServer = () => {
	const written = [];
	const server = {
		games: {},
		socketBroadcast() {},
		database: { collections: { games: { set: record => written.push(record), create() {}, delete() {} } } },
	};

	return { server, written };
};

test('a busy game is saved within SAVE_WITHIN_MS of its first change, not only once it goes quiet', async () => {
	const { server, written } = recordingServer();
	const game = new Game({ server, logger: quiet });
	const within = Game.SAVE_WITHIN_MS;

	Game.SAVE_WITHIN_MS = 40;
	try {
		await Bun.sleep(5);
		written.length = 0;
		// A change every 10ms, for 100ms: a debounce would never fire
		for (let at = 0; at < 10; at++) {
			game.save();
			await Bun.sleep(10);
		}
		expect(written.length).toBeGreaterThanOrEqual(1);
	} finally {
		Game.SAVE_WITHIN_MS = within;
		game.dispose();
	}
});

test("a game's loops stop when it's disposed, and a save still pending is dropped rather than writing it back", async () => {
	const { server, written } = recordingServer();
	const game = new Game({ server, logger: quiet });
	let ticks = 0;
	let disposed = false;

	game.onDispose = () => (disposed = true);
	game.every(5, () => ticks++);
	await Bun.sleep(30);
	written.length = 0;
	game.save();
	game.dispose();

	const ticked = ticks;

	await Bun.sleep(Game.SAVE_WITHIN_MS + 50);
	expect(ticked).toBeGreaterThan(0);
	expect(ticks).toBe(ticked);
	expect(written).toHaveLength(0);
	expect(disposed).toBe(true);
}, 5000);

test("a loop's error is logged and the loop carries on", async () => {
	const { server } = recordingServer();
	const errors = [];
	const game = new Game({ server, logger: { ...quiet, error: (...args) => errors.push(args) } });
	let ticks = 0;

	game.every(5, () => {
		ticks++;
		throw new Error('boom');
	});
	await Bun.sleep(30);
	game.dispose();
	expect(ticks).toBeGreaterThan(1);
	expect(errors.length).toBe(ticks);
});

test('requests about games wait for the saved games to load, and a removed game is gone from the database', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'wgf-life-'));

	dirs.push(dir);
	await Bun.write(join(dir, 'games.json'), JSON.stringify({ games: { g1: { id: 'g1', name: 'Saved', players: [] } } }));

	// Responses the server makes are Bun's own, not the test DOM's
	const DomResponse = globalThis.Response;

	globalThis.Response = (await Bun.fetch('data:,')).constructor;

	const nodeEnv = process.env.NODE_ENV;

	process.env.NODE_ENV = 'production';

	const server = new Server({
		exit: false,
		port: 0,
		Game,
		database: join(dir, 'games.json'),
		logger: quiet,
		router: running => request =>
			new URL(request.url).pathname === '/count' ? Response.json(Object.keys(running.games).length) : undefined,
	});

	await server.ready;
	expect(await (await Bun.fetch(`http://127.0.0.1:${server.port}/count`)).json()).toBe(1);

	expect(server.removeGame('g1')).toBe(true);
	expect(server.games.g1).toBeUndefined();
	await server.flush();
	expect(JSON.parse(await Bun.file(join(dir, 'games.json')).text()).games.g1).toBeUndefined();
	expect(server.removeGame('g1')).toBe(false);
	server.httpServer.stop(true);
	globalThis.Response = DomResponse;
	process.env.NODE_ENV = nodeEnv;
});
