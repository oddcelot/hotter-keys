# Plan 002: Fix pre-release hygiene defects (broken links, false docs claim, packaging drift)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 8a80f5e..HEAD -- README.md docs/src/content/docs/index.mdx docs/src/content/docs/guides/getting-started.md packages/unocss-preset/package.json .changeset/config.json packages/solid/jsr.json packages/vite-plugin-devtools/jsr.json examples/demo/package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-ci-pipeline.md (soft — 001's baseline install makes verification here possible; steps don't conflict)
- **Category**: docs / tech-debt
- **Planned at**: commit `8a80f5e`, 2026-07-07

## Why this matters

All packages sit at `0.0.1` with a pending changeset — the first public
release is imminent. Seven small defects would ship with it: two broken/wrong
links on the project's most visible surfaces, a documented feature that does
not exist in code, an internal styling package that is publishable to npm by
accident, a changesets config that references a package name that doesn't
exist (which makes `changeset version` error), and dead JSR manifests. Each
fix is minutes; together they make the first release trustworthy. The plan
also verifies the standalone demo installs (it is not part of the workspace,
so nothing else exercises it).

## Current state

- `README.md:23` — the package table links core as `[\`@hotter-keys/core\`](core/)`.
No `core/`directory exists at the repo root; the package lives at`packages/core/`. (The solid/devtools rows already use `packages/...`.)
- `docs/src/content/docs/index.mdx:14-15` — the docs landing hero has:

  ```yaml
  - text: View on GitHub
    link: https://github.com/withastro/starlight
  ```

  Leftover from the Starlight template; it must point at
  `https://github.com/oddcelot/hotter-keys`.

- `docs/src/content/docs/guides/getting-started.md:71` — design principle #5:

  ```markdown
  5. **Progressive enhancement** — uses the Keyboard API (Chrome) when available for broader support.
  ```

  A repo-wide search for `navigator.keyboard` / `getLayoutMap` in `packages/`
  finds nothing — the claim is false. (Plan 006 may later _implement_ a
  Keyboard API enhancement; until then the docs must not claim it.)

- `packages/unocss-preset/package.json` — internal design-system preset used
  only by docs/demo styling. It has `"version": "0.0.1"`, **no** `"private"`
  field, and `"files": ["dist", "README.md"]` — but
  `packages/unocss-preset/README.md` does not exist. It is not built or
  uploaded by `publish.yml`, yet `changeset publish` (which publishes every
  non-private, non-ignored package) could attempt to publish it broken.
- `.changeset/config.json:10`:

  ```json
  "ignore": ["@hotter-keys/demo", "@hotter-keys/docs"]
  ```

  The demo package's real name is `hotter-keys-demo`
  (`examples/demo/package.json:2`), not `@hotter-keys/demo`. Changesets
  errors when an ignore entry matches no package, breaking
  `changeset version`. (`@hotter-keys/docs` is correct — that is the real
  name in `docs/package.json`.)

- `packages/solid/jsr.json` and `packages/vite-plugin-devtools/jsr.json` —
  dead manifests. `publish.yml` publishes only core to JSR and states in a
  comment: "Note: @hotter-keys/solid and @hotter-keys/devtools are npm-only.
  They depend on npm packages (solid-js, astro, vite) that JSR can't
  resolve." `packages/core/jsr.json` is real and must stay.
- `examples/demo/` is a **standalone npm project by design** — it is NOT in
  the pnpm workspace (`pnpm-workspace.yaml` lists only `docs` and
  `packages/*`) and carries its own `package-lock.json`, which is what makes
  the README's StackBlitz "Try it" link work. Its registry pins
  (`@hotter-keys/core: 0.0.1` etc.) resolve from npm, where `0.0.1` is in
  fact published. Do NOT convert its dependencies to `workspace:*` — that
  would break standalone installs. Two real issues remain: root `vp install`
  does not install the demo's deps (developers must run install inside
  `examples/demo/`, which CONTRIBUTING should say), and
  `examples/demo/vite.config.ts:1` imports `"vite-plus"`, which is absent
  from `examples/demo/package.json` and its lockfile — locally it resolves
  by walking up to the repo root's `node_modules`, but a truly standalone
  install has no `vite-plus`. Fixing that resolution question is the
  maintainer's call; this plan only verifies and documents.
- There is no `CONTRIBUTING.md`; `.github/` contains only `workflows/`.
  `AGENTS.md` documents the Vite+ toolchain for agents but nothing addresses
  human contributors (setup, verification, changesets).
- Repo conventions: Markdown docs are Starlight content under
  `docs/src/content/docs/`; JSON manifests are plain (no comments);
  commit style is short imperative subjects (see `git log`).

## Commands you will need

| Purpose          | Command                                           | Expected on success                           |
| ---------------- | ------------------------------------------------- | --------------------------------------------- |
| Install          | `vp install`                                      | exit 0                                        |
| Check            | `vp check`                                        | exit 0                                        |
| Tests            | `vp run --cache -r test`                          | exit 0                                        |
| Changeset sanity | `vp exec changeset status --verbose`              | exit 0, no "does not match any package" error |
| Docs build       | `vp run --cache --filter @hotter-keys/docs build` | exit 0                                        |

## Scope

**In scope** (the only files you should modify):

- `README.md` (one link)
- `docs/src/content/docs/index.mdx` (one link)
- `docs/src/content/docs/guides/getting-started.md` (remove one list item)
- `packages/unocss-preset/package.json`
- `.changeset/config.json`
- `packages/solid/jsr.json` (delete)
- `packages/vite-plugin-devtools/jsr.json` (delete)
- `CONTRIBUTING.md` (create)
- `examples/demo/node_modules` + `examples/demo/package-lock.json` (side
  effects of the Step 7 install only — no manifest edits)

