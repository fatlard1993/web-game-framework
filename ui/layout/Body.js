import { Content } from '@vanilla-bean/components';

/** What scrolls in a View, under its Toolbar: a Content, with a game's background behind it if one is set */
export default class Body extends Content {
	/** The parallax background every Body gets unless it passes its own; none until a game sets one at startup */
	static backgroundImage = null;

	static schema = {
		// A parallax background asset for this Body, or false for none whatever the game sets
		backgroundImage: {},
	};

	constructor(options = {}, ...children) {
		const backgroundImage = options.backgroundImage ?? Body.backgroundImage;

		super(
			{
				...options,
				styles: () => `
					/* Content scrolls; sideways it clips, so the background's drift never adds a scrollbar */
					overflow-x: hidden;
					position: relative;
					/* A column, so a game's own view can take the whole of it (flex: 1) */
					display: flex;
					flex-direction: column;
					/* Its own stacking, so the background sits under whatever a game puts here without moving it out of
					   the way it's laid out (a full-screen view positioned absolutely stays so) */
					isolation: isolate;
					background-image: none;

					${
						backgroundImage
							? `
					&::before {
						content: '';
						position: absolute;
						top: -10%;
						left: -10%;
						width: 120%;
						height: 120%;
						background-image: url('${backgroundImage}');
						background-size: cover;
						background-position: center;
						animation: parallax-drift 120s ease-in-out infinite;
						z-index: -1;
					}
					`
							: ''
					}

					@keyframes parallax-drift {
						0% {
							transform: translate(0, 0) scale(1) rotate(0deg);
						}
						12.5% {
							transform: translate(5.5%, -3.5%) scale(1.04) rotate(0.5deg);
						}
						25% {
							transform: translate(7%, 0) scale(1.08) rotate(1deg);
						}
						37.5% {
							transform: translate(5.5%, 3.5%) scale(1.12) rotate(1.5deg);
						}
						50% {
							transform: translate(0, 7%) scale(1.15) rotate(2deg);
						}
						62.5% {
							transform: translate(-5.5%, 3.5%) scale(1.12) rotate(1.5deg);
						}
						75% {
							transform: translate(-7%, 0) scale(1.08) rotate(1deg);
						}
						87.5% {
							transform: translate(-5.5%, -3.5%) scale(1.04) rotate(0.5deg);
						}
						100% {
							transform: translate(0, 0) scale(1) rotate(0deg);
						}
					}
				`,
			},
			...children,
		);
	}
}
