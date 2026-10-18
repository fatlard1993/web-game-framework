import qrCode from 'qrcode';
import { Component } from '@vanilla-bean/components';

/**
 * A canvas drawing a QR code of `src`: the join link a watch screen shows to players' phones
 * @param {object} [options] - QRCode configuration
 * @param {string} [options.src] - The text or URL to encode
 * @param {object} [options.qrCodeConfig] - Options for the qrcode package's toCanvas (width, margin, color)
 * @param {Function} [options.onError] - Called with the error when the code can't be drawn
 * @returns {QRCode} QRCode component instance
 * @example new QRCode({ src: `${location.origin}/join/${gameId}`, qrCodeConfig: { width: 256 } })
 */
export default class QRCode extends Component {
	static schema = {
		tag: { default: 'canvas' },
		src: {},
		qrCodeConfig: {},
		onError: { data: true },
	};

	build() {
		qrCode.toCanvas(this.elem, this.options.src, this.options.qrCodeConfig || {}, error => {
			if (error) this.options.onError?.(error);
		});
	}
}
