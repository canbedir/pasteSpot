import assert from 'node:assert/strict';
import { test } from 'node:test';
import { patina } from './age.ts';

const DAY = 86_400_000;
const NOW = new Date(2026, 7, 10, 12, 0).getTime();
const daysAgo = (days: number) => NOW - days * DAY;

test('nothing from the last couple of days is aged at all', () => {
  assert.equal(patina(NOW, NOW), 0);
  assert.equal(patina(daysAgo(0.5), NOW), 0);
  assert.equal(patina(daysAgo(2), NOW), 0);
});

test('yellowing rises with age and stops at a year', () => {
  const week = patina(daysAgo(7), NOW);
  const month = patina(daysAgo(30), NOW);
  const half = patina(daysAgo(180), NOW);
  const year = patina(daysAgo(365), NOW);

  assert.ok(week > 0 && week < month, `week ${week} month ${month}`);
  assert.ok(month < half && half < year, `month ${month} half ${half} year ${year}`);
  assert.equal(year, 1);
  assert.equal(patina(daysAgo(3000), NOW), 1);
});

test('recent days separate more than distant ones', () => {
  // A week versus a month should open a bigger gap than eleven versus twelve.
  const early = patina(daysAgo(30), NOW) - patina(daysAgo(7), NOW);
  const late = patina(daysAgo(365), NOW) - patina(daysAgo(335), NOW);
  assert.ok(early > late, `early gap ${early} should exceed late gap ${late}`);
});

/**
 * The shape, pinned down. The first attempt at this curve had a week at 0.33 and
 * a month at 0.58, which on screen meant a three-day-old slip looked tan and
 * everything past a month looked identical.
 */
test('most of the range is spent on the ages a note actually reaches', () => {
  const week = patina(daysAgo(7), NOW);
  const month = patina(daysAgo(30), NOW);
  const quarter = patina(daysAgo(90), NOW);
  const halfYear = patina(daysAgo(180), NOW);

  assert.ok(week < 0.2, `a week should still look current, got ${week}`);
  assert.ok(month > 0.25 && month < 0.4, `a month reads as ${month}`);
  assert.ok(quarter > 0.45 && quarter < 0.6, `three months reads as ${quarter}`);
  assert.ok(halfYear > 0.65 && halfYear < 0.8, `six months reads as ${halfYear}`);
});

test('a clock that went backwards does not produce a negative tint', () => {
  assert.equal(patina(NOW + 10 * DAY, NOW), 0);
});

test('nonsense timestamps are treated as fresh rather than throwing', () => {
  assert.equal(patina(Number.NaN, NOW), 0);
  assert.equal(patina(Number.POSITIVE_INFINITY, NOW), 0);
});

test('the value is always usable as an opacity', () => {
  for (const days of [0, 0.1, 1, 2, 9, 45, 120, 364, 365, 900]) {
    const value = patina(daysAgo(days), NOW);
    assert.ok(value >= 0 && value <= 1, `${days} days gave ${value}`);
  }
});
