/**
 * Clicker Game - VBC Client
 * Minimal implementation using @vanilla-bean/components
 */
import '@vanilla-bean/components/app/reloadOnBuild';
import {
	Button,
	Card,
	Component,
	Content,
	EmptyState,
	FormDialog,
	Notify,
	POST,
	Page,
	SectionLabel,
	Toolbar,
	View,
	styled,
	theme,
} from '@vanilla-bean/components';

const { colors, fontSize, space } = theme;

// App state
const state = {
	view: 'lobby', // lobby | game
	gameId: null,
	playerId: null,
	playerName: null,
	game: null,
	games: null, // null while loading
	gamesError: null,
	socket: null,
	countdownInterval: null,
};

// WebSocket setup
function initSocket() {
	state.socket = new WebSocket(`ws://${window.location.host}/ws`);

	state.socket.addEventListener('message', event => {
		const data = JSON.parse(event.data);
		handleMessage(data);
	});

	state.socket.addEventListener('close', () => {
		setTimeout(initSocket, 3000);
	});
}

function send(data) {
	if (state.socket?.readyState === WebSocket.OPEN) {
		state.socket.send(JSON.stringify(data));
	}
}

function handleMessage(data) {
	if (data.error) return new Notify({ intent: 'danger', content: data.error });

	switch (data.update) {
		case 'playerJoined':
		case 'playerLeft':
			refreshGame();
			break;
		case 'gameStarted':
			state.game.status = 'playing';
			state.game.endTime = data.endTime;
			app.showView('game');
			break;
		case 'click': {
			state.game.globalClicks = data.globalClicks;
			const player = state.game.players.find(p => p.id === data.playerId);
			if (player) player.clicks = data.playerClicks;
			app.showView('game');
			break;
		}
		case 'gameEnded':
			state.game.status = 'finished';
			state.game.winner = data.winner;
			state.game.globalClicks = data.globalClicks;
			if (state.countdownInterval) clearInterval(state.countdownInterval);
			app.showView('game');
			break;
		case 'gameReset':
			state.game.status = 'waiting';
			state.game.globalClicks = 0;
			state.game.winner = null;
			app.showView('game');
			break;
	}
}

// API helpers: { ok, body } or { ok: false, error } with the reason, never a throw
async function api(endpoint, options = {}) {
	try {
		const res = await fetch(endpoint, {
			...options,
			headers: { 'Content-Type': 'application/json', ...options.headers },
		});
		const body = await res.json().catch(() => null);

		return res.ok ? { ok: true, body } : { ok: false, error: body?.error || `HTTP ${res.status}` };
	} catch (error) {
		return { ok: false, error: error.message || 'The server could not be reached' };
	}
}

async function loadGames() {
	state.games = null;
	state.gamesError = null;
	app.showView('lobby');

	const result = await api('/api/games');

	if (result.ok) state.games = result.body;
	else state.gamesError = result.error;
	app.showView('lobby');
}

async function createGame() {
	const result = await api('/api/games', { method: 'POST' });

	if (!result.ok) return new Notify({ intent: 'danger', content: `Couldn't create a game: ${result.error}` });
	loadGames();
}

// A refused join comes back as the failed request, which the join dialog shows the reason for
async function joinGame(gameId, playerName) {
	const joined = await POST(`/api/games/${gameId}/join`, { body: { playerName } });

	if (joined.status === 'error') return joined;

	const result = joined.body;

	state.gameId = gameId;
	state.playerId = result.player.id;
	state.playerName = playerName;
	state.game = result.game;
	app.showView('game');
}

async function refreshGame() {
	if (!state.gameId) return;

	// A refresh nobody asked for: a failed one keeps what's showing
	const result = await api(`/api/games/${state.gameId}`);

	if (!result.ok) return;
	state.game = result.body;
	app.showView('game');
}

function leaveGame() {
	send({ type: 'leaveGame', gameId: state.gameId, playerId: state.playerId });
	state.gameId = null;
	state.playerId = null;
	state.game = null;
	if (state.countdownInterval) clearInterval(state.countdownInterval);
	loadGames();
}

// Components
const statusColor = { waiting: colors.green, playing: colors.orange };

class GameCard extends Card {
	constructor(game) {
		super({ accent: statusColor[game.status] ?? colors.gray });

		new Component({ tag: 'h3', textContent: game.name, style: { margin: `0 0 ${space.sm}` }, appendTo: this });
		new Component({
			textContent: `${game.status} · Players: ${game.players.length}`,
			style: { color: `${colors.muted}`, marginBottom: space.sm },
			appendTo: this,
		});

		new Button({
			textContent: game.status === 'waiting' ? 'Join' : 'Watch',
			onPointerPress: () => showJoinDialog(game.id),
			appendTo: this,
		});
	}
}

// What scrolls under a view's bar, in a reading column
const Column = styled(
	Content,
	() => `
		display: flex;
		flex-direction: column;
		gap: ${space.md};
		padding-block: ${space.md};
	`,
);

