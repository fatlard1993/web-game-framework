/**
 * Build script for VBC client
 * Bundles @vanilla-bean/components with the clicker game client
 */

// Build using HTML as entrypoint (like home-page)
const result = await Bun.build({
	entrypoints: ['./client/indexWithVBC.html'],
	outdir: './client/dist',
	define: {
		'process.env.AUTOPREFIXER_GRID': 'undefined',
		'process.cwd': 'String',
	},
});

if (!result.success) {
	console.error('Build failed:');
	result.logs.forEach(log => console.error(log));
	process.exit(1);
}

console.log('Build complete!');
console.log(`Output: ./client/dist/`);
result.outputs.forEach(output => console.log(`  - ${output.path}`));
