import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findFreeSpot } from './placement.ts';
import type { Slip } from './types.ts';

const slipAt = (x: number, y: number): Slip => ({
  id: `${x}-${y}`,
  pageId: 'p',
  body: 'x',
  x,
  y,
  createdAt: 0,
  updatedAt: 0,
});

/**
 * The grid used to collide with itself: columns 22 apart against a clearance of
 * 22 meant the first column ruled out the second, so a desk of 14 slips placed
 * 8 on the grid and scattered the rest at random.
 */
test('a full page of captures all land on the grid, none at random', () => {
  const taken: Slip[] = [];
  const spots = new Set<string>();

  for (let i = 0; i < 14; i++) {
    const spot = findFreeSpot(taken);
    assert.ok(Number.isInteger(spot.x), `slip ${i} was scattered, not placed: ${spot.x}`);
    spots.add(`${spot.x},${spot.y}`);
    taken.push(slipAt(spot.x, spot.y));
  }

  assert.equal(spots.size, 14, 'every capture should get its own spot');
});

test('the grid reaches the right-hand side of the desk', () => {
  const taken: Slip[] = [];
  const xs = new Set<number>();
  for (let i = 0; i < 16; i++) {
    const spot = findFreeSpot(taken);
    xs.add(spot.x);
    taken.push(slipAt(spot.x, spot.y));
  }
  // The old limit was 62, and only because 64 was the hard ceiling.
  assert.ok(Math.max(...xs) >= 75, `rightmost column was ${Math.max(...xs)}`);
});

test('an occupied spot is never handed out twice', () => {
  const first = findFreeSpot([]);
  const second = findFreeSpot([slipAt(first.x, first.y)]);
  assert.notDeepEqual(first, second);
});

test('a desk with no room left still returns somewhere on it', () => {
  const taken: Slip[] = [];
  for (let x = 0; x <= 100; x += 4) {
    for (let y = 0; y <= 100; y += 4) taken.push(slipAt(x, y));
  }
  const spot = findFreeSpot(taken);
  assert.ok(spot.x >= 3 && spot.x <= 75, `x was ${spot.x}`);
  assert.ok(spot.y >= 7 && spot.y <= 64, `y was ${spot.y}`);
});
