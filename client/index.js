/**
 * Client-side modules
 */
export { default as socket, onMessage } from './socket.js';
export { default as gameContext } from './gameContext.js';
export * from './api.js';
export {
	default as createClientEventRouter,
	createValidationMiddleware,
	createLoggingMiddleware,
	createThrottleMiddleware,
} from './eventRouter.js';
