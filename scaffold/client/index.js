import { Page, Router } from '@vanilla-bean/components';
import { Create, Hub, Join } from '@fatlard1993/web-game-framework/ui';

import '@fatlard1993/web-game-framework/client/socket';
import '@vanilla-bean/components/app/reloadOnBuild';

import Play from './Play.js';

// The lobby is the framework's: a list of games to join, and a form to make one. Playing is this game's own.
class GameHub extends Hub {
	constructor(options, ...children) {
		super({ watch: false, ...options }, ...children);
	}
}

const views = {
	'/hub': GameHub,
	'/create': Create,
	'/join/:gameId': Join,
	'/play/:gameId': Play,
};

new Page({ appendTo: document.body, append: new Router({ views, defaultPath: '/hub' }) });
