/**
 * Build script for VBC client
 * Bundles vanilla-bean-components with the clicker game client
 */
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const vbcPath = resolve(__dirname, '../../../vanilla-bean-components');

// Build using HTML as entrypoint (like home-page)
const result = await Bun.build({
	entrypoints: ['./client/indexWithVBC.html'],
	outdir: './client/dist',
	define: {
		'process.env.AUTOPREFIXER_GRID': 'undefined',
		'process.cwd': 'String',
	},
	plugins: [
		{
			name: 'resolve-vbc',
			setup(build) {
				build.onResolve({ filter: /^vanilla-bean-components$/ }, () => ({
					path: resolve(vbcPath, 'index.js'),
				}));
			},
		},
	],
});

if (!result.success) {
	console.error('Build failed:');
	result.logs.forEach(log => console.error(log));
	process.exit(1);
}

console.log('Build complete!');
console.log(`Output: ./client/dist/`);
result.outputs.forEach(output => console.log(`  - ${output.path}`));
