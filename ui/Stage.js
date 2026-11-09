import { Component, styled } from '@vanilla-bean/components';

/**
 * The play area: it grows to fill the room it's in (all of a View's body below the bar), holds a canvas kept at its
 * size and the screen's pixel density, and says when either changes. Whatever else goes in it (a Phaser game, DOM
 * pieces positioned over the board) is laid over the canvas.
 * @example
 * const stage = new Stage({ appendTo: this._body, onResize: ({ width, height }) => draw() });
 * stage.context.fillRect(0, 0, stage.width, stage.height);
 * @param {object} [options] - Options
 * @param {Function} [options.onResize] - ({ width, height, ratio, context }) on first layout and each change, in CSS pixels
 */
export default class Stage extends styled(
	Component,
	() => `
		position: relative;
		flex: 1;
		min-width: 0;
		min-height: 0;
		align-self: stretch;
		overflow: hidden;
		touch-action: none;

		& > canvas {
			position: absolute;
			inset: 0;
			width: 100%;
			height: 100%;
			display: block;
		}
	`,
) {
	static schema = { onResize: { data: true } };

	build() {
		super.build?.();
		this.width = 0;
		this.height = 0;
		this.ratio = 1;

		this.canvas = document.createElement('canvas');
		this.context = this.canvas.getContext('2d');
		this.elem.append(this.canvas);

		this.observer = new ResizeObserver(() => this.fit());
		this.observer.observe(this.elem);
		this.addCleanup?.('stage', () => this.observer.disconnect());
	}

	// The canvas made the size the stage is, in device pixels, with drawing still in CSS pixels
	fit() {
		const { width, height } = this.elem.getBoundingClientRect();
		const ratio = window.devicePixelRatio || 1;

		if (width === this.width && height === this.height && ratio === this.ratio) return;
		Object.assign(this, { width, height, ratio });
		this.canvas.width = Math.round(width * ratio);
		this.canvas.height = Math.round(height * ratio);
		this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
		this.options.onResize?.({ width, height, ratio, context: this.context });
	}

	/**
	 * Where a pointer event is on the stage, in its CSS pixels, held to its edges
	 * @param {PointerEvent} event - The event
	 * @returns {{ x: number, y: number }} The point
	 */
	toBoard(event) {
		const box = this.elem.getBoundingClientRect();

		return {
			x: Math.min(Math.max(event.clientX - box.left, 0), box.width),
			y: Math.min(Math.max(event.clientY - box.top, 0), box.height),
		};
	}
}
