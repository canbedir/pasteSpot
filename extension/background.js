/**
 * Adds the "send selection to pastespot" path, and keeps the badge honest about
 * how many captures are still waiting for a desk to open.
 */

import { enqueue, QUEUE_KEY, readQueue } from './queue.js';

const MENU_ID = 'pastespot-send-selection';

async function paintBadge() {
  const waiting = (await readQueue()).length;
  await chrome.action.setBadgeText({ text: waiting ? String(waiting) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#2a6b51' });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'Send selection to pastespot',
    contexts: ['selection'],
  });
  void paintBadge();
});

chrome.runtime.onStartup.addListener(() => void paintBadge());

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID) return;
  await enqueue(info.selectionText);
  await paintBadge();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[QUEUE_KEY]) void paintBadge();
});
