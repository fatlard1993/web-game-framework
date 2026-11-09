import { Component, styled } from '@vanilla-bean/components';

import { joinUrl } from '../client/joinUrl.js';
import QRCode from './QRCode.js';

/**
 * How someone else joins: a QR code a phone on the same network can open, and the address under it. Uses the server's
 * network address when the page was opened as localhost, which a phone can't reach.
 * @example new JoinCard({ gameId, appendTo: dialog.body })
 * @param {object} options - Options
 * @param {string} options.gameId - The game to join
 * @param {number} [options.size] - The code's width in pixels (default 240)
 */
export default class JoinCard extends styled(
	Component,
	({ space, colors }) => `
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: ${space.sm};

		& canvas {
			border-radius: 8px;
			background: ${colors.white};
		}

		& .address {
			font-size: 0.85em;
			opacity: 0.75;
			word-break: break-all;
			text-align: center;
		}
	`,
) {
	static schema = { gameId: {}, size: { default: 240 } };

	async build() {
		super.build?.();

		const url = await joinUrl(this.options.gameId);
		const address = document.createElement('div');

		address.className = 'address';
		address.textContent = url;
		new QRCode({ src: url, qrCodeConfig: { width: this.options.size, margin: 2 }, appendTo: this.elem });
		this.elem.append(address);
	}
}
