import { Button } from '@vanilla-bean/components';

/**
 * A button that mutes a game's sound (createSound) and lets it play again: a toggle, pressed while the sound is off
 * @example new SoundToggle({ sound, appendTo: toolbar })
 * @param {object} options - Options
 * @param {object} options.sound - What createSound made
 */
export default class SoundToggle extends Button {
	static schema = { sound: { data: true } };

	constructor(options = {}, ...children) {
		super(
			{
				// One name whichever it shows; aria-pressed says which
				title: 'Mute the sound',
				'aria-label': 'Mute the sound',
				...options,
				onPointerPress: event => {
					this.options.sound.toggleMute();
					options.onPointerPress?.(event);
				},
			},
			...children,
		);
	}

	build() {
		super.build?.();

		const { sound } = this.options;
		const show = ({ muted }) => {
			this.options.pressed = muted;
			this.elem.textContent = muted ? '🔇' : '🔊';
		};

		show(sound.settings);
		this.addCleanup?.('sound', sound.onChange(show));
	}
}
