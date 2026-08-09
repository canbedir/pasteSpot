import { SLIP_BOUNDS, type Slip } from './types';

/** Roughly a slip's footprint in percent, used to judge whether a spot is taken. */
const CLEARANCE_X = 22;
const CLEARANCE_Y = 16;

/**
 * Candidate spots, in the order a person would fill a desk: left to right,
 * top to bottom, with a little room left at the edges.
 */
function* candidates(): Generator<{ x: number; y: number }> {
  const columns = [4, 26, 48, 62];
  const rows = [8, 26, 44, 60];
  for (const y of rows) {
    for (const x of columns) {
      yield { x, y };
    }
  }
}

function isClear(x: number, y: number, taken: Slip[]): boolean {
  return taken.every(
    (slip) => Math.abs(slip.x - x) > CLEARANCE_X || Math.abs(slip.y - y) > CLEARANCE_Y,
  );
}

/**
 * Pick somewhere to put a slip that arrived without a click — a keyboard paste,
 * or later an extension capture. Falls back to a jittered spot rather than
 * refusing, because losing the paste is far worse than an overlap.
 */
export function findFreeSpot(taken: Slip[]): { x: number; y: number } {
  for (const spot of candidates()) {
    if (isClear(spot.x, spot.y, taken)) return spot;
  }
  const { minX, maxX, minY, maxY } = SLIP_BOUNDS;
  return {
    x: minX + Math.random() * (maxX - minX),
    y: minY + Math.random() * (maxY - minY),
  };
}
