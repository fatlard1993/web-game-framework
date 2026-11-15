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

	describe('Show info', () => {
		const games = [
			{ id: 'g1', name: 'First Game', players: [] },
			{ id: 'g2', name: 'Second Game', players: [] },
		];

		beforeEach(() => {
			fetchSpy.mockImplementation(async url => {
				const id = String(url).match(/\/games\/(\w+)/)?.[1];

				return Response.json(id ? games.find(game => game.id === id) : games);
			});
		});

		// The popover is on the body, out of the hub, with no role to find it by: it's the row's parent. The test DOM shows
		// and hides a popover by its display
		// eslint-disable-next-line testing-library/no-node-access
		const infoOf = async name => (await screen.findByText(`Game: ${name}`)).parentElement;
		const isShown = popover => popover.style.display === 'block';

		test("hangs the game's info under its button, which closes it again", async () => {
			hub = new Hub({ appendTo: container });

			const [button] = await screen.findAllByRole('button', { name: 'Show info' });
			await userEvent.click(button);

			const info = await infoOf('First Game');

			expect(isShown(info)).toBe(true);
			expect(button).toHaveAttribute('aria-haspopup', 'dialog');
			expect(button).toHaveAttribute('aria-expanded', 'true');

			await userEvent.click(button);

			expect(isShown(info)).toBe(false);
			expect(button).toHaveAttribute('aria-expanded', 'false');
		});

		test("another game's button closes the open one and shows its own game", async () => {
			hub = new Hub({ appendTo: container });

			const [first, second] = await screen.findAllByRole('button', { name: 'Show info' });
			await userEvent.click(first);
			const firstInfo = await infoOf('First Game');

			await userEvent.click(second);
			const secondInfo = await infoOf('Second Game');

			await waitFor(() => expect(isShown(firstInfo)).toBe(false));
			expect(isShown(secondInfo)).toBe(true);
			expect(first).toHaveAttribute('aria-expanded', 'false');
			expect(second).toHaveAttribute('aria-expanded', 'true');
		});

		test("opens once its game is in, so it's placed at its size", async () => {
			let answer;
			const listed = fetchSpy.getMockImplementation();
			fetchSpy.mockImplementation(url =>
				String(url).includes('/games/') ? new Promise(resolve => (answer = resolve)) : listed(url),
			);
			hub = new Hub({ appendTo: container });

			const [button] = await screen.findAllByRole('button', { name: 'Show info' });
			await userEvent.click(button);

			expect(button).not.toHaveAttribute('aria-expanded');

			answer(Response.json(games[0]));

			await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'true'));
			expect(isShown(await infoOf('First Game'))).toBe(true);
		});

		test('a press elsewhere closes it', async () => {
			hub = new Hub({ appendTo: container });

			await userEvent.click((await screen.findAllByRole('button', { name: 'Show info' }))[0]);
			const info = await infoOf('First Game');

			// The press that opened it is let through first, a frame on
			await new Promise(resolve => requestAnimationFrame(resolve));
			await userEvent.click(document.body);

			await waitFor(() => expect(isShown(info)).toBe(false));
		});

		test('leaves with the hub', async () => {
			hub = new Hub({ appendTo: container });

			await userEvent.click((await screen.findAllByRole('button', { name: 'Show info' }))[0]);
			const info = await infoOf('First Game');

			hub.destroy();
			hub = null;

			expect(info.isConnected).toBe(false);
		});
	});

	test('a copied link says so beside what was pressed, not at a point of its own', async () => {
		hub = new Hub({ appendTo: container });

		await userEvent.click(await screen.findByRole('button', { name: 'Copy link' }));

		const copied = await screen.findByText('Copied link to clipboard!');

		// Beside the button, or the corner stack when there's no room beside it: placed at a point, it is neither
		expect(copied.matches('.anchored, .stacked')).toBe(true);
	});
});
