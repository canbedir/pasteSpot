import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

/**
 * db.ts opens IndexedDB the moment it is imported, so the store cannot be loaded
 * in a bare runtime without something answering. Nothing here reads or writes:
 * a request that never settles leaves every save pending, which is exactly what
 * these tests want, since they set state directly rather than loading it.
 */
const globals = globalThis as { indexedDB?: unknown };
globals.indexedDB ??= { open: () => ({ result: null }) };

const { useDesk, slipsOnPage } = await import('./store.ts');
const { DEFAULT_SETTINGS } = await import('./types.ts');
type Slip = import('./types.ts').Slip;
type Page = import('./types.ts').Page;

const page = (id: string, order = 0): Page => ({ id, name: id, order, createdAt: 0 });

const slip = (id: string, pageId = 'p1', body = `body ${id}`): Slip => ({
  id,
  pageId,
  body,
  x: 10,
  y: 10,
  createdAt: 1,
  updatedAt: 1,
});

function desk(pages: Page[], slips: Slip[]) {
  useDesk.setState({
    ready: true,
    pages,
    slips,
    settings: { ...DEFAULT_SETTINGS },
    activePageId: pages[0]!.id,
    query: '',
    revealedId: null,
    history: [],
  });
}

beforeEach(() => desk([page('p1')], [slip('s1'), slip('s2')]));

test('deleting a slip can be taken back, and says which one came back', () => {
  useDesk.getState().removeSlip('s1');
  assert.equal(useDesk.getState().slips.length, 1);

  useDesk.getState().undo();
  const after = useDesk.getState();
  assert.deepEqual(
    after.slips.map((s) => s.id),
    ['s1', 's2'],
  );
  // Lighting the restored slip is the only acknowledgement there is.
  assert.equal(after.revealedId, 's1');
});

test('a blank slip is a misclick, not a deletion worth remembering', () => {
  desk([page('p1')], [slip('s1', 'p1', '   ')]);
  useDesk.getState().removeSlip('s1');
  assert.equal(useDesk.getState().history.length, 0);
});

test('typing is not on the stack; the browser already owns text undo', () => {
  useDesk.getState().updateSlip('s1', 'changed');
  useDesk.getState().updateSlip('s1', 'changed again');
  assert.equal(useDesk.getState().history.length, 0);
});

test('a move is one step, and puts the slip back where it was', () => {
  useDesk.getState().moveSlip('s1', 80, 40);
  assert.equal(useDesk.getState().history.length, 1);

  useDesk.getState().undo();
  const back = useDesk.getState().slips.find((s) => s.id === 's1');
  assert.deepEqual([back?.x, back?.y], [10, 10]);
});

test('a moved slip comes to the front, where paint order puts it on top', () => {
  // Paint order is array order, so a slip dropped on an older one used to end up
  // underneath it with no way to raise it.
  assert.deepEqual(
    useDesk.getState().slips.map((s) => s.id),
    ['s1', 's2'],
  );
  useDesk.getState().moveSlip('s1', 40, 40);
  assert.deepEqual(
    useDesk.getState().slips.map((s) => s.id),
    ['s2', 's1'],
  );
});

test('undoing a move restores the stacking order too', () => {
  useDesk.getState().moveSlip('s1', 40, 40);
  useDesk.getState().undo();
  assert.deepEqual(
    useDesk.getState().slips.map((s) => s.id),
    ['s1', 's2'],
  );
});

test('deleting a page brings back its slips as well as the page', () => {
  desk([page('p1'), page('p2', 1)], [slip('s1', 'p1'), slip('s2', 'p2'), slip('s3', 'p2')]);
  useDesk.getState().removePage('p2');
  assert.equal(useDesk.getState().slips.length, 1);

  useDesk.getState().undo();
  const after = useDesk.getState();
  assert.equal(after.pages.length, 2);
  assert.equal(slipsOnPage(after, 'p2').length, 2);
});

test('undoing a new page never leaves the desk pointing at nothing', () => {
  const added = useDesk.getState().addPage();
  assert.equal(useDesk.getState().activePageId, added);

  useDesk.getState().undo();
  const after = useDesk.getState();
  assert.ok(
    after.pages.some((p) => p.id === after.activePageId),
    'active page must exist',
  );
});

test('a capture can be taken back; an empty slip from a click cannot', () => {
  useDesk.getState().captureText('146704');
  assert.equal(useDesk.getState().history.length, 1);

  useDesk.getState().undo();
  assert.equal(useDesk.getState().slips.length, 2);

  const before = useDesk.getState().history.length;
  useDesk.getState().addSlip(20, 20);
  assert.equal(useDesk.getState().history.length, before);
});

test('an import is one step, so the wrong file is one keystroke to reverse', () => {
  useDesk.getState().importSnapshot([page('imported', 5)], [slip('i1', 'imported')]);
  assert.equal(useDesk.getState().pages.length, 2);

  useDesk.getState().undo();
  assert.deepEqual(
    useDesk.getState().pages.map((p) => p.id),
    ['p1'],
  );
});

test('undo with nothing to undo does nothing at all', () => {
  const before = useDesk.getState().slips;
  useDesk.getState().undo();
  assert.equal(useDesk.getState().slips, before);
});

test('undo walks back one change at a time', () => {
  useDesk.getState().removeSlip('s1');
  useDesk.getState().removeSlip('s2');
  assert.equal(useDesk.getState().slips.length, 0);

  useDesk.getState().undo();
  assert.equal(useDesk.getState().slips.length, 1);
  useDesk.getState().undo();
  assert.equal(useDesk.getState().slips.length, 2);
  assert.equal(useDesk.getState().canUndo(), false);
});

test('the stack is capped, so a long session cannot grow without bound', () => {
  for (let i = 0; i < 120; i++) useDesk.getState().moveSlip('s1', i % 90, 20);
  assert.equal(useDesk.getState().history.length, 40);
});

test('labelling a slip is undoable and leaves updatedAt alone', () => {
  const before = useDesk.getState().slips.find((s) => s.id === 's1')!.updatedAt;
  useDesk.getState().setKeywords('s1', ['lol']);

  const labelled = useDesk.getState().slips.find((s) => s.id === 's1')!;
  assert.deepEqual(labelled.keywords, ['lol']);
  assert.equal(labelled.updatedAt, before);

  useDesk.getState().undo();
  assert.equal(useDesk.getState().slips.find((s) => s.id === 's1')?.keywords, undefined);
});
