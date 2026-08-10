import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DESK_EDGE, fitOnDesk, TAB_RESERVE } from './fit.ts';

/**
 * The old bounds were a fixed box — 64% across, 72% down — sized for the widest
 * slip that could ever exist. On a 1440px desk that left a 140px code slip with
 * 380px of unusable desk to its right. These fix that number in place.
 */

const DESK = { deskW: 1440, deskH: 900 };
const CODE = { slipW: 140, slipH: 86 };
const PARAGRAPH = { slipW: 302, slipH: 658 };

test('a narrow slip reaches nearly the whole width', () => {
  const fit = fitOnDesk({ x: 100, y: 10, ...CODE, ...DESK });
  const left = Math.round((fit.x / 100) * DESK.deskW);
  assert.equal(left, DESK.deskW - CODE.slipW - DESK_EDGE);
  // The old maxX of 64 stopped this slip at 922px.
  assert.ok(left > 1200, `expected past 1200px, got ${left}`);
});

test('a wide slip is held back further, by exactly its own width', () => {
  const code = fitOnDesk({ x: 100, y: 10, ...CODE, ...DESK });
  const paragraph = fitOnDesk({ x: 100, y: 10, ...PARAGRAPH, ...DESK });
  assert.ok(paragraph.x < code.x);
  assert.equal(
    Math.round(((code.x - paragraph.x) / 100) * DESK.deskW),
    PARAGRAPH.slipW - CODE.slipW,
  );
});

test('the right edge is reachable but never crossed', () => {
  for (const slipW of [90, 140, 240, 302, 420]) {
    const fit = fitOnDesk({ x: 140, y: 10, slipW, slipH: 100, ...DESK });
    const right = (fit.x / 100) * DESK.deskW + slipW;
    assert.ok(right <= DESK.deskW, `slip of ${slipW}px ends at ${right}`);
  }
});

test('the bottom keeps the tab strip clear', () => {
  const fit = fitOnDesk({ x: 10, y: 100, ...CODE, ...DESK });
  const bottom = Math.round((fit.y / 100) * DESK.deskH + CODE.slipH);
  assert.equal(bottom, DESK.deskH - TAB_RESERVE);
});

test('a slip larger than the desk pins to the corner rather than hanging off it', () => {
  const fit = fitOnDesk({ x: 80, y: 80, slipW: 600, slipH: 1200, deskW: 390, deskH: 844 });
  assert.equal(Math.round((fit.x / 100) * 390), DESK_EDGE);
  assert.equal(Math.round((fit.y / 100) * 844), DESK_EDGE);
});

test('a slip that fitted on a wide desk stays on screen on a phone', () => {
  // Placed comfortably at 70% of a laptop desk...
  const wide = fitOnDesk({ x: 70, y: 20, slipW: 211, slipH: 96, ...DESK });
  assert.equal(Math.round(wide.x), 70);
  // ...and pulled back in when the same slip is measured on a phone.
  const phone = fitOnDesk({ x: 70, y: 20, slipW: 211, slipH: 96, deskW: 390, deskH: 844 });
  const right = (phone.x / 100) * 390 + 211;
  assert.ok(right <= 390, `slip ends at ${right} on a 390px screen`);
});

test('negative and absurd input is clamped, not trusted', () => {
  const fit = fitOnDesk({ x: -50, y: -999, ...CODE, ...DESK });
  assert.equal(Math.round((fit.x / 100) * DESK.deskW), DESK_EDGE);
  assert.equal(Math.round((fit.y / 100) * DESK.deskH), DESK_EDGE);
});

test('an unmeasured desk hands the intent straight back', () => {
  assert.deepEqual(fitOnDesk({ x: 42, y: 17, slipW: 0, slipH: 0, deskW: 0, deskH: 0 }), {
    x: 42,
    y: 17,
  });
});
