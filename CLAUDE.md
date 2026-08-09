# pastespot

A local-only spot to paste and keep the small things. You open the site, click an
empty patch of the desk, paste, and leave. Nothing is uploaded, nothing is synced,
there is no account and no server.

## The one rule

**Capture must cost nothing.** Every proposed feature is measured against the
number of actions between "I have something" and "it is saved". Today that number
is two: click, paste. Anything that raises it needs a very good reason.

This is why there is no save button, no title field, no "new note" dialog, no
folder picker, and no confirmation step anywhere in the capture path.

## What it is

- A dark desk surface with **paper slips** scattered on it, positioned where you clicked.
- Slips **type themselves**: a number renders as large monospace, a URL as a link,
  a sentence as serif prose. The user never picks a format.
- **Pages** hold slips. A new page opens when the desk fills up; tabs sit along the bottom.
- **⌘K** searches across every page. Matches stay lit, the rest dim in place — nothing moves,
  so spatial memory survives.
- **Settings** let the user change the desk tone, surface texture, and typography.

## Architecture in one paragraph

Astro renders the marketing and static pages with zero JavaScript, which keeps the
landing page fast and indexable. The app itself is one React island mounted on
`/app`. All state lives in a zustand store; every mutation is flushed to IndexedDB
through a debounced queue in `src/app/db.ts`. There is no server, no API route, and
no data layer beyond the browser.

Read `docs/ARCHITECTURE.md` before changing the storage or state layers, and
`docs/DESIGN.md` before touching visuals — the paper metaphor has rules that are easy
to break by accident.

## Layout

| Path | What lives there |
| --- | --- |
| `src/pages/` | Astro routes. `index.astro` is static; `app.astro` mounts the island. |
| `src/app/` | The React island: board, slips, pages, palette, settings. |
| `src/app/db.ts` | The only module allowed to touch IndexedDB. |
| `src/styles/` | Design tokens and global CSS. No component owns a raw colour. |
| `docs/` | Plan, architecture, design system, commit conventions, extension plan. |

## Conventions that matter

- **Never hard-code a colour in a component.** Every colour comes from a token in
  `src/styles/tokens.css`. Desk tones are selectable at runtime, so a literal hex in a
  component silently breaks theming.
- **`db.ts` is the only IndexedDB caller.** Components talk to the store; the store talks
  to `db.ts`. This keeps persistence testable and makes the future extension sync a
  single-file change.
- **Slips are positioned in percentages, not pixels**, so a resized window does not
  scramble the desk.
- **Commits follow `docs/COMMITS.md`** — Conventional Commits, English, with a bulleted
  body. Scopes are listed there.

## Development

Start the dev server in background mode:

```
astro dev --background
```

Manage it with `astro dev stop`, `astro dev status`, and `astro dev logs`.

Before committing: `npm run build` must pass. `npm run check` runs Astro's type checker.

## Astro reference

Full documentation: https://docs.astro.build

- [Routing, dynamic routes, middleware](https://docs.astro.build/en/guides/routing/)
- [Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Framework components / islands](https://docs.astro.build/en/guides/framework-components/)
- [Content collections](https://docs.astro.build/en/guides/content-collections/)
- [Styling](https://docs.astro.build/en/guides/styling/)
