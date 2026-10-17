const globals = require('globals');
const vanillaBeanEslint = require('@vanilla-bean/components/eslint.config.cjs');
const vanillaBeanSpellcheck = require('@vanilla-bean/components/spellcheck.config.cjs');
const localSpellcheck = require('./spellcheck.config.cjs');

module.exports = [
	...vanillaBeanEslint,
	{
		ignores: ['**/dist'],
	},
	{
		rules: {
			'no-unused-vars': [
				'error',
				{ varsIgnorePattern: '^_', argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
			],
			// lowdb is installed, but its ESM-only exports map defeats eslint-plugin-import's resolver
			'import/no-unresolved': [1, { ignore: ['bun', 'bun:test', String.raw`\.asText$`, '^lowdb'] }],
			'spellcheck/spell-checker': [
				'warn',
				{
					...vanillaBeanSpellcheck,
					...localSpellcheck,
					skipWords: [...vanillaBeanSpellcheck.skipWords, ...localSpellcheck.skipWords],
				},
			],
		},
	},
	{
		files: ['core/**/*', 'plugins/**/*', 'utils/**/*', 'examples/*/server.js', 'examples/*/build.js'],
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
