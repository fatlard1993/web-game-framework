// A game's sound, one way for every game: effects that can overlap (each played from a small pool), music that loops
// and crossfades from one track to the next, volume for each and a mute kept in this browser, and nothing lost to the
// browser's rule that sound waits for a first tap: what was asked for before it plays once the page is touched.

const SETTINGS = 'wgf.sound';
const POOL = 4;
const FADE_MS = 800;
const FADE_STEP_MS = 40;

const loadSettings = () => {
	try {
		return { effects: 0.8, music: 0.4, muted: false, ...JSON.parse(localStorage.getItem(SETTINGS) ?? '{}') };
	} catch {
		return { effects: 0.8, music: 0.4, muted: false };
	}
};

/**
 * The sound for a game. `effects` and `music` map names to the files' addresses (an imported mp3 gives its address).
 * @example
 * import coin from './sounds/coin.mp3';
 * import level from './sounds/level.mp3';
 * const sound = createSound({ effects: { coin }, music: { level } });
 * sound.music('level');
 * sound.play('coin');
 * @param {object} [options] - Options
 * @param {object} [options.effects] - { [name]: address }
 * @param {object} [options.music] - { [name]: address }
 * @returns {object} play, music, setVolume, toggleMute, settings, onChange, destroy
 */
export const createSound = ({ effects = {}, music = {} } = {}) => {
	const settings = loadSettings();
	const pools = {};
	const listeners = new Set();
	let unlocked = false;
	let pending = [];
	let track = null;
	let trackName = null;

	const save = () => {
		try {
			localStorage.setItem(SETTINGS, JSON.stringify(settings));
		} catch {
			// Not kept this time
		}
		for (const listener of listeners) listener({ ...settings });
	};

	const level = kind => (settings.muted ? 0 : settings[kind]);

	const poolOf = name => {
		if (!effects[name]) return null;
		pools[name] ??= { at: 0, players: Array.from({ length: POOL }, () => new Audio(effects[name])) };

		return pools[name];
	};

	// Played now when sound may play, or kept for the first tap
	const whenUnlocked = run => (unlocked ? run() : pending.push(run));

	const unlock = () => {
		if (unlocked) return;
		unlocked = true;
		for (const run of pending.splice(0)) run();
	};

	for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, unlock, { once: true, capture: true });

	const fade = (audio, from, to, then) => {
		const steps = Math.max(1, Math.round(FADE_MS / FADE_STEP_MS));
		let step = 0;

		audio.volume = from;

		const timer = setInterval(() => {
			step++;
			audio.volume = Math.min(1, Math.max(0, from + ((to - from) * step) / steps));
			if (step >= steps) {
				clearInterval(timer);
				then?.();
			}
		}, FADE_STEP_MS);
	};

	return {
		/**
		 * Plays an effect, overlapping itself up to a few at once
		 * @param {string} name - The effect
		 * @param {object} [options] - { volume } from 0 to 1, times the effects volume
		 */
		play: (name, { volume = 1 } = {}) => {
			const pool = poolOf(name);

			if (!pool || !level('effects')) return;
			whenUnlocked(() => {
				const player = pool.players[pool.at++ % POOL];

				player.currentTime = 0;
				player.volume = Math.min(1, volume * level('effects'));
				player.play().catch(() => {});
			});
		},

		/**
		 * Loops a music track, crossfading from the one playing; the same track again carries on, and null fades out
		 * @param {string|null} name - The track, or null for none
		 */
		music: name => {
			if (name === trackName) return;
			trackName = name;

			const leaving = track;

			track = null;
			if (leaving) fade(leaving, leaving.volume, 0, () => leaving.pause());
			if (!name || !music[name]) return;

			const coming = new Audio(music[name]);

			coming.loop = true;
			track = coming;
			whenUnlocked(() => {
				if (track !== coming) return;
				coming.volume = 0;
				coming.play().catch(() => {});
				fade(coming, 0, level('music'));
			});
		},

		/**
		 * Sets the volume of effects or music, from 0 to 1, kept in this browser
		 * @param {'effects'|'music'} kind - Which
		 * @param {number} value - How loud
		 */
		setVolume: (kind, value) => {
			settings[kind] = Math.min(1, Math.max(0, Number(value) || 0));
			if (kind === 'music' && track) track.volume = level('music');
			save();
		},

		/** Mutes everything, or lets it play again, kept in this browser; returns whether it's muted now */
		toggleMute: () => {
			settings.muted = !settings.muted;
			if (track) track.volume = level('music');
			save();

			return settings.muted;
		},

		/** The current volumes and mute */
		get settings() {
			return { ...settings };
		},

		/** Hears each change to the settings; returns how to stop hearing */
		onChange: listener => {
			listeners.add(listener);

			return () => listeners.delete(listener);
		},

		/** Stops the music and lets go of everything */
		destroy: () => {
			track?.pause();
			track = null;
			trackName = null;
			pending = [];
			listeners.clear();
			window.removeEventListener('pointerdown', unlock, { capture: true });
			window.removeEventListener('keydown', unlock, { capture: true });
		},
	};
};
