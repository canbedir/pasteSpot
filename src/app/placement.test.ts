import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deskLayout } from './layout.ts';
import { findFreeSpot } from './placement.ts';
import type { Slip } from './types.ts';

const LAPTOP = deskLayout(1440, 900);
const PHONE = deskLayout(390, 844);

const slipAt = (x: number, y: number): Slip => ({
  id: `${x}-${y}`,
  pageId: 'p',
  body: 'x',
  x,
  y,
  createdAt: 0,
  updatedAt: 0,
});

/** Fill a desk to capacity and report where everything landed. */
function fill(layout: ReturnType<typeof deskLayout>) {
  const taken: Slip[] = [];
  const spots: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < layout.capacity; i += 1) {
    const spot = findFreeSpot(taken, layout);
    spots.push(spot);
    taken.push(slipAt(spot.x, spot.y));
  }
  return spots;
}

/**
 * The grid used to rule itself out: columns 22 apart against a clearance of 22
 * meant the first column blocked the second, so a full page placed 8 slips on the
 * grid and scattered the rest at random.
 */
test('a full page of captures all land on the grid, on every desk size', () => {
  for (const layout of [LAPTOP, PHONE, deskLayout(768, 1024), deskLayout(844, 390)]) {
    const spots = fill(layout);
    const unique = new Set(spots.map((s) => `${s.x},${s.y}`));
    assert.equal(unique.size, layout.capacity, `duplicate spots on a ${layout.capacity}-slip desk`);

    for (const spot of spots) {
      assert.ok(
        layout.columns.includes(spot.x) && layout.rows.includes(spot.y),
        `(${spot.x}, ${spot.y}) was scattered rather than placed`,
      );
    }
  }
});

/**
 * The bug this work exists for. On a phone the old grid put four columns inside
 * 390px while slips were 177–322px wide: six captures, five overlapping pairs.
 */
test('a phone desk stacks in one column, so nothing can hide behind anything', () => {
  const spots = fill(PHONE);
  assert.equal(new Set(spots.map((s) => s.x)).size, 1, 'a phone should use one column');

  const ys = spots.map((s) => s.y).sort((a, b) => a - b);
  for (let i = 1; i < ys.length; i += 1) {
    // 844px tall: 15% of it is 127px, comfortably past the tallest slip seen.
    assert.ok(ys[i]! - ys[i - 1]! >= 14, `rows only ${ys[i]! - ys[i - 1]!}% apart`);
  }
});

test('a phone fills from the top down, in the order things were captured', () => {
  const spots = fill(PHONE);
  const ys = spots.map((s) => s.y);
  assert.deepEqual(ys, [...ys].sort((a, b) => a - b));
});

test('the laptop grid still reaches the right-hand side', () => {
  const spots = fill(LAPTOP);
  assert.ok(Math.max(...spots.map((s) => s.x)) >= 75);
});

test('an occupied spot is never handed out twice', () => {
  const first = findFreeSpot([], LAPTOP);
  const second = findFreeSpot([slipAt(first.x, first.y)], LAPTOP);
  assert.notDeepEqual(first, second);
});

test('a desk with no room left still returns somewhere on it', () => {
  const taken: Slip[] = [];
  for (let x = 0; x <= 100; x += 4) {
    for (let y = 0; y <= 100; y += 4) taken.push(slipAt(x, y));
  }
  for (const layout of [LAPTOP, PHONE]) {
    const spot = findFreeSpot(taken, layout);
    assert.ok(spot.x >= layout.columns[0]! && spot.x <= layout.columns.at(-1)!, `x ${spot.x}`);
    assert.ok(spot.y >= layout.rows[0]! && spot.y <= layout.rows.at(-1)!, `y ${spot.y}`);
  }
});
