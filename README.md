<div align="center">

# pastespot

**A local-only spot to paste and keep the small things.**

Open the site, click an empty patch of desk, paste, leave.
No account, no server, no sync — it stays on your machine.

</div>

---

## Why

You have a six-digit code on screen and nowhere to put it. Every note app wants you
to pick a notebook, name a note, and press save first. pastespot wants two actions:
click, paste. There is no marketing page in front of it — opening the site opens
the desk.

What you paste types itself. A number renders as large monospace because the reason
it exists is to be read back. A URL renders as a link. A sentence renders as prose.
You never choose a format.

## Status

Early. Phase 1 is in progress — see [`docs/PLAN.md`](./docs/PLAN.md).

## Running it

Requires [bun](https://bun.sh) 1.2 or newer.

```bash
bun install
bun run dev      # http://localhost:4321
bun run build    # static output in dist/
bun run check    # type check
bun test         # bun's built-in runner, no framework
```

## Shortcuts

| | |
| --- | --- |
| Click an empty spot | new slip there |
| Paste with nothing focused | new slip, placed for you |
| <kbd>Ctrl/Cmd</kbd> <kbd>K</kbd> | search — matches stay lit, the rest dim in place |
| <kbd>Ctrl/Cmd</kbd> <kbd>[</kbd> / <kbd>]</kbd> | previous / next page |
| Drag a slip's timestamp | move it |
| Double-click the active tab | rename the page |

## How it is built

| | |
| --- | --- |
| **Astro 7** | zero-config static build; there is one route and it is the app |
| **React 19** | one island on `/`, hydrated `client:only` because the desk reads IndexedDB first |
| **zustand** | a single small store |
| **IndexedDB** | the entire backend, via `idb-keyval` |
| **Plain CSS** | tokens in `src/styles/tokens.css`; the paper look is too bespoke for a utility framework |

There is no server, no API route, and no telemetry.

## Privacy

Everything lives in your browser's IndexedDB. Nothing is transmitted anywhere.

Clearing site data deletes it, so settings has **export json** and **export text**.
The JSON round-trips back through **import**; the text file is the one that will
still open in ten years. Importing only ever adds — a restored backup can
duplicate slips, but it can never overwrite what is already on the desk.
