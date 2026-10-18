import { afterAll, beforeAll, expect, jest, test } from 'bun:test';

// A WebSocket that records each one made, opened and closed by the test
class FakeSocket extends EventTarget {
	static made = [];
	readyState = 0;

	constructor(url) {
		super();
		this.url = url;
		FakeSocket.made.push(this);
	}

	open() {
		this.readyState = 1;
		this.dispatchEvent(new Event('open'));
	}

	drop() {
		this.readyState = 3;
		this.dispatchEvent(new Event('close'));
	}

	send() {}
	close() {}
}

Object.assign(FakeSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });

let socket;
const RealSocket = globalThis.WebSocket;

beforeAll(async () => {
	globalThis.WebSocket = FakeSocket;
	jest.spyOn(console, 'log').mockImplementation(() => {});
	jest.spyOn(console, 'error').mockImplementation(() => {});
	jest.useFakeTimers();
	({ default: socket } = await import('./socket.js'));
});

afterAll(() => {
	jest.useRealTimers();
	jest.restoreAllMocks();
	globalThis.WebSocket = RealSocket;
});

const latest = () => FakeSocket.made.at(-1);

test('a lost connection keeps being retried, backing off, and listeners carry over to each new socket', () => {
	const heard = [];

	socket.addEventListener('message', event => heard.push(event.data));
	latest().open();

	for (let attempt = 0; attempt < 6; attempt++) {
		const before = FakeSocket.made.length;

		latest().drop();
		jest.advanceTimersByTime(10_000);
		expect(FakeSocket.made.length).toBe(before + 1);
	}

	latest().open();
	latest().dispatchEvent(Object.assign(new Event('message'), { data: 'hello' }));

	expect(heard).toEqual(['hello']);
});

test('the page coming back into view reconnects at once, without waiting out the backoff', () => {
	for (let attempt = 0; attempt < 5; attempt++) {
		latest().drop();
		jest.advanceTimersByTime(10_000);
	}

	latest().drop();

	const before = FakeSocket.made.length;

	document.dispatchEvent(new Event('visibilitychange'));

	expect(FakeSocket.made.length).toBe(before + 1);
});
