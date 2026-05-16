/**
 * Graceful exit handler for Bun servers
 *
 * Handles SIGINT (Ctrl+C) and uncaught exceptions with proper logging
 * @example
 * ```js
 * // In your server entry point:
 * import '@fatlard1993/web-game-framework/utils/exit';
 * ```
 */

process.on('SIGINT', () => {
	console.log('[server] Clean exit - SIGINT received');
	process.exit(130);
});

process.on('uncaughtException', error => {
	console.error('[server] Uncaught exception:', error.message);
	console.error(error.stack);
	process.exit(99);
});
