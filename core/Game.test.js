import Game from './Game.js';

const quietLogger = { info: () => {}, warning: () => {}, error: () => {}, debug: () => {} };

const mockServer = () => {
	const created = [];

	return {
		created,
		games: {},
		database: {
			collections: {
				games: {
					create: data => created.push(data),
					set: () => {},
				},
			},
		},
	};
};

class CustomGame extends Game {
	constructor(options) {
		super(options);
		this.customState = 'initialized';
	}

	_generateId() {
		return 'custom-id';
	}

	toSaveState() {
		return { ...super.toSaveState(), customState: this.customState };
	}
}

describe('Game', () => {
	test('uses the subclass _generateId override for new games', () => {
		const server = mockServer();
		const game = new CustomGame({ server, logger: quietLogger });

		expect(game.id).toBe('custom-id');
		expect(server.games['custom-id']).toBe(game);
	});

	test('keeps the saveState id when restoring', () => {
		const server = mockServer();
		const game = new CustomGame({ server, logger: quietLogger, saveState: { id: 'saved-id' } });

		expect(game.id).toBe('saved-id');
	});

	test('initial save includes state set by the subclass constructor', async () => {
		const server = mockServer();
		new CustomGame({ server, logger: quietLogger });

		expect(server.created.length).toBe(0);
		await Promise.resolve();

		expect(server.created.length).toBe(1);
		expect(server.created[0].id).toBe('custom-id');
		expect(server.created[0].customState).toBe('initialized');
	});

	test('restored games do not write an initial save', async () => {
		const server = mockServer();
		new CustomGame({ server, logger: quietLogger, saveState: { id: 'saved-id' } });

		await Promise.resolve();

		expect(server.created.length).toBe(0);
	});
});
