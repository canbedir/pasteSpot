import { enqueue, readQueue } from './queue.js';

/**
 * The whole popup: paste, Enter, gone.
 *
 * Capture has to cost nothing, so there is no title field, no page picker and
 * no confirmation. Closing the popup with text still in it keeps that text —
 * losing a capture because someone clicked away would break the one promise
 * this product makes.
 */

const input = document.getElementById('input');
const keep = document.getElementById('keep');
const said = document.getElementById('said');
const waiting = document.getElementById('waiting');

let stored = false;

/**
 * Where a desk can be open, taken from the manifest's own content-script matches.
 *
 * The manifest is already the authority on which origins the bridge runs on, so
 * repeating the list here only created somewhere for it to go stale.
 */
function deskOrigins() {
  return chrome.runtime.getManifest().content_scripts.flatMap((script) => script.matches);
}

async function paintWaiting() {
  const queue = await readQueue();
  waiting.textContent = queue.length ? `${queue.length} waiting` : '';
}

async function store({ close }) {
  if (stored) return;
  const body = input.value.trim();
  if (!body) return;

  stored = true;
  await enqueue(body);
  input.value = '';

  // Read the origins from the manifest rather than repeating them. The two lists
  // had already drifted apart once, and a popup that looks for the wrong origin
  // reports "lands when you open the desk" while the desk is open in front of you.
  const tabs = await chrome.tabs.query({ url: deskOrigins() });
  said.textContent = tabs.length ? 'kept — landing on the desk' : 'kept — lands when you open the desk';

  await paintWaiting();
  if (close) setTimeout(() => window.close(), 550);
  else stored = false;
}

input.addEventListener('input', () => {
  keep.disabled = input.value.trim() === '';
  said.textContent = '';
});

input.addEventListener('keydown', (event) => {
  // Enter keeps it; Shift+Enter is a newline, because some captures have them.
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    void store({ close: true });
    return;
  }
  if (event.key === 'Escape') {
    void store({ close: true });
  }
});

keep.addEventListener('click', () => void store({ close: true }));

/**
 * Dismissing the popup any other way — clicking the page, pressing the shortcut
 * again — must not drop what is in the box.
 */
window.addEventListener('blur', () => void store({ close: false }));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void store({ close: false });
});

void paintWaiting();
input.focus();
