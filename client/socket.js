/* eslint-disable no-console */
import { debounce, Notify } from '@vanilla-bean/components';

/**
 * WebSocket wrapper with automatic reconnection and listener management
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Connection status notifications
 * - Hot reload in development mode
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

let socket;
let reconnectAttempts = 0;
const maxReconnectAttempts = 3;
const reconnectDelay = 3000; // 3 seconds
const messageListeners = new Set();

/**
 * Create WebSocket connection
 * @param {string} [url] - Optional WebSocket URL (default: ws://current-host/ws)
 */
const createSocket = url => {
	const wsUrl = url || `ws://${window.location.host}/ws`;
	socket = new WebSocket(wsUrl);

	socket.addEventListener('open', () => {
		console.log('WebSocket connected');

		// Re-attach all message listeners to new socket
		messageListeners.forEach(listener => {
			socket.addEventListener('message', listener);
		});

		// Show restoration message if reconnected
		if (reconnectAttempts > 0 && typeof Notify !== 'undefined') {
			new Notify({
				type: 'success',
				content: 'Connection restored.',
				timeout: 2000,
				x: window.innerWidth / 2,
				y: 100,
			});
		}

		reconnectAttempts = 0;
	});

	socket.addEventListener('error', error => {
		console.error('WebSocket error:', error);
		if (typeof Notify !== 'undefined') {
			new Notify({
				type: 'error',
				content: 'Connection error. Attempting to reconnect...',
				timeout: 3000,
				x: window.innerWidth / 2,
				y: 100,
			});
		}
	});

	socket.addEventListener('close', event => {
		console.error('WebSocket closed:', event);

		if (reconnectAttempts < maxReconnectAttempts) {
			reconnectAttempts++;
			const delay = reconnectDelay * Math.pow(1.5, reconnectAttempts - 1);

			if (typeof Notify !== 'undefined') {
				new Notify({
					type: 'warning',
					content: `Connection lost. Reconnecting in ${Math.round(delay / 1000)}s... (${reconnectAttempts}/${maxReconnectAttempts})`,
					timeout: delay - 500,
					x: window.innerWidth / 2,
					y: 100,
				});
			}

			setTimeout(() => {
				console.log(`Reconnect attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
				createSocket(wsUrl);
			}, delay);
		} else {
			if (typeof Notify !== 'undefined') {
				new Notify({
					type: 'error',
					content: 'Connection failed. Reloading in 5 seconds...',
					timeout: 4500,
					x: window.innerWidth / 2,
					y: 100,
				});
			}

			setTimeout(() => {
				console.log('All reconnection attempts failed, reloading...');
				window.location.reload();
			}, 5000);
		}
	});

	return socket;
};

// Initialize connection
socket = createSocket();

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

	messageListeners.add(listener);
	socket.addEventListener('message', listener);

	return () => {
		messageListeners.delete(listener);
		socket.removeEventListener('message', listener);
	};
};

// Hot reload in development
if (process.env.NODE_ENV === 'development') {
	const debouncedReload = debounce(() => {
		console.log('[dev] Hot reload triggered');
		window.location.reload();
	}, 1000);

	const hotReloadListener = event => {
		if (event.data === 'hotReload') {
			debouncedReload();
		}
	};

	messageListeners.add(hotReloadListener);
	socket.addEventListener('message', hotReloadListener);
}

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
	addEventListener: (...args) => socket.addEventListener(...args),
	removeEventListener: (...args) => socket.removeEventListener(...args),
	send: (...args) => socket.send(...args),
	close: (...args) => socket.close(...args),
};
