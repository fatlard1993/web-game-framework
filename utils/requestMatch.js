/**
 * Match HTTP request against a route pattern with URL parameters
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} pattern - Route pattern (e.g., '/games/:id/join')
 * @param {Request} request - Bun Request object
 * @returns {object|false} Object with URL params and query params, or false if no match
 * @example
 * ```js
 * const match = requestMatch('GET', '/games/:id', request);
 * if (match) {
 *   console.log(match.id); // URL parameter
 *   console.log(match.playerId); // Query parameter
 * }
 * ```
 */
const requestMatch = (method, pattern, request) => {
	if (method !== request.method) return false;

	const url = new URL(request.url);
	const path = url.pathname;

	const result = {};

	// Extract query parameters
	for (const [key, value] of url.searchParams.entries()) {
		result[key] = value;
	}

	// Simple exact match (no URL parameters)
	if (!pattern.includes(':')) {
		return path === pattern && result;
	}

	// Build regex for pattern with URL parameters
	const regex = new RegExp(pattern.replaceAll('/', String.raw`\/`).replaceAll(/:[^/]+/g, '([^/]+)'));

	// Extract parameter names from pattern
	const keys = regex
		.exec(pattern)
		?.slice(1)
		?.map(key => key.slice(1));

	// Extract parameter values from path
	const values = regex.exec(path)?.slice(1);

	// Map parameter names to values
	keys?.forEach((key, index) => {
		result[key] = values?.[index] && decodeURI(values[index]);
	});

	return values && result;
};

export default requestMatch;
