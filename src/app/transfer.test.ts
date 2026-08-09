import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildExport, ImportError, parseImport, toPlainText } from './transfer.ts';
import { DEFAULT_SETTINGS, type Page, type Slip } from './types.ts';

const pages: Page[] = [
  { id: 'p1', name: 'desk', order: 0, createdAt: 1000 },
  { id: 'p2', name: 'work', order: 1, createdAt: 2000 },
];

const slips: Slip[] = [
  { id: 's1', pageId: 'p1', body: '146704', x: 10, y: 20, createdAt: 1100, updatedAt: 1100 },
  { id: 's2', pageId: 'p2', body: 'call the courier', x: 30, y: 40, createdAt: 2100, updatedAt: 2200 },
];

const exported = () => JSON.stringify(buildExport(pages, slips, DEFAULT_SETTINGS));

test('an export survives a round trip', () => {
  const back = parseImport(exported());
  assert.equal(back.pages.length, 2);
  assert.equal(back.slips.length, 2);
  assert.deepEqual(
    back.slips.map((s) => s.body).sort(),
    ['146704', 'call the courier'],
  );
});

test('import remaps every id so it can only ever add', () => {
  const back = parseImport(exported());
  const ids = [...back.pages.map((p) => p.id), ...back.slips.map((s) => s.id)];
  for (const id of ids) {
    assert.ok(!['p1', 'p2', 's1', 's2'].includes(id), `${id} was not remapped`);
  }
  // Slips must still point at the page they came from, under its new id.
  const workPage = back.pages.find((p) => p.name === 'work')!;
  const courier = back.slips.find((s) => s.body === 'call the courier')!;
  assert.equal(courier.pageId, workPage.id);
});

test('a slip whose page is missing lands on the first page instead of vanishing', () => {
  const orphaned = JSON.stringify({
    format: 'pastespot',
    version: 1,
    pages: [pages[0]],
    slips: [{ ...slips[1], pageId: 'gone' }],
  });
  const back = parseImport(orphaned);
  assert.equal(back.slips.length, 1);
  assert.equal(back.slips[0]!.pageId, back.pages[0]!.id);
});

test('out-of-range and missing coordinates are clamped onto the desk', () => {
  const wild = JSON.stringify({
    format: 'pastespot',
    version: 1,
    pages,
    slips: [
      { body: 'far right', pageId: 'p1', x: 900, y: 900 },
      { body: 'no position', pageId: 'p1' },
    ],
  });
  const back = parseImport(wild);
  for (const slip of back.slips) {
    assert.ok(slip.x >= 2 && slip.x <= 64, `x out of range: ${slip.x}`);
    assert.ok(slip.y >= 5 && slip.y <= 72, `y out of range: ${slip.y}`);
  }
});

test('blank slips are dropped rather than imported as ghosts', () => {
  const withBlanks = JSON.stringify({
    format: 'pastespot',
    version: 1,
    pages,
    slips: [...slips, { body: '   ', pageId: 'p1', x: 5, y: 5 }, { pageId: 'p1' }],
  });
  assert.equal(parseImport(withBlanks).slips.length, 2);
});

test('bad input fails with a message a person can act on', () => {
  assert.throws(() => parseImport('not json'), ImportError);
  assert.throws(() => parseImport('{"format":"something-else"}'), ImportError);
  assert.throws(() => parseImport('{"format":"pastespot"}'), ImportError);
  assert.throws(
    () => parseImport('{"format":"pastespot","pages":[],"slips":[]}'),
    ImportError,
  );
});

test('plain text groups slips under their page, oldest first', () => {
  const text = toPlainText(pages, slips);
  assert.match(text, /# desk/);
  assert.match(text, /# work/);
  assert.ok(text.indexOf('# desk') < text.indexOf('# work'), 'pages out of order');
  assert.ok(text.indexOf('146704') < text.indexOf('call the courier'));
});

test('an empty page is marked rather than silently skipped', () => {
  const text = toPlainText(pages, [slips[0]!]);
  assert.match(text, /# work\n\n\(empty\)/);
});
