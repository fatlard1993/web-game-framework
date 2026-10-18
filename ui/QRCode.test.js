import QRCode from './QRCode.js';

describe('QRCode', () => {
	test('is a canvas that keeps what it encodes', () => {
		const code = new QRCode({ src: 'https://example.com/join/abc', appendTo: container });

		expect(code.elem.tagName).toBe('CANVAS');
		expect(code.options.src).toBe('https://example.com/join/abc');

		code.destroy();
	});
});
