/**
 * Event-based message routing system with validation and middleware support
 *
 * Features:
 * - Type-safe event definitions with validation schemas
 * - Middleware pipeline (validation, throttling, transformation)
 * - Automatic client/server message routing
 * - Event namespacing
 * - Wildcard listeners
 * @example Server-side
 * ```js
 * const router = game.createEventRouter();
 *
 * router.defineEvent('player:move', {
 *   validate: (data) => typeof data.position === 'object',
 *   throttle: 50
 * });
 *
 * router.on('player:move', (data, context) => {
 *   game.movePlayer(data.playerId, data.position);
 * });
 * ```
 * @example Client-side
 * ```js
 * const router = createEventRouter(gameContext);
 *
 * router.on('playerMoved', (data) => {
 *   updatePlayerPosition(data.playerId, data.position);
 * });
 * ```
 */
export default class EventRouter {
	/**
	 * @param {object} options - Router configuration
	 * @param {object} [options.context] - Context object (game, server, etc.)
	 * @param {object} [options.logger] - Optional logger
	 * @param {Function} [options.emitFn] - Custom emit function for sending events
	 */
	constructor({ context, logger, emitFn } = {}) {
		this.context = context;
		this.logger = logger || console;
		this.emitFn = emitFn;

		// Event handlers: Map<eventName, Set<handler>>
		this.handlers = new Map();

		// Event definitions: Map<eventName, config>
		this.eventDefinitions = new Map();

		// Middleware: Array<function>
		this.middleware = [];

		// Throttle timers: Map<eventName+handlerId, timeoutId>
		this.throttleTimers = new Map();
	}

	/**
	 * Define an event with validation and middleware
	 * @param {string} eventName - Event name (supports wildcards: 'player:*')
	 * @param {object} config - Event configuration
	 * @param {Function} [config.validate] - Validation function
	 * @param {number} [config.throttle] - Throttle delay in ms
	 * @param {Function} [config.transform] - Data transformation function
	 * @param {object} [config.schema] - JSON schema for validation
	 */
	defineEvent(eventName, config = {}) {
		this.eventDefinitions.set(eventName, {
			validate: config.validate,
			throttle: config.throttle,
			transform: config.transform,
			schema: config.schema,
		});

		this.logger.debug?.(`[EventRouter] Defined event: ${eventName}`, config);
	}

	/**
	 * Register middleware that runs before all handlers
	 * @param {Function} fn - Middleware function (data, context, next)
	 */
	use(fn) {
		this.middleware.push(fn);
	}

	/**
	 * Register an event handler
	 * @param {string} eventName - Event name (supports wildcards: 'player:*')
	 * @param {Function} handler - Handler function (data, context)
	 * @returns {Function} Cleanup function to remove handler
	 */
	on(eventName, handler) {
		if (!this.handlers.has(eventName)) {
			this.handlers.set(eventName, new Set());
		}

		this.handlers.get(eventName).add(handler);

		// Return cleanup function
		return () => {
			this.off(eventName, handler);
		};
	}

	/**
	 * Register a one-time event handler
	 * @param {string} eventName - Event name
	 * @param {Function} handler - Handler function
	 * @returns {Function} Cleanup function
	 */
	once(eventName, handler) {
		const wrappedHandler = (data, context) => {
			handler(data, context);
			this.off(eventName, wrappedHandler);
		};

		return this.on(eventName, wrappedHandler);
	}

	/**
	 * Remove an event handler
	 * @param {string} eventName - Event name
	 * @param {Function} handler - Handler to remove
	 */
	off(eventName, handler) {
		const handlers = this.handlers.get(eventName);
		if (handlers) {
			handlers.delete(handler);
			if (handlers.size === 0) {
				this.handlers.delete(eventName);
			}
		}
	}

	/**
	 * Remove all handlers for an event (or all events if no name provided)
	 * @param {string} [eventName] - Optional event name
	 */
	removeAllListeners(eventName) {
		if (eventName) {
			this.handlers.delete(eventName);
		} else {
			this.handlers.clear();
		}
	}

