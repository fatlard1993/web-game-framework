/* eslint-disable no-console */
import { Notify } from '@vanilla-bean/components';

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

let socket;
let wsUrl;
let retry;
let delay = 1000;
let lost = null;
const MAX_DELAY = 10_000;
const messageListeners = new Set();
// Listeners added through the wrapper, carried onto each new socket like the message listeners
const socketListeners = new Set();

const notify = options => {
	if (typeof Notify === 'undefined') return;

	return new Notify({ x: window.innerWidth / 2, y: 100, ...options });
};

// Now, rather than after the backoff: a page back in view, or a network back up, shouldn't wait out a timer
const reconnectNow = () => {
	if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;

	clearTimeout(retry);
	delay = 1000;
	createSocket(wsUrl);
};

/**
 * Create WebSocket connection. A lost connection is retried for as long as the page is open, backing off to every 10
 * seconds, and at once when the page comes back into view or the network comes back.
 * @param {string} [url] - Optional WebSocket URL (default: the current host's /ws, over wss on https pages)
 * @returns {WebSocket} The newly created socket
 */
const createSocket = url => {
	wsUrl = url || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
	socket = new WebSocket(wsUrl);

	messageListeners.forEach(listener => socket.addEventListener('message', listener));
	socketListeners.forEach(([type, listener, options]) => socket.addEventListener(type, listener, options));

	socket.addEventListener('open', () => {
		console.log('WebSocket connected');
		delay = 1000;

		if (lost) {
			if (lost.elem?.isConnected) lost.destroy();
			lost = null;
			notify({ type: 'success', content: 'Connection restored.', timeout: 2000 });
		}
	});

	socket.addEventListener('error', error => console.error('WebSocket error:', error));

	socket.addEventListener('close', event => {
		console.error('WebSocket closed:', event);

		// Said once per outage, not once per attempt
		lost ??= notify({ type: 'warning', content: 'Connection lost. Reconnecting...', timeout: 0 });

		clearTimeout(retry);
		retry = setTimeout(() => createSocket(wsUrl), delay);
		delay = Math.min(delay * 2, MAX_DELAY);
	});

	return socket;
};

document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reconnectNow());
window.addEventListener('online', reconnectNow);

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
	addEventListener: (type, listener, options) => {
		socketListeners.add([type, listener, options]);
		socket.addEventListener(type, listener, options);
	},
	removeEventListener: (type, listener, options) => {
		for (const entry of socketListeners) if (entry[0] === type && entry[1] === listener) socketListeners.delete(entry);
		socket.removeEventListener(type, listener, options);
	},
	send: (...args) => socket.send(...args),
	close: (...args) => socket.close(...args),
};
