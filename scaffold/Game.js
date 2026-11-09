import { Game as BaseGame } from '@fatlard1993/web-game-framework';

// One running game, on the server. `state` is what's true for everyone in it; every change to it is broadcast, and the
// players' pages redraw from what arrives (client/Play.js) rather than from what they did. Change `state`, `receive`
// and Play together: they are the three ends of one wire.
export default class Game extends BaseGame {
	constructor(options) {
		super(options);

		// Back from the save file after a restart, or new
		this.state = options.saveState?.state ?? { taps: {} };
	}

	// What a player's page gets when it asks for the game
	toClient() {
		return { ...super.toClient(), state: this.state };
	}

	// What survives a restart (data/games.json)
	toSaveState() {
		return { ...super.toSaveState(), state: this.state };
	}

	// The whole picture to every page: the state and who's playing, each with whether they're here (a page open on the
	// game) or have left (their place and taps kept for when they're back)
	announce() {
		this.broadcast('state', { state: this.state, players: super.toClient().players });
	}

	// Something a player did, from their page: { gameId, playerId, type, ...whatever the type carries }
	receive({ type, playerId }) {
		if (!this.players.has(playerId)) return;

		if (type === 'tap') this.state.taps[playerId] = (this.state.taps[playerId] ?? 0) + 1;

		this.announce();
	}

	onPlayerAdded() {
		this.announce();
	}

	// A player's page opened, or their last one closed
	onPresence() {
		this.announce();
	}

	onPlayerRemoved(playerId) {
		delete this.state.taps[playerId];
		this.announce();
	}
}
