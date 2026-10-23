import { screen, waitFor } from '@testing-library/dom';

// The lobby listens on the game socket; this one never connects
class QuietSocket extends EventTarget {
	readyState = 0;
	send() {}
	close() {}
}

describe('Hub', () => {
	const RealSocket = globalThis.WebSocket;
	let Hub;
	let hub;
	let fetchSpy;

	beforeAll(async () => {
		globalThis.WebSocket = QuietSocket;
		({ default: Hub } = await import('./Hub.js'));
	});

	afterAll(() => {
		globalThis.WebSocket = RealSocket;
	});

	beforeEach(() => {
		fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async () =>
			Response.json([{ id: 'g1', name: 'Test Game', players: [] }]),
		);
	});

	afterEach(() => {
		fetchSpy.mockRestore();
		hub?.destroy?.();
		hub = null;
	});

	test("lists each game's Watch link by default", async () => {
		hub = new Hub({ appendTo: container });

		await waitFor(() => expect(screen.getByRole('link', { name: 'Watch' })).toHaveAttribute('href', '#/watch/g1'));
	});

	test('watch: false leaves out the Watch link', async () => {
		hub = new Hub({ appendTo: container, watch: false });

		await screen.findByRole('link', { name: 'Join' });
		expect(screen.getAllByRole('link').map(link => link.textContent)).toEqual(['New Game', 'Join']);
	});
});
