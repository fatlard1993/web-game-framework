const globals = require('globals');
const jsdoc = require('eslint-plugin-jsdoc');

// The framework is a library: its JSDoc stays required everywhere but the examples and the scaffold, as in the components
// library
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
		},
	},
	{
		files: ['core/**/*', 'utils/**/*', 'bin/**/*', 'scaffold/*.js', 'examples/*/server.js', 'examples/*/build.js'],
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
		files: ['**/examples/**/*', 'examples/*', 'scaffold/**/*'],
		rules: {
			'no-console': 'off',
			'jsdoc/require-jsdoc': 'off',
		},
	},
	{
		// The scaffold imports the framework as the package a game installs, which this checkout isn't
		files: ['scaffold/**/*'],
		rules: {
			'import/no-unresolved': 'off',
		},
	},
	...require('@vanilla-bean/components/eslint.usage.config.cjs'),
];
