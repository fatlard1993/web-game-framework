import { Game as BaseGame, refuse } from '@fatlard1993/web-game-framework';

import { TICK_MS, addPlayer, newState, step } from './rules.js';

// One running game, on the server. Its rules are in rules.js, shared with the page; this is what runs them: the loop
// that moves the game on, what a player can do (`actions`), and what each page is sent (`viewFor`, by publish()).
export default class Game extends BaseGame {
	// A save from an older shape of `state` is brought up to date before the constructor reads it: when `state` changes
	// shape, raise `version` and add a migration, { [version]: save => { ...change save.state in place } }
	static version = 1;
	static migrations = {};
	// What's never saved: where each player is heading lasts only while they hold a key
	static transient = ['headings', 'caught'];

	constructor(options) {
		super(options);

		// Back from the save file after a restart, or new
		this.state = options.saveState?.state ?? newState();
		this.state.headings = {};
		this.state.caught = [];
		for (const id of this.players.keys()) addPlayer(this.state, id);

		// The loop: stopped by itself when the game is deleted
		this.every(TICK_MS, () => this.tick());
	}

	// What a player can do, from their page: act('steer', { x, y }). Each runs as the page's own player, and the game is
	// published after; refuse('why') turns one down and their page is told why.
	actions = {
		steer(player, { x, y } = {}) {
			if (!Number.isFinite(x) || !Number.isFinite(y)) refuse('Steer with a direction');

			const length = Math.hypot(x, y);

			this.state.headings[player.id] = length > 1 ? { x: x / length, y: y / length } : { x, y };
		},
	};

	tick() {
		const { moved, caught } = step(this.state, this.state.headings, TICK_MS / 1000);

		this.state.caught = caught;
		if (moved || caught.length) this.publish();
	}

	// What each page is sent: the same for everyone in this game (override it per player for a game with secrets, like
	// a hand of cards), with who's playing and whether they're here
	viewFor() {
		return { state: this.savedState(), caught: this.state.caught, players: this.toClient().players };
	}

	toClient() {
		return { ...super.toClient(), state: this.savedState() };
	}

	// What survives a restart (data/games.json)
	toSaveState() {
		return { ...super.toSaveState(), state: this.savedState() };
	}

	onPlayerAdded(player) {
		addPlayer(this.state, player.id);
		this.publish();
	}

	// A player's page closed: they stop where they are, and stay off the field until they're back
	onPresence(id, online) {
		if (!online) delete this.state.headings[id];
		this.publish();
	}

	onPlayerRemoved(id) {
		delete this.state.spots[id];
		delete this.state.scores[id];
		delete this.state.headings[id];
		this.publish();
	}
}
