/**
 * The handover queue.
 *
 * The extension has nowhere to POST to — pastespot has no server — so captures
 * wait in chrome.storage.local until a pastespot tab exists to receive them.
 * Shared by the popup, the background worker, and the content script.
 */

export const QUEUE_KEY = 'pastespot:queue';

/** Matches BRIDGE_VERSION in src/app/extension.ts. Bump both together. */
export const BRIDGE_VERSION = 1;

export async function readQueue() {
  const stored = await chrome.storage.local.get(QUEUE_KEY);
  const queue = stored[QUEUE_KEY];
  return Array.isArray(queue) ? queue : [];
}

/**
 * Add a capture. Returns the new queue length so callers can report it.
 *
 * Appends rather than replaces: two quick captures before the desk is opened
 * must both survive.
 */
export async function enqueue(text) {
  const body = String(text ?? '').trim();
  if (!body) return null;

  const queue = await readQueue();
  queue.push({ id: crypto.randomUUID(), body, capturedAt: Date.now() });
  await chrome.storage.local.set({ [QUEUE_KEY]: queue });
  return queue.length;
}

/** Drop only the ids the desk confirmed, so a partial handover loses nothing. */
export async function removeFromQueue(ids) {
  const drop = new Set(ids);
  const queue = await readQueue();
  const left = queue.filter((item) => !drop.has(item.id));
  await chrome.storage.local.set({ [QUEUE_KEY]: left });
  return left.length;
}
