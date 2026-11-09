import { afterEach, beforeEach, expect, test } from 'bun:test';

import { createSound } from './sound.js';

let sound;
const played = [];

beforeEach(() => {
	localStorage.clear();
	played.length = 0;
	globalThis.Audio = class {
		constructor(src) {
			this.src = src;
			this.volume = 1;
		}

		play() {
			played.push({ src: this.src, volume: this.volume });

			return Promise.resolve();
		}

		pause() {}
	};
});
afterEach(() => sound?.destroy());

test('an effect waits for the first tap, then plays; overlapping plays come from a pool', () => {
	sound = createSound({ effects: { coin: 'coin.mp3' } });
	sound.play('coin');
	expect(played).toHaveLength(0);
	window.dispatchEvent(new Event('pointerdown'));
	expect(played).toEqual([{ src: 'coin.mp3', volume: 0.8 }]);
	sound.play('coin');
	sound.play('missing');
	expect(played).toHaveLength(2);
});

test('mute and volumes are kept in this browser and heard by whoever listens', () => {
	sound = createSound({ effects: { coin: 'coin.mp3' } });

	const heard = [];

	sound.onChange(settings => heard.push(settings.muted));
	sound.setVolume('effects', 0.5);
	expect(sound.toggleMute()).toBe(true);
	sound.destroy();
	sound = createSound();
	expect(sound.settings).toMatchObject({ effects: 0.5, muted: true });
	expect(heard).toEqual([false, true]);
});
