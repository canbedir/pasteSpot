---
name: commit
description: Write a pastespot commit — Conventional Commits, English, bulleted body, project scopes. Use whenever committing in this repo, or when the user asks to commit, stage, or wrap up a change here.
---

# Committing in pastespot

The full convention lives in `docs/COMMITS.md`. Read it if anything below is
ambiguous. This skill is the working checklist.

## Before writing the message

1. `git status --short` and `git diff` (or `git diff --cached`) — know what actually changed.
2. `npm run build` must pass. Do not commit a broken build.
3. If the change spans unrelated ideas, split it into separate commits.

## The message

```
<type>(<scope>): <subject>

- <what changed, and why when the diff does not make it obvious>
- <one bullet per idea, never one per file>
```

- Imperative mood, lower case after the colon, no trailing period, ≤ 72 chars.
- Bullets start with a capital, no trailing period.
- Body is reasoning, not a file listing. If a bullet just names a file, delete it.
- Trivial commits (typo, version bump) may skip the body.

Types: `feat` `fix` `refactor` `perf` `style` `docs` `test` `build` `chore`

Scopes: `board` `slip` `pages` `palette` `settings` `storage` `store` `tokens`
`type` `site` `a11y` `deps` `config` `extension`

Omit the scope only when the change genuinely spans the whole project.

## Footer

End every commit message with:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

## Worked example

```
feat(slip): derive paper kind from body text on render

- Detect codes, links, and prose with regexes in detect.ts
- Drop the stored kind field so an edit cannot leave it stale
- Render digit-led strings in large tabular mono, the case the product exists for

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

## Do not

- Do not push unless asked.
- Do not use `--no-verify` or skip signing.
- Do not amend an existing commit; add a new one.
- Do not write "update files", "various fixes", or "wip" as a subject.
