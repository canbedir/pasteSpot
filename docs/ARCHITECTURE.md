# Architecture

## Shape of the thing

There is no backend. pastespot is a static site plus one interactive island. The
entire product runs in the browser tab and writes to IndexedDB.

```
┌─────────────────────────────────────────────────────────┐
│  Astro (static build)                                   │
│                                                         │
│  /            landing page      0 KB JS, indexable      │
│  /privacy     static copy       0 KB JS                 │
│  /app         ──────────────┐                           │
└─────────────────────────────┼───────────────────────────┘
                              │
                     ┌────────▼──────────┐
                     │  React island     │
                     │  (client:only)    │
                     │                   │
                     │  Board ─ Page ─ Slip
                     │    │              │
                     │  zustand store    │
                     │    │              │
                     │  db.ts (debounced)│
                     └────────┬──────────┘
                              │
                        ┌─────▼──────┐
                        │ IndexedDB  │
                        └────────────┘
```

## Why Astro rather than a single-page app

SEO matters for this product: it is a consumer tool that people find by searching.
A pure SPA would ship an empty shell to crawlers and pay a JavaScript cost on the
landing page, which is the one page that must be instant.

Astro inverts the default. Static pages ship literally zero JavaScript, and the
board opts in to hydration on its own route. The app code never loads for someone
who came to read the homepage.

Next.js would also work, but its value is in SSR, server components, and API
routes — none of which this product uses. That machinery would be pure overhead.

## Why the app is `client:only`

The board reads IndexedDB before it can render anything meaningful, and IndexedDB
does not exist on the server. Server-rendering the island would produce an empty
desk followed by a visible pop-in once real slips arrived.

`client:only="react"` skips the server pass entirely. The route ships a small
skeleton, and the desk paints once, already correct.

## Data model

```ts
type SlipKind = "code" | "link" | "text";

interface Slip {
  id: string;        // crypto.randomUUID()
  pageId: string;
  body: string;      // exactly what the user typed or pasted
  x: number;         // 0–100, percentage of desk width
  y: number;         // 0–100, percentage of desk height
  createdAt: number;
  updatedAt: number;
}

interface Page {
  id: string;
  name: string;
  order: number;
  createdAt: number;
}
```

`kind` is deliberately **not** stored. It is derived from `body` on render by
`detect.ts`. Storing it would let the stored kind drift out of sync with the text
after an edit, and it buys nothing — the detection is a few regexes.

Positions are percentages so that resizing a window, or opening the desk on a
different screen, keeps the arrangement recognisable. Pixels would scatter it.

## Storage

`src/app/db.ts` is the only module that imports `idb-keyval`. Everything else goes
through the store. This matters for two reasons:

1. The debounce lives in one place, so a burst of keystrokes produces one write.
2. When the browser extension arrives it needs a second writer into the same
   store. That becomes a change to one file instead of an archaeology project.

Writes are debounced at 400 ms and also flushed on `visibilitychange`, because the
common exit path for this product is *closing the tab immediately after pasting*.
Waiting for a debounce timer that never fires would lose the one slip that mattered.

## State

zustand, one store, no slices. The store holds pages, slips, the active page, the
search query, and settings. It is small enough that splitting it would cost more
than it saves.

Components subscribe to narrow selectors so that typing in one slip does not
re-render the whole desk.

## Search

⌘K filters in memory. There is no index and no worker: matching a few hundred
strings is instant, and building an index would add a consistency problem for no
measurable gain.

The result of a search is **not** a list. Matching slips stay exactly where they
are and non-matching slips dim. Moving things would destroy the spatial memory
that makes the desk worth using. If a match is on another page, the page tab is
badged and switching pages keeps the filter applied.

## What is deliberately absent

- No accounts, no server, no sync. The privacy claim is the product.
- No rich text. Paste fidelity beats formatting; plain text never breaks.
- No folders or tags. Pages plus search cover it; tags are a filing chore.
- No undo history beyond the browser's native undo inside a slip. Revisit if
  accidental deletion turns out to hurt in practice.
