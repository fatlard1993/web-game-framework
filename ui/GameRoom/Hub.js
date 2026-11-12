import { Link, Button, Notify, EmptyState, copyToClipboard, failureReason } from '@vanilla-bean/components';

import { View } from '../layout/index.js';
import { getGames, onMessage } from '../../client/index.js';
import { joinUrl } from '../../client/joinUrl.js';
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
		watch: { default: true },
		popoverOptions: {},
	};

	constructor(options, ...children) {
		super(
			{
				...options,
				// The games read best in a column on a wide screen
				body: { column: true, ...options.body },
				toolbar: {
					heading: options.toolbar?.heading || 'Game Hub',
					left: options.toolbar?.left || [],
					right: [
						new Link({
							textContent: options.toolbar?.createText || 'Create a game',
							href: options.toolbar?.createHref || '#/create',
							variant: 'button',
							tooltip: false,
						}),
					],
				},
			},
			...children,
		);

		// A press anywhere else dismisses the popover; the list's buttons stop their press from reaching here
		this.options.onPointerPress = () => {
			if (this.gamePopover) {
				this.gamePopover.destroy();
				this.gamePopover = null;
			}
		};
	}

	build() {
		super.build();
		this._init();
	}

	async _init() {
		this._socketCleanup?.();

		// Loading until the list first shows; after that, a live update keeps it on screen until the new one is here
		if (!this._listed) {
			this._body.empty();
			new EmptyState({ loading: true, appendTo: this._body });
		}

		const games = await getGames();

		this._body.empty();

		if (games.status === 'error') {
			this._listed = false;
			new EmptyState({
				icon: 'triangle-exclamation',
				title: "Couldn't load the games",
				message: failureReason(games),
				action: {
					textContent: 'Try again',
					onPointerPress: () => {
						// A refusal is cached like a list: ask again
						games.invalidateCache();
						this._init();
					},
				},
				appendTo: this._body,
			});
			return;
		}

		this._listed = true;

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
				new EmptyState({
					icon: 'gamepad',
					title: 'No games yet',
					message: this.options.noGamesMessage || 'No games found. Create one to get started!',
					appendTo: this._body,
				});
			}
			return;
		}

		const gameList = new GameList({
			items: games.body.map(({ id, name, players }) => ({
				append: [
					new GameListText({ content: name }),
					new Button({
						content: this.options.buttons?.linkText || 'Copy link',
						variant: 'flat',
						onPointerPress: async event => {
							event.stopPropagation();

							// An address a phone on the network can open, not localhost
							copyToClipboard(await joinUrl(id));

							new Notify({
								x: event.clientX,
								y: event.clientY,
								content: 'Copied link to clipboard!',
								intent: 'success',
								timeout: 1300,
							});
						},
					}),
					new Button({
						content: this.options.buttons?.infoText || 'Show info',
						variant: 'flat',
						onPointerPress: event => {
							event.stopPropagation();

							// One that destroyed itself (its game couldn't be loaded) is off the page: open another
							if (this.gamePopover?.elem.isConnected) {
								this.gamePopover.destroy();
								this.gamePopover = null;
							} else {
								this.gamePopover = new GameInfoPopover({
									x: event.clientX,
									y: event.clientY,
									gameId: id,
									...this.options.popoverOptions,
								});
							}
						},
					}),
					new Link({
						content: this.options.buttons?.joinText || 'Join',
						href: `#/join/${id}`,
						variant: 'button',
						tooltip: false,
					}),
					this.options.watch &&
						new Link({
							content: this.options.buttons?.watchText || 'Watch',
							href: `#/watch/${id}`,
							variant: 'flat',
							tooltip: false,
						}),
					new GameListText({ content: `${players.length}` }),
				].filter(Boolean),
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
