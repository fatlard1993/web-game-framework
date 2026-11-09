import { afterEach, expect, test } from 'bun:test';

import { createInput } from './input.js';

let input;

afterEach(() => {
	input?.destroy();
	document.body.innerHTML = '';
});

const key = (type, keyName, target = window) =>
	target.dispatchEvent(new KeyboardEvent(type, { key: keyName, bubbles: true }));

test('arrow keys and WASD both move, diagonals as long as straight lines, and space is the action', () => {
	const pressed = [];

	input = createInput({ onPress: name => pressed.push(name) });
	key('keydown', 'w');
	key('keydown', 'ArrowRight');

	const { x, y } = input.direction();

	expect(x).toBeCloseTo(Math.SQRT1_2);
	expect(y).toBeCloseTo(-Math.SQRT1_2);
	key('keydown', ' ');
	key('keydown', ' ');
	expect(pressed).toEqual(['up', 'right', 'action']);
	key('keyup', 'w');
	expect(input.held('up')).toBe(false);
	expect(input.direction()).toEqual({ x: 1, y: 0 });
});

test('nothing stays held when the window loses focus', () => {
	input = createInput();
	key('keydown', 'a');
	window.dispatchEvent(new Event('blur'));
	expect(input.held('left')).toBe(false);
});

test("keys typed into a field, or while a dialog is open, are not the game's", () => {
	input = createInput();

	const field = document.createElement('input');

	document.body.append(field);
	key('keydown', 'd', field);
	expect(input.held('right')).toBe(false);

	const dialog = document.createElement('dialog');

	dialog.setAttribute('open', '');
	document.body.append(dialog);
	key('keydown', 'd');
	expect(input.held('right')).toBe(false);
});

test('an on-screen button holds its control while pressed, and lets it go however the press ends', () => {
	input = createInput();

	const button = document.createElement('button');

	document.body.append(button);
	input.hold(button, 'left');
	button.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1 }));
	expect(input.held('left')).toBe(true);
	button.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 }));
	expect(input.held('left')).toBe(false);
});
