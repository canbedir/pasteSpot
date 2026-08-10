/**
 * Which tabs the strip shows.
 *
 * The strip used to hold one tab per page inside a hidden horizontal scroller.
 * At 60 pages that made it 3715px wide in a 1325px window, which put the "new
 * page" button 2400px out of reach, and stepping with the keyboard never scrolled
 * the active tab back into view — so the strip stopped saying which page you were
 * on. Both were measured, not theorised.
 *
 * So the strip now shows a fixed window around the active page and counts the
 * rest. Nothing scrolls, the button never moves, and the number of tab elements
 * stops growing with the desk's history.
 */

/** How many tabs fit, by desk width. Narrow screens get fewer, not smaller. */
export function tabCapacity(deskWidth: number): number {
  if (deskWidth < 520) return 3;
  if (deskWidth < 820) return 5;
  return 7;
}

/**
 * The slice of pages to render, kept centred on the active page and pinned at
 * either end so the first and last pages are always reachable in one step.
 */
export function tabWindow(
  count: number,
  active: number,
  capacity: number,
): { start: number; end: number } {
  if (count <= capacity) return { start: 0, end: count };

  const half = Math.floor(capacity / 2);
  const start = Math.max(0, Math.min(active - half, count - capacity));
  return { start, end: start + capacity };
}