**Out of scope** (do NOT touch, even though they look related):

- `packages/core/jsr.json` — core IS published to JSR; leave it.
- `examples/demo/vite.config.ts` — it has an uncommitted local edit that is
  the maintainer's decision (see plans/README.md notes); do not stage,
  commit, or revert it.
- `.github/workflows/publish.yml` — plan 001 owns workflow edits.
- Renumbering or rewording the remaining design principles in
  getting-started.md.

## Git workflow

- Branch: `advisor/002-prerelease-hygiene`
- Commit per step; short imperative subjects (e.g. "Fix README core package link").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix the README core link

In `README.md` line 23, change the link target `(core/)` to
`(packages/core/)`.

**Verify**: `grep -n "](core/)" README.md` → no matches;
`grep -n "](packages/core/)" README.md` → one match.

### Step 2: Fix the docs hero GitHub link

In `docs/src/content/docs/index.mdx`, change the hero action link
`https://github.com/withastro/starlight` to
`https://github.com/oddcelot/hotter-keys`.

**Verify**: `grep -rn "withastro/starlight" docs/src/content/` → no matches.

### Step 3: Remove the false Keyboard API claim

In `docs/src/content/docs/guides/getting-started.md`, delete the entire
line for design principle #5 ("Progressive enhancement — uses the Keyboard
API..."). Leave principles 1–4 numbered as they are.

**Verify**: `grep -rn "Keyboard API" docs/src/content/` → no matches.

### Step 4: Make the UnoCSS preset private

In `packages/unocss-preset/package.json`: add `"private": true` (immediately
after `"version"`), and remove `"README.md"` from the `files` array (the file
doesn't exist).

**Verify**:
`node -e "const p=require('./packages/unocss-preset/package.json'); if(p.private!==true||p.files.includes('README.md'))process.exit(1)"`
→ exit 0.

### Step 5: Fix the changesets ignore list

In `.changeset/config.json`, change `"@hotter-keys/demo"` to
`"hotter-keys-demo"`.

**Verify**: after a root `vp install`, `vp exec changeset status --verbose` →
exit 0 with no error about an ignore entry not matching any package.

### Step 6: Delete the dead JSR manifests

Delete `packages/solid/jsr.json` and `packages/vite-plugin-devtools/jsr.json`.

**Verify**: `ls packages/solid/jsr.json packages/vite-plugin-devtools/jsr.json`
→ both "No such file or directory"; `ls packages/core/jsr.json` → still exists.

### Step 7: Verify the standalone demo installs, and record the vite-plus gap

Do NOT edit `examples/demo/package.json`. Run `vp install` inside
`examples/demo/` (Vite+ detects npm via the `package-lock.json`) and then
`vp run build` there. If the build fails because `"vite-plus"` (imported by
`examples/demo/vite.config.ts:1`) is not a demo dependency, do not fix it —
record the exact error in your report; the resolution strategy (add
`vite-plus` to the demo's devDependencies vs. import `vite` config helpers
instead) is a maintainer decision flagged in `plans/README.md`.

**Verify**: `cd examples/demo && vp install` → exit 0 and
`examples/demo/node_modules/@vitejs/devtools` exists. Build outcome recorded
either way.

### Step 8: Add CONTRIBUTING.md

Create `CONTRIBUTING.md` at the repo root covering, briefly (≤ 60 lines):

- Prerequisites: the global `vp` CLI (Vite+); Node 22.
- Setup: `vp install` (never pnpm/npm directly — link to `AGENTS.md`).
- Verify: `vp check` and `vp run --cache -r test`.
- Dev servers: `vp run --filter @hotter-keys/docs dev` for docs; the demo is
  a standalone npm project OUTSIDE the workspace — `cd examples/demo`,
  `vp install` once, then `vp run dev`.
- Releasing: add a changeset with `vp exec changeset`, describe the change;
  maintainer tags `v*` to trigger `publish.yml`.
- License note: contributions are GPL-3.0-only.

**Verify**: `test -f CONTRIBUTING.md && grep -c "vp install" CONTRIBUTING.md`
→ ≥ 1.

## Test plan

No new unit tests (docs/config-only change). Full-suite regression gate:
`vp check && vp run --cache -r test` → exit 0. Docs still build:
`vp run --cache --filter @hotter-keys/docs build` → exit 0.

## Done criteria

- [ ] All eight step verifications pass
- [ ] `vp check && vp run --cache -r test` exits 0
- [ ] `vp run --cache --filter @hotter-keys/docs build` exits 0
- [ ] `git status` shows no modifications outside the in-scope list
      (`examples/demo/vite.config.ts` may still show its pre-existing
      uncommitted edit — leave it exactly as found)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any "Current state" excerpt no longer matches the live file.
- The Step 7 install inside `examples/demo` modifies files outside
  `examples/demo/` (would indicate the standalone-project assumption is wrong).
- `changeset status` still errors after Step 5 (the ignore-name assumption
  may be incomplete — report the exact error).
- The docs build fails after Step 3 (the removed line may be referenced
  elsewhere).

## Maintenance notes

- Plan 006 (named-keys / Keyboard API spike) may re-introduce a Keyboard API
  sentence in getting-started.md — only once real code ships behind it.
- If the maintainer ever wants to publish `@hotter-keys/unocss-preset` for
  real, reverse Step 4 _and_ add it to `publish.yml`'s build/artifact steps
  and write its README.
- Reviewer should scrutinize that Step 7 produced no manifest diffs — the
  demo's registry pins are intentional for standalone/StackBlitz use; the
  open `vite-plus` resolution question belongs to the maintainer, not this
  plan.
