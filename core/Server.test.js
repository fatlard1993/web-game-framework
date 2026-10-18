import os from 'os';
import path from 'path';
import fs from 'fs';

import { hotReload } from '@vanilla-bean/components/app';

import Server from './Server.js';
import Database from './Database.js';
import Game from './Game.js';

const quietLogger = { info: () => {}, warning: () => {}, error: () => {}, debug: () => {} };

const temporaryFilePath = () =>
	path.join(os.tmpdir(), `server-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);

describe('Server database option', () => {
	let server;
	let filePath;

	beforeEach(() => {
		filePath = temporaryFilePath();
	});

	afterEach(() => {
		server?.httpServer?.stop(true);
		server = null;
		fs.rmSync(filePath, { force: true });
	});

	test('accepts a Database instance', () => {
		const database = new Database({ filePath, logger: quietLogger });
		server = new Server({ port: 0, database, logger: quietLogger });

		expect(server.database).toBe(database);
	});

	test('accepts a file path string and constructs a Database from it', () => {
		server = new Server({ port: 0, database: filePath, logger: quietLogger });

		expect(server.database).toBeInstanceOf(Database);
		expect(server.database.options.filePath).toBe(filePath);
	});

	test('throws on a database option that is neither instance nor string', () => {
		expect(() => new Server({ port: 0, database: 42, logger: quietLogger })).toThrow(
			'Database instance or a file path',
		);
		expect(() => new Server({ port: 0, database: { filePath }, logger: quietLogger })).toThrow(
			'Database instance or a file path',
		);
	});

	test('runs without a database', () => {
		server = new Server({ port: 0, logger: quietLogger });

		expect(server.database).toBeUndefined();
	});
});

describe('Server sockets', () => {
	let server;
	let directory;

	beforeAll(async () => {
		directory = fs.mkdtempSync(path.join(os.tmpdir(), 'server-test-'));
		fs.writeFileSync(path.join(directory, 'index.js'), 'globalThis.loaded = true;\n');
		await hotReload.watch({ entrypoints: [path.join(directory, 'index.js')], outdir: path.join(directory, 'build') });
		server = new Server({ port: 0, logger: quietLogger });
	});

	afterAll(() => {
		server.httpServer.stop(true);
		hotReload.stop();
		fs.rmSync(directory, { recursive: true, force: true });
	});

	// The ws client, not the test DOM's WebSocket, which sends the test page's origin: another site, to this server
	const connect = async socketPath => {
		const { WebSocket: NodeSocket } = await import('ws');
		const socket = new NodeSocket(`ws://localhost:${server.port}${socketPath}`);

		await new Promise((resolve, reject) => {
			socket.on('open', resolve);
			socket.on('error', reject);
		});
		await new Promise(resolve => setTimeout(resolve, 50));

		return socket;
	};

	test('a game socket is a client', async () => {
		const socket = await connect('/ws');

		expect(Object.keys(server.clients)).toHaveLength(1);

		socket.close();
		await new Promise(resolve => setTimeout(resolve, 50));
	});

	test("another site's page can't open a game socket, or write; a socket from no browser can", async () => {
		const { WebSocket: NodeSocket } = await import('ws');
		const opens = origin =>
			new Promise(resolve => {
				const socket = new NodeSocket(`ws://localhost:${server.port}/ws`, { headers: origin ? { origin } : {} });

				socket.on('open', () => (socket.close(), resolve(true)));
				socket.on('error', () => resolve(false));
			});

		expect(await opens(`http://localhost:${server.port}`)).toBe(true);
		expect(await opens()).toBe(true);

		// The refusal is a Response the server makes, so Bun's own, not the test DOM's
		const DomResponse = globalThis.Response;

		globalThis.Response = (await Bun.fetch('data:,')).constructor;

		try {
			expect(await opens('https://evil.example')).toBe(false);

			const write = await Bun.fetch(`http://localhost:${server.port}/games`, {
				method: 'POST',
				headers: { origin: 'https://evil.example' },
			});

			expect(write.status).toBe(403);
		} finally {
			globalThis.Response = DomResponse;
		}
		await new Promise(resolve => setTimeout(resolve, 50));
	});

	test('a page reload socket is not a game client', async () => {
		const socket = await connect('/hotReload');

		expect(Object.keys(server.clients)).toHaveLength(0);

		socket.close();
	});
});

// A game whose constructor throws after the base class has registered it, like one whose world fails to generate
class FragileGame extends Game {
	constructor(options) {
		super(options);

		if (options.fail || options.saveState?.fail) throw new Error('world generation failed');
	}

	toSaveState() {
		return { ...super.toSaveState(), fail: this.options.fail };
	}
}

describe('Server games that fail to construct', () => {
	let server;
	let filePath;

	beforeEach(() => {
		filePath = temporaryFilePath();
	});

	afterEach(() => {
		server?.httpServer?.stop(true);
		server = null;
		fs.rmSync(filePath, { force: true });
	});

	const ready = database => new Promise(resolve => database.onReady(resolve));

	test('a failed create leaves nothing registered and saves nothing', async () => {
		const database = new Database({ filePath, logger: quietLogger });
		server = new Server({ port: 0, database, Game: FragileGame, logger: quietLogger });
		await ready(database);

		expect(() => server.createGame({ name: 'broken', fail: true })).toThrow('world generation failed');
		await Promise.resolve();

		expect(Object.keys(server.games)).toEqual([]);
		expect(Object.keys(database.collections.games.read())).toEqual([]);
	});

	test('a successful create is registered and saved', async () => {
		const database = new Database({ filePath, logger: quietLogger });
		server = new Server({ port: 0, database, Game: FragileGame, logger: quietLogger });
		await ready(database);

		const game = server.createGame({ name: 'fine' });
		await Promise.resolve();

		expect(server.games[game.id]).toBe(game);
		expect(Object.keys(database.collections.games.read())).toEqual([game.id]);
	});

	test('a saved game that cannot be restored is skipped with a warning, and the rest still load', async () => {
		fs.writeFileSync(
			filePath,
			JSON.stringify({ games: { good: { id: 'good', name: 'good' }, bad: { id: 'bad', name: 'bad', fail: true } } }),
		);

		const warnings = [];
		const logger = { ...quietLogger, warning: (message, data) => warnings.push({ message, data }) };
		const database = new Database({ filePath, logger: quietLogger });
		server = new Server({ port: 0, database, Game: FragileGame, logger });
		await ready(database);

		expect(Object.keys(server.games)).toEqual(['good']);
		expect(warnings).toEqual([
			{
				message: 'Skipping a saved game that could not be restored',
				data: { gameId: 'bad', error: 'world generation failed' },
			},
		]);
	});
});
