// Note: randInt and randFromArray are available from vanilla-bean-components/utils
// We don't re-export them here to avoid ambiguous imports when both are used together
import { randInt } from '@vanilla-bean/components/utils';

/**
 * Shuffle an array in place (Fisher-Yates algorithm)
 * @param {Array} array - Array to shuffle
 * @returns {Array} The shuffled array (same reference)
 * @example
 * ```js
 * const deck = [1, 2, 3, 4, 5];
 * shuffleArray(deck); // [3, 1, 5, 2, 4]
 * ```
 */
export const shuffleArray = array => {
	for (let index = array.length - 1; index > 0; index--) {
		const rIndex = Math.floor(Math.random() * (index + 1));
		[array[index], array[rIndex]] = [array[rIndex], array[index]];
	}

	return array;
};

/**
 * Select an item based on weighted probabilities
 * @param {object} items - Object where keys are items and values are percentages (must sum to 100)
 * @returns {string} The selected item key
 * @example
 * ```js
 * const item = weightedChance({
 *   common: 70,
 *   rare: 25,
 *   legendary: 5
 * }); // "common" (70% chance)
 * ```
 */
export const weightedChance = items => {
	const percentChance = randInt(0, 100);
	let sum = 0;

	// Validate sum is 100
	Object.values(items).forEach(chance => {
		sum += chance;
	});

	if (sum !== 100) {
		throw new Error(`weightedChance sum is not 100%: ${sum} || ${Object.keys(items).join(', ')}`);
	}

	sum = 0;

	// Select item
	const itemNames = Object.keys(items);
	for (let x = 0; x < itemNames.length; ++x) {
		sum += items[itemNames[x]];
		if (percentChance <= sum) return itemNames[x];
	}
};

/**
 * Test a percentage chance
 * @param {number} percentage - Percentage (0-100)
 * @returns {boolean} True if chance succeeded
 * @example
 * ```js
 * if (chance(25)) {
 *   console.log('25% chance triggered!');
 * }
 * ```
 */
export const chance = (percentage = 50) => percentage > 0 && randInt(0, 100) <= percentage;
