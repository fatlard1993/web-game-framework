import {
	Button,
	Component,
	Dialog,
	Link,
	List,
	Notify,
	SectionLabel,
	failureReason,
	styled,
} from '@vanilla-bean/components';

import { deleteGame } from '../../client/index.js';

export default class GameInfoDialog extends styled(
	Dialog,
	({ space }) => `
		/* Its own footer, so the space the dialog gives its buttons */
		& .footer {
			column-gap: ${space.xs};
		}
	`,
) {
	static schema = {
		game: {},
	};

	constructor(options = {}) {
		super({
			size: 'standard',
			header: options.game.name,
			// Close, then Delete, then Join last: going to the game is a Link, so it's a footer of its own rather than buttons
			footer: [
				new Button({ textContent: 'Close', onPointerPress: () => this.close() }),
				new Button({ textContent: 'Delete', intent: 'danger', onPointerPress: () => this.delete() }),
				new Link({
					textContent: 'Join',
					href: `#/join/${options.game.id}`,
					variant: 'button',
					tooltip: false,
					// The view changes under the dialog, which goes with it
					onPointerPress: () => this.close(),
				}),
			],
			...options,
		});
	}

	build() {
		super.build();

		const { game } = this.options;

		new Component({ content: `Game ID: ${game.id}`, appendTo: this._body });

		new SectionLabel({ textContent: 'Players', appendTo: this._body });
		new List({ items: game.players.map(({ name }) => name), appendTo: this._body });
	}

	/**
	 * Ask, then delete the game and close; a refused delete says why and stays open
	 */
	async delete() {
		const { game } = this.options;
		const players = game.players.length;
		const sure = await Dialog.confirm({
			header: `Delete ${game.name}?`,
			body: players
				? `${players} ${players === 1 ? 'player loses their place' : 'players lose their places'} in it, for good.`
				: 'It is gone for good.',
			intent: 'danger',
			confirmLabel: 'Delete',
		});

		if (!sure) return;

		const deleted = await deleteGame(game.id);

		// Not gone: the dialog stays, so it can be tried again
		if (deleted.status === 'error') {
			new Notify({ intent: 'danger', content: `Couldn't delete ${game.name}: ${failureReason(deleted)}` });

			return;
		}

		this.close();
	}
}
