import { GameList } from './GameList.js';

describe('GameList', () => {
	test('is an unbulleted List', () => {
		const list = new GameList({ appendTo: container, items: ['A game'] });

		expect(list.elem).toHaveClass('no-style');
		list.destroy();
	});
});
