import { refuse } from '../actions.js';
import basicGameRoutes from './basicGameRoutes.js';

const quietLogger = { info: () => {}, warning: () => {}, error: () => {}, debug: () => {} };

const mockServer = () => ({
	games: {
		abc: { id: 'abc', toClient: () => ({ id: 'abc', name: 'Test Game' }) },
	},
	socketBroadcast: () => {},
});

describe('basicGameRoutes', () => {
	test('matches /games at the root by default', async () => {
		const routes = basicGameRoutes({ logger: quietLogger });

		const response = await routes(new Request('http://localhost/games'), mockServer());

		expect(response).toBeDefined();
		expect(await response.json()).toEqual([{ id: 'abc', name: 'Test Game' }]);
	});

	test('matches under a basePath prefix', async () => {
		const routes = basicGameRoutes({ logger: quietLogger, basePath: '/api' });

		const response = await routes(new Request('http://localhost/api/games/abc'), mockServer());

		expect(response).toBeDefined();
		expect(await response.json()).toEqual({ id: 'abc', name: 'Test Game' });
	});

	test('does not match root paths when a basePath is set', async () => {
		const routes = basicGameRoutes({ logger: quietLogger, basePath: '/api' });

		const response = await routes(new Request('http://localhost/games'), mockServer());

		expect(response).toBeFalsy();
	});

	test('returns 404 for a missing game', async () => {
		const routes = basicGameRoutes({ logger: quietLogger });

		const response = await routes(new Request('http://localhost/games/missing'), mockServer());

		expect(response.status).toBe(404);
	});

	test('returns 400 with an error for a malformed body on create and join', async () => {
		const routes = basicGameRoutes({ logger: quietLogger });
		const malformed = path => new Request(`http://localhost${path}`, { method: 'POST', body: '{not json' });

		for (const path of ['/games', '/games/abc/join']) {
			const response = await routes(malformed(path), mockServer());

			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({ error: 'Malformed JSON body' });
		}
	});

	test("a game is made from its options alone: a save sent along is dropped, a non-object refused, and a game's refusal is a 400", async () => {
		const routes = basicGameRoutes({ logger: quietLogger });
		const made = [];
		const server = {
			...mockServer(),
			createGame: options => {
				made.push(options);
				if (options.packs?.length === 0) refuse('Pick at least one pack');

				return { id: 'new', name: options.name, toClient: () => ({ id: 'new' }) };
			},
		};
		const create = body =>
			routes(new Request('http://localhost/games', { method: 'POST', body: JSON.stringify(body) }), server);

		expect((await create({ name: 'x', saveState: { id: 'evil' }, server: 1, logger: 2 })).status).toBe(201);
		expect(made[0]).toEqual({ name: 'x' });
		expect((await create([1, 2])).status).toBe(400);

		const refused = await create({ name: 'x', packs: [] });

		expect(refused.status).toBe(400);
		expect(await refused.json()).toEqual({ message: 'Pick at least one pack' });
	});
});
