import { Component } from '@vanilla-bean/components';

import Toolbar from './Toolbar.js';

describe('Toolbar', () => {
	let toolbar;

	afterEach(() => {
		toolbar?.destroy?.();
		toolbar = null;
	});

	describe('initial render', () => {
		test('renders a page top bar without a heading by default', () => {
			toolbar = new Toolbar({ appendTo: container });

			expect(toolbar.elem).toHaveClass('variant-bar');
			expect(container.querySelector('[role="heading"]')).toBeNull();
		});

		test('renders a string heading as the bar title', () => {
			toolbar = new Toolbar({ appendTo: container, heading: 'Game Hub' });

			expect(container.querySelector('.heading[aria-level="1"]')).toHaveTextContent('Game Hub');
		});

		test('renders a component heading in place of the default title', () => {
			const heading = new Component({ tag: 'h2', textContent: 'Custom Heading' });
			toolbar = new Toolbar({ appendTo: container, heading });

			expect(container.querySelector('.heading[aria-level="1"]')).toBeNull();
			expect(container.querySelector('h2')).toHaveTextContent('Custom Heading');
			expect(heading.elem).toHaveClass('heading');
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

			const headings = container.querySelectorAll('[role="heading"]');
			expect(headings).toHaveLength(1);
			expect(headings[0]).toHaveTextContent('After');
		});

		test('setting heading to a component replaces the current heading', () => {
			toolbar = new Toolbar({ appendTo: container, heading: 'Original' });
			const replacement = new Component({ tag: 'h2', textContent: 'Replacement' });

			toolbar.options.heading = replacement;

			expect(container.querySelector('.heading[aria-level="1"]')).toBeNull();
			expect(container.querySelector('h2')).toHaveTextContent('Replacement');
		});

		test('setting a string heading after a component heading puts a title back', () => {
			toolbar = new Toolbar({ appendTo: container, heading: new Component({ tag: 'h2', textContent: 'Custom' }) });

			toolbar.options.heading = 'Plain';

			expect(container.querySelector('h2')).toBeNull();
			expect(container.querySelector('.heading[aria-level="1"]')).toHaveTextContent('Plain');
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
