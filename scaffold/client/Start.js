import { Button, Component, styled } from '@vanilla-bean/components';
import { createGame, getGames, joinGame } from '@fatlard1993/web-game-framework/client';
import { View } from '@fatlard1993/web-game-framework/ui';

// The first screen, for players who may not read yet: pick who you are (an animal), press play. There is one game
// for everyone on this server, made the first time someone plays; grown-ups and phones can still use the lobby at
// #/hub to make more or watch.
const AVATARS = ['🦊', '🐸', '🐼', '🦄', '🐙', '🐯', '🐧', '🐝'];
const GAME_NAME = 'Everyone';

const Screen = styled(
	Component,
	({ space }) => `
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: ${space.xl};
		min-height: 100%;
		padding: ${space.xl};
		text-align: center;
	`,
);

const Title = styled(
	Component,
	() => `
		font-size: 4rem;
		line-height: 1;
	`,
);

const Avatars = styled(
	Component,
	({ space }) => `
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: ${space.md};
		max-width: 420px;
	`,
);

const Avatar = styled(
	Button,
	({ colors, radius }) => `
		width: 72px;
		height: 72px;
		border-radius: ${radius.pill};
		font-size: 2.4rem;
		background: ${colors.alpha(colors.white, 0.08)};

		&.picked {
			background: ${colors.blue};
			transform: scale(1.1);
		}
	`,
);

const PlayButton = styled(
	Button,
	({ colors, radius }) => `
		min-width: 220px;
		padding: 18px 32px;
		border-radius: ${radius.pill};
		background: ${colors.green};
		font-size: 2rem;
	`,
);

export default class Start extends View {
	build() {
		this._init();
	}

	async _init() {
		const game = await everyonesGame();

		// Already in: straight to the game
		if (game && game.players.some(({ id }) => id === localStorage.getItem(game.id))) {
			window.location.href = `#/play/${game.id}`;

			return;
		}

		const screen = new Screen({ appendTo: this });
		let picked = localStorage.getItem('avatar') || AVATARS[0];
		const avatars = new Avatars();
		const buttons = AVATARS.map(
			avatar =>
				new Avatar({
					textContent: avatar,
					addClass: avatar === picked ? 'picked' : '',
					appendTo: avatars,
					onPointerPress: () => {
						picked = avatar;
						for (const button of buttons) button.elem.classList.toggle('picked', button.elem.textContent === avatar);
					},
				}),
		);

		new Title({ textContent: '⭐', appendTo: screen });
		screen.append(avatars);
		new PlayButton({
			textContent: '▶️ Play',
			appendTo: screen,
			onPointerPress: async () => {
				const found = game ?? (await createGame({ body: { name: GAME_NAME } })).body;
				const joined = await joinGame(found.id, { body: { name: picked } });

				if (!joined.body?.id) return;
				localStorage.setItem(found.id, joined.body.id);
				localStorage.setItem('avatar', picked);
				window.location.href = `#/play/${found.id}`;
			},
		});
	}
}

// The one game everyone plays, or null until someone presses play: never some other game that happens to be listed
const everyonesGame = async () => {
	const { body } = await getGames({ invalidateAfter: 0 });

	return body?.find(game => game.name === GAME_NAME) ?? null;
};
