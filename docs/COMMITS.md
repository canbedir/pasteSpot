# Commit conventions

English, Conventional Commits, with a bulleted body. Short subject, then the
reasoning in bullets — not a changelog of files.

## Format

```
<type>(<scope>): <subject>

- <what changed and, where it is not obvious, why>
- <one bullet per idea, not per file>
```

Rules:

- Subject in the imperative mood, lower case after the colon, no trailing period.
- Subject ≤ 72 characters.
- Body bullets start with a capital and have no trailing period.
- Explain the *why* whenever the change is not self-evident from the diff.
- Omit the body only for genuinely trivial commits (a typo, a version bump).

## Types

| Type | Use for |
| --- | --- |
| `feat` | new user-visible capability |
| `fix` | corrected behaviour |
| `refactor` | restructuring with no behaviour change |
| `perf` | performance work |
| `style` | visual and CSS work with no logic change |
| `docs` | documentation only |
| `test` | tests only |
| `build` | build pipeline, bundler, output |
| `chore` | tooling, dependencies, repo housekeeping |

## Scopes

| Scope | Covers |
| --- | --- |
| `board` | the desk surface, click-to-create, layout |
| `slip` | an individual paper slip, its anatomy and editing |
| `pages` | pages, tabs, switching |
| `palette` | ⌘K search and commands |
| `settings` | user preferences and their panel |
| `storage` | IndexedDB, persistence, migrations |
| `store` | zustand state shape and selectors |
| `tokens` | design tokens, themes, desk tones |
| `type` | typography and font loading |
| `site` | landing page, static routes, SEO |
| `a11y` | accessibility work |
| `deps` | dependency changes |
| `config` | build and tooling configuration |
| `extension` | the browser extension (Phase 4) |

Omit the scope when a change genuinely spans the whole project.

## Examples

```
feat(slip): derive paper kind from body text on render

- Detect codes, links, and prose with regexes in detect.ts
- Drop the stored kind field so an edit cannot leave it stale
- Render digit-led strings in large tabular mono, the case the product exists for
```

```
fix(storage): flush pending writes on visibilitychange

- Debounced writes were lost when the tab closed right after a paste
- Closing the tab immediately is the product's most common exit path
```

```
style(tokens): make desk light colour track the selected tone

- A warm glow over a cold ground read as artificial
- Each tone now defines both its ground and its light
```
