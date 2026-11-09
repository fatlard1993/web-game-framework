import { Server, basicGameRoutes } from '@fatlard1993/web-game-framework';

import Game from './Game.js';

const routes = basicGameRoutes();

// One server for the page and every game: the games' routes (list, create, join, exit, delete), and the built page for
// the rest. Players act and are sent their view of the game over the socket; the framework ties each to its player.
// 'auto' port: PORT if set, else the one this game had last, else 3000, else any free one.
export const server = new Server({
	port: 'auto',
	Game,
	database: './data/games.json',
	router: running => request => routes(request, running),
	static: true,
});
