/* eslint-disable no-console */
import { Notify } from '@vanilla-bean/components';
import { connectSocket } from '@vanilla-bean/components/utils';

/**
 * WebSocket wrapper with automatic reconnection and listener management
 *
 * Features:
 * - Reconnection for as long as the page is open, backing off to every 10s, and at once when it's back in view
 * - One notice when the connection is lost, and one when it's restored
 * - Message listener tracking (survives reconnections)
 * @example
 * ```js
 * import socket, { onMessage } from '@fatlard1993/web-game-framework/client/socket';
 *
 * const cleanup = onMessage(data => {
 *   console.log('Received:', data);
 * });
 *
 * // Later: cleanup() to remove listener
 * ```
 */

let lost = null;

const notify = options => {
	if (typeof Notify === 'undefined') return;

	return new Notify({ x: window.innerWidth / 2, y: 100, ...options });
};

const socket = connectSocket('/ws', {
	onLost: () => {
		lost = notify({ type: 'warning', content: 'Connection lost. Reconnecting...', timeout: 0 });
	},
	onRestored: () => {
		if (lost?.elem?.isConnected) lost.destroy();
		lost = null;
		notify({ type: 'success', content: 'Connection restored.', timeout: 2000 });
	},
});

socket.addEventListener('error', error => console.error('WebSocket error:', error));
socket.addEventListener('close', event => console.error('WebSocket closed:', event));

/**
 * Register a message listener
 * @param {Function} callback - Called with parsed JSON data
 * @returns {Function} Cleanup function to remove listener
 */
export const onMessage = callback => {
	const listener = event => {
		try {
			callback(JSON.parse(event.data));
		} catch (error) {
			if (process.env.NODE_ENV === 'development') {
				console.error('Error handling message:', error, event);
			}
		}
	};

	socket.addEventListener('message', listener);

	return () => socket.removeEventListener('message', listener);
};

/**
 * Socket wrapper with getters for current socket instance
 * This ensures code always references the latest socket after reconnection
 */
export default {
	get readyState() {
		return socket.readyState;
	},
	get CONNECTING() {
		return WebSocket.CONNECTING;
	},
	get OPEN() {
		return WebSocket.OPEN;
	},
	get CLOSING() {
		return WebSocket.CLOSING;
	},
	get CLOSED() {
		return WebSocket.CLOSED;
	},
	addEventListener: socket.addEventListener,
	removeEventListener: socket.removeEventListener,
	send: socket.send,
	close: socket.close,
};
