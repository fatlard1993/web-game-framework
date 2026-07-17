import { Link, Button, Notify, copyToClipboard, randInt } from '@vanilla-bean/components';

import { View } from '../layout/index.js';
import { getGames, onMessage } from '../../client/index.js';
import { GameList, GameListText } from './GameList.js';
import GameInfoPopover from './GameInfoPopover.js';

export default class Hub extends View {
	static schema = {
		containerComponent: {},
		noGamesText: {},
		noGamesMessage: {},
		gamesFoundText: {},
		gamesFoundTextFn: {},
		buttons: {},
	};

	constructor(options, ...children) {
		super(
			{
				...options,
				toolbar: {
					heading: options.toolbar?.heading || 'Game Hub',
					left: options.toolbar?.left || [],
					right: [
						new Link({
							textContent: options.toolbar?.createText || 'New Game',
							href: options.toolbar?.createHref || '#/create',
							variant: 'button',
						}),
					],
				},
			},
			...children,
		);

		// Dismiss on pointerdown: onPointerPress handlers fire on pointerdown, so their
		// stopPropagation can shield the popover toggle from this handler
		this.options.onPointerDown = () => {
			if (this.gamePopover) {
				this.gamePopover.elem.remove();
				this.gamePopover = null;
			}
		};
	}

	build() {
		super.build();
		this._init();
	}

	async _init() {
		this._body.empty();
		this._socketCleanup?.();

		const games = await getGames();

		if (games.response.status !== 200) {
			// TODO limit to center area
			new Notify({
				type: 'error',
				content: games.body?.message || games.response.statusText,
				x: randInt(12, window.innerWidth - 12),
				y: randInt(72, window.innerHeight / 3),
			});
			return;
		}

		const socketCleanup = onMessage(data => {
			if (
				data.update === 'newGame' ||
				data.update === 'removedGame' ||
				data.update === 'addPlayer' ||
				data.update === 'removePlayer'
			) {
				games.invalidateCache();
				this._init();
			}
		});

		this._socketCleanup = socketCleanup;
		this.addCleanup('socketCleanup', () => this._socketCleanup?.());

		if (!games.body?.length) {
			// Allow games to provide their own container component for empty state
			if (this.options.containerComponent && this.options.noGamesText) {
				const ContainerComponent = this.options.containerComponent;
				this.container = new ContainerComponent({
					appendTo: this._body,
					textContent: this.options.noGamesText,
				});
			} else {
				const noGamesMessage = this.options.noGamesMessage || 'No games found. Create one to get started!';
				const messageElement = document.createElement('div');
				messageElement.style.cssText = 'margin: 24px; padding: 16px; text-align: center; color: #666;';
				messageElement.textContent = noGamesMessage;
				this._body.append(messageElement);
			}
			return;
		}

		const gameList = new GameList({
			items: games.body.map(({ id, name, players }) => ({
				append: [
					new GameListText({ content: name }),
					new Button({
						content: this.options.buttons?.linkText || 'Copy Link',
						onPointerPress: event => {
							event.stopPropagation();

							copyToClipboard(`${window.location.origin}#/join/${id}`);

							new Notify({
								x: event.clientX,
								y: event.clientY,
								content: 'Copied link to clipboard!',
								type: 'success',
								timeout: 1300,
							});
						},
					}),
					new Button({
						content: this.options.buttons?.infoText || 'Info',
						onPointerPress: event => {
							event.stopPropagation();

							if (this.gamePopover) {
								this.gamePopover.elem.remove();
								this.gamePopover = null;
							} else this.gamePopover = new GameInfoPopover({ x: event.clientX, y: event.clientY, gameId: id });
						},
					}),
					new Link({
						content: this.options.buttons?.joinText || 'Join',
						href: `#/join/${id}`,
						variant: 'button',
					}),
					new Link({
						content: this.options.buttons?.watchText || 'Watch',
						href: `#/watch/${id}`,
						variant: 'button',
					}),
					new GameListText({ content: `${players.length}` }),
				],
			})),
		});

		// Allow games to provide their own container component for games list
		if (this.options.containerComponent && (this.options.gamesFoundText || this.options.gamesFoundTextFn)) {
			const ContainerComponent = this.options.containerComponent;
			const gamesText = this.options.gamesFoundTextFn
				? this.options.gamesFoundTextFn(games.body.length)
				: this.options.gamesFoundText;

			this.container = new ContainerComponent(
				{
					appendTo: this._body,
					textContent: gamesText,
				},
				gameList,
			);
		} else {
			this._body.append(gameList);
		}
	}
}
