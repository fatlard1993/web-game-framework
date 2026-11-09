// A game's controls, one way for every game: the keyboard on a computer (arrow keys and WASD to move, space for the
// main action), on-screen buttons on a touch device, and the pointer over the play area; all of it let go when the
// window loses focus, and none of it heard while a dialog is open or someone types in a field.

const KEYS = {
	up: ['ArrowUp', 'w', 'W'],
	down: ['ArrowDown', 's', 'S'],
	left: ['ArrowLeft', 'a', 'A'],
	right: ['ArrowRight', 'd', 'D'],
	action: [' ', 'Enter'],
};

/** Whether this device is played by touch (show on-screen controls) rather than a mouse and keyboard */
export const isTouch = () =>
	typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;

// Something else has the keyboard: a dialog open, or a field being typed in
const elsewhere = event =>
	Boolean(document.querySelector('dialog[open]')) ||
	['INPUT', 'TEXTAREA', 'SELECT'].includes(event?.target?.tagName) ||
	event?.target?.isContentEditable;

/**
 * The controls for one game view. `keys` names each control and the keys that hold it (the defaults: up, down, left,
 * right, action); `onPress(name)` hears a control the moment it's pressed (a key, or an on-screen button).
 * @example
 * const input = createInput({ onPress: name => name === 'action' && act('jump') });
 * input.every(50, () => { const { x, y } = input.direction(); if (x || y) act('move', { x, y }); });
 * if (isTouch()) input.hold(leftButton, 'left');
 * @param {object} [options] - Options
 * @param {object} [options.keys] - { [control]: [key names] }
 * @param {Function} [options.onPress] - (control) when one is pressed
 * @returns {object} The controls: held, direction, hold, pointer, every, destroy
 */
export const createInput = ({ keys = KEYS, onPress } = {}) => {
	const held = new Set();
	const cleanups = [];
	const controlOf = key => Object.keys(keys).find(name => keys[name].includes(key));

	const press = name => {
		if (held.has(name)) return;
		held.add(name);
		onPress?.(name);
	};

	const listen = (target, type, handler, options) => {
		target.addEventListener(type, handler, options);
		cleanups.push(() => target.removeEventListener(type, handler, options));
	};

	listen(window, 'keydown', event => {
		const name = controlOf(event.key);

		if (!name || elsewhere(event)) return;
		event.preventDefault();
		press(name);
	});
	listen(window, 'keyup', event => {
		const name = controlOf(event.key);

		if (name) held.delete(name);
	});
	// Focus gone (another window, a tab switch): nothing stays held down
	listen(window, 'blur', () => held.clear());
	listen(document, 'visibilitychange', () => document.hidden && held.clear());

	const timers = [];

	return {
		/** Whether a control is held now */
		held: name => held.has(name),

		/** Where the held controls point, each axis -1, 0 or 1, and diagonals as long as straight lines */
		direction: () => {
			const x = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
			const y = (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0);
			const length = Math.hypot(x, y) || 1;

			return { x: x / length, y: y / length };
		},

		/**
		 * Makes an on-screen button hold a control while a finger is on it, however it slides: the press is captured,
		 * so letting go anywhere lets it go
		 * @param {HTMLElement} element - The button
		 * @param {string} name - The control it holds
		 */
		hold: (element, name) => {
			const release = () => held.delete(name);

			element.style.touchAction = 'none';
			listen(element, 'pointerdown', event => {
				event.preventDefault();
				element.setPointerCapture?.(event.pointerId);
				press(name);
			});
			listen(element, 'pointerup', release);
			listen(element, 'pointercancel', release);
			listen(element, 'lostpointercapture', release);
		},

		/**
		 * Follows the pointer over a play area, in its own coordinates (0 to its width and height, CSS pixels): a press
		 * that starts within `margin` pixels outside it still counts, held to its edge, and a drag that leaves it keeps
		 * going until let go. `onDown`, `onMove` and `onUp` hear ({ x, y, event }).
		 * @param {HTMLElement} area - The play area
		 * @param {object} [handlers] - { onDown, onMove, onUp, margin }
		 * @returns {{ x: number, y: number, down: boolean }} Where the pointer is now, kept current
		 */
		pointer: (area, { onDown, onMove, onUp, margin = 48 } = {}) => {
			const now = { x: 0, y: 0, down: false };
			const place = event => {
				const box = area.getBoundingClientRect();

				now.x = Math.min(Math.max(event.clientX - box.left, 0), box.width);
				now.y = Math.min(Math.max(event.clientY - box.top, 0), box.height);

				return { x: now.x, y: now.y, event };
			};
			const near = event => {
				const box = area.getBoundingClientRect();

				return (
					event.clientX >= box.left - margin &&
					event.clientX <= box.right + margin &&
					event.clientY >= box.top - margin &&
					event.clientY <= box.bottom + margin
				);
			};

			area.style.touchAction = 'none';
			listen(window, 'pointerdown', event => {
				if (!near(event) || elsewhere(event) || event.target.closest?.('button, a, input')) return;
				now.down = true;
				onDown?.(place(event));
			});
			listen(window, 'pointermove', event => {
				if (!now.down && !area.contains(event.target)) return;
				onMove?.(place(event));
			});
			const up = event => {
				if (!now.down) return;
				now.down = false;
				onUp?.(place(event));
			};

			listen(window, 'pointerup', up);
			listen(window, 'pointercancel', up);

			return now;
		},

		/**
		 * Runs `tick` every `ms` while the page is shown and nothing else has the keyboard: for sending held controls
		 * to the server as they're held
		 */
		every: (ms, tick) => {
			const timer = setInterval(() => !document.hidden && !elsewhere() && tick(), ms);

			timers.push(timer);

			return timer;
		},

		/** Stops listening, lets everything go, and stops `every` */
		destroy: () => {
			for (const cleanup of cleanups.splice(0)) cleanup();
			for (const timer of timers.splice(0)) clearInterval(timer);
			held.clear();
		},
	};
};
