/**
 * `@fatlard1993/web-game-framework`
 *
 * Lightweight framework for building multiplayer web games
 */

// Core exports
export { default as Server } from './core/Server.js';
export { default as Game } from './core/Game.js';
export { default as Players } from './core/Players.js';
export { default as Database } from './core/Database.js';
export { default as basicGameRoutes } from './core/router/basicGameRoutes.js';

// Utils
export * from './utils/index.js';
