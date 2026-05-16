/**
 * Clicker Game Client
 *
 * Demonstrates client-side framework usage:
 * - WebSocket connection with auto-reconnect
 * - Game state management
 * - Real-time updates
 * - UI state transitions
 */

// State management
const state = {
	currentView: 'lobby', // lobby, game
	gameId: null,
	playerId: null,
	playerName: null,
	gameState: null,
	countdownInterval: null,
};

// WebSocket connection
let socket = null;
// Initialize WebSocket
function initSocket() {
	const wsUrl = `ws://${window.location.host}/ws`;
	socket = new WebSocket(wsUrl);

	socket.addEventListener('open', () => {
		console.log('✅ WebSocket connected');
		updateConnectionStatus('connected');
	});

	socket.addEventListener('message', event => {
		try {
			const data = JSON.parse(event.data);
			handleServerMessage(data);
		} catch (error) {
			console.error('Error parsing message:', error);
		}
	});

	socket.addEventListener('error', error => {
		console.error('❌ WebSocket error:', error);
		updateConnectionStatus('error');
	});

	socket.addEventListener('close', () => {
		console.log('🔌 WebSocket closed');
		updateConnectionStatus('disconnected');

		// Attempt reconnect after 3 seconds
		setTimeout(() => {
			console.log('🔄 Reconnecting...');
			initSocket();
		}, 3000);
	});
}

// Send message to server
function send(data) {
	if (socket && socket.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify(data));
	} else {
		console.error('WebSocket not connected');
	}
}

// Handle messages from server
function handleServerMessage(data) {
	console.log('📨 Server message:', data);

	// Handle errors
	if (data.error) {
		alert(`Error: ${data.error}`);
		return;
	}

	// Handle different update types
	switch (data.update) {
		case 'playerJoined':
			updatePlayersList();
			break;

		case 'playerLeft':
			updatePlayersList();
			break;

		case 'gameStarted':
			handleGameStarted(data);
			break;

		case 'click':
			handleClick(data);
			break;

		case 'gameEnded':
			handleGameEnded(data);
			break;

		case 'gameReset':
			handleGameReset();
			break;
	}
}

// Update connection status indicator
function updateConnectionStatus(status) {
	const statusEl = document.getElementById('connection-status');
	const textEl = statusEl.querySelector('.status-text');

	statusEl.classList.remove('hidden');

	switch (status) {
		case 'connected':
			statusEl.className = 'connection-status connected';
			textEl.textContent = 'Connected';
			setTimeout(() => statusEl.classList.add('hidden'), 2000);
			break;

		case 'disconnected':
			statusEl.className = 'connection-status disconnected';
			textEl.textContent = 'Disconnected';
			break;

		case 'error':
			statusEl.className = 'connection-status error';
			textEl.textContent = 'Connection Error';
			break;
	}
}

// API calls
async function api(endpoint, options = {}) {
	const response = await fetch(endpoint, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			...options.headers,
		},
	});

	const data = await response.json();

	if (!data.success && data.error) {
		throw new Error(data.error);
	}

	return data;
}

// Load games list
async function loadGames() {
	const listEl = document.getElementById('games-list');
	listEl.innerHTML = '<p class="loading">Loading games...</p>';

	try {
		const games = await fetch('/api/games').then(r => r.json());

		if (games.length === 0) {
			listEl.innerHTML = '<p class="empty">No games available. Create one!</p>';
			return;
		}

		listEl.innerHTML = games
			.map(
				game => `
			<div class="game-card">
				<div class="game-card-header">
					<h3>${game.name}</h3>
					<span class="badge badge-${game.status}">${game.status}</span>
				</div>
				<div class="game-card-body">
					<p>Players: ${game.players.length}</p>
					<p>Global Clicks: ${game.globalClicks}</p>
					${game.winner ? `<p>Winner: ${game.winner.name} (${game.winner.clicks} clicks)</p>` : ''}
				</div>
				<div class="game-card-footer">
					<button class="btn btn-primary btn-small" onclick="joinGame('${game.id}')">
						${game.status === 'waiting' ? 'Join' : 'Watch'}
					</button>
				</div>
			</div>
		`,
			)
			.join('');
	} catch (error) {
		console.error('Error loading games:', error);
		listEl.innerHTML = `<p class="error">Failed to load games: ${error.message}</p>`;
	}
}

