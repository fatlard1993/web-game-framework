/**
 * Console-backed logger for when no logger is given
 * @param {object} [options] - Configuration options
 * @param {string} [options.prefix] - Prepended to each level tag, e.g. 'DB-' gives '[DB-INFO]'
 * @param {number} [options.verbosity] - 0 logs errors only, 1 adds info, 2 adds warnings, 3 adds debug
 * @returns {object} Logger with info, warning, error and debug methods
 */
export default function consoleLogger({ prefix = '', verbosity = 0 } = {}) {
	return {
		info: (...args) => verbosity >= 1 && console.log(`[${prefix}INFO]`, ...args),
		warning: (...args) => verbosity >= 2 && console.warn(`[${prefix}WARN]`, ...args),
		error: (...args) => console.error(`[${prefix}ERROR]`, ...args),
		debug: (...args) => verbosity >= 3 && console.log(`[${prefix}DEBUG]`, ...args),
	};
}
