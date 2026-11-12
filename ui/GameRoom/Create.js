import { Link, Button, Form, Notify, failureReason, theme } from '@vanilla-bean/components';

import { View } from '../layout/index.js';
import { createGame } from '../../client/index.js';

export default class Create extends View {
	static schema = {
		formData: {},
		formInputs: {},
		containerComponent: {},
		containerText: {},
	};

	constructor(options, ...children) {
		super(
			{
				formInputs: [{ key: 'name', label: 'Room Name' }],
				...options,
				// The form reads best in a column on a wide screen
				body: { column: true, ...options.body },
				toolbar: {
					heading: options.toolbar?.heading || 'New Game',
					left: [
						new Link({
							textContent: options.toolbar?.backText || 'Back to Hub',
							href: options.toolbar?.backHref || '#/hub',
							icon: 'arrow-left',
							variant: 'flat',
							tooltip: false,
						}),
					],
					right: [
						new Button({
							textContent: options.toolbar?.createText || 'Create Game',
							onPointerPress: () => this.create(),
						}),
					],
				},
			},
			...children,
		);
	}

	build() {
		super.build();
		this._init();
	}

	/**
	 * Serialize form data for the create request; override to transform game-specific fields
	 * @returns {object} The request body
	 */
	createBody() {
		return { ...this.form.options.data };
	}

	/**
	 * Validate and submit the form, then navigate to the new game's join page; a refused create says why and stays
	 * Override to add game-specific validation before calling super.create()
	 */
	async create() {
		if (this.form.hasErrors()) return;

		const created = await createGame({ body: this.createBody() });

		if (created.status === 'error') {
			new Notify({ intent: 'danger', content: `Couldn't create the game: ${failureReason(created)}` });

			return;
		}

		window.location.href = `#/join/${created.body.id}`;
	}

	_init() {
		this.form = new Form({
			// The column is the side padding
			style: { margin: `${theme.space.md} 0` },
			data: this.options.subscriber('formData'),
			inputs: this.options.subscriber('formInputs'),
		});

		// Allow games to provide their own container component and content
		if (this.options.containerComponent) {
			const ContainerComponent = this.options.containerComponent;
			this.container = new ContainerComponent(
				{
					appendTo: this._body,
					textContent: this.options.containerText || '> [SYSTEM] Creating new game.\n> Fill out required fields.',
				},
				this.form,
			);
		} else {
			// Default behavior - append the form directly
			this._body.append(this.form);
		}
	}
}
