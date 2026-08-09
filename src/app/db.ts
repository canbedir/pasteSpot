import { createStore, get, set } from 'idb-keyval';
import { DEFAULT_SETTINGS, type Snapshot } from './types';

/**
 * The only module allowed to touch IndexedDB.
 *
 * Everything else goes through the store. That keeps the debounce in one place,
 * and it means the future browser extension needs a change here rather than a
 * second, drifting copy of the write path. See docs/EXTENSION.md.
 */

const DB_NAME = 'pastespot';
const STORE_NAME = 'desk';
const SNAPSHOT_KEY = 'snapshot';

/** Bump only for a breaking shape change, and migrate additively. */
export const SCHEMA_VERSION = 1;

/**
 * Long enough to collapse a burst of keystrokes, short enough that a person who
 * pastes and immediately reaches for the tab close button is already safe.
 */
const DEBOUNCE_MS = 400;

const store = createStore(DB_NAME, STORE_NAME);

let timer: ReturnType<typeof setTimeout> | undefined;
let pending: Snapshot | null = null;
let listenersAttached = false;

export function emptySnapshot(): Snapshot {
  return {
    version: SCHEMA_VERSION,
    pages: [],
    slips: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export async function loadSnapshot(): Promise<Snapshot> {
  try {
    const stored = await get<Snapshot>(SNAPSHOT_KEY, store);
    if (!stored) return emptySnapshot();
    return {
      version: SCHEMA_VERSION,
      pages: stored.pages ?? [],
      slips: stored.slips ?? [],
      settings: { ...DEFAULT_SETTINGS, ...stored.settings },
    };
  } catch (error) {
    // A blocked or unavailable IndexedDB must not blank the desk on load.
    console.error('pastespot: could not read saved desk', error);
    return emptySnapshot();
  }
}

/** Write immediately, bypassing the debounce. */
export async function flush(): Promise<void> {
  if (timer !== undefined) {
    clearTimeout(timer);
    timer = undefined;
  }
  if (!pending) return;
  const snapshot = pending;
  pending = null;
  try {
    await set(SNAPSHOT_KEY, snapshot, store);
  } catch (error) {
    console.error('pastespot: could not save desk', error);
  }
}

export function queueSave(snapshot: Snapshot): void {
  pending = snapshot;
  attachFlushListeners();
  if (timer !== undefined) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    void flush();
  }, DEBOUNCE_MS);
}

/**
 * Closing the tab right after pasting is this product's most common exit path,
 * so a debounce timer that never fires would lose the one slip that mattered.
 * `visibilitychange` is the reliable signal; `pagehide` covers bfcache unloads.
 */
function attachFlushListeners(): void {
  if (listenersAttached || typeof document === 'undefined') return;
  listenersAttached = true;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
  window.addEventListener('pagehide', () => {
    void flush();
  });
}
