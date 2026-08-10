import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  countByDay,
  dayKey,
  monthGrid,
  monthsWithSlips,
  shiftMonth,
  slipsOnDay,
} from './calendar.ts';
import type { Slip } from './types.ts';

const at = (date: string, body = 'x'): Slip => ({
  id: `${date}-${body}`,
  pageId: 'p',
  body,
  x: 5,
  y: 5,
  createdAt: new Date(date).getTime(),
  updatedAt: new Date(date).getTime(),
});

test('a day key is local, not UTC', () => {
  // Grouping by UTC would file this under the day before in any timezone east of
  // Greenwich, which is the one day the person would not think to look on.
  const local = new Date(2026, 7, 10, 0, 30);
  assert.equal(dayKey(local.getTime()), '2026-08-10');

  const lateNight = new Date(2026, 7, 10, 23, 45);
  assert.equal(dayKey(lateNight.getTime()), '2026-08-10');
});

test('day keys sort lexically, which is why they are strings', () => {
  const keys = ['2026-08-09', '2026-12-01', '2026-01-31', '2025-11-05'];
  assert.deepEqual([...keys].sort(), ['2025-11-05', '2026-01-31', '2026-08-09', '2026-12-01']);
});

test('a month grid is whole weeks starting Monday', () => {
  // August 2026 starts on a Saturday and has 31 days.
  const grid = monthGrid(2026, 7);
  assert.equal(grid.length % 7, 0);
  assert.equal(grid.filter(Boolean).length, 31);
  // Saturday is the sixth column, so five blanks lead.
  assert.deepEqual(grid.slice(0, 5), [null, null, null, null, null]);
  assert.deepEqual(grid[5], { key: '2026-08-01', day: 1 });
});

test('a month starting on Monday has no lead blanks', () => {
  // June 2026 starts on a Monday.
  const grid = monthGrid(2026, 5);
  assert.deepEqual(grid[0], { key: '2026-06-01', day: 1 });
});

test('February knows about leap years', () => {
  assert.equal(monthGrid(2024, 1).filter(Boolean).length, 29);
  assert.equal(monthGrid(2026, 1).filter(Boolean).length, 28);
});

test('days are counted per day, not per month', () => {
  const counts = countByDay([
    at('2026-08-10T09:00', 'a'),
    at('2026-08-10T18:00', 'b'),
    at('2026-08-11T09:00', 'c'),
  ]);
  assert.equal(counts.get('2026-08-10'), 2);
  assert.equal(counts.get('2026-08-11'), 1);
  assert.equal(counts.get('2026-08-12'), undefined);
});

test('months with nothing in them are not offered', () => {
  const months = monthsWithSlips([at('2026-08-10'), at('2026-03-02'), at('2025-12-30')]);
  assert.deepEqual(months, [
    { year: 2026, month: 7 },
    { year: 2026, month: 2 },
    { year: 2025, month: 11 },
  ]);
});

test('a day reads in the order it happened', () => {
  const slips = [
    at('2026-08-10T18:00', 'evening'),
    at('2026-08-10T09:00', 'morning'),
    at('2026-08-11T09:00', 'tomorrow'),
  ];
  assert.deepEqual(
    slipsOnDay(slips, '2026-08-10').map((slip) => slip.body),
    ['morning', 'evening'],
  );
});

test('stepping a month rolls the year over in both directions', () => {
  assert.deepEqual(shiftMonth({ year: 2026, month: 11 }, 1), { year: 2027, month: 0 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 0 }, -1), { year: 2025, month: 11 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 5 }, 3), { year: 2026, month: 8 });
});
