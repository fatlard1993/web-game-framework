import EventRouter from '../core/EventRouter.js';
import { onMessage } from './socket.js';

/**
 * Create a client-side event router that listens to WebSocket messages
 *
 * Automatically routes incoming socket messages to registered handlers
 * based on the `update` field in the message.
 * @example
 * ```js
 * const router = createClientEventRouter({ gameId: 'abc123' });
 *
 * router.on('playerMoved', (data) => {
 *   console.log('Player moved:', data.playerId, data.position);
 * });
 *
 * router.on('player:*', (data, { eventName }) => {
 *   console.log('Player event:', eventName, data);
 * });
 * ```
 * @param {object} options
 * @param {string} [options.gameId] - Filter messages by game ID
 * @param {object} [options.context] - Context object (e.g., gameContext)
 * @param {object} [options.logger] - Optional logger
 * @returns {EventRouter} Configured event router with socket listener
 */
export function createClientEventRouter({ gameId, context, logger } = {}) {
	const router = new EventRouter({ context, logger });

	// Setup socket message listener
	const cleanup = onMessage(async data => {
		// Filter by game ID if provided
		if (gameId && data.id !== gameId) {
			return;
		}

		// Extract event name from `update` field
		const eventName = data.update;
		if (!eventName) {
			logger?.warn?.('[EventRouter] Message missing "update" field', data);
			return;
		}

		// Emit to router
		await router.emit(eventName, data, { raw: data });
	});

	// Store cleanup function on router
	router.destroy = () => {
		cleanup();
		router.removeAllListeners();
	};

	return router;
}

/**
 * Create validation middleware for common patterns
 * @param {object} options
 * @param {boolean} [options.requirePlayerId] - Require playerId field
 * @param {boolean} [options.requirePosition] - Require position {x, y} field
 * @param {Array<string>} [options.requiredFields] - Additional required fields
 * @returns {Function} Middleware function
 */
export function createValidationMiddleware(options = {}) {
	return (data, context, next) => {
		// Check required fields
		if (options.requiredFields) {
			for (const field of options.requiredFields) {
				if (data[field] === undefined) {
					context.router.logger.warn?.(`[EventRouter] Missing required field: ${field}`, {
						event: context.eventName,
						data,
					});
					return false;
				}
			}
		}

		// Check playerId
		if (options.requirePlayerId && typeof data.playerId !== 'string') {
			context.router.logger.warn?.('[EventRouter] Invalid or missing playerId', { event: context.eventName, data });
			return false;
		}

		// Check position
		if (options.requirePosition) {
			const pos = data.position;
			if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') {
				context.router.logger.warn?.('[EventRouter] Invalid or missing position', { event: context.eventName, data });
				return false;
			}
		}

		return next();
	};
}

/**
 * Create logging middleware
 * @param {object} options
 * @param {Array<string>} [options.include] - Only log these events
 * @param {Array<string>} [options.exclude] - Don't log these events
 * @param {Function} [options.filter] - Custom filter function
 * @returns {Function} Middleware function
 */
export function createLoggingMiddleware(options = {}) {
	return (data, context, next) => {
		// Check filters
		if (options.include && !options.include.includes(context.eventName)) {
			return next();
		}

		if (options.exclude && options.exclude.includes(context.eventName)) {
			return next();
		}

		if (options.filter && !options.filter(context.eventName, data)) {
			return next();
		}

		// Log the event
		console.log(`[Event] ${context.eventName}`, data);

		return next();
	};
}

/**
 * Create throttling middleware
 * @param {number} delay - Throttle delay in ms
 * @param {Function} [keyFn] - Function to generate throttle key (default: eventName)
 * @returns {Function} Middleware function
 */
export function createThrottleMiddleware(delay, keyFn) {
	const timers = new Map();

	return (data, context, next) => {
		const key = keyFn ? keyFn(data, context) : context.eventName;

		if (timers.has(key)) {
			// Throttled
			return false;
		}

		timers.set(
			key,
			setTimeout(() => {
				timers.delete(key);
			}, delay),
		);

		return next();
	};
}

export default createClientEventRouter;
