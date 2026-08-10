import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BRIDGE_VERSION, parseCapture } from './extension.ts';

const valid = {
  source: 'pastespot-extension',
  version: BRIDGE_VERSION,
  batch: 'batch-1',
  items: ['146704', 'call the courier'],
};

test('a well-formed handover is accepted', () => {
  const parsed = parseCapture(valid);
  assert.ok(parsed);
  assert.equal(parsed.batch, 'batch-1');
  assert.deepEqual(parsed.items, ['146704', 'call the courier']);
});

test('anything not from the extension is ignored', () => {
  assert.equal(parseCapture(null), null);
  assert.equal(parseCapture('a string'), null);
  assert.equal(parseCapture(42), null);
  assert.equal(parseCapture({ ...valid, source: 'somewhere-else' }), null);
  assert.equal(parseCapture({ ...valid, source: undefined }), null);
});

test('a version mismatch is refused rather than guessed at', () => {
  assert.equal(parseCapture({ ...valid, version: BRIDGE_VERSION + 1 }), null);
  assert.equal(parseCapture({ ...valid, version: undefined }), null);
});

test('a handover with no usable batch id is refused', () => {
  // Without a batch the extension could never be told what landed, so it would
  // either clear the queue blindly or never clear it.
  assert.equal(parseCapture({ ...valid, batch: '' }), null);
  assert.equal(parseCapture({ ...valid, batch: 7 }), null);
  assert.equal(parseCapture({ ...valid, batch: undefined }), null);
});

test('junk inside items is dropped, not trusted', () => {
  const parsed = parseCapture({
    ...valid,
    items: ['keep me', '', '   ', 42, null, { body: 'nope' }, 'keep me too'],
  });
  assert.ok(parsed);
  assert.deepEqual(parsed.items, ['keep me', 'keep me too']);
});

test('a handover with nothing usable left is refused', () => {
  assert.equal(parseCapture({ ...valid, items: [] }), null);
  assert.equal(parseCapture({ ...valid, items: ['', '  ', 9] }), null);
  assert.equal(parseCapture({ ...valid, items: 'not an array' }), null);
});
