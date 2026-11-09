import { expect, test } from 'bun:test';

import Game from './Game.js';
import { FIELD, REACH, step } from './rules.js';

const quiet = { info() {}, debug() {}, warning() {}, error() {} };
const newGame = () => new Game({ server: { games: {}, publish() {}, socketBroadcast() {} }, logger: quiet });

test('a player steers, moves on each tick, and stays inside the field', () => {
	const game = newGame();
	const fox = game.addPlayer('🦊');

	game.dispose();
	game.state.spots[fox.id] = { x: FIELD.width - 1, y: 10 };
	expect(game.act(fox.id, 'steer', { x: 5, y: 0 })).toEqual({ ok: true });
	expect(game.state.headings[fox.id]).toEqual({ x: 1, y: 0 });
	game.tick();
	expect(game.state.spots[fox.id]).toEqual({ x: FIELD.width - 4, y: 10 });
	expect(game.act(fox.id, 'steer', { x: 'left' })).toEqual({ ok: false, error: 'Steer with a direction' });
});

test('reaching a star catches it, scores, and puts another star somewhere else', () => {
	const state = { spots: { a: { x: 50, y: 50 } }, scores: { a: 0 }, stars: [{ x: 50 + REACH - 1, y: 50 }] };
	const { caught } = step(state, { a: { x: 0.0001, y: 0 } }, 0.01);

	expect(caught).toHaveLength(1);
	expect(state.scores.a).toBe(1);
	expect(state.stars).toHaveLength(1);
});

test('where players are heading is never saved, and the save comes back as it went', () => {
	const game = newGame();
	const fox = game.addPlayer('🦊');

	game.dispose();
	game.act(fox.id, 'steer', { x: 1, y: 0 });

	const save = game.toSaveState();

	expect(save.state.headings).toBeUndefined();
	expect(save.version).toBe(1);

	const back = new Game({
		saveState: JSON.parse(JSON.stringify(save)),
		server: { games: {}, publish() {} },
		logger: quiet,
	});

	back.dispose();
	expect(back.state.scores).toEqual(game.state.scores);
	expect(back.state.headings).toEqual({});
});
