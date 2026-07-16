import os from 'os';
import path from 'path';
import fs from 'fs';

import Database from './Database.js';

const quietLogger = { info: () => {}, warning: () => {}, error: () => {}, debug: () => {} };

const temporaryFilePath = () =>
	path.join(os.tmpdir(), `database-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);

describe('Database', () => {
	let filePath;

	beforeEach(() => {
		filePath = temporaryFilePath();
	});

	afterEach(() => {
		fs.rmSync(filePath, { force: true });
	});

	test('fires the onReady constructor option with the database instance', async () => {
		const database = await new Promise(resolve => new Database({ filePath, logger: quietLogger, onReady: resolve }));

		expect(database.isReady).toBe(true);
		expect(database.collections.games).toBeDefined();
	});

	test('onReady() registered before ready fires once ready', async () => {
		const database = new Database({ filePath, logger: quietLogger });

		const readyDatabase = await new Promise(resolve => database.onReady(resolve));

		expect(readyDatabase).toBe(database);
		expect(database.isReady).toBe(true);
	});

	test('onReady() registered after ready fires immediately', async () => {
		const database = new Database({ filePath, logger: quietLogger });
		await new Promise(resolve => database.onReady(resolve));

		let fired = false;
		database.onReady(() => {
			fired = true;
		});

		expect(fired).toBe(true);
	});
});
