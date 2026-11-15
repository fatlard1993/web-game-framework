import { Button, Component, Elem, Notify, failureReason, styled } from '@vanilla-bean/components';
import { createGame, getGames, joinGame } from '@fatlard1993/web-game-framework/client';
import { View } from '@fatlard1993/web-game-framework/ui';

// The first screen, in pictures so anyone can play it: pick who you are (an animal), press play. There is one game for
// everyone on this server, made the first time someone plays; the lobby at #/hub makes more, or watches one.
const AVATARS = ['🦊', '🐸', '🐼', '🦄', '🐙', '🐯', '🐧', '🐝'];
// What each avatar is called to someone who can't see it; a new avatar gets a name here too
const AVATAR_NAMES = {
	'🦊': 'Fox',
	'🐸': 'Frog',
	'🐼': 'Panda',
	'🦄': 'Unicorn',
	'🐙': 'Octopus',
	'🐯': 'Tiger',
	'🐧': 'Penguin',
	'🐝': 'Bee',
};
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

		&[aria-pressed='true'] {
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
					'aria-label': AVATAR_NAMES[avatar],
					pressed: avatar === picked,
					appendTo: avatars,
					onPointerPress: () => {
						picked = avatar;
						buttons.forEach((button, index) => (button.options.pressed = AVATARS[index] === avatar));
					},
				}),
		);

		new Title({ textContent: '⭐', appendTo: screen });
		screen.append(avatars);
		new PlayButton({
			textContent: '▶️ Play',
			appendTo: screen,
			onPointerPress: async () => {
				try {
					// Looked for again: someone may have made it since this screen opened, and there is only one game
					const found = (await everyonesGame()) ?? (await createGame({ body: { name: GAME_NAME } })).body;
					const joined = await joinGame(found.id, { body: { name: picked } });

					if (!joined.body?.id) throw new Error(failureReason(joined) || 'the game gave no player back');
					localStorage.setItem(found.id, joined.body.id);
					localStorage.setItem('avatar', picked);
					window.location.href = `#/play/${found.id}`;
				} catch (error) {
					// Said where it happened, in a picture and two words, with the reason small beneath for whoever can read it
					console.error('Could not start playing', error);
					new Notify({
						intent: 'danger',
						content: new Component({
							append: [
								'😕 Try again',
								new Elem({ tag: 'small', textContent: error.message, style: { display: 'block' } }),
							],
						}),
					});
				}
			},
		});
	}
}

// The one game everyone plays, or null until someone presses play: never some other game that happens to be listed
const everyonesGame = async () => {
	const { body } = await getGames({ invalidateAfter: 0 });

	return body?.find(game => game.name === GAME_NAME) ?? null;
};
