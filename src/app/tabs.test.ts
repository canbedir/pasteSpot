import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tabCapacity, tabWindow } from './tabs.ts';

test('a short strip shows every page', () => {
  assert.deepEqual(tabWindow(1, 0, 7), { start: 0, end: 1 });
  assert.deepEqual(tabWindow(7, 3, 7), { start: 0, end: 7 });
});

test('the active page is always inside the window', () => {
  for (let active = 0; active < 200; active++) {
    const { start, end } = tabWindow(200, active, 7);
    assert.ok(active >= start && active < end, `page ${active} fell outside ${start}..${end}`);
  }
});

test('the window is always full once there are enough pages', () => {
  for (let active = 0; active < 60; active++) {
    const { start, end } = tabWindow(60, active, 7);
    assert.equal(end - start, 7, `window was ${end - start} wide at page ${active}`);
    assert.ok(start >= 0 && end <= 60);
  }
});

test('the window sits centred in the middle and pins at the ends', () => {
  assert.deepEqual(tabWindow(60, 30, 7), { start: 27, end: 34 });
  assert.deepEqual(tabWindow(60, 0, 7), { start: 0, end: 7 });
  assert.deepEqual(tabWindow(60, 59, 7), { start: 53, end: 60 });
});

test('the last page is one step from the end of the strip', () => {
  const { end } = tabWindow(60, 59, 7);
  assert.equal(end, 60);
});

test('capacity drops on narrow desks rather than shrinking the tabs', () => {
  assert.equal(tabCapacity(390), 3);
  assert.equal(tabCapacity(768), 5);
  assert.equal(tabCapacity(1440), 7);
});

test('a narrow desk still keeps the active page in view', () => {
  const { start, end } = tabWindow(40, 39, tabCapacity(390));
  assert.ok(39 >= start && 39 < end);
  assert.equal(end - start, 3);
});
