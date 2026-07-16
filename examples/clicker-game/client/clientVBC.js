/**
 * Clicker Game - VBC Client
 * Minimal implementation using @vanilla-bean/components
 */
import { Component, Button, Input, Dialog, Page } from '@vanilla-bean/components';

// App state
const state = {
	view: 'lobby', // lobby | game
	gameId: null,
	playerId: null,
	playerName: null,
	game: null,
	games: [],
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
	if (data.error) return alert(data.error);

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

// API helpers
async function api(endpoint, options = {}) {
	const res = await fetch(endpoint, {
		...options,
		headers: { 'Content-Type': 'application/json', ...options.headers },
	});
	return res.json();
}

async function loadGames() {
	state.games = await api('/api/games');
	app.showView('lobby');
}

async function createGame() {
	await api('/api/games', { method: 'POST' });
	loadGames();
}

async function joinGame(gameId, playerName) {
	const result = await api(`/api/games/${gameId}/join`, {
		method: 'POST',
		body: JSON.stringify({ playerName }),
	});
	state.gameId = gameId;
	state.playerId = result.player.id;
	state.playerName = playerName;
	state.game = result.game;
	app.showView('game');
}

async function refreshGame() {
	if (state.gameId) {
		state.game = await api(`/api/games/${state.gameId}`);
		app.showView('game');
	}
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
class GameCard extends Component {
	constructor(game) {
		super({
			style: {
				padding: '1rem',
				border: '1px solid #333',
				borderRadius: '8px',
				margin: '0.5rem 0',
			},
		});

		new Component({ tag: 'h3', textContent: game.name, style: { margin: '0 0 0.5rem' }, appendTo: this });
		new Component({
			style: {
				display: 'inline-block',
				padding: '2px 8px',
				borderRadius: '4px',
				fontSize: '0.8rem',
				background: game.status === 'waiting' ? '#4a5' : game.status === 'playing' ? '#fa0' : '#888', // eslint-disable-line no-nested-ternary
				color: 'white',
			},
			textContent: game.status,
			appendTo: this,
		});
		new Component({ tag: 'p', textContent: `Players: ${game.players.length}`, appendTo: this });

		new Button({
			textContent: game.status === 'waiting' ? 'Join' : 'Watch',
			onPointerUp: () => showJoinDialog(game.id),
			appendTo: this,
		});
	}
}

class LobbyView extends Component {
	constructor() {
		super({
			style: {
				padding: '2rem',
				maxWidth: '600px',
				margin: '0 auto',
			},
		});
	}

	render() {
		this.empty();

		new Component({ tag: 'h1', textContent: 'Clicker Game', style: { textAlign: 'center' }, appendTo: this });

		new Component({
			style: { display: 'flex', gap: '1rem', margin: '1rem 0' },
			append: [
				new Button({ textContent: 'Create Game', onPointerUp: createGame }),
				new Button({ textContent: 'Refresh', onPointerUp: loadGames }),
			],
			appendTo: this,
		});

		const list = new Component({ appendTo: this });

		if (state.games.length === 0) {
			new Component({ tag: 'p', textContent: 'No games. Create one!', appendTo: list });
		} else {
			state.games.forEach(game => (new GameCard(game).options.appendTo = list));
		}
	}
}

class GameView extends Component {
	constructor() {
		super({
			style: {
				padding: '2rem',
				maxWidth: '600px',
				margin: '0 auto',
				textAlign: 'center',
			},
		});
	}

	render() {
		this.empty();
		const game = state.game;
		if (!game) return;

		// Header
		new Component({
			append: [
				new Component({ tag: 'h2', textContent: game.name }),
				new Button({ textContent: 'Leave', onPointerUp: leaveGame }),
			],
			appendTo: this,
		});

		if (game.status === 'waiting') {
			new Component({ tag: 'p', textContent: `You are: ${state.playerName}`, appendTo: this });
			new Button({
				textContent: 'Start Game',
				onPointerUp: () => send({ type: 'startGame', gameId: state.gameId }),
				appendTo: this,
			});
		}

		if (game.status === 'playing') {
			const statsEl = new Component({
				style: { display: 'flex', justifyContent: 'space-around', margin: '2rem 0' },
				appendTo: this,
			});

			const statValueStyle = { fontSize: '2rem', fontWeight: 'bold' };

			const timeEl = new Component({
				append: [
					new Component({ textContent: 'Time', style: { fontSize: '0.8rem' } }),
					new Component({ style: statValueStyle, textContent: '30s' }),
				],
				appendTo: statsEl,
			});

			const myClicks = game.players.find(p => p.id === state.playerId)?.clicks || 0;
			new Component({
				append: [
					new Component({ textContent: 'Your Clicks', style: { fontSize: '0.8rem' } }),
					new Component({ style: statValueStyle, textContent: String(myClicks) }),
				],
				appendTo: statsEl,
			});

			new Component({
				append: [
					new Component({ textContent: 'Total', style: { fontSize: '0.8rem' } }),
					new Component({ style: statValueStyle, textContent: String(game.globalClicks) }),
				],
				appendTo: statsEl,
			});

			new Component({
				tag: 'button',
				style: {
					fontSize: '2rem',
					padding: '2rem 4rem',
					cursor: 'pointer',
					background: '#4a5',
					border: 'none',
					borderRadius: '12px',
					color: 'white',
				},
				textContent: 'CLICK!',
				onPointerUp: () => send({ type: 'click', gameId: state.gameId, playerId: state.playerId }),
				appendTo: this,
			});

			// Countdown
			if (state.countdownInterval) clearInterval(state.countdownInterval);
			state.countdownInterval = setInterval(() => {
				const remaining = Math.max(0, Math.ceil((game.endTime - Date.now()) / 1000));
				const valueEl = timeEl.elem.querySelector('div:last-child');
				if (valueEl) valueEl.textContent = `${remaining}s`;
			}, 100);
		}

		if (game.status === 'finished') {
			const winner = game.winner;
			new Component({
				style: { fontSize: '3rem', margin: '2rem 0' },
				textContent: winner ? (winner.id === state.playerId ? 'You Won!' : `${winner.name} Won!`) : 'No Winner', // eslint-disable-line no-nested-ternary
				appendTo: this,
			});

			new Component({
				tag: 'p',
				textContent: `Total clicks: ${game.globalClicks}`,
				appendTo: this,
			});

			new Button({
				textContent: 'Play Again',
				onPointerUp: () => send({ type: 'resetGame', gameId: state.gameId }),
				appendTo: this,
			});
		}

		// Players list
		const playersEl = new Component({
			style: { marginTop: '2rem', textAlign: 'left' },
			appendTo: this,
		});
		new Component({ tag: 'h3', textContent: 'Players', appendTo: playersEl });

		game.players.forEach(player => {
			const isYou = player.id === state.playerId;
			new Component({
				style: {
					display: 'flex',
					justifyContent: 'space-between',
					padding: '0.5rem',
					borderBottom: '1px solid #333',
					background: isYou ? 'rgba(74, 170, 85, 0.2)' : 'transparent',
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

// Join dialog
let joinDialog = null;
function showJoinDialog(gameId) {
	if (joinDialog) joinDialog.elem.remove();

	let nameInput;
	joinDialog = new Dialog({
		title: 'Join Game',
		append: [
			(nameInput = new Input({
				placeholder: 'Your name',
				onKeydown: e => {
					if (e.key === 'Enter' && nameInput.elem.value) {
						joinGame(gameId, nameInput.elem.value);
						joinDialog.close();
					}
				},
			})),
			new Button({
				textContent: 'Join',
				onPointerUp: () => {
					if (nameInput.elem.value) {
						joinGame(gameId, nameInput.elem.value);
						joinDialog.close();
					}
				},
			}),
		],
		appendTo: document.body,
	});

	joinDialog.open();
	setTimeout(() => nameInput.elem.focus(), 100);
}

// Main app
class ClickerApp extends Component {
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
