import { screen, waitFor } from '@testing-library/dom';

// The dialog loads the game socket; this one never connects
class QuietSocket extends EventTarget {
	readyState = 0;
	send() {}
	close() {}
}

describe('GameInfoDialog', () => {
	const RealSocket = globalThis.WebSocket;
	let GameInfoDialog;
	let dialog;

	beforeAll(async () => {
		globalThis.WebSocket = QuietSocket;
		({ default: GameInfoDialog } = await import('./GameInfoDialog.js'));
	});

	afterAll(() => {
		globalThis.WebSocket = RealSocket;
	});

	afterEach(() => {
		dialog?.destroy?.();
		dialog = null;
	});

	test('goes to the game by a link, after Close and Delete', async () => {
		dialog = new GameInfoDialog({ game: { id: 'g1', name: 'Test Game', players: [{ name: 'Ana' }] } });
		await waitFor(() => expect(dialog.elem.open).toBe(true));

		expect(screen.getByRole('link', { name: 'Join' })).toHaveAttribute('href', '#/join/g1');
		expect(screen.getAllByRole('button').map(button => button.textContent)).toEqual(['Close', 'Delete']);
	});

	test('heads its players with a section label', async () => {
		dialog = new GameInfoDialog({ game: { id: 'g1', name: 'Test Game', players: [{ name: 'Ana' }] } });
		await waitFor(() => expect(dialog.elem.open).toBe(true));

		expect(screen.getByRole('heading', { name: 'Players' })).toBeInTheDocument();
		expect(screen.getByRole('listitem')).toHaveTextContent('Ana');
	});
});
