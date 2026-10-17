const globals = require('globals');
const jsdoc = require('eslint-plugin-jsdoc');

// The framework is a library: its JSDoc stays required everywhere but the examples, as in the components library
const jsdocRequirements = Object.fromEntries(
	Object.entries(jsdoc.configs['flat/recommended'].rules).filter(([name]) => name.startsWith('jsdoc/require-')),
);

module.exports = [
	...require('@vanilla-bean/components/eslint.app.config.cjs'),
	{
		ignores: ['**/dist'],
	},
	{
		rules: {
			...jsdocRequirements,
			'no-unused-vars': [
				'error',
				{ varsIgnorePattern: '^_', argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
			],
		},
	},
	{
		files: ['core/**/*', 'utils/**/*', 'examples/*/server.js', 'examples/*/build.js'],
		languageOptions: {
			globals: {
				...globals.node,
				Bun: true,
			},
		},
		rules: {
			'no-console': 'off',
			'jsdoc/check-param-names': ['warn', { checkDestructured: false }],
			'compat/compat': 'off',
		},
	},
	{
		files: ['**/examples/**/*', 'examples/*'],
		rules: {
			'no-console': 'off',
			'jsdoc/require-jsdoc': 'off',
		},
	},
];