	/**
	 * Emit an event to all registered handlers
	 * @param {string} eventName - Event name
	 * @param {object} data - Event data
	 * @param {object} [context] - Additional context
	 * @returns {Promise<boolean>} Whether event was handled
	 */
	async emit(eventName, data, context = {}) {
		// Get event definition
		const eventDefinition = this.eventDefinitions.get(eventName);

		// Validate if defined
		if (eventDefinition?.validate) {
			try {
				const isValid = await eventDefinition.validate(data);
				if (!isValid) {
					this.logger.warn?.(`[EventRouter] Validation failed for event: ${eventName}`, data);
					return false;
				}
			} catch (error) {
				this.logger.error?.(`[EventRouter] Validation error for event: ${eventName}`, error);
				return false;
			}
		}

		// Transform data if defined
		let transformedData = data;
		if (eventDefinition?.transform) {
			try {
				transformedData = await eventDefinition.transform(data);
			} catch (error) {
				this.logger.error?.(`[EventRouter] Transform error for event: ${eventName}`, error);
				return false;
			}
		}

		// Build context
		const eventContext = {
			...context,
			eventName,
			router: this,
			context: this.context,
		};

		// Run middleware pipeline
		let middlewareIndex = 0;
		const runMiddleware = async () => {
			if (middlewareIndex >= this.middleware.length) {
				return true; // All middleware passed
			}

			const middleware = this.middleware[middlewareIndex++];
			try {
				const result = await middleware(transformedData, eventContext, runMiddleware);
				// If middleware returns false, stop propagation
				return result !== false;
			} catch (error) {
				this.logger.error?.(`[EventRouter] Middleware error for event: ${eventName}`, error);
				return false;
			}
		};

		const shouldContinue = await runMiddleware();
		if (!shouldContinue) {
			return false;
		}

		// Find all matching handlers (including wildcards)
		const matchingHandlers = this._getMatchingHandlers(eventName);

		if (matchingHandlers.size === 0) {
			this.logger.debug?.(`[EventRouter] No handlers for event: ${eventName}`);
			return false;
		}

		// Execute all handlers
		const promises = [];
		for (const handler of matchingHandlers) {
			// Apply throttling if defined
			if (eventDefinition?.throttle) {
				const throttleKey = `${eventName}:${handler.toString()}`;
				if (this.throttleTimers.has(throttleKey)) {
					continue; // Skip throttled
				}

				this.throttleTimers.set(
					throttleKey,
					setTimeout(() => {
						this.throttleTimers.delete(throttleKey);
					}, eventDefinition.throttle),
				);
			}

			promises.push(
				(async () => {
					try {
						await handler(transformedData, eventContext);
					} catch (error) {
						this.logger.error?.(`[EventRouter] Handler error for event: ${eventName}`, error);
					}
				})(),
			);
		}

		await Promise.all(promises);
		return true;
	}

	/**
	 * Get all handlers that match an event name (including wildcards)
	 * @private
	 * @param {string} eventName - Event name
	 * @returns {Set<Function>} Matching handlers
	 */
	_getMatchingHandlers(eventName) {
		const matching = new Set();

		// Exact match
		const exactHandlers = this.handlers.get(eventName);
		if (exactHandlers) {
			exactHandlers.forEach(h => matching.add(h));
		}

		// Wildcard matches
		for (const [pattern, handlers] of this.handlers.entries()) {
			if (pattern.includes('*') && this._matchesPattern(eventName, pattern)) {
				handlers.forEach(h => matching.add(h));
			}
		}

		return matching;
	}

	/**
	 * Check if event name matches a wildcard pattern
	 * @private
	 * @param {string} eventName - Event name to test
	 * @param {string} pattern - Pattern with wildcards
	 * @returns {boolean} Whether it matches
	 */
	_matchesPattern(eventName, pattern) {
		// Convert pattern to regex
		const regexPattern = pattern
			.split('*')
			.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
			.join('.*');

		const regex = new RegExp(`^${regexPattern}$`);
		return regex.test(eventName);
	}

	/**
	 * List all registered event names
	 * @returns {Array<string>} Event names
	 */
	listEvents() {
		return Array.from(this.handlers.keys());
	}

	/**
	 * Get handler count for an event
	 * @param {string} eventName - Event name
	 * @returns {number} Handler count
	 */
	listenerCount(eventName) {
		const handlers = this.handlers.get(eventName);
		return handlers ? handlers.size : 0;
	}
}
