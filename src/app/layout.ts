import { TAB_RESERVE, TOP_RESERVE } from './fit';

/**
 * The grid a desk of a given size lays its slips out on.
 *
 * Placement used to be one grid in percentages, tuned on a 1440px window: columns
 * at 3, 27, 51 and 75 percent. On a 390px phone those land at 12, 105, 199 and
 * 293px while the slips themselves are 177 to 322px wide, so six captures produced
 * five overlapping pairs and two slips were completely hidden underneath others —
 * measured, not guessed. Meanwhile the bottom 62% of the screen sat empty.
 *
 * A percentage grid cannot survive that, because a slip's width is set by its text
 * and the screen's is not. So the grid comes from the desk's real pixel size: a
 * narrow desk gets *fewer columns* rather than narrower cells, and a short one
 * fewer rows rather than tighter ones.
 *
 * The widest tier is deliberately identical to the old grid. Nothing about the
 * desktop desk changes here, only the sizes it was never designed for.
 */

export interface DeskLayout {
  /** Column positions, in percent of desk width. */
  columns: number[];
  /** Row positions, in percent of desk height. */
  rows: number[];
  /** How close two slips may sit before a spot counts as taken, in percent. */
  clearanceX: number;
  clearanceY: number;
  /** How many slips this desk holds before the next page opens. */
  capacity: number;
}

/**
 * The least vertical room a row can have, in px. A slip is about 85px tall, and a
 * grouped IBAN wrapping onto two lines reaches 105px, so anything under this puts
 * tall slips back on top of each other.
 */
const MIN_ROW_PX = 118;

/**
 * Tiers by desk width. Rows are a band and a count rather than fixed positions, so
 * dropping a row on a short screen spreads the rest through the whole band instead
 * of bunching them at the top.
 *
 * `capacity` is stated rather than taken from the cell count, so the widest tier
 * keeps the 14 it has always had and leaves the desk a little room to spare.
 */
const TIERS = [
  { minWidth: 900, columns: [3, 27, 51, 75], band: [7, 64], rows: 4, capacity: 14 },
  { minWidth: 560, columns: [4, 50], band: [7, 76], rows: 4, capacity: 8 },
  { minWidth: 0, columns: [5], band: [8, 83], rows: 6, capacity: 6 },
] as const;

/** `count` positions spread evenly across a band, inclusive of both ends. */
function spread([from, to]: readonly [number, number], count: number): number[] {
  if (count <= 1) return [from];
  const step = (to - from) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round((from + i * step) * 10) / 10);
}

/**
 * Clearance has to stay under the spacing it is checked against, or the grid rules
 * itself out: the original columns were 22 apart against a clearance of 22, so a
 * slip in the first column blocked the second and a full page scattered half its
 * slips at random.
 *
 * A single column has no neighbour to be near, so nothing horizontal can excuse an
 * overlap and the vertical check decides alone.
 */
function clearanceFor(positions: readonly number[]): number {
  if (positions.length < 2) return 100;

  let smallest = Infinity;
  for (let i = 1; i < positions.length; i += 1) {
    smallest = Math.min(smallest, positions[i]! - positions[i - 1]!);
  }
  return smallest - 2;
}

export function deskLayout(deskW: number, deskH: number): DeskLayout {
  // Before the first measurement, assume the desk this was designed on.
  const width = deskW > 0 ? deskW : 1440;
  const height = deskH > 0 ? deskH : 900;

  const tier = TIERS.find((candidate) => width >= candidate.minWidth) ?? TIERS.at(-1)!;

  const room = height - TOP_RESERVE - TAB_RESERVE;
  const rowCount = Math.max(1, Math.min(tier.rows, Math.floor(room / MIN_ROW_PX)));
  const rows = spread(tier.band, rowCount);
  const columns = [...tier.columns];

  return {
    columns,
    rows,
    clearanceX: clearanceFor(columns),
    clearanceY: clearanceFor(rows),
    capacity: Math.min(tier.capacity, columns.length * rows.length),
  };
}
