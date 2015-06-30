'use strict';

/**
 * Limits the number so it lies within a given range
 * @param {number} x
 * @param {number} [a = 0]
 * @param {number} [b = 1]
 * @return {number}
 */
export function clamp(x, a = 0, b = 1) {
  if (a > b) { [a, b] = [b, a]; }

  return ~~Math.max(a, Math.min(b, parseInt(x))) | 0;
}
