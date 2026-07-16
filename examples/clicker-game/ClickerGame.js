/**
 * ClickerGame - Multiplayer clicking competition
 *
 * Demonstrates:
 * - Game state management
 * - Player tracking
 * - Broadcasting updates
 * - Persistence with save/load
 * - Lifecycle hooks
 */
import Game from '../../core/Game.js';

export default class ClickerGame extends Game {
	constructor(options) {
		super(options);

		// Restore from save state or initialize
		this.globalClicks = options.saveState?.globalClicks || 0;
		this.status = options.saveState?.status || 'waiting'; // waiting, playing, finished
		this.startTime = options.saveState?.startTime || null;
		this.endTime = options.saveState?.endTime || null;
		this.duration = options.saveState?.duration || 30; // 30 seconds per game
		this.winner = options.saveState?.winner || null;

		// Initialize player scores from save state
		if (options.saveState?.players) {
			options.saveState.players.forEach(player => {
				if (this.players.has(player.id)) {
					this.players.get(player.id).clicks = player.clicks || 0;
				}
			});
		}
	}

	/**
	 * Serialize game state for clients
	 * @returns {object} Client-safe game state
	 */
	toClient() {
		return {
			...super.toClient(),
			globalClicks: this.globalClicks,
			status: this.status,
			startTime: this.startTime,
			endTime: this.endTime,
			duration: this.duration,
			winner: this.winner,
			// Include player scores
			players: [...this.players.values()].map(p => ({
				id: p.id,
				name: p.name,
				clicks: p.clicks || 0,
			})),
		};
	}

	/**
	 * Serialize game state for persistence
	 * @returns {object} Game state snapshot for saving
	 */
	toSaveState() {
		return {
			...super.toSaveState(),
			globalClicks: this.globalClicks,
			status: this.status,
			startTime: this.startTime,
			endTime: this.endTime,
			duration: this.duration,
			winner: this.winner,
			// Save player scores
			players: [...this.players.values()].map(p => ({
				id: p.id,
				name: p.name,
				clicks: p.clicks || 0,
			})),
		};
	}

	/**
	 * Lifecycle hook - called when player is added
	 * @param {object} player - The player that joined
	 */
	onPlayerAdded(player) {
		// Initialize player score
		player.clicks = 0;

		this.logger.info('Player added', {
			gameId: this.id,
			playerId: player.id,
			playerName: player.name,
			totalPlayers: this.players.size,
		});

		// Broadcast to all players
		this.broadcast('playerJoined', {
			player: {
				id: player.id,
				name: player.name,
				clicks: 0,
			},
		});
	}

	/**
	 * Lifecycle hook - called when player is removed
	 * @param {string} playerId - ID of the player that left
	 */
	onPlayerRemoved(playerId) {
		this.logger.info('Player removed', {
			gameId: this.id,
			playerId,
			totalPlayers: this.players.size,
		});

		this.broadcast('playerLeft', { playerId });

		// If game is playing and all players left, end the game
		if (this.status === 'playing' && this.players.size === 0) {
			this.endGame();
		}
	}

	/**
	 * Start the game
	 * @returns {object} Success flag or error message
	 */
	startGame() {
		if (this.status === 'playing') {
			return { error: 'Game already started' };
		}

		if (this.players.size === 0) {
			return { error: 'Need at least one player' };
		}

		this.status = 'playing';
		this.startTime = Date.now();
		this.endTime = this.startTime + this.duration * 1000;
		this.globalClicks = 0;
		this.winner = null;

		// Reset all player scores
		this.players.forEach(player => {
			player.clicks = 0;
		});

		this.broadcast('gameStarted', {
			startTime: this.startTime,
			endTime: this.endTime,
			duration: this.duration,
		});

		// Auto-end game after duration
		setTimeout(() => {
			if (this.status === 'playing') {
				this.endGame();
			}
		}, this.duration * 1000);

		return { success: true };
	}

	/**
	 * Register a click from a player
	 * @param {string} playerId - ID of the clicking player
	 * @returns {object} Success flag or error message
	 */
	click(playerId) {
		if (this.status !== 'playing') {
			return { error: 'Game not active' };
		}

		const player = this.players.get(playerId);
		if (!player) {
			return { error: 'Player not found' };
		}

		// Increment scores
		player.clicks = (player.clicks || 0) + 1;
		this.globalClicks++;

		// Broadcast update
		this.broadcast('click', {
			playerId,
			playerClicks: player.clicks,
			globalClicks: this.globalClicks,
		});

		return { success: true, clicks: player.clicks };
	}

	/**
	 * End the game and determine winner
	 */
	endGame() {
		if (this.status === 'finished') {
			return;
		}

		this.status = 'finished';
		this.endTime = Date.now();

		// Find winner (player with most clicks)
		let maxClicks = 0;
		let winnerId = null;

		this.players.forEach(player => {
			if ((player.clicks || 0) > maxClicks) {
				maxClicks = player.clicks || 0;
				winnerId = player.id;
			}
		});

		const winnerPlayer = winnerId ? this.players.get(winnerId) : null;

		this.winner = winnerPlayer
			? {
					id: winnerPlayer.id,
					name: winnerPlayer.name,
					clicks: winnerPlayer.clicks,
				}
			: null;

		this.broadcast('gameEnded', {
			winner: this.winner,
			globalClicks: this.globalClicks,
			finalScores: [...this.players.values()].map(p => ({
				id: p.id,
				name: p.name,
				clicks: p.clicks || 0,
			})),
		});

		this.logger.info('Game ended', {
			gameId: this.id,
			winner: this.winner?.name || 'none',
			globalClicks: this.globalClicks,
		});
	}

	/**
	 * Reset game for a new round
	 */
	resetGame() {
		this.status = 'waiting';
		this.startTime = null;
		this.endTime = null;
		this.globalClicks = 0;
		this.winner = null;

		// Reset player scores
		this.players.forEach(player => {
			player.clicks = 0;
		});

		this.broadcast('gameReset', {});
	}
}