// Create new game
async function createGame() {
	try {
		const result = await api('/api/games', { method: 'POST' });
		await loadGames();
		alert(`Game created: ${result.game.name}`);
	} catch (error) {
		alert(`Failed to create game: ${error.message}`);
	}
}

// Show join modal
function joinGame(gameId) {
	state.gameId = gameId;
	document.getElementById('join-modal').classList.remove('hidden');
	document.getElementById('player-name-input').focus();
}

// Join game with player name
async function submitJoin(event) {
	event.preventDefault();

	const playerName = document.getElementById('player-name-input').value.trim();
	if (!playerName) return;

	try {
		const result = await api(`/api/games/${state.gameId}/join`, {
			method: 'POST',
			body: JSON.stringify({ playerName }),
		});

		state.playerId = result.player.id;
		state.playerName = playerName;
		state.gameState = result.game;

		// Hide modal and show game view
		document.getElementById('join-modal').classList.add('hidden');
		document.getElementById('player-name-input').value = '';

		showGameView();
	} catch (error) {
		alert(`Failed to join game: ${error.message}`);
	}
}

// Cancel join
function cancelJoin() {
	document.getElementById('join-modal').classList.add('hidden');
	document.getElementById('player-name-input').value = '';
	state.gameId = null;
}

// Show game view
function showGameView() {
	document.getElementById('lobby-view').classList.add('hidden');
	document.getElementById('game-view').classList.remove('hidden');
	state.currentView = 'game';

	// Update UI
	document.getElementById('game-title').textContent = state.gameState.name;
	document.getElementById('player-name-display').textContent = state.playerName;

	updateGameState();
	updatePlayersList();
}

// Show lobby view
function showLobbyView() {
	document.getElementById('game-view').classList.add('hidden');
	document.getElementById('lobby-view').classList.remove('hidden');
	state.currentView = 'lobby';

	// Clear game state
	state.gameId = null;
	state.playerId = null;
	state.playerName = null;
	state.gameState = null;

	if (state.countdownInterval) {
		clearInterval(state.countdownInterval);
		state.countdownInterval = null;
	}

	loadGames();
}

// Update game state UI
async function updateGameState() {
	// Fetch latest game state
	try {
		state.gameState = await fetch(`/api/games/${state.gameId}`).then(r => r.json());
	} catch (error) {
		console.error('Error fetching game state:', error);
		return;
	}

	const status = state.gameState.status;
	document.getElementById('status-badge').textContent = status;
	document.getElementById('status-badge').className = `badge badge-${status}`;

	// Show appropriate state
	document.getElementById('waiting-state').classList.toggle('hidden', status !== 'waiting');
	document.getElementById('playing-state').classList.toggle('hidden', status !== 'playing');
	document.getElementById('finished-state').classList.toggle('hidden', status !== 'finished');

	if (status === 'playing') {
		startCountdown();
	}
}

// Start game
function startGame() {
	send({
		type: 'startGame',
		gameId: state.gameId,
	});
}

// Handle game started event
function handleGameStarted(data) {
	state.gameState.status = 'playing';
	state.gameState.startTime = data.startTime;
	state.gameState.endTime = data.endTime;

	updateGameState();
}

// Start countdown timer
function startCountdown() {
	if (state.countdownInterval) {
		clearInterval(state.countdownInterval);
	}

	const updateTimer = () => {
		const now = Date.now();
		const remaining = Math.max(0, state.gameState.endTime - now);
		const seconds = Math.ceil(remaining / 1000);

		document.getElementById('time-remaining').textContent = `${seconds}s`;

		if (remaining <= 0) {
			clearInterval(state.countdownInterval);
			state.countdownInterval = null;
		}
	};

	updateTimer();
	state.countdownInterval = setInterval(updateTimer, 100);
}

