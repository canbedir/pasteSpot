# Design system

The desk metaphor is load-bearing. It is not decoration, and it is easy to break by
accident — most of the rules below exist because the obvious shortcut looks wrong.

## The idea

A dark desk under a soft pool of light, with paper slips left on it. Slips are
physical: they sit at slight angles, their bottom edges are torn from a pad, they
carry a faint grain, and some are clipped. Picking one up straightens it and lifts
it toward the light.

Everything else on screen is quiet so the paper can be the subject.

## Tokens

Never write a colour, radius, or shadow literal inside a component. Everything comes
from `src/styles/tokens.css`. Desk tones are switchable at runtime, so a hard-coded
hex silently defeats the setting.

### Desk tones

The default is **moss**. Each tone defines the ground *and* the colour of the light
falling on it — a warm glow over a cold desk reads as fake, so they always move together.

| Token set | Ground | Light | Feel |
| --- | --- | --- | --- |
| `moss` *(default)* | `#0E1411` | warm mint | quiet, green-black |
| `walnut` | `#17130E` | amber | warm, wooden |
| `ink` | `#0D111A` | cool blue-white | night desk |
| `graphite` | `#141618` | neutral | plain, sober |
| `plum` | `#14101A` | violet | soft, dim |

### Surfaces

Three textures, all grid-free. A dot grid was rejected: it is the default look of
every canvas tool and says nothing about this product.

- `pool` *(default)* — a soft elliptical light from above plus a cool bounce below.
- `contour` — iso-lines from a sum of sines, drawn to a canvas. Map-like, organic.
- `flat` — ground only.

Fine film grain sits over all three. It is generated at runtime into a 140 px canvas
tile, not shipped as an asset.

## Paper slips

### Anatomy

```
        ╭── paperclip (every 3rd slip only)
        │
   ┌────┴──────────────────────┐
   │  146704                   │  ← body, typed by content kind
   │  ─────────────────────    │
   │  14:02            copy    │  ← foot: time, and copy on hover
   └──╌╌─╌╌╌╌─╌╌╌─╌╌╌╌─╌╌──────┘  ← torn bottom edge
```

### Rules

- **Rotation is derived from the slip's index, never random.** A slip must not jump
  to a new angle on re-render. Range is ±1.3°, enough to read as hand-placed.
- **The torn edge is also deterministic**, seeded from the same index.
- **Torn edges need `filter: drop-shadow`, not `box-shadow`.** `clip-path` cuts the
  element's shape; `box-shadow` ignores that and draws a rectangle underneath.
- **Paperclips appear on every third slip.** On all of them it reads as a template;
  on a third it reads as "some of these were clipped".
- **Hover straightens and lifts.** Rotation to 0, a small rise, a deeper shadow.
  This is the "picking it up" gesture and it should stay subtle.

### Content typing

The kind is derived from the body text on every render (see `detect.ts`), never stored.

| Kind | Matches | Paper | Type |
| --- | --- | --- | --- |
| `code` | digit-led strings ≤ 44 chars — codes, IBANs, phones, ISBNs | cool grey | mono, large, tabular figures |
| `link` | `http(s)://…` or `www.…` | warm cream | host bold, path muted |
| `text` | everything else | cream | serif, generous leading |

This is the feature that earns the product its name. A pasted `146704` should be
readable from across the room, because the reason it exists is to be read back.

## Pages

Tabs sit along the bottom edge and look like folder dividers: the active tab is
pulled forward and lightened, the others sit back. Switching slides the desk
horizontally and settles the incoming slips in sequence, 45 ms apart.

The stagger is the one place with real motion. It reads as paper landing, and it
covers the slide. Keep it out of everything else.

## Typography

| Role | Face | Used for |
| --- | --- | --- |
| Display | Newsreader | text slips, headings, landing copy |
| Body | IBM Plex Sans | UI, links, settings |
| Mono | IBM Plex Mono | codes, timestamps, labels, tabs |

Fonts are self-hosted and subset to latin + latin-ext. `latin` alone drops Turkish
`ğ ş İ`, so latin-ext is not optional.

## Motion

Respect `prefers-reduced-motion` everywhere. Slide, stagger, and lift all collapse to
instant. Nothing in the capture path may wait on an animation — a slip must be
editable the moment it exists.

## Accessibility

- Visible focus on every interactive element; the desk is usable from the keyboard.
- Slips are `contenteditable` regions with accessible names from their content.
- Contrast is checked against the *lightest* desk tone, which is the worst case.
- Colour never carries meaning alone — slip kind is also signalled by typography.
