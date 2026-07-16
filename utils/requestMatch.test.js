import requestMatch from './requestMatch.js';

const request = (method, path) => ({ method, url: `http://localhost${path}` });

describe('requestMatch', () => {
	test('returns false when the method differs', () => {
		expect(requestMatch('POST', '/games', request('GET', '/games'))).toBe(false);
	});

	test('matches an exact path', () => {
		expect(requestMatch('GET', '/games', request('GET', '/games'))).toEqual({});
	});

	test('rejects a different path', () => {
		expect(requestMatch('GET', '/games', request('GET', '/players'))).toBeFalsy();
	});

	test('collects query parameters', () => {
		expect(requestMatch('GET', '/games', request('GET', '/games?watch=true'))).toEqual({ watch: 'true' });
	});

	test('extracts named path parameters', () => {
		expect(requestMatch('GET', '/games/:gameId', request('GET', '/games/alpha'))).toEqual({ gameId: 'alpha' });
	});

	test('extracts multiple named parameters', () => {
		expect(
			requestMatch('DELETE', '/games/:gameId/players/:playerId', request('DELETE', '/games/alpha/players/bravo')),
		).toEqual({
			gameId: 'alpha',
			playerId: 'bravo',
		});
	});

	test('rejects a path missing a parameter segment', () => {
		expect(requestMatch('GET', '/games/:gameId/players/:playerId', request('GET', '/games/alpha'))).toBeFalsy();
	});

	test('decodes encoded parameter values', () => {
		expect(requestMatch('GET', '/games/:gameId', request('GET', '/games/a%20b'))).toEqual({ gameId: 'a b' });
	});
});
