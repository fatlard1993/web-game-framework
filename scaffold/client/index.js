import { Page, Router } from '@vanilla-bean/components';
import { Create, Hub, Join } from '@fatlard1993/web-game-framework/ui';

import '@fatlard1993/web-game-framework/client/socket';
import '@vanilla-bean/components/app/reloadOnBuild';

import Play from './Play.js';
import Start from './Start.js';

// The start screen and the game are this game's own, made for players who may not read: pictures, one big button.
// The framework's lobby stays at #/hub for grown-ups and phones: more games, joining one by name, watching.
class GameHub extends Hub {
	constructor(options, ...children) {
		super({ watch: false, ...options }, ...children);
	}
}

const views = {
	'/': Start,
	'/play/:gameId': Play,
	'/hub': GameHub,
	'/create': Create,
	'/join/:gameId': Join,
};

new Page({ appendTo: document.body, append: new Router({ views, defaultPath: '/' }) });
