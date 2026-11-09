import { GET, POST, DELETE } from '@vanilla-bean/components';
import gameContext from './gameContext.js';
import { forgetSecret, keepSecret, secretOf } from './secrets.js';

/**
 * API helpers for game operations
 *
 * These assume a specific server route structure.
 * Customize or replace based on your server's API.
 */

const apiContext = {
	get gameId() {
		return gameContext.gameId;
	},
	get playerId() {
		return gameContext.playerId;
	},
};

export const getGames = async options => await GET('/games', { apiId: 'games', ...options });

export const getGame = async (id, options) =>
	await GET('/games/:id', { apiId: ['games', id], urlParameters: { id }, ...options });

export const createGame = async options => await POST('/games', { invalidates: ['games'], ...options });

// Joining keeps the secret the server gives the new player in this browser; joining again as them sends it back
export const joinGame = async (id, options = {}) => {
	const rejoining = options.body?.playerId;
	const joined = await POST('/games/:id/join', {
		invalidates: ['games'],
		urlParameters: { id },
		...options,
		body: { ...options.body, ...(rejoining && { secret: secretOf(rejoining) }) },
	});

	keepSecret(joined.body?.id, joined.body?.secret);

	return joined;
};

export const exitGame = async (options = {}) => {
	const { playerId } = apiContext;
	const left = await POST('/games/:gameId/:playerId/exit', {
		invalidates: ['games'],
		urlParameters: apiContext,
		...options,
		fetchOptions: {
			...options.fetchOptions,
			headers: {
				...options.fetchOptions?.headers,
				...(secretOf(playerId) && { 'x-player-secret': secretOf(playerId) }),
			},
		},
	});

	if (left.response?.ok) forgetSecret(playerId);

	return left;
};

export const deleteGame = async (id, options) =>
	await DELETE('/games/:id', { invalidates: ['games'], urlParameters: { id }, ...options });
