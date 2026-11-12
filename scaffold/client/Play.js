import { Button, Component, Dialog, Link, styled } from '@vanilla-bean/components';
import { act, createInput, createSound, enterGame, isTouch } from '@fatlard1993/web-game-framework/client';
import { JoinCard, SoundToggle, Stage, View } from '@fatlard1993/web-game-framework/ui';

import { FIELD } from '../rules.js';

const Scores = styled(
	Component,
	({ space, fontSize }) => `
		display: flex;
		gap: ${space.md};
		font-size: ${fontSize.xxl};
		white-space: nowrap;
		overflow: hidden;

		& .me { text-decoration: underline; }
	`,
);

// One player's screen, or a watcher's: the field fills everything below the bar, scores and buttons sit in the bar.
// What it shows comes from the server and nothing else: steering is an action, and the field redraws from each view
// of the game the server sends.
export default class Play extends View {
	static schema = { gameId: {}, watch: { default: false } };

	constructor(options, ...children) {
		const scores = new Scores();
		const sound = createSound({
			// Sounds go here as the game gets them: import catchSound from './sounds/catch.mp3', then { catch: catchSound }
			effects: {},
		});

		super(
			{
				...options,
				toolbar: {
					heading: '',
					left: [new Link({ textContent: '🏠', href: '#/', variant: 'button', tooltip: false }), scores],
					right: [
						new SoundToggle({ sound }),
						new Button({ textContent: '➕👫', title: 'Someone else joins', onPointerPress: () => this.invite() }),
					],
				},
			},
			...children,
		);
		this.scores = scores;
		this.sound = sound;
	}

	build() {
		super.build();
		this._init();
	}

	async _init() {
		const { gameId, watch } = this.options;
		let view = null;

		const stage = new Stage({ appendTo: this._body, onResize: () => view && this.draw(view) });
		const { playerId, leave } = await enterGame(gameId, {
			watch,
			onState: next => {
				if (next.caught?.some(({ playerId: who }) => who === playerId)) this.sound.play('catch');
				view = next;
				this.draw(view);
			},
			// Not in this game (or it's gone): the start screen sorts it out
			notMember: () => (window.location.href = '#/'),
			gone: () => (window.location.href = '#/'),
		});

		this.stage = stage;
		this.playerId = playerId;
		this.addCleanup('game', () => {
			leave();
			this.sound.destroy();
		});
		if (!watch && playerId) this.controls(stage);
	}

	// Steering: held keys on a computer, a finger (or the mouse) held down toward where to go; sent only when it changes
	controls(stage) {
		let sent = '';
		let toward = null;
		const input = createInput();
		const send = heading => {
			const said = `${heading.x.toFixed(2)},${heading.y.toFixed(2)}`;

			if (said === sent) return;
			sent = said;
			act('steer', heading, { quiet: true });
		};

		input.pointer(stage.elem, {
			onDown: point => (toward = point),
			onMove: point => toward && (toward = point),
			onUp: () => (toward = null),
		});
		input.every(50, () => {
			const keys = input.direction();

			if (keys.x || keys.y || !toward) return send(keys);

			// Toward the finger, from where this player is now, in field units
			const me = this.view?.state.spots[this.playerId];
			const scale = this.scale();

			if (!me || !scale) return;

			const dx = toward.x / scale.factor - scale.left / scale.factor - me.x;
			const dy = toward.y / scale.factor - scale.top / scale.factor - me.y;
			const length = Math.hypot(dx, dy);

			send(length < 2 ? { x: 0, y: 0 } : { x: dx / length, y: dy / length });
		});
		this.addCleanup('input', () => input.destroy());
		if (isTouch()) this.stage.elem.title = 'Hold a finger where you want to go';
	}

	// How the field fits the stage: as big as it can, centered
	scale() {
		const { width, height } = this.stage ?? {};

		if (!width || !height) return null;

		const factor = Math.min(width / FIELD.width, height / FIELD.height);

		return { factor, left: (width - FIELD.width * factor) / 2, top: (height - FIELD.height * factor) / 2 };
	}

	draw(view) {
		this.view = view;

		const { context } = this.stage ?? {};
		const scale = this.scale();

		if (!context || !scale) return;

		const { factor, left, top } = scale;
		const here = view.players.filter(({ online }) => online !== false);

		context.clearRect(0, 0, this.stage.width, this.stage.height);
		context.fillStyle = 'rgba(255, 255, 255, 0.05)';
		context.fillRect(left, top, FIELD.width * factor, FIELD.height * factor);
		// Emoji draw in the fill color's opacity: a solid one for the pieces
		context.fillStyle = '#ffffff';
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.font = `${Math.max(16, 7 * factor)}px sans-serif`;
		for (const star of view.state.stars) context.fillText('⭐', left + star.x * factor, top + star.y * factor);
		for (const player of here) {
			const spot = view.state.spots[player.id];

			if (spot) context.fillText(player.name, left + spot.x * factor, top + spot.y * factor);
		}

		this.scores.elem.replaceChildren(
			...here.map(
				player =>
					new Component({
						tag: 'span',
						textContent: `${player.name} ${view.state.scores[player.id] ?? 0}`,
						addClass: player.id === this.playerId ? 'me' : '',
					}).elem,
			),
		);
	}

	// A code a phone on the same network opens to join
	invite() {
		new Dialog({
			appendTo: document.body,
			size: 'fit',
			header: '➕👫',
			body: new JoinCard({ gameId: this.options.gameId }),
			buttons: ['✅'],
			onButtonPress: ({ closeDialog }) => closeDialog(),
		});
	}
}
