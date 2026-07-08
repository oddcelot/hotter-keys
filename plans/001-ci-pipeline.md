# Plan 001: Add a CI pipeline that gates PRs and releases on check + full test suite

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8a80f5e..HEAD -- .github/workflows/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `8a80f5e`, 2026-07-07

## Why this matters

The repo has only two workflows: `publish.yml` (fires on `v*` tags) and
`deploy-docs.yml` (fires on push to `main`). Nothing runs lint, typecheck, or
tests on pull requests — broken code can merge to `main` unblocked, and the
docs site auto-deploys from `main` on every push. Additionally, the release
build in `publish.yml` runs tests for `@hotter-keys/core` only, so
`@hotter-keys/solid` and `@hotter-keys/devtools` can be published to npm
without any verification beyond `tsc` succeeding. This plan is the
verification baseline that every other plan in `plans/` relies on.

## Current state

- `.github/workflows/publish.yml` — publishes to npm + JSR on tag push. Its
  `build` job currently runs (lines 20–23):

  ```yaml
  - run: vp install
  - run: vp run --cache --filter @hotter-keys/core test
  - run: vp run --cache -r build
  ```

- `.github/workflows/deploy-docs.yml` — builds core, devtools, then docs and
  deploys to GitHub Pages on push to `main`. No test/lint step.
- There is **no** workflow with an `on: pull_request` trigger.
- Both existing workflows use this setup pattern — match it exactly:

  ```yaml
  - uses: actions/checkout@v5
  - uses: voidzero-dev/setup-vp@v1
    with:
      node-version: "22"
      cache: true
  - run: vp install
  ```

- The repo's toolchain is Vite+ (`vp`). Per `AGENTS.md` (and root `CLAUDE.md`),
  the canonical verification commands are `vp check` (format + lint +
  typecheck) and the test suite. Only `packages/core` currently has a `test`
  script (`"test": "vp test run"` in `packages/core/package.json`); plans 003
  and 004 add test scripts to solid and devtools, which `vp run --cache -r test`
  will then pick up automatically with no further CI change.
- **Unverified baseline**: the advisor session could not run `vp install`
  (read-only constraint; no `node_modules` present), so whether `vp check`
  currently passes on `main` is unknown. Step 1 establishes that.

## Commands you will need

| Purpose       | Command                  | Expected on success                           |
| ------------- | ------------------------ | --------------------------------------------- |
| Install       | `vp install`             | exit 0                                        |
| Check         | `vp check`               | exit 0, no errors                             |
| Tests         | `vp run --cache -r test` | exit 0, core suite passes                     |
| Workflow lint | `vp dlx actionlint`      | exit 0 (skip if the binary cannot be fetched) |

## Scope

**In scope** (the only files you should modify):

- `.github/workflows/ci.yml` (create)
- `.github/workflows/publish.yml` (edit the `build` job's test step only)

**Out of scope** (do NOT touch, even though they look related):

- `.github/workflows/deploy-docs.yml` — docs deploy cadence is a separate
  decision; do not add gates to it in this plan.
- Any source file. If `vp check` fails on pre-existing code, that is a STOP
  condition, not an invitation to fix lint errors.
- `package.json` scripts in any package (plans 003/004 own test scripts).

## Git workflow

- Branch: `advisor/001-ci-pipeline`
- Commit style: short imperative subject, matching `git log` (e.g.
  "Add CI workflow for PRs"). One commit per step is fine.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Establish the local baseline

Run `vp install`, then `vp check`, then `vp run --cache -r test` at the repo
root.

**Verify**: all three exit 0. The test run should report the
`@hotter-keys/core` suite passing (three test files: `hotkeys.test.ts`,
`parse.test.ts`, `record.test.ts`). If `vp check` or the tests fail on
untouched `main` code, STOP and report the exact output — the CI workflow
would be born red, and the maintainer must decide what to fix first.

### Step 2: Create `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: voidzero-dev/setup-vp@v1
        with:
          node-version: "22"
          cache: true
      - run: vp install
      - run: vp check
      - run: vp run --cache -r test
```

**Verify**: `vp dlx actionlint` → exit 0, no findings for `ci.yml` (if
actionlint cannot be fetched in your environment, verify instead with
`node -e "require('node:fs').readFileSync('.github/workflows/ci.yml')"` plus a
YAML parse via `vp dlx yaml-lint .github/workflows/ci.yml`, or note that
workflow-lint was skipped).

### Step 3: Gate the release build on check + full tests

In `.github/workflows/publish.yml`, in the `build` job, replace:

```yaml
- run: vp run --cache --filter @hotter-keys/core test
```

with:

```yaml
- run: vp check
- run: vp run --cache -r test
```

Leave everything else in the file untouched (the `publish-npm` and
`publish-jsr-core` jobs, artifact upload paths, the trailing comment about
solid/devtools being npm-only).

**Verify**: `git diff .github/workflows/publish.yml` shows exactly one line
removed and two added, inside the `build` job. `vp dlx actionlint` → exit 0.

## Test plan

No new test files — this plan's tests are the workflow runs themselves.
Local proxy for CI green: `vp check && vp run --cache -r test` → exit 0.

## Done criteria

- [ ] `.github/workflows/ci.yml` exists with `pull_request` and
      `push: branches: [main]` triggers
- [ ] `grep -n "filter @hotter-keys/core test" .github/workflows/publish.yml`
      returns no matches
- [ ] `grep -n "vp check" .github/workflows/publish.yml` returns one match
- [ ] `vp check && vp run --cache -r test` exits 0 locally
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `vp check` or `vp run --cache -r test` fails on the untouched checkout in
  Step 1 (pre-existing failures — the maintainer decides the fix order).
- `publish.yml`'s build job no longer matches the excerpt in "Current state".
- `vp install` fails (likely a `vite-plus`/registry environment issue —
  report the error rather than switching to pnpm/npm directly; this repo
  forbids using the package manager directly).

## Maintenance notes

- When plans 003/004 add `test` scripts to `packages/solid` and
  `packages/vite-plugin-devtools`, `vp run --cache -r test` picks them up in
  both CI and the release build with no workflow change — that's why the
  recursive form is used instead of per-package filters.
- If a future plan adds a React adapter package (plan 008), its `test` script
  is likewise auto-included.
- Reviewer should scrutinize: the `permissions: contents: read` block (least
  privilege) and that no caching layer masks test failures (`--cache` caches
  task results keyed on inputs; a red test is never cached as green by Vite
  Task, but if in doubt, drop `--cache` from the CI test step).
