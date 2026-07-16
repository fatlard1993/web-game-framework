import { Component } from '@vanilla-bean/components';

import Toolbar from './Toolbar.js';

describe('Toolbar', () => {
	let toolbar;

	afterEach(() => {
		toolbar?.destroy?.();
		toolbar = null;
	});

	describe('initial render', () => {
		test('renders an empty heading and layout container by default', () => {
			toolbar = new Toolbar({ appendTo: container });

			const heading = container.querySelector('h1');
			expect(heading).not.toBeNull();
			expect(heading).toHaveTextContent('');
		});

		test('renders a string heading as h1 text', () => {
			toolbar = new Toolbar({ appendTo: container, heading: 'Game Hub' });

			expect(container.querySelector('h1')).toHaveTextContent('Game Hub');
		});

		test('renders a component heading in place of the default h1', () => {
			const heading = new Component({ tag: 'h2', textContent: 'Custom Heading' });
			toolbar = new Toolbar({ appendTo: container, heading });

			expect(container.querySelector('h1')).toBeNull();
			expect(container.querySelector('h2')).toHaveTextContent('Custom Heading');
			expect(toolbar.elem.contains(heading.elem)).toBe(true);
		});

		test('renders left and right components', () => {
			toolbar = new Toolbar({
				appendTo: container,
				left: [new Component({ textContent: 'left one' }), new Component({ textContent: 'left two' })],
				right: [new Component({ textContent: 'right one' })],
			});

			expect(toolbar.elem).toHaveTextContent('left one');
			expect(toolbar.elem).toHaveTextContent('left two');
			expect(toolbar.elem).toHaveTextContent('right one');
		});
	});

	describe('post-render option updates', () => {
		test('setting heading to a string updates the existing heading text', () => {
			toolbar = new Toolbar({ appendTo: container, heading: 'Before' });

			toolbar.options.heading = 'After';

			const headings = container.querySelectorAll('h1');
			expect(headings.length).toBe(1);
			expect(headings[0]).toHaveTextContent('After');
		});

		test('setting heading to a component replaces the current heading', () => {
			toolbar = new Toolbar({ appendTo: container, heading: 'Original' });
			const replacement = new Component({ tag: 'h2', textContent: 'Replacement' });

			toolbar.options.heading = replacement;

			expect(container.querySelector('h1')).toBeNull();
			expect(container.querySelector('h2')).toHaveTextContent('Replacement');
		});

		test('setting left replaces its children', () => {
			toolbar = new Toolbar({ appendTo: container, left: [new Component({ textContent: 'old item' })] });

			toolbar.options.left = [new Component({ textContent: 'new item' })];

			expect(toolbar.elem).not.toHaveTextContent('old item');
			expect(toolbar.elem).toHaveTextContent('new item');
		});

		test('setting right replaces its children', () => {
			toolbar = new Toolbar({ appendTo: container, right: [new Component({ textContent: 'old item' })] });

			toolbar.options.right = [new Component({ textContent: 'new item' })];

			expect(toolbar.elem).not.toHaveTextContent('old item');
			expect(toolbar.elem).toHaveTextContent('new item');
		});
	});

	describe('schema defaults', () => {
		test('left and right default arrays are not shared between instances', () => {
			toolbar = new Toolbar({ appendTo: container });
			const second = new Toolbar({ appendTo: container });

			toolbar.options.left.push(new Component({ textContent: 'only in first' }));

			expect(second.options.left).toHaveLength(0);
			second.destroy?.();
		});
	});
});
