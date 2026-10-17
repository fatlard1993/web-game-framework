/**
 * Build script for VBC client
 * Bundles @vanilla-bean/components with the clicker game client
 */
import { buildClient } from '@vanilla-bean/components/app';

const result = await buildClient({ entrypoints: ['./client/indexWithVBC.html'], outdir: './client/dist' });

if (!result.success) process.exit(1);

result.outputs.forEach(output => console.log(`  - ${output.path}`));
