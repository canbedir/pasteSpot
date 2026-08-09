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
click, paste.

What you paste types itself. A number renders as large monospace because the reason
it exists is to be read back. A URL renders as a link. A sentence renders as prose.
You never choose a format.

## Status

Early. Phase 1 is in progress — see [`docs/PLAN.md`](./docs/PLAN.md).

## Running it

Requires Node 22.12 or newer.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
npm run check    # type check
```

## How it is built

| | |
| --- | --- |
| **Astro 7** | static pages ship zero JavaScript, so the landing page is instant and indexable |
| **React 19** | one island on `/app`, hydrated `client:only` because the desk reads IndexedDB first |
| **zustand** | a single small store |
| **IndexedDB** | the entire backend, via `idb-keyval` |
| **Plain CSS** | tokens in `src/styles/tokens.css`; the paper look is too bespoke for a utility framework |

There is no server, no API route, and no telemetry.

## Documentation

| Document | Contents |
| --- | --- |
| [`docs/PLAN.md`](./docs/PLAN.md) | phases, success test, what is out of scope |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | data model, storage, why Astro |
| [`docs/DESIGN.md`](./docs/DESIGN.md) | tokens, desk tones, slip anatomy |
| [`docs/COMMITS.md`](./docs/COMMITS.md) | commit format and scopes |
| [`docs/EXTENSION.md`](./docs/EXTENSION.md) | the planned browser extension |

## Privacy

Everything lives in your browser's IndexedDB. Nothing is transmitted anywhere.
Clearing site data deletes it — export first if you care about it.