// Click button
function click() {
	send({
		type: 'click',
		gameId: state.gameId,
		playerId: state.playerId,
	});

	// Visual feedback
	const animation = document.getElementById('click-animation');
	animation.classList.add('active');
	setTimeout(() => animation.classList.remove('active'), 100);
}

// Handle click event
function handleClick(data) {
	document.getElementById('global-clicks').textContent = data.globalClicks;

	if (data.playerId === state.playerId) {
		document.getElementById('your-clicks').textContent = data.playerClicks;
	}

	updatePlayersList();
}

// Handle game ended event
function handleGameEnded(data) {
	state.gameState.status = 'finished';
	state.gameState.winner = data.winner;
	state.gameState.globalClicks = data.globalClicks;

	if (state.countdownInterval) {
		clearInterval(state.countdownInterval);
		state.countdownInterval = null;
	}

	updateGameState();

	// Update winner announcement
	const announcement = document.getElementById('winner-announcement');
	if (data.winner) {
		if (data.winner.id === state.playerId) {
			announcement.textContent = '🎉 You Won!';
			announcement.className = 'winner-announcement you-won';
		} else {
			announcement.textContent = `${data.winner.name} Won!`;
			announcement.className = 'winner-announcement';
		}
	} else {
		announcement.textContent = 'No Winner!';
	}

	// Update final stats
	const statsEl = document.getElementById('final-stats');
	statsEl.innerHTML = `
		<div class="final-stat">
			<div class="final-stat-label">Winner</div>
			<div class="final-stat-value">${data.winner ? `${data.winner.name} (${data.winner.clicks} clicks)` : 'None'}</div>
		</div>
		<div class="final-stat">
			<div class="final-stat-label">Total Clicks</div>
			<div class="final-stat-value">${data.globalClicks}</div>
		</div>
		<div class="final-stat">
			<div class="final-stat-label">Your Score</div>
			<div class="final-stat-value">${data.finalScores.find(s => s.id === state.playerId)?.clicks || 0}</div>
		</div>
	`;
}

// Handle game reset
function handleGameReset() {
	state.gameState.status = 'waiting';
	state.gameState.globalClicks = 0;
	state.gameState.winner = null;

	updateGameState();
	updatePlayersList();
}

// Update players list
async function updatePlayersList() {
	try {
		const game = await fetch(`/api/games/${state.gameId}`).then(r => r.json());
		const listEl = document.getElementById('players-list');

		if (game.players.length === 0) {
			listEl.innerHTML = '<p>No players yet</p>';
			return;
		}

		listEl.innerHTML = game.players
			.map(
				player => `
			<div class="player-item ${player.id === state.playerId ? 'you' : ''}">
				<span class="player-name">${player.name}${player.id === state.playerId ? ' (You)' : ''}</span>
				<span class="player-clicks">${player.clicks || 0}</span>
			</div>
		`,
			)
			.join('');
	} catch (error) {
		console.error('Error updating players list:', error);
	}
}

// Leave game
function leaveGame() {
	send({
		type: 'leaveGame',
		gameId: state.gameId,
		playerId: state.playerId,
	});

	showLobbyView();
}

// Reset game
function resetGame() {
	send({
		type: 'resetGame',
		gameId: state.gameId,
	});
}

// Event listeners
document.getElementById('create-game-btn').addEventListener('click', createGame);
document.getElementById('refresh-games-btn').addEventListener('click', loadGames);
document.getElementById('join-form').addEventListener('submit', submitJoin);
document.getElementById('cancel-join-btn').addEventListener('click', cancelJoin);
document.getElementById('start-game-btn').addEventListener('click', startGame);
document.getElementById('click-btn').addEventListener('click', click);
document.getElementById('leave-game-btn').addEventListener('click', leaveGame);
document.getElementById('play-again-btn').addEventListener('click', resetGame);
document.getElementById('back-to-lobby-btn').addEventListener('click', leaveGame);

// Initialize
initSocket();
loadGames();

// Make functions global for inline onclick handlers
window.joinGame = joinGame;
