# Plan 004: Add tests for the devtools sentinel handshake and event formatting

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8a80f5e..HEAD -- packages/vite-plugin-devtools/ packages/core/src/hotkeys.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/001-ci-pipeline.md (CI auto-picks-up the new test script)
- **Category**: tests
- **Planned at**: commit `8a80f5e`, 2026-07-07

## Why this matters

`@hotter-keys/devtools` (~1,360 lines) is a published package with zero
tests. Its core mechanism — the sentinel handshake by which `Hotkeys`
instances and the devtools find each other across load-order permutations —
spans two packages and is only ever exercised manually in a browser. If the
handshake or the late-attach replay breaks, the devtools just show nothing:
no error, no failing test, no signal. The protocol is pure JS over
`globalThis` and is cheaply unit-testable; the DOM panel UI is not the target
here.

## Current state

The protocol has two halves, both read in full during planning:

- Core side — `packages/core/src/hotkeys.ts:95-105` (constructor):

  ```ts
  if (typeof globalThis !== "undefined") {
    const g = globalThis as any;
    if (g.__HOTTER_KEYS_DEVTOOLS__) {
      ...
      g.__HOTTER_KEYS_DEVTOOLS__.__register(this);
    } else {
      ...
      (g.__HOTTER_KEYS_INSTANCES__ ??= []).push(this);
    }
  }
  ```

  Plus a public hook field: `__devtools?: DevtoolsHook` (line 53), called
  throughout core with typed events (`binding:added`, `binding:fired`,
  `layer:change`, `scope:change`, `held-keys:change`, `lifecycle`, …— see
  `DevtoolsEvent` in `packages/core/src/types.ts:131-152`).

- Devtools side — `packages/vite-plugin-devtools/src/client/shared.ts:129-183`,
  `setupSentinel(onEvent, options?, onRawEvent?)`:
  - installs `globalThis.__HOTTER_KEYS_DEVTOOLS__ = sentinel` where
    `sentinel.__register(instance)` sets `instance.__devtools = hook`,
  - filters events by `allowedTypes` (default `DEFAULT_EVENT_TYPES`, which
    **excludes** `held-keys:change`; `ALL_EVENT_TYPES` includes it),
  - replays state for late-attached instances: for each existing binding it
    synthesizes a `binding:added`, then one `layer:change` with
    `instance.getLayers()` (duck-typed via `typeof instance.getBindings === "function"`),
  - drains `globalThis.__HOTTER_KEYS_INSTANCES__` and clears it
    (`pending.length = 0`),
  - guards double-registration via an internal `Set`.

- Also in `shared.ts` and worth cheap coverage: `fmtSequence` (lines 58–72,
  chord array → `"Ctrl+Meta+Shift+Alt+K"` strings joined by spaces) and
  `formatDetail` (lines 74–97, per-event-type detail strings, e.g.
  `layer:change` → `"global → modal"` using `" → "`).

- `packages/vite-plugin-devtools/package.json` — no test script;
  devDependencies already include `"vite-plus": "catalog:"` and
  `"typescript": "catalog:default"`, but NOT `jsdom`, `vitest`, or
  `@hotter-keys/core`. `src/index.ts` (Astro integration) and
  `src/vite-devtools.ts` import `astro` / devtools-kit types — the test file
  must import ONLY from `./client/shared.js` and `@hotter-keys/core` so no
  Astro/Vite server machinery is loaded.

- Test conventions: mirror `packages/core` — `vitest.config.ts` with
  `environment: "jsdom"` (core instances construct against `document` by
  default; tests pass an explicit div target anyway), imports from
  `"vite-plus/test"`, scripts `"test": "vp test run"` / `"test:watch": "vp test"`.
  Synthetic key events: copy the `fireKey` helper pattern from
  `packages/core/src/test-helpers.ts` (35 lines, not published — copy, don't
  deep-import).

## Commands you will need

| Purpose   | Command                                           | Expected on success |
| --------- | ------------------------------------------------- | ------------------- |
| Install   | `vp install`                                      | exit 0              |
| Run suite | `cd packages/vite-plugin-devtools && vp test run` | all tests pass      |
| All tests | `vp run --cache -r test` (repo root)              | everything passes   |
| Check     | `vp check`                                        | exit 0              |

## Scope

**In scope** (the only files you should modify/create):

- `packages/vite-plugin-devtools/package.json` (test scripts + devDeps:
  `"jsdom": "catalog:"`, `"vitest": "catalog:"`,
  `"@hotter-keys/core": "workspace:*"`)
- `packages/vite-plugin-devtools/vitest.config.ts` (create)
- `packages/vite-plugin-devtools/src/client/shared.test.ts` (create)

**Out of scope** (do NOT touch):

- `src/client/panel.ts`, `src/client/toolbar-app.ts`,
  `src/client/devtools-action.ts` — DOM UI, explicitly not under test here.
