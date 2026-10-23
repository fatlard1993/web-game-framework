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
});
