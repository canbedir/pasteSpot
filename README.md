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
it exists is to be read back. A card number or IBAN is regrouped in fours so you can
read it aloud. A URL renders as a link. A sentence renders as prose. You never choose
a format, and the text itself is never altered — only how it looks.

Paper yellows, too. Something from this morning is bright white and something from
last spring is tea-stained, so you can see how old a corner of the desk is without
reading a single timestamp.

On a phone the desk lays slips out in a single column down the page, and opens its
next page sooner, because a grid built for a 1440px window buries them on a 390px
one.

Settings change the desk tone, the surface texture, and the writing — prose in serif
or sans, at three sizes. Codes stay monospace and links stay sans whichever you pick:
those are typeset for what they are, not for taste.

## Status

Working, and deployed on Vercel.

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
| <kbd>Ctrl/Cmd</kbd> <kbd>P</kbd> | every page at once, as small desks |
| <kbd>Ctrl/Cmd</kbd> <kbd>Z</kbd> | take back the last change to the desk |
| <kbd>Ctrl/Cmd</kbd> <kbd>[</kbd> / <kbd>]</kbd> | previous / next page |
| Drag a slip's timestamp | move it — and bring it to the front |
| Drag a slip's **copy** | drop the text into another window |
| Double-click the active tab | rename the page |

## Finding things again

Three different questions, three answers:

- **"What does it say?"** — <kbd>Ctrl/Cmd</kbd> <kbd>K</kbd>. Matching slips stay
  exactly where they are and the rest dim, so spatial memory survives. Choosing a
  result **copies it** and then goes to the slip itself, lit — because that is
  usually why you were looking. <kbd>Shift</kbd> <kbd>↵</kbd> just shows it.
  With nothing typed, the box offers what you captured most recently, so
  <kbd>Ctrl/Cmd</kbd> <kbd>K</kbd> <kbd>↵</kbd> hands back the last thing you put
  down.
- **"Which desk did I put it on?"** — <kbd>Ctrl/Cmd</kbd> <kbd>P</kbd> zooms out to
  every page, each drawn as a small desk with its slips where they really sit.
- **"What did I write down on Tuesday?"** — **dates** opens a month at a time, with
  busy days inked more heavily and the chosen day's slips listed underneath.

Some slips cannot be found by their own text: a password reads `a123fff4` and
nothing about it will ever come to mind. Any slip can be given **keywords** from its
foot — write `lol` on it and searching `lol` finds it. This never happens during
capture, only afterwards, and it is not a tag system: no list, no autocomplete,
nothing to browse by.

## Nothing is lost by accident

<kbd>Ctrl/Cmd</kbd> <kbd>Z</kbd> takes back a deletion, a move, a label, a renamed
or deleted page, or an import. The slip that comes back lights up, which is the only
notification this app has. Typing is left to the browser's own undo.

Undo lasts for the session, not across reloads — which is why deleting a whole page
still asks first.

Open the desk in two tabs and they stay in step: whichever one saves tells the other,
and a tab coming back to the foreground re-reads what it missed.

## Without a mouse

<kbd>Ctrl/Cmd</kbd> <kbd>V</kbd> is the whole capture gesture with the click removed,
so nothing here needs a pointer. <kbd>Tab</kbd> reaches the controls first and then
every slip and its actions, and a screen reader is told when something is saved,
deleted, undone, labelled, or when you move between pages.

## The extension

`extension/` is a Manifest V3 extension, loadable unpacked with no build step:
open `chrome://extensions`, turn on developer mode, **Load unpacked**, pick the
folder.

Open it with <kbd>Ctrl/Cmd</kbd> <kbd>Shift</kbd> <kbd>Y</kbd>, paste, press
Enter. Or select text on any page and right-click **Send selection to pastespot**.

There is no server to send to, so captures wait in the extension's own storage
until a pastespot tab exists — the badge shows how many. The extension never
writes the database itself; it hands text to the page, which stores it through
the same path as every other capture, so the schema lives in one place and a
failed handover keeps the queue instead of losing it.

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

Everything lives in your browser's IndexedDB. Nothing is transmitted anywhere,
and after the first visit it opens with the network off.

Clearing site data deletes it, so settings has **export json** and **export text**.
The JSON round-trips back through **import**; the text file is the one that will
still open in ten years. Importing only ever adds — a restored backup can
duplicate slips, but it can never overwrite what is already on the desk.
