import { screen, waitFor, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

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
	let made;
	let fetchSpy;

	const refuse = (status, body) =>
		(fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json(body, { status })));

	beforeAll(async () => {
		globalThis.WebSocket = QuietSocket;
		({ default: Create } = await import('./Create.js'));
		({ default: GameInfoDialog } = await import('./GameInfoDialog.js'));
		({ default: GameInfoPopover } = await import('./GameInfoPopover.js'));
	});

	afterAll(() => {
		globalThis.WebSocket = RealSocket;
	});

	beforeEach(() => {
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
});
