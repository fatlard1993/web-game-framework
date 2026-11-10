import { Notify } from '@vanilla-bean/components';

import socket, { onMessage } from './socket.js';

// Actions waiting on the server's answer, by their ack number
const waiting = new Map();
let nextAck = 1;
let listening = false;

const listen = () => {
	if (listening) return;
	listening = true;
	onMessage(message => {
		if (message.update !== 'acted' || !waiting.has(message.ack)) return;

		const { resolve, quiet } = waiting.get(message.ack);

		waiting.delete(message.ack);
		if (!message.ok && !quiet && typeof Notify !== 'undefined')
			new Notify({ x: window.innerWidth / 2, y: 100, intent: 'warning', content: message.error, timeout: 2500 });
		resolve(
			message.ok
				? { ok: true, ...('result' in message && { result: message.result }) }
				: { ok: false, error: message.error },
		);
	});
};

/**
 * Asks the server to do a player action in the game this page is on (enterGame says which): the server runs the
 * game's `actions[name]` as this page's player, then every page redraws from what it publishes. A refusal shows as a
 * notice unless `quiet`. Resolves to { ok, result } (what the action returned, if anything) or { ok: false, error };
 * one never answered (the connection lost) gives up
 * after `timeout`.
 * @example act('move', { dx: 1, dy: 0 });
 * @param {string} name - The action
 * @param {*} [data] - What it carries
 * @param {object} [options] - Options
 * @param {boolean} [options.quiet] - Don't show a refusal
 * @param {number} [options.timeout] - How long to wait for the answer, in ms (default 8000)
 * @returns {Promise<{ ok: boolean, error?: string }>} What came of it
 */
export const act = (name, data, { quiet = false, timeout = 8000 } = {}) => {
	listen();

	const ack = nextAck++;

	return new Promise(resolve => {
		waiting.set(ack, { resolve, quiet });
		socket.send(JSON.stringify({ type: 'act', action: name, data, ack }));
		setTimeout(() => {
			if (!waiting.delete(ack)) return;
			resolve({ ok: false, error: 'No answer from the game' });
		}, timeout);
	});
};
