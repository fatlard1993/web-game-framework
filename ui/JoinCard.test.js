import { screen } from '@testing-library/dom';

import JoinCard from './JoinCard.js';

describe('JoinCard', () => {
	test('shows the address to join by under its code', async () => {
		const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({}));
		const card = new JoinCard({ gameId: 'abc', appendTo: container });

		expect(await screen.findByText(/\/#\/join\/abc$/)).toHaveClass('address');

		card.destroy();
		fetchSpy.mockRestore();
	});
});
