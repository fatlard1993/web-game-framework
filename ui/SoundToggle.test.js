import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

import SoundToggle from './SoundToggle.js';

// What createSound makes, as far as the toggle uses it
const fakeSound = () => {
	const listeners = new Set();
	const settings = { muted: false };

	return {
		get settings() {
			return { ...settings };
		},
		toggleMute: mock(() => {
			settings.muted = !settings.muted;
			for (const listener of listeners) listener({ ...settings });
		}),
		onChange: listener => {
			listeners.add(listener);

			return () => listeners.delete(listener);
		},
	};
};

describe('SoundToggle', () => {
	let toggle;

	afterEach(() => {
		toggle?.destroy();
		toggle = null;
	});

	test('is a toggle, pressed while the sound is off', async () => {
		const sound = fakeSound();
		toggle = new SoundToggle({ sound, appendTo: container });

		const button = screen.getByRole('button', { name: 'Mute the sound' });

		expect(button).toHaveAttribute('aria-pressed', 'false');

		await userEvent.click(button);

		expect(sound.toggleMute).toHaveBeenCalledTimes(1);
		expect(button).toHaveAttribute('aria-pressed', 'true');
	});

	test('answers the keyboard', async () => {
		const sound = fakeSound();
		toggle = new SoundToggle({ sound, appendTo: container });

		screen.getByRole('button').focus();
		await userEvent.keyboard('{Enter}');

		expect(sound.toggleMute).toHaveBeenCalledTimes(1);
	});

	test('stops listening once destroyed', async () => {
		const sound = fakeSound();
		toggle = new SoundToggle({ sound, appendTo: container });
		const button = screen.getByRole('button');

		toggle.destroy();
		toggle = null;
		button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(sound.toggleMute).not.toHaveBeenCalled();
	});
});
