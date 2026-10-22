import { Dialog, Input, Label, Notify } from '@vanilla-bean/components';
import { failureReason } from '@vanilla-bean/hypertether';

import { exitGame } from '../../client/api.js';

/**
 * Leaving a game. The confirming button takes the player out of the game, unless they clear the checkbox, then goes to
 * the hub; a removal that fails is reported, and the player still leaves.
 * @example new ExitDialog({ gameId, playerId, onExit: () => music.stop() });
 */
export default class ExitDialog extends Dialog {
	static schema = {
		// The checkbox's label
		label: { default: 'Remove me from the game' },
		// The confirming button's label
		confirmLabel: { default: 'Exit' },
		// Whose exit to send; without both, exitGame reads them from gameContext
		gameId: {},
		playerId: {},
		// Where the player goes
		hubUrl: { default: '#/hub' },
		// Called after the removal, before leaving, maybe async
		onExit: {},
	};

	constructor(options = {}) {
		super({
			size: 'fit',
			header: 'Exiting',
			buttons: ['Cancel', options.confirmLabel ?? ExitDialog.schema.confirmLabel.default],
			onButtonPress: async ({ button, closeDialog }) => {
				if (button === this.options.confirmLabel) await this.exit();

				closeDialog();
			},
			...options,
		});
	}

	build() {
		super.build();

		this.removePlayer = true;

		new Label(
			{ label: this.options.label, variant: 'inline-after', appendTo: this.body },
			new Input({
				type: 'checkbox',
				value: true,
				onChange: ({ value }) => {
					this.removePlayer = value;
				},
			}),
		);
	}

	/**
	 * Remove the player (if still ticked), run onExit, and go to the hub
	 */
	async exit() {
		if (this.removePlayer) {
			const { gameId, playerId } = this.options;
			const result = await exitGame(gameId && playerId ? { urlParameters: { gameId, playerId } } : {});

			if (result.status === 'error') new Notify({ type: 'error', content: failureReason(result) });
		}

		await this.options.onExit?.();

		window.location.href = this.options.hubUrl;
	}
}
