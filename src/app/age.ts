/**
 * How much a slip has yellowed.
 *
 * Paper ages, and this desk has no other way of showing time at a glance: every
 * slip carries a timestamp, but reading fourteen timestamps is not glancing. A
 * tint costs no space, no control and no chrome, and it tells you which corner of
 * the desk is old before you have read a word.
 *
 * Returns 0 for something captured in the last couple of days and rises to 1 over
 * a year.
 *
 * The shape matters more than the endpoints. A logarithmic ramp was tried first
 * and was wrong in a way only visible on screen: a three-day-old slip already
 * looked tan, and everything past a month looked identical. Most of a note's life
 * is spent being weeks or months old, so that is where the range has to go.
 *
 * The exponent flattens the start and keeps the far end spread out:
 *
 *     a week    0.15    still obviously current
 *     a month   0.32
 *     3 months  0.53
 *     6 months  0.73
 *     a year    1.00    aged, and still perfectly readable
 */

const DAY = 86_400_000;

/** Where the tint stops. Past this, more yellow only costs legibility. */
const FULL_AGE_DAYS = 365;

/** Below this, paper is still fresh. Nothing from this week looks old. */
const FRESH_DAYS = 2;

/** Under 1 to flatten the first weeks. Found by looking at it, not by taste. */
const CURVE = 0.45;

export function patina(createdAt: number, now = Date.now()): number {
  const days = (now - createdAt) / DAY;

  // A clock that has gone backwards, or a slip from the future, is not aged.
  if (!Number.isFinite(days) || days <= FRESH_DAYS) return 0;
  if (days >= FULL_AGE_DAYS) return 1;

  return ((days - FRESH_DAYS) / (FULL_AGE_DAYS - FRESH_DAYS)) ** CURVE;
}