class LobbyView extends View {
	build() {
		new Toolbar({
			variant: 'bar',
			heading: 'Clicker Game',
			append: [
				new Button({ textContent: 'Create game', onPointerPress: createGame }),
				new Button({ textContent: 'Refresh', variant: 'flat', size: 'small', onPointerPress: loadGames }),
			],
			appendTo: this,
		});

		const list = new Column({ column: 600, appendTo: this });

		if (state.gamesError) {
			new EmptyState({
				icon: 'triangle-exclamation',
				title: "Couldn't load the games",
				message: state.gamesError,
				action: { textContent: 'Try again', onPointerPress: loadGames },
				appendTo: list,
			});
		} else if (!state.games) {
			new EmptyState({ loading: true, appendTo: list });
		} else if (state.games.length === 0) {
			new EmptyState({
				icon: 'computer-mouse',
				title: 'No games yet',
				message: 'Create one, and others can join it.',
				appendTo: list,
			});
		} else {
			state.games.forEach(game => list.append(new GameCard(game)));
		}
	}
}

const Stat = styled(
	Component,
	() => `
		& > :first-child {
			font-size: ${fontSize.xs};
			color: ${colors.muted};
		}

		& > :last-child {
			font-size: ${fontSize.xxl};
			font-weight: bold;
		}
	`,
);

const ClickButton = styled(
	Button,
	() => `
		font-size: ${fontSize.xxl};
		padding: ${space.xl} ${space.xl};
		background-color: ${colors.green};
		align-self: center;
	`,
);

class GameView extends View {
	build() {
		const game = state.game;
		if (!game) return;

		new Toolbar({
			variant: 'bar',
			heading: game.name,
			append: [
				new Button({
					icon: 'arrow-left',
					textContent: 'Leave',
					variant: 'flat',
					addClass: 'start',
					onPointerPress: leaveGame,
				}),
			],
			appendTo: this,
		});

		const body = new Column({ column: 600, style: { textAlign: 'center' }, appendTo: this });

		if (game.status === 'waiting') {
			new Component({ tag: 'p', textContent: `You are: ${state.playerName}`, appendTo: body });
			new Button({
				textContent: 'Start game',
				onPointerPress: () => send({ type: 'startGame', gameId: state.gameId }),
				style: { alignSelf: 'center' },
				appendTo: body,
			});
		}

		if (game.status === 'playing') {
			const statsEl = new Component({
				style: { display: 'flex', justifyContent: 'space-around', margin: `${space.xl} 0` },
				appendTo: body,
			});

			const myClicks = game.players.find(p => p.id === state.playerId)?.clicks || 0;
			const timeValue = new Component({ textContent: '30s' });

			new Stat({ append: [new Component({ textContent: 'Time' }), timeValue], appendTo: statsEl });
			new Stat({
				append: [new Component({ textContent: 'Your clicks' }), new Component({ textContent: String(myClicks) })],
				appendTo: statsEl,
			});
			new Stat({
				append: [new Component({ textContent: 'Total' }), new Component({ textContent: String(game.globalClicks) })],
				appendTo: statsEl,
			});

			new ClickButton({
				textContent: 'Click!',
				onPointerPress: () => send({ type: 'click', gameId: state.gameId, playerId: state.playerId }),
				appendTo: body,
			});

			// Countdown
			if (state.countdownInterval) clearInterval(state.countdownInterval);
			state.countdownInterval = setInterval(() => {
				const remaining = Math.max(0, Math.ceil((game.endTime - Date.now()) / 1000));
				timeValue.options.textContent = `${remaining}s`;
			}, 100);
		}

		if (game.status === 'finished') {
			const winner = game.winner;
			new Component({
				tag: 'h2',
				textContent: winner ? (winner.id === state.playerId ? 'You won!' : `${winner.name} won!`) : 'No winner', // eslint-disable-line no-nested-ternary
				appendTo: body,
			});

			new Component({
				tag: 'p',
				textContent: `Total clicks: ${game.globalClicks}`,
				appendTo: body,
			});

			new Button({
				textContent: 'Play again',
				onPointerPress: () => send({ type: 'resetGame', gameId: state.gameId }),
				style: { alignSelf: 'center' },
				appendTo: body,
			});
		}

		// Players list
		const playersEl = new Component({
			style: { marginTop: space.xl, textAlign: 'left' },
			appendTo: body,
		});
		new SectionLabel({ textContent: 'Players', appendTo: playersEl });

		game.players.forEach(player => {
			const isYou = player.id === state.playerId;
			new Component({
				style: {
					display: 'flex',
					justifyContent: 'space-between',
					padding: space.sm,
					borderBottom: `1px solid ${colors.border}`,
					background: isYou ? `${colors.alpha(colors.green, 0.2)}` : 'transparent',
				},
				append: [
					new Component({ tag: 'span', textContent: player.name + (isYou ? ' (You)' : '') }),
					new Component({ tag: 'span', textContent: String(player.clicks || 0) }),
				],
				appendTo: playersEl,
			});
		});
	}
}

// Join dialog: a refused join shows why inside it, and it stays open
let joinDialog = null;
function showJoinDialog(gameId) {
	joinDialog?.destroy();

	joinDialog = new FormDialog({
		header: 'Join game',
		inputs: [{ key: 'name', label: 'Your name', validate: value => (value ? null : 'Required') }],
		saveLabel: 'Join',
		onSave: ({ name }) => joinGame(gameId, name),
	});
}

// Main app
class ClickerApp extends View {
	showView(view) {
		this.empty();
		if (view === 'lobby') {
			new LobbyView({ appendTo: this });
		} else if (view === 'game') {
			new GameView({ appendTo: this });
		}
	}
}

// Init
const app = new ClickerApp();

new Page({
	appendTo: document.body,
	append: [app],
});

app.showView('lobby');
initSocket();
loadGames();
