import { Component, Toolbar as BaseToolbar, styled } from '@vanilla-bean/components';

const Side = styled(
	Component,
	({ space, media }) => `
		display: flex;
		align-items: center;
		gap: ${space.sm};
		flex: 1 1 0;
		min-width: max-content;

		&.right {
			justify-content: flex-end;
		}

		@media ${media.phone} {
			&:empty {
				display: none;
			}
		}
	`,
);

/**
 * The library's page top bar with the game's heading centered between a left and a right group of controls. On a
 * phone the heading takes its own row above them.
 */
export default class Toolbar extends styled(
	BaseToolbar,
	({ media }) => `
		& > .heading {
			flex: 0 1 auto;
			text-align: center;
		}

		& > .left {
			order: -1;
		}

		@media ${media.phone} {
			& > .heading {
				flex: 1 0 100%;
				order: -2;
			}
		}
	`,
) {
	static schema = {
		variant: { default: 'bar' },
		gap: { default: 8 },
		heading: {
			set(value, next) {
				this._headingComponent?.elem.remove();
				this._headingComponent = null;

				if (!value?.elem) {
					next((typeof value === 'object' ? value?.textContent : value) ?? null);

					return;
				}

				next(null);

				value.addClass('heading');
				this.elem.prepend(value.elem);
				this._headingComponent = value;
			},
		},
		left: {
			get default() {
				return [];
			},
			set(value) {
				this._left.empty();
				this._left.append(value);
			},
		},
		right: {
			get default() {
				return [];
			},
			set(value) {
				this._right.empty();
				this._right.append(value);
			},
		},
	};

	build() {
		this._left = new Side({ addClass: 'left', appendTo: this });
		this._right = new Side({ addClass: 'right', appendTo: this });
	}
}
