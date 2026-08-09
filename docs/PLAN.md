# Plan

## The product in one line

Open the site, click an empty patch of desk, paste, leave. It stays on your machine.

## Success test

A person with a six-digit code in their clipboard can save it and be gone in under
three seconds, on first visit, without reading anything.

## Phase 1 — the desk

The smallest thing that is genuinely useful.

- [x] Astro + React island scaffold
- [x] Design tokens: desk tones, surfaces, typography
- [x] IndexedDB store with debounced writes and a flush on tab close
- [x] Board: click empty space to create a slip, edit in place, autosave
- [x] Slips: torn edges, grain, deterministic rotation, paperclips
- [x] Content typing: code / link / text
- [x] Copy button on each slip
- [x] Landing page with real SEO metadata

Done when someone can use it daily and lose nothing.

## Phase 2 — living with it

The things that only hurt after a few weeks of real use.

- [x] Pages with bottom tabs and staggered switching
- [x] Auto-open a new page when the desk fills
- [x] ⌘K search across all pages, dim-in-place instead of a result list
- [x] Delete a slip
- [x] Settings: desk tone and surface texture
- [x] Drag a slip to reposition
- [x] Rename and delete a page
- [x] Keyboard: page switching, and paste with nothing focused
- [ ] Settings: typography, and a reset to defaults
- [ ] Jump between slips from the keyboard alone

## Phase 3 — trust

Reasons to keep using it rather than a text file.

- [ ] Export everything as JSON and as plain text
- [ ] Import from a previous export
- [ ] Offline support via a service worker
- [ ] A real empty state that teaches the click-to-paste gesture once
- [ ] Storage-pressure warning before the browser evicts data

## Phase 4 — the extension

See `docs/EXTENSION.md`. Deliberately last: the site has to be worth pasting into
before a faster way to paste into it means anything.

- [ ] Manifest V3 extension with a popup input
- [ ] Paste in the popup, land on the desk
- [ ] Optional: send the current selection with a keyboard shortcut
- [ ] Sync path that does not require the site to be open

## Explicitly not doing

| Not doing | Because |
| --- | --- |
| Accounts and sync | The privacy claim *is* the product |
| Rich text | Paste fidelity beats formatting; plain text never breaks |
| Folders and tags | Pages plus search cover it; tags are a filing chore |
| Sharing and collaboration | A different product |
| Mobile app | The web app should just work on a phone |
| AI features | Nothing here is improved by them |

## Open questions

- Should a full desk open a new page automatically, or prompt? Automatic is faster
  but relocates a slip the user was about to place.
- Is there a slip count where the desk stops working? Find it before users do.
- Does a torn edge on every slip get tiring? Watch it over a few weeks of use.
