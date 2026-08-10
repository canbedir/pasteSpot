/**
 * Receives captures from the browser extension.
 *
 * The extension deliberately does not write IndexedDB itself. It hands text to
 * the page over `postMessage`, and the app stores it through the same path as
 * every other capture. That keeps `db.ts` the only writer and means the schema
 * cannot drift between two codebases. See docs/EXTENSION.md.
 */

/** Bumped only if the message shape changes in a way the extension must match. */
export const BRIDGE_VERSION = 1;

const FROM_EXTENSION = 'pastespot-extension';
const FROM_APP = 'pastespot-app';

export interface CaptureMessage {
  source: typeof FROM_EXTENSION;
  version: number;
  /** Correlates the acknowledgement, so the extension only clears what landed. */
  batch: string;
  items: string[];
}

/**
 * Validate an incoming message before trusting any of it.
 *
 * Anything on the page can post a message, so nothing here may be assumed.
 * A same-origin script could forge this, but such a script already has full
 * access to the database, so this is a shape guard rather than a trust boundary.
 */
export function parseCapture(data: unknown): CaptureMessage | null {
  if (typeof data !== 'object' || data === null) return null;
  const message = data as Record<string, unknown>;

  if (message.source !== FROM_EXTENSION) return null;
  if (message.version !== BRIDGE_VERSION) return null;
  if (typeof message.batch !== 'string' || !message.batch) return null;
  if (!Array.isArray(message.items)) return null;

  const items = message.items.filter(
    (item): item is string => typeof item === 'string' && item.trim() !== '',
  );
  if (items.length === 0) return null;

  return { source: FROM_EXTENSION, version: BRIDGE_VERSION, batch: message.batch, items };
}

/**
 * Listen for handovers. Returns an unsubscribe function.
 *
 * The acknowledgement is what lets the extension drop its queue. Without it a
 * failed handover would clear the queue anyway and silently lose the capture.
 */
export function listenForExtensionCaptures(capture: (body: string) => unknown): () => void {
  if (typeof window === 'undefined') return () => {};

  const onMessage = (event: MessageEvent) => {
    // Only this document, on this origin. Not a frame, not another tab.
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;

    const message = parseCapture(event.data);
    if (!message) return;

    let stored = 0;
    for (const item of message.items) {
      if (capture(item)) stored += 1;
    }

    window.postMessage(
      { source: FROM_APP, version: BRIDGE_VERSION, type: 'ack', batch: message.batch, stored },
      window.location.origin,
    );
  };

  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}
