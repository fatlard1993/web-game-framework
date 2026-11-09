#!/usr/bin/env bun
import { cp, mkdir, readdir, readFile, writeFile } from 'fs/promises';
import { basename, extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'util';

// A new game from the scaffold: the folder copied, and the placeholders in its files filled in.
//
//   new-game <folder> [--name <package name>] [--title <what it's called>] [--description <a sentence or two>]
//            [--color <css color>] [--framework <dependency spec>] [--vbc <dependency spec>]
//
// The title, description and color are the game's face: its page title, web manifest and README, which is what a
// browser, a phone's home screen and web-game-mother-hub's card show of it. Without a color, one is made from the name.
//
// The framework is depended on from GitHub unless a spec is given (a project that pins a commit passes its own, so the
// game pins the same); the component library at the range this framework works with.

const SCAFFOLD = fileURLToPath(new URL('../scaffold', import.meta.url));
const OWN_PACKAGE = fileURLToPath(new URL('../package.json', import.meta.url));
const FRAMEWORK = 'github:fatlard1993/web-game-framework';
const FILLED = ['package.json', 'README.md', 'CLAUDE.md', 'client/index.html', 'client/manifest.json'];
const DESCRIPTION = 'A multiplayer web game, played together from any device on the network.';

// Each placeholder is written as its file reads it: escaped as a JSON string in the manifest, as text in the page
const ESCAPE = {
	'.json': value => JSON.stringify(String(value)).slice(1, -1),
	'.html': value =>
		String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'),
};

/**
 * A color of the game's own from its name: the same name always gets the same one, a mid-bright hue that reads on a
 * dark page and under white text
 * @param {string} name - The game's name
 * @returns {string} A hex color
 */
export const colorFor = name => {
	let hash = 0;

	for (const character of String(name)) hash = (hash * 31 + character.codePointAt(0)) >>> 0;

	const hue = hash % 360;
	const channel = offset => {
		const k = (offset + hue / 30) % 12;
		const value = 0.5 - 0.5 * 0.55 * Math.max(-1, Math.min(k - 3, 9 - k, 1));

		return Math.round(value * 255)
			.toString(16)
			.padStart(2, '0');
	};

	return `#${channel(0)}${channel(8)}${channel(4)}`;
};

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
 * @param {string} [options.title] - What the game is called where people see it; the package name by default
 * @param {string} [options.description] - A sentence or two saying what the game is, for its manifest and README
 * @param {string} [options.color] - Its theme color; one made from its name by default
 * @param {string} [options.framework] - The framework's dependency spec; GitHub's main branch by default
 * @param {string} [options.vbc] - The component library's dependency spec; the framework's own range by default
 * @returns {Promise<{ folder: string, name: string }>} Where it went, and what it's called
 */
export const newGame = async (folder, { name, title, description, color, framework = FRAMEWORK, vbc } = {}) => {
	const target = resolve(folder);
	const packageTitle = name || packageName(target);

	await mkdir(target, { recursive: true });
	if ((await readdir(target)).length) throw new Error(`${target} isn't empty`);

	await cp(SCAFFOLD, target, { recursive: true });

	const values = {
		name: packageTitle,
		title: String(title ?? '').trim() || packageTitle,
		description: String(description ?? '').trim() || DESCRIPTION,
		color: String(color ?? '').trim() || colorFor(packageTitle),
		framework,
		vbc: vbc ?? (await vbcRange()),
	};

	for (const file of FILLED) {
		const path = join(target, file);
		const escape = ESCAPE[extname(file)] ?? String;
		const filled = (await readFile(path, 'utf8')).replace(/\{\{(\w+)\}\}/g, (whole, key) =>
			key in values ? escape(values[key]) : whole,
		);

		await writeFile(path, filled);
	}

	return { folder: target, name: packageTitle };
};

if (import.meta.main) {
	const { values, positionals } = parseArgs({
		allowPositionals: true,
		options: {
			name: { type: 'string' },
			title: { type: 'string' },
			description: { type: 'string' },
			color: { type: 'string' },
			framework: { type: 'string' },
			vbc: { type: 'string' },
		},
	});

	if (!positionals[0]) {
		console.error(
			'Usage: new-game <folder> [--name <package name>] [--title <title>] [--description <text>] [--color <css color>] [--framework <spec>] [--vbc <spec>]',
		);
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
