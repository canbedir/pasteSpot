import type { Slip } from './types';

/** Roughly a slip's footprint in percent, used to judge whether a spot is taken. */
const CLEARANCE_X = 22;
const CLEARANCE_Y = 16;

/**
 * Candidate spots, in the order a person would fill a desk: left to right,
 * top to bottom, with a little room left at the edges.
 *
 * Column spacing has to exceed CLEARANCE_X or the grid collides with itself:
 * the old columns were 22 apart against a clearance of 22, so a slip in the
 * first column ruled out the second, and a full desk of 14 landed 8 on the grid
 * and the rest at random. The right-hand column now runs out to 75, which only
 * became usable once `fit.ts` replaced the fixed 64% limit.
 */
function* candidates(): Generator<{ x: number; y: number }> {
  const columns = [3, 27, 51, 75];
  const rows = [7, 26, 45, 64];
  for (const y of rows) {
    for (const x of columns) {
      yield { x, y };
    }
  }
}

/** The band the fallback scatters within — the grid's own extremes. */
const SCATTER = { minX: 3, maxX: 75, minY: 7, maxY: 64 } as const;

function isClear(x: number, y: number, taken: Slip[]): boolean {
  return taken.every(
    (slip) => Math.abs(slip.x - x) > CLEARANCE_X || Math.abs(slip.y - y) > CLEARANCE_Y,
  );
}

/**
 * Pick somewhere to put a slip that arrived without a click — a keyboard paste,
 * or a capture handed over by the extension. Falls back to a jittered spot rather
 * than refusing, because losing the paste is far worse than an overlap.
 */
export function findFreeSpot(taken: Slip[]): { x: number; y: number } {
  for (const spot of candidates()) {
    if (isClear(spot.x, spot.y, taken)) return spot;
  }
  const { minX, maxX, minY, maxY } = SCATTER;
  return {
    x: minX + Math.random() * (maxX - minX),
    y: minY + Math.random() * (maxY - minY),
  };
}