- `src/index.ts` / `src/vite-devtools.ts` — build-tool integrations; testing
  them needs an Astro/Vite harness that is not worth it yet.
- `packages/core/**` — the handshake test uses core as-is; if core's side
  looks broken, STOP and report.

## Git workflow

- Branch: `advisor/004-devtools-tests`
- Commit style: short imperative subject.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Test infrastructure

Add the scripts/devDeps listed in Scope to
`packages/vite-plugin-devtools/package.json`; create `vitest.config.ts`
identical to `packages/core/vitest.config.ts`. Run `vp install`.

**Verify**: `cd packages/vite-plugin-devtools && vp test run` → exits without
config errors (no test files yet).

### Step 2: Pure-function tests (`fmtSequence`, `formatDetail`)

Cases: single chord with each modifier flag; multi-chord sequence joins with
a space; `formatDetail` for each event type in `TAG_MAP` including
`binding:fired` with and without `scope`, `layer:change` arrow join,
`held-keys:change` empty → `"(none)"`, and the `default` branch
(JSON.stringify fallback for an unknown type).

**Verify**: `vp test run` → these pass.

### Step 3: Sentinel handshake tests (the real target)

Global hygiene: in `beforeEach`/`afterEach`, delete
`(globalThis as any).__HOTTER_KEYS_DEVTOOLS__` and
`__HOTTER_KEYS_INSTANCES__` so cases are order-independent.

Use the REAL core: `import { createHotkeys } from "@hotter-keys/core"` with a
detached div target. Cases:

1. **Eager registration** (sentinel first): `setupSentinel(onEvent)`, then
   `createHotkeys({ target })` → subsequent `hk.add("ctrl+k", fn)` produces a
   `binding:added` entry via `onEvent`.
2. **Stash + drain** (instance first): `createHotkeys({ target })` →
   `globalThis.__HOTTER_KEYS_INSTANCES__` has length 1; then
   `setupSentinel(onEvent)` → the pending array is drained to length 0 and
   the instance's `__devtools` is set.
3. **Late-attach replay**: create an instance, `add` two bindings and
   `pushLayer("modal")` BEFORE `setupSentinel`; after setup, `onEvent`
   received two `binding:added` entries and one `layer:change` entry whose
   detail contains `modal`.
4. **Event filtering**: with default options, fire a held-keys change
   (`fireKey(target, "a")`) → NO `held-keys:change` entry (excluded by
   `DEFAULT_EVENT_TYPES`); with `setupSentinel(onEvent, { events: ALL_EVENT_TYPES })`
   it IS delivered. `onRawEvent`, when provided, receives it in both cases.
5. **No double-registration**: call `sentinel.__register` twice for the same
   instance (e.g. create instance pre-sentinel, then `setupSentinel`, then
   manually `(globalThis as any).__HOTTER_KEYS_DEVTOOLS__.__register(hk)`)
   → replay events are not duplicated.
6. **Fired events flow end-to-end**: after handshake, `hk.add("ctrl+k", fn)`
   - `fireKey(target, "k", { ctrlKey: true })` → a `binding:fired` entry with
     tag `"fired"`.

**Verify**: `cd packages/vite-plugin-devtools && vp test run` → full suite
green; from root, `vp run --cache -r test` → all packages pass.

## Test plan

Steps 2–3 above are the test plan: ≥ 12 cases, one file
(`src/client/shared.test.ts`), modeled structurally on
`packages/core/src/hotkeys.test.ts` (describe per concern, fresh state per
test).

## Done criteria

- [ ] `cd packages/vite-plugin-devtools && vp test run` exits 0, ≥ 12 tests
- [ ] Handshake cases 1–3 (eager, stash+drain, replay) all present and green
- [ ] `vp run --cache -r test` at root exits 0
- [ ] `vp check` exits 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Importing `@hotter-keys/core` from the devtools package fails to resolve
  after adding the workspace devDependency (Vite+ workspace resolution issue —
  report rather than adding path aliases).
- A handshake test fails in a way that implicates the source (e.g. replay
  emits before `__devtools` is wired, drain doesn't clear the stash) — that's
  a real bug find; report it, don't patch `shared.ts` or core.
- Test pollution via `globalThis` persists despite the beforeEach cleanup
  (would mean the sentinel holds state this plan didn't account for).

## Maintenance notes

- Plan 009 (browser-extension spike) builds directly on `setupSentinel`; this
  suite is its safety net — keep it green before starting 009.
- If core's `DevtoolsEvent` union gains a member, `formatDetail`'s `default`
  branch hides the gap; the Step 2 unknown-type test documents that behavior.
- Reviewer: check the tests import only `./client/shared.js` and core — an
  accidental import of `src/index.ts` drags Astro types into the test graph.
