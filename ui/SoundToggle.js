import { Button } from '@vanilla-bean/components';

/**
 * A button that mutes a game's sound (createSound) and lets it play again, showing which it is now
 * @example new SoundToggle({ sound, appendTo: toolbar })
 * @param {object} options - Options
 * @param {object} options.sound - What createSound made
 */
export default class SoundToggle extends Button {
	static schema = { sound: { data: true } };

	build() {
		super.build?.();

		const { sound } = this.options;
		const show = ({ muted }) => {
			this.elem.textContent = muted ? '🔇' : '🔊';
			this.elem.title = muted ? 'Sound off: tap to play it' : 'Sound on: tap to mute';
		};

		show(sound.settings);
		this.elem.addEventListener('click', () => sound.toggleMute());
		this.addCleanup?.('sound', sound.onChange(show));
	}
}
