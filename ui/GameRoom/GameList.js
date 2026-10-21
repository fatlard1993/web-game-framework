import { Card, Component, List, styled } from '@vanilla-bean/components';

const GameListItem = styled(
	Card,
	({ space, media }) => `
		display: flex;
		align-items: center;
		gap: ${space.sm};

		@media ${media.phone} {
			flex-wrap: wrap;
			position: relative;
		}

		& > button, & > a {
			margin: 0;

			@media ${media.phone} {
				flex: 1 1 auto;
				min-width: 80px;
			}
		}
	`,
);

export class GameList extends styled(
	List,
	({ space }) => `
		display: flex;
		flex-direction: column;
		gap: ${space.sm};
		margin: 0;
		padding: ${space.sm};
		overflow: visible;

		& > li {
			list-style: none;
			text-indent: 0;
			line-height: normal;
		}
	`,
) {
	static schema = {
		ListItemComponent: { default: GameListItem },
	};
}

export const GameListText = styled(
	Component,
	({ space, media }) => `
		font-size: 1.2em;
		line-height: 1.6;
		padding: 0 ${space.xs};
		pointer-events: none;

		&:first-of-type {
			flex: 1;
			min-width: 0;
			overflow-wrap: anywhere;
		}

		@media ${media.phone} {
			/* First text (name) forces new line by taking full width */
			&:first-of-type {
				order: -2;
				flex: 0 0 100%;
				padding-right: 60px; /* Make room for player count */
			}

			/* Last text (player count) positioned absolutely on the right */
			&:last-of-type {
				order: -1;
				position: absolute;
				top: 10px;
				right: 12px;
			}
		}
	`,
);
