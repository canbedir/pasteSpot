/**
 * Runs on the pastespot origin and hands the queue to the desk.
 *
 * It does not touch IndexedDB. The page stores everything through its own
 * single write path, so the schema lives in exactly one codebase. The queue is
 * only cleared for items the page acknowledges.
 */

const QUEUE_KEY = 'pastespot:queue';
const BRIDGE_VERSION = 1;
const FROM_EXTENSION = 'pastespot-extension';
const FROM_APP = 'pastespot-app';

/** Batches still waiting for an acknowledgement, by batch id. */
const pending = new Map();

async function readQueue() {
  const stored = await chrome.storage.local.get(QUEUE_KEY);
  const queue = stored[QUEUE_KEY];
  return Array.isArray(queue) ? queue : [];
}

async function drain() {
  const queue = await readQueue();
  if (queue.length === 0) return;

  const batch = crypto.randomUUID();
  pending.set(
    batch,
    queue.map((item) => item.id),
  );

  window.postMessage(
    {
      source: FROM_EXTENSION,
      version: BRIDGE_VERSION,
      batch,
      items: queue.map((item) => item.body),
    },
    window.location.origin,
  );

  // If the desk never answers, keep the queue and try again next time.
  setTimeout(() => pending.delete(batch), 5000);
}

window.addEventListener('message', async (event) => {
  if (event.source !== window) return;
  if (event.origin !== window.location.origin) return;

  const data = event.data;
  if (!data || data.source !== FROM_APP || data.type !== 'ack') return;

  const ids = pending.get(data.batch);
  if (!ids) return;
  pending.delete(data.batch);

  const drop = new Set(ids);
  const queue = await readQueue();
  await chrome.storage.local.set({
    [QUEUE_KEY]: queue.filter((item) => !drop.has(item.id)),
  });
});

// Anything captured while the desk is already open should land immediately.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[QUEUE_KEY]) {
    const next = changes[QUEUE_KEY].newValue;
    if (Array.isArray(next) && next.length > 0) void drain();
  }
});

void drain();
