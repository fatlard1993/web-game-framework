import { screen, waitFor } from '@testing-library/dom';
import { resetRequest } from '@vanilla-bean/components';

// The lobby's pieces load the game socket; this one never connects
class QuietSocket extends EventTarget {
	readyState = 0;
	send() {}
	close() {}
}

// EmptyState's spinner has no role to find it by
// eslint-disable-next-line testing-library/no-node-access
const spinner = () => container.querySelector('.loading');

describe('Join', () => {
	const RealSocket = globalThis.WebSocket;
	let Join;
	let join;
	let fetchSpy;

	beforeAll(async () => {
		globalThis.WebSocket = QuietSocket;
		({ default: Join } = await import('./Join.js'));
	});

	afterAll(() => {
		globalThis.WebSocket = RealSocket;
	});

	beforeEach(() => {
		resetRequest();
	});

	afterEach(() => {
		fetchSpy.mockRestore();
		join?.destroy?.();
		join = null;
	});

	test('says it is loading until the game arrives', async () => {
		let answer;
		fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(resolve => (answer = resolve)));
		join = new Join({ gameId: 'g1', appendTo: container });

		await waitFor(() => expect(spinner()).toBeInTheDocument());
		answer(Response.json({ id: 'g1', name: 'Test Game', players: [] }));
		await screen.findByRole('textbox', { name: 'Player Name' });
		expect(spinner()).toBeNull();
	});
});
