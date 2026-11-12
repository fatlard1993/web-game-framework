import { screen } from '@testing-library/dom';

// enterGame loads the game socket; this one never connects
class QuietSocket extends EventTarget {
	readyState = 0;
	send() {}
	close() {}
}

describe("a game that can't be entered", () => {
	const RealSocket = globalThis.WebSocket;
	let enterGame;
	let fetchSpy;

	beforeAll(async () => {
		globalThis.WebSocket = QuietSocket;
		({ default: enterGame } = await import('./enterGame.js'));
	});

	afterAll(() => {
		globalThis.WebSocket = RealSocket;
	});

	afterEach(() => {
		fetchSpy?.mockRestore();
	});

	test('is gone when the server says it is not found', async () => {
		fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async () =>
			Response.json({ message: 'Game not found' }, { status: 404 }),
		);
		const gone = jest.fn();
		const failed = jest.fn();

		await enterGame('g404', { gone, failed });

		expect(gone).toHaveBeenCalled();
		expect(failed).not.toHaveBeenCalled();
	});

	test("isn't gone when the server can't be reached, and says why", async () => {
		fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async () => {
			throw new TypeError('Failed to fetch');
		});
		const gone = jest.fn();
		const failed = jest.fn();

		await enterGame('g-offline', { gone, failed });

		expect(gone).not.toHaveBeenCalled();
		expect(failed).toHaveBeenCalledWith('Failed to fetch', expect.anything());
	});

	test("a failing server isn't a gone game, and without a failed handler a danger toast says why", async () => {
		fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async () =>
			Response.json({ error: 'The database is locked' }, { status: 500 }),
		);
		const gone = jest.fn();

		await enterGame('g500', { gone });

		expect(gone).not.toHaveBeenCalled();
		expect(await screen.findByText("Couldn't load the game: The database is locked")).toBeInTheDocument();
	});
});
