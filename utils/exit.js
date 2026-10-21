/**
 * Graceful exit handler for Bun servers: Ctrl+C exits 130, SIGTERM exits 0, an uncaught exception exits 99 and an
 * unhandled rejection exits 1
 * @example
 * ```js
 * // In your server entry point:
 * import '@fatlard1993/web-game-framework/utils/exit';
 * ```
 */
import { handleExit } from '@vanilla-bean/components/app';

handleExit();
