import { Component, Button, Notify, failureReason, styled, theme } from '@vanilla-bean/components';

import { getGame } from '../../client/index.js';
import GameInfoDialog from './GameInfoDialog.js';

export default class GameInfoPopover extends (styled.Popover`
	flex-direction: column;
`) {
	static schema = {
		gameId: {},
		infoRows: {
			// Games override this to show their own rows (world, stage, packs, ...)
			get default() {
				return game => [`Game: ${game.name}`, `Players: ${game.players.length}`];
			},
		},
		// The paths that differ from the framework's, handed on to the dialog when given
		paths: {},
		dialogComponent: {
			// Games override this with their own detail dialog
			get default() {
				return GameInfoDialog;
			},
		},
	};

	build() {
		super.build();
		// Settles once the game's rows are in (or it's gone, its game couldn't be loaded): opened then, it's placed at its size
		this.loaded = this._init();
	}

	async _init() {
		const found = await getGame(this.options.gameId);

		if (found.status === 'error') {
			new Notify({ intent: 'danger', content: `Couldn't load the game: ${failureReason(found)}` });
			this.destroy();

			return;
		}

		const game = found.body;

		this.options.infoRows(game).forEach(content => new Component({ content, appendTo: this }));
		new Button({
			content: 'Show details',
			appendTo: this,
			style: { display: 'block', margin: `${theme.space.sm} auto` },
			onPointerPress: () => {
				this.destroy();

				new this.options.dialogComponent({ game, ...(this.options.paths && { paths: this.options.paths }) });
			},
		});
	}
}
