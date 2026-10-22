import { screen, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

import ExitDialog from './ExitDialog.js';

describe('ExitDialog', () => {
	let dialog;
	let fetchSpy;

	const respond = (status, body) =>
		(fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
		));

	// A dialog opens a moment after it's made
	const open = async options => {
		dialog = new ExitDialog({ gameId: 'g1', playerId: 'p1', ...options });

		await waitFor(() => expect(dialog.elem.open).toBe(true));
	};

	beforeEach(() => {
		window.location.hash = '#/play/g1';
	});

	afterEach(() => {
		fetchSpy?.mockRestore();
		dialog?.destroy?.();
		dialog = null;
	});

	test('asks with the removal ticked, the confirming button second', async () => {
		await open();

		expect(screen.getByRole('checkbox', { name: 'Remove me from the game' })).toBeChecked();
		expect(screen.getAllByRole('button').map(button => button.textContent)).toEqual(['Cancel', 'Exit']);
	});

	test('exit removes the player, runs onExit, and goes to the hub', async () => {
		respond(200, { success: true });
		const onExit = mock();
		await open({ onExit });

		await userEvent.click(screen.getByRole('button', { name: 'Exit' }));

		await waitFor(() => expect(window.location.hash).toBe('#/hub'));
		expect(fetchSpy.mock.calls[0][0]).toEndWith('/games/g1/p1/exit');
		expect(fetchSpy.mock.calls[0][1].method).toBe('POST');
		expect(onExit).toHaveBeenCalledTimes(1);
	});

	test('unticked, exit leaves without removing the player', async () => {
		respond(200, {});
		await open({ confirmLabel: 'Abort' });

		await userEvent.click(screen.getByRole('checkbox'));
		await userEvent.click(screen.getByRole('button', { name: 'Abort' }));

		await waitFor(() => expect(window.location.hash).toBe('#/hub'));
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	test("a failed removal says the server's reason, and the player still leaves", async () => {
		respond(500, { error: 'Game not found' });
		await open();

		await userEvent.click(screen.getByRole('button', { name: 'Exit' }));

		await waitFor(() => expect(window.location.hash).toBe('#/hub'));
		expect(screen.getByRole('alert', { hidden: true })).toHaveTextContent('Game not found');
	});

	test('cancel stays', async () => {
		respond(200, {});
		await open();

		await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

		expect(window.location.hash).toBe('#/play/g1');
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
