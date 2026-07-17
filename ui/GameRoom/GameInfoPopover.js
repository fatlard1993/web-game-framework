import { Component, Button, styled } from '@vanilla-bean/components';

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
		dialogComponent: {
			// Games override this with their own detail dialog
			get default() {
				return GameInfoDialog;
			},
		},
	};

	build() {
		super.build();
		this._init();
	}

	async _init() {
		const game = (await getGame(this.options.gameId)).body;

		this.options.infoRows(game).forEach(content => new Component({ content, appendTo: this }));
		new Button({
			content: 'More',
			appendTo: this,
			style: { display: 'block', margin: '6px auto' },
			onPointerPress: () => {
				this.elem.remove();

				new this.options.dialogComponent({ game });
			},
		});
	}
}
