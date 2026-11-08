import { Button, Component, Link, styled } from '@vanilla-bean/components';
import { gameContext, getGame, onMessage, socket } from '@fatlard1993/web-game-framework/client';
import { View } from '@fatlard1993/web-game-framework/ui';

const Board = styled(
	Component,
	({ space }) => `
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: ${space.xl};
		padding: ${space.xl};
	`,
);

const Tap = styled(
	Button,
	({ colors, radius }) => `
		width: min(60vw, 240px);
		height: min(60vw, 240px);
		border-radius: ${radius.pill};
		background: ${colors.blue};
		font-size: 5rem;

		&:active {
			transform: scale(0.94);
		}
	`,
);

const Scores = styled(
	Component,
	({ space }) => `
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: ${space.lg};
		font-size: 2rem;
	`,
);

const Score = styled(
	Component,
	({ colors, radius, space }) => `
		display: flex;
		align-items: center;
		gap: ${space.sm};
		padding: ${space.sm} ${space.md};
		border-radius: ${radius.pill};
		background: ${colors.alpha(colors.white, 0.08)};

		&.me {
			background: ${colors.alpha(colors.blue, 0.35)};
		}
	`,
);

// One player's screen: a big star to tap, and everyone's stars, each player shown as the animal they picked. What it
// shows comes from the server's state and nothing else: a tap sends a message, and the number changes when the new
// state comes back, on this screen and every other.
export default class Play extends View {
	static schema = { gameId: {} };

	constructor(options, ...children) {
		super(
			{
				...options,
				toolbar: { heading: '', left: [new Link({ textContent: '🏠', href: '#/', variant: 'button' })] },
			},
			...children,
		);
	}

	build() {
		super.build();
		this._init();
	}

	async _init() {
		const { gameId } = this.options;
		const playerId = localStorage.getItem(gameId);
		const { body: game, response } = await getGame(gameId, { invalidateAfter: 0 });

		// Not in this game (or the game is gone): the start screen sorts it out
		if (response.status !== 200 || !game.players.some(({ id }) => id === playerId)) {
			window.location.href = '#/';

			return;
		}

		gameContext.gameId = gameId;
		gameContext.playerId = playerId;

		const board = new Board({ appendTo: this._body });
		const scores = new Scores();

		new Tap({
			textContent: '⭐',
			appendTo: board,
			onPointerPress: () => socket.send({ gameId, playerId, type: 'tap' }),
		});
		board.append(scores);

		const draw = ({ players, state }) => {
			scores.empty();
			for (const player of players)
				new Score({
					appendTo: scores,
					addClass: player.id === playerId ? 'me' : '',
					textContent: `${player.name} ${state.taps[player.id] ?? 0}`,
				});
		};

		draw(game);
		this.addCleanup(
			'socket',
			onMessage(message => message.gameId === gameId && message.update === 'state' && draw(message)),
		);
	}
}
