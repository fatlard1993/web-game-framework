import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';

const freePort = wanted => {
	try {
		const probe = Bun.serve({ port: wanted, fetch: () => new Response() });
		const { port } = probe;

		probe.stop(true);

		return port;
	} catch {
		return null;
	}
};

const remembered = file => {
	try {
		return Number(readFileSync(file, 'utf8')) || null;
	} catch {
		return null;
	}
};

/**
 * The port a game listens on: PORT when it's set, else the one this game had last (kept in `file`, so a server that
 * starts over on every save stays at the address its page shows), else 3000, else any free one
 * @param {object} [options] - Options
 * @param {string} [options.file] - Where the port is remembered (default ./data/port)
 * @returns {number} The port
 */
export const autoPort = ({ file = './data/port' } = {}) => {
	if (Number(process.env.PORT)) return Number(process.env.PORT);

	const last = remembered(file);
	const port = (last && freePort(last)) || freePort(3000) || freePort(0);

	try {
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, String(port));
	} catch {
		// Not remembered this time: the next start picks again
	}

	return port;
};
