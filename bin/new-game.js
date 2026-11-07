#!/usr/bin/env bun
import { cp, mkdir, readdir, readFile, writeFile } from 'fs/promises';
import { basename, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'util';

// A new game from the scaffold: the folder copied, and the placeholders in its files filled in.
//
//   new-game <folder> [--name <package name>] [--framework <dependency spec>] [--vbc <dependency spec>]
//
// The framework is depended on from GitHub unless a spec is given (a project that pins a commit passes its own, so the
// game pins the same); the component library at the range this framework works with.

const SCAFFOLD = fileURLToPath(new URL('../scaffold', import.meta.url));
const OWN_PACKAGE = fileURLToPath(new URL('../package.json', import.meta.url));
const FRAMEWORK = 'github:fatlard1993/web-game-framework';
const FILLED = ['package.json', 'README.md', 'CLAUDE.md', 'client/index.html'];

/**
 * A package name from a folder's name
 * @param {string} folder - The folder the game goes in
 * @returns {string} A valid package name
 */
export const packageName = folder =>
	basename(resolve(folder))
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, '-')
		.replace(/^[-.]+|[-.]+$/g, '') || 'game';

const vbcRange = async () =>
	JSON.parse(await readFile(OWN_PACKAGE, 'utf8')).peerDependencies['@vanilla-bean/components'];

/**
 * Copy the scaffold into a folder and fill in its placeholders. The folder is made if it's missing, and refused if
 * it has anything in it.
 * @param {string} folder - Where the game goes
 * @param {object} [options] - What to fill in
 * @param {string} [options.name] - The package name; the folder's name by default
 * @param {string} [options.framework] - The framework's dependency spec; GitHub's main branch by default
 * @param {string} [options.vbc] - The component library's dependency spec; the framework's own range by default
 * @returns {Promise<{ folder: string, name: string }>} Where it went, and what it's called
 */
export const newGame = async (folder, { name, framework = FRAMEWORK, vbc } = {}) => {
	const target = resolve(folder);
	const packageTitle = name || packageName(target);

	await mkdir(target, { recursive: true });
	if ((await readdir(target)).length) throw new Error(`${target} isn't empty`);

	await cp(SCAFFOLD, target, { recursive: true });

	const values = { name: packageTitle, framework, vbc: vbc ?? (await vbcRange()) };
	const fill = text => text.replace(/\{\{(name|framework|vbc)\}\}/g, (_, key) => values[key]);

	for (const file of FILLED) {
		const path = join(target, file);

		await writeFile(path, fill(await readFile(path, 'utf8')));
	}

	return { folder: target, name: packageTitle };
};

if (import.meta.main) {
	const { values, positionals } = parseArgs({
		allowPositionals: true,
		options: { name: { type: 'string' }, framework: { type: 'string' }, vbc: { type: 'string' } },
	});

	if (!positionals[0]) {
		console.error('Usage: new-game <folder> [--name <package name>] [--framework <spec>] [--vbc <spec>]');
		process.exit(2);
	}

	try {
		const { folder, name } = await newGame(positionals[0], values);

		console.log(`${name} is in ${folder}. Next: cd there, bun install, bun run dev.`);
	} catch (error) {
		console.error(error.message);
		process.exit(1);
	}
}
