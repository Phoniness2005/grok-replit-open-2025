/**
 * Power of 10 rule 5 assertion primitive.
 * Side-effect free: it only returns a boolean. Callers clamp, reset, or bail.
 * This function is the assertion facility and is exempt from the density count.
 * @param {boolean} condition
 * @returns {boolean}
 */
export function assertThat(condition) {
  const isBoolean = typeof condition === 'boolean';
  const isTrue = condition === true;
  return isBoolean && isTrue;
}
