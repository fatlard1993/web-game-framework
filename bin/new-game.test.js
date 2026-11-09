import { mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { colorFor, newGame, packageName } from './new-game.js';

const made = [];
const scratch = async () => {
	const folder = await mkdtemp(join(tmpdir(), 'new-game-'));

	made.push(folder);

	return folder;
};

afterEach(async () => {
	await Promise.all(made.splice(0).map(folder => rm(folder, { recursive: true, force: true })));
});

describe('packageName', () => {
	test('is the folder name, made valid', () => {
		expect(packageName('/tmp/Space Rocks!')).toBe('space-rocks');
		expect(packageName('/tmp/..')).toBe('game');
	});
});

describe('newGame', () => {
	test('copies the scaffold and fills in the name and the dependency specs', async () => {
		const folder = join(await scratch(), 'rocks');
		const { name } = await newGame(folder, { framework: 'github:fatlard1993/web-game-framework#abc123' });
		const manifest = JSON.parse(await readFile(join(folder, 'package.json'), 'utf8'));

		expect(name).toBe('rocks');
		expect(manifest.name).toBe('rocks');
		expect(manifest.dependencies['@fatlard1993/web-game-framework']).toBe(
			'github:fatlard1993/web-game-framework#abc123',
		);
		expect(manifest.dependencies['@vanilla-bean/components']).toMatch(/^\^7\./);
		expect(await readFile(join(folder, 'client/index.html'), 'utf8')).toContain('<title>rocks</title>');
		expect(await readFile(join(folder, 'CLAUDE.md'), 'utf8')).not.toContain('{{');
		expect(await readdir(join(folder, 'client'))).toEqual(expect.arrayContaining(['index.js', 'Play.js']));
		expect(await readFile(join(folder, '.gitignore'), 'utf8')).toContain('data');
	});

	test('takes a name of its own and the component library spec', async () => {
		const folder = join(await scratch(), 'x');
		const { name } = await newGame(folder, { name: 'moon-game', vbc: '^8.0.0' });
		const manifest = JSON.parse(await readFile(join(folder, 'package.json'), 'utf8'));

		expect(name).toBe('moon-game');
		expect(manifest.dependencies['@vanilla-bean/components']).toBe('^8.0.0');
	});

	test("writes the game's face: title, description and color in its page, manifest and README", async () => {
		const folder = join(await scratch(), 'dino');

		await newGame(folder, {
			title: 'Dino "Dash" & Friends',
			description: 'Run from the lava <fast>.',
			color: '#c8622b',
		});

		const manifest = JSON.parse(await readFile(join(folder, 'client/manifest.json'), 'utf8'));
		const page = await readFile(join(folder, 'client/index.html'), 'utf8');
		const readme = await readFile(join(folder, 'README.md'), 'utf8');

		expect(manifest).toMatchObject({
			name: 'Dino "Dash" & Friends',
			description: 'Run from the lava <fast>.',
			theme_color: '#c8622b',
		});
		expect(page).toContain('<title>Dino &quot;Dash&quot; &amp; Friends</title>');
		expect(page).toContain('<meta name="theme-color" content="#c8622b" />');
		expect(page).toContain('<link rel="manifest" href="./manifest.json" />');
		expect(readme.startsWith('# Dino "Dash" & Friends\n\nRun from the lava <fast>.\n')).toBe(true);
	});

	test('without a color, one steady color from the name; without a description, a plain one', async () => {
		const folder = join(await scratch(), 'rocks');

		await newGame(folder);

		const manifest = JSON.parse(await readFile(join(folder, 'client/manifest.json'), 'utf8'));

		expect(manifest.theme_color).toBe(colorFor('rocks'));
		expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/);
		expect(colorFor('rocks')).not.toBe(colorFor('dino'));
		expect(manifest.description).toContain('multiplayer web game');
	});

	test('refuses a folder with anything in it', async () => {
		const folder = await scratch();

		await writeFile(join(folder, 'notes.txt'), 'mine');
		await expect(newGame(folder)).rejects.toThrow("isn't empty");
		expect(await readdir(folder)).toEqual(['notes.txt']);
	});
});
