import { customAlphabet } from 'nanoid';

/**
 * Simple alphanumeric ID generator
 * Generates 5-character IDs like: "aB3xY", "Kp9Wq"
 * @example
 * ```js
 * import { simpleId } from '@fatlard1993/web-game-framework/utils';
 * const id = simpleId(); // "aB3xY"
 * ```
 */
export const simpleId = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 5);
