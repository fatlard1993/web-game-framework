import { href, paths, pathsWith } from './paths.js';

describe('paths', () => {
	test("href fills a path's params, encoded", () => {
		expect(href(paths.join, { gameId: 'a b' })).toBe('#/join/a%20b');
		expect(href(paths.hub)).toBe('#/hub');
	});

	test("a game's own paths go over the framework's, the rest kept", () => {
		expect(pathsWith({ hub: '/lobby' })).toEqual({ ...paths, hub: '/lobby' });
		expect(pathsWith()).toEqual(paths);
	});
});
