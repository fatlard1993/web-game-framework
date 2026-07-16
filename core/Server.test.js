import os from 'os';
import path from 'path';
import fs from 'fs';

import Server from './Server.js';
import Database from './Database.js';

const quietLogger = { info: () => {}, warning: () => {}, error: () => {}, debug: () => {} };

const temporaryFilePath = () =>
	path.join(os.tmpdir(), `server-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);

describe('Server database option', () => {
	let server;
	let filePath;

	beforeEach(() => {
		filePath = temporaryFilePath();
	});

	afterEach(() => {
		server?.httpServer?.stop(true);
		server = null;
		fs.rmSync(filePath, { force: true });
	});

	test('accepts a Database instance', () => {
		const database = new Database({ filePath, logger: quietLogger });
		server = new Server({ port: 0, database, logger: quietLogger });

		expect(server.database).toBe(database);
	});

	test('accepts a file path string and constructs a Database from it', () => {
		server = new Server({ port: 0, database: filePath, logger: quietLogger });

		expect(server.database).toBeInstanceOf(Database);
		expect(server.database.options.filePath).toBe(filePath);
	});

	test('throws on a database option that is neither instance nor string', () => {
		expect(() => new Server({ port: 0, database: 42, logger: quietLogger })).toThrow(
			'Database instance or a file path',
		);
		expect(() => new Server({ port: 0, database: { filePath }, logger: quietLogger })).toThrow(
			'Database instance or a file path',
		);
	});

	test('runs without a database', () => {
		server = new Server({ port: 0, logger: quietLogger });

		expect(server.database).toBeUndefined();
	});
});
