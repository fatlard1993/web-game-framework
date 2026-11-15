import { screen, waitFor, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { resetRequest } from '@vanilla-bean/components';

// The lobby's pieces load the game socket; this one never connects
class QuietSocket extends EventTarget {
	readyState = 0;
	send() {}
	close() {}
}

describe('a refused request in the lobby', () => {
	const RealSocket = globalThis.WebSocket;
	let Create;
	let GameInfoDialog;
	let GameInfoPopover;
	let Join;
	let made;
	let fetchSpy;

	const refuse = (status, body) =>
		(fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json(body, { status })));

	beforeAll(async () => {
		globalThis.WebSocket = QuietSocket;
		({ default: Create } = await import('./Create.js'));
		({ default: GameInfoDialog } = await import('./GameInfoDialog.js'));
		({ default: GameInfoPopover } = await import('./GameInfoPopover.js'));
		({ default: Join } = await import('./Join.js'));
	});

	afterAll(() => {
		globalThis.WebSocket = RealSocket;
	});

	beforeEach(() => {
		// Each test answers its own way, not from the last one's cache
		resetRequest();
		window.location.hash = '#/start';
	});

	afterEach(() => {
		fetchSpy?.mockRestore();
		made?.destroy?.();
		made = null;
	});

	test("a refused create says why, and doesn't go anywhere", async () => {
		refuse(400, { error: 'That name is taken' });
		made = new Create({ appendTo: container });

		await made.create();

		expect(screen.getByText("Couldn't create the game: That name is taken")).toBeInTheDocument();
		expect(window.location.hash).toBe('#/start');
	});

	test('a refused delete says why, and the dialog stays', async () => {
		refuse(404, { error: 'Game not found' });
		made = new GameInfoDialog({ game: { id: 'g1', name: 'Test Game', players: [] } });
		await waitFor(() => expect(made.elem.open).toBe(true));

		await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
		const confirm = await screen.findByRole('dialog', { name: 'Delete Test Game?' });
		await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));

		await screen.findByText("Couldn't delete Test Game: Game not found");
		expect(made.elem.open).toBe(true);
	});

	test("a game that can't be loaded says why, and the popover goes", async () => {
		refuse(404, { error: 'Game not found' });
		made = new GameInfoPopover({ gameId: 'g1' });

		await screen.findByText("Couldn't load the game: Game not found");
		expect(made.elem.isConnected).toBe(false);
	});

	test("a game that can't be looked up to join says why, and goes to the hub", async () => {
		refuse(404, { error: 'Game not found' });
		made = new Join({ gameId: 'g1', appendTo: container });

		await screen.findByText("Couldn't load the game: Game not found");
		expect(window.location.hash).toBe('#/hub');
	});

	test("a refused join says why, and doesn't go anywhere", async () => {
		fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async (url, { method } = {}) =>
			method === 'POST'
				? Response.json({ error: 'That name is taken' }, { status: 400 })
				: Response.json({ id: 'g1', name: 'Test Game', players: [] }),
		);
		made = new Join({ gameId: 'g1', appendTo: container });
		await screen.findByRole('textbox', { name: 'Player Name' });

		await userEvent.click(screen.getByRole('button', { name: 'Join' }));

		await screen.findByText("Couldn't join the game: That name is taken");
		expect(window.location.hash).toBe('#/start');
	});
});
