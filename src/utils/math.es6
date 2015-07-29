/**
 * Limits the number so it lies within a given range
 * @param {number} x
 * @param {number} [a = 0]
 * @param {number} [b = 1]
 * @return {number}
 */
function clamp(x, a = 0, b = 1) {
  if (a > b) { [a, b] = [b, a]; }

  return ~~Math.max(a, Math.min(b, parseInt(x, 10))) | 0;
}

export default { clamp };
