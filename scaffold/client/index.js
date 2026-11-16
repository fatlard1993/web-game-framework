import { Page, Router } from '@vanilla-bean/components';
import { paths } from '@fatlard1993/web-game-framework/client';
import { Create, Hub, Join } from '@fatlard1993/web-game-framework/ui';

import '@fatlard1993/web-game-framework/client/socket';
import '@vanilla-bean/components/app/reloadOnBuild';

import Play from './Play.js';
import Start from './Start.js';

// The start screen and the game are this game's own, made for players who may not read: pictures, one big button.
// The framework's lobby stays at #/hub for grown-ups and phones: more games, joining one by name, watching.
// Watching shows the game without playing it: the same view as a player's, without controls
class Watch extends Play {
	constructor(options, ...children) {
		super({ ...options, watch: true }, ...children);
	}
}

// Each screen by its path in the framework's map, which every link and redirect also builds from (href(paths.play, ...))
export const views = {
	[paths.start]: Start,
	[paths.play]: Play,
	[paths.watch]: Watch,
	[paths.hub]: Hub,
	[paths.create]: Create,
	[paths.join]: Join,
};

new Page({ appendTo: document.body, append: new Router({ views, defaultPath: paths.start }) });
