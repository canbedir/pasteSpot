# Browser extension (Phase 4)

Planned, not built. This document exists so that Phase 1–3 decisions do not paint
the extension into a corner.

## The goal

Open the extension, paste, close. The thing lands on the desk without a tab ever
being opened.

## The constraint that shapes everything

pastespot has no server. There is nothing to POST to. The extension and the site
must therefore meet inside the browser, and the only shared ground is the site's
own origin.

## Why this works without a backend

A content script running on `pastespot.app` executes **in that origin**, so it can
open the same IndexedDB database the site uses. That gives two viable paths:

**Path A — write when a tab is open.** The extension stores captures in
`chrome.storage.local`, and a content script drains that queue into IndexedDB the
next time a pastespot tab exists.
*Simple, but capture is not visible until the site is opened.*

**Path B — offscreen document.** An MV3 offscreen document hosts an iframe on the
pastespot origin and writes to IndexedDB immediately, with no tab required.
*More moving parts, but the capture is genuinely instant.*

Path A ships first because it is small and the failure mode is only a delay. Path B
is the upgrade once the flow proves itself.

## What this requires from the site

These are the reasons `db.ts` is the only module allowed to touch IndexedDB:

1. **A stable schema.** The extension writes the same `Slip` and `Page` shapes. A
   schema change is now a two-sided change, so `docs/ARCHITECTURE.md` must stay honest.
2. **A versioned database name.** Already the case; migrations must be additive.
3. **A single writer module.** The extension bundles or mirrors `db.ts` rather than
   reimplementing the write path and drifting.
4. **Position defaults.** An extension capture has no click coordinate, so the site
   needs a "find an empty patch" placement helper. Phase 2's auto-page logic is the
   natural home for it.

## Sketch

```
┌── extension popup ───────┐
│  paste here…             │   ⌘V, then close
└──────────┬───────────────┘
           │ chrome.storage.local queue
           ▼
┌── content script ────────┐   runs on the pastespot origin
│  drains queue → db.ts    │
└──────────┬───────────────┘
           ▼
      IndexedDB (same origin, same schema)
```

## Open questions

- Where does an extension-captured slip land? Newest page, or a dedicated inbox page?
- Should the popup show recent captures, or stay a single blank field?
- Firefox and Safari both differ on offscreen documents. Path A first partly for this.
