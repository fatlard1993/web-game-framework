import { describe, test, expect, beforeEach } from 'bun:test';
import EventRouter from './EventRouter.js';

describe('EventRouter', () => {
	let router;

	beforeEach(() => {
		router = new EventRouter();
	});

	describe('Basic event handling', () => {
		test('should register and emit events', async () => {
			let received = null;

			router.on('test', data => {
				received = data;
			});

			await router.emit('test', { value: 42 });

			expect(received).toEqual({ value: 42 });
		});

		test('should support multiple handlers for same event', async () => {
			const calls = [];

			router.on('test', () => calls.push('handler1'));
			router.on('test', () => calls.push('handler2'));

			await router.emit('test', {});

			expect(calls).toEqual(['handler1', 'handler2']);
		});

		test('should remove handler with cleanup function', async () => {
			let callCount = 0;

			const cleanup = router.on('test', () => {
				callCount++;
			});

			await router.emit('test', {});
			expect(callCount).toBe(1);

			cleanup();

			await router.emit('test', {});
			expect(callCount).toBe(1); // Should not increase
		});

		test('should support once() for one-time handlers', async () => {
			let callCount = 0;

			router.once('test', () => {
				callCount++;
			});

			await router.emit('test', {});
			await router.emit('test', {});

			expect(callCount).toBe(1);
		});
	});

	describe('Event definitions and validation', () => {
		test('should validate events with custom function', async () => {
			router.defineEvent('validated', {
				validate: data => data.value > 10,
			});

			let received = null;
			router.on('validated', data => {
				received = data;
			});

			// Should pass validation
			await router.emit('validated', { value: 20 });
			expect(received).toEqual({ value: 20 });

			// Should fail validation
			received = null;
			await router.emit('validated', { value: 5 });
			expect(received).toBe(null);
		});

		test('should transform data before handlers', async () => {
			router.defineEvent('transform', {
				transform: data => ({ ...data, transformed: true }),
			});

			let received = null;
			router.on('transform', data => {
				received = data;
			});

			await router.emit('transform', { value: 42 });

			expect(received).toEqual({ value: 42, transformed: true });
		});

		test('should throttle events', async () => {
			router.defineEvent('throttled', {
				throttle: 100,
			});

			let callCount = 0;
			router.on('throttled', () => {
				callCount++;
			});

			// Emit multiple times rapidly
			await router.emit('throttled', {});
			await router.emit('throttled', {});
			await router.emit('throttled', {});

			expect(callCount).toBe(1);

			// Wait for throttle to expire
			await new Promise(resolve => setTimeout(resolve, 150));

			await router.emit('throttled', {});
			expect(callCount).toBe(2);
		});
	});

	describe('Middleware', () => {
		test('should run middleware before handlers', async () => {
			const calls = [];

			router.use((data, context, next) => {
				calls.push('middleware');
				return next();
			});

			router.on('test', () => {
				calls.push('handler');
			});

			await router.emit('test', {});

			expect(calls).toEqual(['middleware', 'handler']);
		});

		test('should support multiple middleware', async () => {
			const calls = [];

			router.use((data, context, next) => {
				calls.push('middleware1');
				return next();
			});

			router.use((data, context, next) => {
				calls.push('middleware2');
				return next();
			});

			router.on('test', () => {
				calls.push('handler');
			});

			await router.emit('test', {});

			expect(calls).toEqual(['middleware1', 'middleware2', 'handler']);
		});

		test('should stop propagation if middleware returns false', async () => {
			let handlerCalled = false;

			router.use(() => false); // Stop propagation

			router.on('test', () => {
				handlerCalled = true;
			});

			await router.emit('test', {});

			expect(handlerCalled).toBe(false);
		});

		test('should pass context to middleware', async () => {
			let receivedContext = null;

			router.use((data, context, next) => {
				receivedContext = context;
				return next();
			});

			router.on('test', () => {});

			await router.emit('test', {});

			expect(receivedContext).toHaveProperty('eventName', 'test');
			expect(receivedContext).toHaveProperty('router');
		});
	});

	describe('Wildcard patterns', () => {
		test('should match wildcard patterns', async () => {
			const calls = [];

			router.on('player:*', (data, context) => {
				calls.push(context.eventName);
			});

			await router.emit('player:move', {});
			await router.emit('player:attack', {});
			await router.emit('player:heal', {});

			expect(calls).toEqual(['player:move', 'player:attack', 'player:heal']);
		});

		test('should match exact handlers and wildcards', async () => {
			const calls = [];

			router.on('player:move', () => calls.push('exact'));
			router.on('player:*', () => calls.push('wildcard'));

			await router.emit('player:move', {});

			expect(calls).toEqual(['exact', 'wildcard']);
		});

		test('should match complex wildcard patterns', async () => {
			const calls = [];

			router.on('game:*:end', (data, context) => {
				calls.push(context.eventName);
			});

			await router.emit('game:round:end', {});
			await router.emit('game:match:end', {});

			expect(calls).toEqual(['game:round:end', 'game:match:end']);
		});
	});

	describe('Utility methods', () => {
		test('should list all events', () => {
			router.on('event1', () => {});
			router.on('event2', () => {});
			router.on('event3', () => {});

			const events = router.listEvents();

			expect(events).toContain('event1');
			expect(events).toContain('event2');
			expect(events).toContain('event3');
		});

		test('should count listeners for event', () => {
			router.on('test', () => {});
			router.on('test', () => {});
			router.on('test', () => {});

			expect(router.listenerCount('test')).toBe(3);
		});

		test('should remove all listeners', () => {
			router.on('event1', () => {});
			router.on('event2', () => {});

			router.removeAllListeners();

			expect(router.listenerCount('event1')).toBe(0);
			expect(router.listenerCount('event2')).toBe(0);
		});

		test('should remove all listeners for specific event', () => {
			router.on('event1', () => {});
			router.on('event1', () => {});
			router.on('event2', () => {});

			router.removeAllListeners('event1');

			expect(router.listenerCount('event1')).toBe(0);
			expect(router.listenerCount('event2')).toBe(1);
		});
	});

	describe('Error handling', () => {
		test('should handle errors in handlers gracefully', async () => {
			router.on('test', () => {
				throw new Error('Handler error');
			});

			// Should not throw
			await expect(router.emit('test', {})).resolves.toBe(true);
		});

		test('should handle errors in validation gracefully', async () => {
			router.defineEvent('test', {
				validate: () => {
					throw new Error('Validation error');
				},
			});

			router.on('test', () => {});

			// Should return false on validation error
			const result = await router.emit('test', {});
			expect(result).toBe(false);
		});

		test('should handle errors in transform gracefully', async () => {
			router.defineEvent('test', {
				transform: () => {
					throw new Error('Transform error');
				},
			});

			router.on('test', () => {});

			// Should return false on transform error
			const result = await router.emit('test', {});
			expect(result).toBe(false);
		});
	});

	describe('Context integration', () => {
		test('should pass context object to handlers', async () => {
			const gameContext = { gameId: 'test123' };
			const contextRouter = new EventRouter({ context: gameContext });

			let receivedContext = null;

			contextRouter.on('test', (data, context) => {
				receivedContext = context;
			});

			await contextRouter.emit('test', {});

			expect(receivedContext.context).toBe(gameContext);
		});

		test('should support custom emit function', async () => {
			let emittedData = null;

			const customRouter = new EventRouter({
				emitFn: (event, data) => {
					emittedData = { event, data };
				},
			});

			// emitFn is available but not automatically called by emit()
			// It's meant for integration with external systems
			expect(customRouter.emitFn).toBeDefined();

			// Manual call to test it works
			customRouter.emitFn('test', { value: 42 });
			expect(emittedData).toEqual({ event: 'test', data: { value: 42 } });
		});
	});
});
