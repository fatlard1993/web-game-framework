import Body from './Body.js';

// The generated scoped styles land in a <style> in head; a Body's own rule set is the one naming its class
const stylesOf = body =>
	[...document.head.querySelectorAll('style')]
		.map(style => style.textContent)
		.find(css => css.includes(body.uniqueId)) ?? '';

describe('Body', () => {
	afterEach(() => {
		Body.backgroundImage = null;
	});

	test('has no background unless one is set', () => {
		const body = new Body({ appendTo: document.body });

		expect(stylesOf(body)).toContain('overflow: hidden auto');
		expect(stylesOf(body)).not.toContain('background-image: url(');
	});

	test('a background set for the game reaches every Body, and one Body can still opt out', () => {
		Body.backgroundImage = 'img/starfield.svg';

		const withGameBackground = new Body({ appendTo: document.body });
		const plain = new Body({ backgroundImage: false, appendTo: document.body });

		expect(stylesOf(withGameBackground)).toContain("url('img/starfield.svg')");
		expect(stylesOf(plain)).toContain('overflow: hidden auto');
		expect(stylesOf(plain)).not.toContain('background-image: url(');
	});
});
