// Each player's secret, as the server gave it when they joined: kept in this browser, and what speaks for that player
// (presence, actions, joining again, leaving). Without one (a player from before secrets), nothing is sent.
const KEY = 'wgf.secret.';

const storage = () => (typeof localStorage === 'undefined' ? null : localStorage);

export const secretOf = playerId => (playerId && storage()?.getItem(`${KEY}${playerId}`)) || undefined;

export const keepSecret = (playerId, secret) => {
	if (playerId && secret) storage()?.setItem(`${KEY}${playerId}`, secret);
};

export const forgetSecret = playerId => playerId && storage()?.removeItem(`${KEY}${playerId}`);
