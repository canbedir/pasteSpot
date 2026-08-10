import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deskLayout } from './layout.ts';

const LAPTOP = [1440, 900] as const;
const PHONE = [390, 844] as const;
const PHONE_LANDSCAPE = [844, 390] as const;
const TABLET = [768, 1024] as const;

test('the widest desk keeps exactly the grid it always had', () => {
  const layout = deskLayout(...LAPTOP);
  assert.deepEqual(layout.columns, [3, 27, 51, 75]);
  assert.deepEqual(layout.rows, [7, 26, 45, 64]);
  assert.equal(layout.capacity, 14);
  assert.equal(layout.clearanceX, 22);
});

test('a phone gets one column, not four narrow ones', () => {
  const layout = deskLayout(...PHONE);
  assert.equal(layout.columns.length, 1);
  assert.equal(layout.rows.length, 6);
  assert.equal(layout.capacity, 6);
});

test('a tablet sits between the two', () => {
  const layout = deskLayout(...TABLET);
  assert.equal(layout.columns.length, 2);
  assert.ok(layout.capacity > 6 && layout.capacity <= 8, `capacity ${layout.capacity}`);
});

test('a short desk drops rows rather than crowding them', () => {
  const layout = deskLayout(...PHONE_LANDSCAPE);
  // 390px tall leaves 286px of room, which is two rows at most.
  assert.equal(layout.rows.length, 2);
  assert.equal(layout.capacity, 4);
});

test('dropped rows spread through the whole band instead of bunching at the top', () => {
  const short = deskLayout(390, 500);
  assert.ok(short.rows.length < 6, `expected fewer rows, got ${short.rows.length}`);
  // The last row still reaches the bottom of the band.
  assert.equal(short.rows.at(-1), 83);
  assert.equal(short.rows[0], 8);
});

test('clearance always stays under the spacing it is checked against', () => {
  for (const size of [LAPTOP, PHONE, TABLET, PHONE_LANDSCAPE, [1920, 1080], [320, 568]] as const) {
    const layout = deskLayout(size[0], size[1]);

    for (const positions of [layout.columns, layout.rows]) {
      if (positions.length < 2) continue;
      const clearance = positions === layout.columns ? layout.clearanceX : layout.clearanceY;
      for (let i = 1; i < positions.length; i += 1) {
        const gap = positions[i]! - positions[i - 1]!;
        assert.ok(
          gap > clearance,
          `at ${size[0]}x${size[1]} a gap of ${gap} does not clear ${clearance}`,
        );
      }
    }
  }
});

test('a single column reports a clearance nothing can slip past', () => {
  const layout = deskLayout(...PHONE);
  assert.equal(layout.clearanceX, 100);
});

test('every position stays on the desk', () => {
  for (const size of [LAPTOP, PHONE, TABLET, PHONE_LANDSCAPE, [320, 480]] as const) {
    const layout = deskLayout(size[0], size[1]);
    for (const x of layout.columns) assert.ok(x >= 0 && x <= 100, `x ${x}`);
    for (const y of layout.rows) assert.ok(y >= 0 && y <= 100, `y ${y}`);
    assert.ok(layout.capacity >= 1);
  }
});

test('an unmeasured desk falls back to the one it was designed on', () => {
  assert.deepEqual(deskLayout(0, 0), deskLayout(...LAPTOP));
});
