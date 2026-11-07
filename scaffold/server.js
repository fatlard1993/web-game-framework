import { mkdirSync } from 'fs';

import { serveStatic } from '@vanilla-bean/components/app';
import { Server, basicGameRoutes } from '@fatlard1993/web-game-framework';

import Game from './Game.js';

const routes = basicGameRoutes();

// The games' routes (list, create, join, exit, delete), then the built page and the files it loads
const router = server => async request => (await routes(request, server)) ?? serveStatic(request);

// The save file's folder has to exist before the database opens it
mkdirSync('./data', { recursive: true });

// 3000 when it's free, or else any free port, so two games can run side by side; PORT names one outright. Chosen once
// per process: `bun --hot` runs this file again on each change, and the server keeps its port through that.
const freePort = wanted => {
	try {
		Bun.serve({ port: wanted, fetch: () => new Response() }).stop(true);

		return wanted;
	} catch {
		return 0;
	}
};

globalThis.gamePort ??= Number(process.env.PORT) || freePort(3000);

const server = new Server({
	port: globalThis.gamePort,
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
