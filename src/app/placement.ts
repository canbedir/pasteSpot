import type { DeskLayout } from './layout';
import type { Slip } from './types';

/**
 * Candidate spots, in the order a person would fill a desk: left to right,
 * top to bottom. The grid itself comes from `layout.ts`, which sizes it to the
 * desk rather than assuming the one it was designed on.
 */
function* candidates(layout: DeskLayout): Generator<{ x: number; y: number }> {
  for (const y of layout.rows) {
    for (const x of layout.columns) {
      yield { x, y };
    }
  }
}

function isClear(x: number, y: number, taken: Slip[], layout: DeskLayout): boolean {
  return taken.every(
    (slip) =>
      Math.abs(slip.x - x) > layout.clearanceX || Math.abs(slip.y - y) > layout.clearanceY,
  );
}

/**
 * Pick somewhere to put a slip that arrived without a click — a keyboard paste,
 * or a capture handed over by the extension. Falls back to a jittered spot rather
 * than refusing, because losing the paste is far worse than an overlap.
 */
export function findFreeSpot(taken: Slip[], layout: DeskLayout): { x: number; y: number } {
  for (const spot of candidates(layout)) {
    if (isClear(spot.x, spot.y, taken, layout)) return spot;
  }

  // Scatter within the grid's own extremes, so a fallback still lands on the desk.
  const minX = layout.columns[0]!;
  const maxX = layout.columns.at(-1)!;
  const minY = layout.rows[0]!;
  const maxY = layout.rows.at(-1)!;

  return {
    x: minX + Math.random() * (maxX - minX),
    y: minY + Math.random() * (maxY - minY),
  };
}
