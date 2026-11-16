import { screen, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { resetRequest } from '@vanilla-bean/components';

// The lobby's pieces load the game socket; this one never connects
class QuietSocket extends EventTarget {
	readyState = 0;
	send() {}
	close() {}
}

// A game whose screens live elsewhere than the framework's
const paths = { hub: '/lobby', create: '/new', join: '/seat/:gameId', play: '/table/:gameId', watch: '/see/:gameId' };

describe("the lobby, given a game's own paths", () => {
	const RealSocket = globalThis.WebSocket;
	let Hub;
	let Join;
	let Create;
	let GameInfoDialog;
	let made;
	let fetchSpy;

	const answer = handler => (fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(handler));

	beforeAll(async () => {
		globalThis.WebSocket = QuietSocket;
		({ default: Hub } = await import('./Hub.js'));
		({ default: Join } = await import('./Join.js'));
		({ default: Create } = await import('./Create.js'));
		({ default: GameInfoDialog } = await import('./GameInfoDialog.js'));
	});

	afterAll(() => {
		globalThis.WebSocket = RealSocket;
	});

	beforeEach(() => {
		resetRequest();
		window.location.hash = '#/start';
	});

	afterEach(() => {
		fetchSpy?.mockRestore();
		made?.destroy?.();
		made = null;
		localStorage.clear();
	});

	test("the hub's links go by them", async () => {
		answer(async () => Response.json([{ id: 'g1', name: 'Test Game', players: [] }]));
		made = new Hub({ appendTo: container, paths });

		await waitFor(() => expect(screen.getByRole('link', { name: 'Join' })).toHaveAttribute('href', '#/seat/g1'));
		expect(screen.getByRole('link', { name: 'Watch' })).toHaveAttribute('href', '#/see/g1');
		expect(screen.getByRole('link', { name: 'Create a game' })).toHaveAttribute('href', '#/new');
	});

	test("the info dialog's Join goes by them", async () => {
		made = new GameInfoDialog({ game: { id: 'g1', name: 'Test Game', players: [] }, paths });

		await waitFor(() => expect(made.elem.open).toBe(true));
		expect(screen.getByRole('link', { name: 'Join' })).toHaveAttribute('href', '#/seat/g1');
	});

	test('a seat taken goes to their play path, and Back to their hub', async () => {
		answer(async (url, { method } = {}) =>
			method === 'POST'
				? Response.json({ id: 'p1', name: 'Ana' })
				: Response.json({ id: 'g1', name: 'Test Game', players: [] }),
		);
		made = new Join({ gameId: 'g1', appendTo: container, paths, formData: { name: 'Ana' } });
		await screen.findByRole('textbox', { name: 'Player Name' });

		expect(screen.getByRole('link', { name: 'Back to the hub' })).toHaveAttribute('href', '#/lobby');
		await userEvent.click(screen.getByRole('button', { name: 'Join' }));

		await waitFor(() => expect(window.location.hash).toBe('#/table/g1'));
	});

	test("a game that's gone goes where Back does", async () => {
		answer(async () => Response.json({ error: 'Game not found' }, { status: 404 }));
		made = new Join({ gameId: 'g1', appendTo: container, toolbar: { backHref: '#/elsewhere' } });

		await waitFor(() => expect(window.location.hash).toBe('#/elsewhere'));
	});

	test('a game made goes to its join path', async () => {
		answer(async () => Response.json({ id: 'g9' }));
		made = new Create({ appendTo: container, paths, formData: { name: 'Friday' } });

		expect(screen.getByRole('link', { name: 'Back to the hub' })).toHaveAttribute('href', '#/lobby');
		await made.create();

		expect(window.location.hash).toBe('#/seat/g9');
	});
});
