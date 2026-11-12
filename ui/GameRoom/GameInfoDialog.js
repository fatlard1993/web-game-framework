import { Component, Dialog, List, Label, Notify, failureReason } from '@vanilla-bean/components';

import { deleteGame } from '../../client/index.js';

export default class GameInfoDialog extends Dialog {
	static schema = {
		game: {},
	};

	constructor(options = {}) {
		super({
			size: 'standard',
			header: options.game.name,
			buttons: [
				'Close',
				{
					textContent: 'Delete',
					intent: 'danger',
				},
				'Join',
			],
			onButtonPress: async ({ button }) => {
				if (button === 'Join') window.location.href = `#/join/${options.game.id}`;
				else if (button?.textContent === 'Delete') {
					const players = options.game.players.length;
					const sure = await Dialog.confirm({
						header: `Delete ${options.game.name}?`,
						body: players
							? `${players} ${players === 1 ? 'player loses their place' : 'players lose their places'} in it, for good.`
							: 'It is gone for good.',
						intent: 'danger',
						confirmLabel: 'Delete',
					});

					if (!sure) return;

					const deleted = await deleteGame(options.game.id);

					// Not gone: the dialog stays, so it can be tried again
					if (deleted.status === 'error') {
						new Notify({ intent: 'danger', content: `Couldn't delete ${options.game.name}: ${failureReason(deleted)}` });

						return;
					}
				}

				this.close();
			},
			...options,
		});
	}

	build() {
		super.build();

		const { game } = this.options;

		new Component({ content: `Game ID: ${game.id}`, appendTo: this._body });

		new Label({
			label: 'Players',
			appendTo: this._body,
			append: new List({ items: game.players.map(({ name }) => name) }),
		});
	}
}
