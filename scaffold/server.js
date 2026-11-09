import { mkdirSync, readFileSync, writeFileSync } from 'fs';

import { serveStatic } from '@vanilla-bean/components/app';
import { Server, basicGameRoutes } from '@fatlard1993/web-game-framework';

import Game from './Game.js';

const routes = basicGameRoutes();

// The games' routes (list, create, join, exit, delete), then the built page and the files it loads
const router = server => async request => (await routes(request, server)) ?? serveStatic(request);

// The save file's folder has to exist before the database opens it
mkdirSync('./data', { recursive: true });

// PORT names the port outright. Otherwise the one this game used last, kept in its data folder, or 3000, or any free
// one, so two games can run side by side: `bun --watch` starts this file over on each change, and the page carries on
// at the same address.
const PORT_FILE = './data/port';

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

const lastPort = () => {
	try {
		return Number(readFileSync(PORT_FILE, 'utf8')) || null;
	} catch {
		return null;
	}
};

const last = lastPort();
const port = Number(process.env.PORT) || (last && freePort(last)) || freePort(3000) || freePort(0);

if (!process.env.PORT) writeFileSync(PORT_FILE, String(port));

const server = new Server({
	port,
	Game,
	database: './data/games.json',
	router,
	websocket: {
		// A message from a player's page goes to the game it names (see client/Play.js and Game.receive)
		message: (socket, message) => {
			const data = JSON.parse(message);

			server.games[data.gameId]?.receive(data, socket);
		},
	},
});
