import { screen, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { resetRequest } from '@vanilla-bean/components';

// The lobby listens on the game socket; this one never connects
class QuietSocket extends EventTarget {
	readyState = 0;
	send() {}
	close() {}
}

// EmptyState's spinner has no role to find it by
// eslint-disable-next-line testing-library/no-node-access
const spinner = () => container.querySelector('.loading');

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
		// Each test answers the list its own way, not from the last one's cache
		resetRequest();
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
		expect(screen.getAllByRole('link').map(link => link.textContent)).toEqual(['Create a game', 'Join']);
	});

	test('lists the games in a reading column', async () => {
		hub = new Hub({ appendTo: container });

		await screen.findByRole('link', { name: 'Join' });
		expect(hub._body.elem).toHaveClass('column');
	});

	test('says it is loading until the games arrive', async () => {
		let answer;
		fetchSpy.mockImplementation(() => new Promise(resolve => (answer = resolve)));
		hub = new Hub({ appendTo: container });

		await waitFor(() => expect(spinner()).toBeInTheDocument());
		answer(Response.json([{ id: 'g1', name: 'Test Game', players: [] }]));
		await screen.findByRole('link', { name: 'Join' });
		expect(spinner()).toBeNull();
	});

	test("a list that can't be loaded says why, and tries again", async () => {
		fetchSpy.mockImplementation(async () => Response.json({ error: 'Server is down' }, { status: 500 }));
		hub = new Hub({ appendTo: container });

		await screen.findByText("Couldn't load the games");
		expect(screen.getByText('Server is down')).toBeInTheDocument();

		fetchSpy.mockImplementation(async () => Response.json([{ id: 'g1', name: 'Test Game', players: [] }]));
		await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

		await screen.findByRole('link', { name: 'Join' });
	});

	test('no games says so, and how to make one', async () => {
		fetchSpy.mockImplementation(async () => Response.json([]));
		hub = new Hub({ appendTo: container });

		await screen.findByText('No games yet');
		expect(screen.getByText('No games found. Create one to get started!')).toBeInTheDocument();
	});

	test("a row's one filled control is Join; its links are nav, without a link tooltip", async () => {
		hub = new Hub({ appendTo: container });

		const join = await screen.findByRole('link', { name: 'Join' });

		expect(join).not.toHaveClass('variant-flat');
		expect(screen.getByRole('link', { name: 'Watch' })).toHaveClass('variant-flat');
		for (const button of screen.getAllByRole('button')) expect(button).toHaveClass('variant-flat');
		for (const link of screen.getAllByRole('link')) expect(link).not.toHaveClass('has-tooltip');
	});
});
