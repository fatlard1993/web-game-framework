import { Component } from '@vanilla-bean/components';

import View from './View.js';

describe('View', () => {
	let view;

	afterEach(() => {
		view?.destroy?.();
		view = null;
	});

	test('renders a toolbar and body by default', () => {
		view = new View({ appendTo: container });

		expect(view._toolbar).toBeDefined();
		expect(view._body).toBeDefined();
		expect(view.elem.contains(view._toolbar.elem)).toBe(true);
		expect(view.elem.contains(view._body.elem)).toBe(true);
	});

	test('forwards toolbar options to the toolbar', () => {
		view = new View({
			appendTo: container,
			toolbar: { heading: 'Mission Control', right: [new Component({ textContent: 'action' })] },
		});

		expect(container.querySelector('h1')).toHaveTextContent('Mission Control');
		expect(view._toolbar.elem).toHaveTextContent('action');
	});

	test('forwards body options to the body', () => {
		view = new View({ appendTo: container, body: { textContent: 'body content' } });

		expect(view._body.elem).toHaveTextContent('body content');
	});

	test('toolbar and body options stay in the options store instead of leaking onto the element', () => {
		view = new View({ appendTo: container, toolbar: { heading: 'H' }, body: {} });

		expect(view.elem.toolbar).toBeUndefined();
		expect(view.elem.body).toBeUndefined();
		expect(view.options.toolbar).toEqual({ heading: 'H' });
	});
});
