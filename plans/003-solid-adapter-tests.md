# Plan 003: Add a test suite for @hotter-keys/solid (lifecycle + reactivity coverage)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8a80f5e..HEAD -- packages/solid/ packages/core/src/test-helpers.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/001-ci-pipeline.md (CI picks these tests up automatically once a `test` script exists)
- **Category**: tests
- **Planned at**: commit `8a80f5e`, 2026-07-07

## Why this matters

`@hotter-keys/solid` is a published package whose entire value is reactive
lifecycle management — auto-destroy on cleanup, auto-unbind of shortcuts,
auto-pop of layers, reactive signals for layers/held-keys — and it has zero
tests. The core package's 850-line suite never exercises the Solid layer.
A regression in disposal (double-destroy, leaked binding, layer left on the
stack) would ship silently. These are exactly the bugs reactive wrappers get.

## Current state

Package under test — five small source files, all read in full during planning:

- `packages/solid/src/createHotkeys.ts` (67 lines) — wraps
  `coreCreateHotkeys`, exposes `instance`, reactive `layers`/`heldKeys`/`scope`
  signals wired via `instance.onLayerChange`/`onHeldKeysChange`, and
  `setScope`/`pushLayer`/`popLayer` passthroughs. Cleanup behavior (lines
  45–49):

  ```ts
  onCleanup(() => {
    unsubLayers();
    unsubHeldKeys();
    instance.destroy();
  });
  ```

- `packages/solid/src/createShortcut.ts` (40 lines) — static string combo:
  `hk.instance.add(combo, handler, options)` + `onCleanup(unsub)`. Accessor
  combo: re-registers inside `createEffect`, unsubbing the previous binding
  first; also `onCleanup(() => unsub?.())`.
- `packages/solid/src/createLayer.ts` (44 lines) — `options?.active` pushes on
  creation; `onCleanup(() => hk.instance.popLayer(name))`; returns
  `{ isActive, push, pop }` where `isActive` is
  `createMemo(() => hk.layers().includes(name))`. Note the style
  inconsistency: cleanup calls `hk.instance.popLayer` while `push`/`pop` call
  `hk.pushLayer`/`hk.popLayer` — functionally equivalent (the wrapper methods
  are thin passthroughs and signals update via subscription), do NOT change it
  in this plan.
- `packages/solid/src/createKeyHold.ts` (18 lines) — signal over
  `instance.onKeyHold(key, setHeld)`, unsubscribed on cleanup.
- `packages/solid/src/Hotkey.tsx` (27 lines) — component that just calls
  `createShortcut(props.hk, () => props.combo, props.onFire, props.options)`
  and returns `null`. It can be invoked as a plain function inside a reactive
  root — no JSX compilation needed in tests.

Test conventions to match — from `packages/core`:

- `packages/core/vitest.config.ts`:

  ```ts
  import { defineConfig } from "vite-plus";

  export default defineConfig({
    test: {
      environment: "jsdom",
    },
  });
  ```

- `packages/core/package.json` scripts: `"test": "vp test run"`,
  `"test:watch": "vp test"`; devDependencies include `"jsdom": "catalog:"`,
  `"vite-plus": "catalog:"`, `"vitest": "catalog:"`.
- Test style (`packages/core/src/hotkeys.test.ts`): imports from
  `"vite-plus/test"` (`describe, it, expect, vi, beforeEach, afterEach`),
  creates a detached `document.createElement("div")` as the event target, and
  fires synthetic `KeyboardEvent`s via `packages/core/src/test-helpers.ts`
  (`fireKey`/`fireKeyUp` — dispatch a bubbling, cancelable KeyboardEvent with
  modifier flags). `test-helpers.ts` is 35 lines and excluded from core's
  published `files`; copy the helper into the solid test file rather than
  deep-importing core internals.
- `packages/solid/package.json` currently has NO test script and NO
  jsdom/vitest/vite-plus devDependencies (only `@hotter-keys/core`
  `workspace:*`, `solid-js catalog:default`, `typescript catalog:default`).

Solid reactivity in tests without the JSX compiler: use
`createRoot(dispose => { ... })` from `solid-js`. `createEffect` bodies run
after the synchronous root body completes — when asserting on effect-driven
re-binding (reactive `createShortcut`), flush with
`await Promise.resolve()` (microtask) or drive the change through a signal
and assert afterward. This is the one genuinely fiddly part; the escape
hatch below applies.

## Commands you will need

| Purpose   | Command                              | Expected on success |
| --------- | ------------------------------------ | ------------------- |
| Install   | `vp install`                         | exit 0              |
| Run suite | `cd packages/solid && vp test run`   | all tests pass      |
| All tests | `vp run --cache -r test` (repo root) | core + solid pass   |
| Check     | `vp check`                           | exit 0              |

## Scope

**In scope** (the only files you should modify/create):

- `packages/solid/package.json` (add test scripts + devDependencies)
- `packages/solid/vitest.config.ts` (create)
- `packages/solid/src/solid.test.tsx` (create — one file is fine; split per
  primitive only if it exceeds ~400 lines)

**Out of scope** (do NOT touch):

- Any file in `packages/solid/src/` other than the new test file — including
  the `hk.instance.popLayer` inconsistency in `createLayer.ts` (noted for the
  maintainer, not for this plan).
- `packages/core/**` — if a core behavior seems wrong while testing the
  adapter, STOP and report; do not patch core.
- `tsconfig.json` in the solid package, unless the test file fails to
  typecheck solely because tests aren't included — in that case mirror how
  `packages/core/tsconfig.json` handles test files, and say so in your report.

## Git workflow

- Branch: `advisor/003-solid-adapter-tests`
- Commit style: short imperative subject (e.g. "Add tests for solid primitives").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Wire up the test infrastructure

- In `packages/solid/package.json`, add scripts `"test": "vp test run"` and
  `"test:watch": "vp test"`, and add devDependencies `"jsdom": "catalog:"`,
  `"vite-plus": "catalog:"`, `"vitest": "catalog:"` (exactly the strings core
  uses — the catalog resolves versions).
- Create `packages/solid/vitest.config.ts` identical to core's (excerpt
  above). If Solid's reactivity requires the solid plugin for `.tsx` test
  files, prefer a plain `.ts` test file calling `Hotkey(...)` as a function
  instead of adding `vite-plugin-solid`.
- Run `vp install`.

**Verify**: `cd packages/solid && vp test run` → runs, reports "no test files
found" (or equivalent) and exits without a config error.

### Step 2: Write the smoke + lifecycle tests for `createHotkeys`

In the new test file, copy the ~30-line `fireKey`/`fireKeyUp` helper from
`packages/core/src/test-helpers.ts` (attribute it in a comment). Cases:

1. Instance works inside `createRoot`: `hk.instance.add("ctrl+k", handler)`;
   `fireKey(target, "k", { ctrlKey: true })` → handler called once. Create
   the instance with `createHotkeys({ target })` where `target` is a detached
   div (pass `target` through — `HotkeysOptions` supports it).
   Note: core translates `ctrl` per platform; in jsdom `isMac()` is false, so
   `ctrl+…` combos match `ctrlKey` events as-is (core's own tests rely on this).
2. Dispose destroys: after `dispose()`, the same `fireKey` does NOT call the
   handler again.
3. `layers` signal tracks: initial `["global"]`; after `hk.pushLayer("modal")`
   → `["global", "modal"]`; after `hk.popLayer()` → `["global"]`.
4. `heldKeys` signal tracks: `fireKey(target, "a")` → `["a"]`;
   `fireKeyUp(target, "a")` → `[]`.
5. `scope` signal + `setScope`: `hk.setScope("draw")` → `hk.scope() === "draw"`
   and `hk.instance.getScope() === "draw"`.

**Verify**: `cd packages/solid && vp test run` → these tests pass.

### Step 3: Cover `createShortcut` (static + reactive) and `Hotkey`

1. Static: registers, fires, and unbinds on dispose.
2. Reactive: `const [combo, setCombo] = createSignal("ctrl+a")`;
   `createShortcut(hk, combo, handler)`; assert `ctrl+a` fires; then
   `setCombo("ctrl+b")`, flush a microtask, assert `ctrl+a` no longer fires
   and `ctrl+b` does (re-bind happened, old binding removed — check
   `hk.instance.getBindings().length === 1`).
3. Reactive cleanup: after dispose, neither combo fires and
   `getBindings()` is empty.
4. `Hotkey` called as a function inside `createRoot` behaves like case 1.

**Verify**: `vp test run` → passing; `getBindings()` assertions prove no
binding leak.

### Step 4: Cover `createLayer` and `createKeyHold`

1. `createLayer(hk, "modal", { active: true })` → `isActive()` true,
   `hk.layers()` contains `"modal"`; `pop()` → `isActive()` false.
2. Without `active`: `isActive()` false until `push()`.
3. Dispose auto-pops: create with `active: true`, `dispose()` → core
   `instance.getLayers()` no longer contains `"modal"`.
4. `createKeyHold(hk.instance, "shift")`: `fireKey(target, "Shift")` →
   signal true; then `fireKey(target, "a", { shiftKey: true })` → signal
   false (no longer the sole held key); `fireKeyUp` both → false.
   (Key-hold semantics: fires true only while the watched key is the ONLY
   key held — see `KeyHoldListener` docs in `packages/core/src/types.ts`.)

**Verify**: `cd packages/solid && vp test run` → full suite green; then from
repo root `vp run --cache -r test` → core + solid both pass.

## Test plan

This plan IS the test plan. Target: ≥ 14 test cases across the four steps,
covering registration, firing, reactive re-binding, and — most importantly —
disposal behavior of every primitive. Model structure after
`packages/core/src/hotkeys.test.ts` (describe-block per primitive,
`beforeEach` fresh target div).

## Done criteria

- [ ] `cd packages/solid && vp test run` exits 0 with ≥ 14 passing tests
- [ ] `vp run --cache -r test` at root exits 0 (core suite unaffected)
- [ ] `vp check` exits 0
- [ ] Every primitive (`createHotkeys`, `createShortcut`, `createLayer`,
      `createKeyHold`, `Hotkey`) has at least one disposal/cleanup assertion
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A test failure looks like a real bug in `packages/solid` or
  `packages/core` source (e.g. dispose does not actually unbind, the layers
  signal misses an update). Report the failing case and your diagnosis —
  fixing source is a separate decision.
- Solid's `createEffect` timing cannot be flushed deterministically with
  microtasks and tests are flaky after two attempts — report which approach
  you tried (the maintainer may accept `@solidjs/testing-library` as a new
  devDependency, but adding a dependency is not authorized by this plan).
- `vp test run` cannot discover/compile the test file after mirroring core's
  config (points to a Vite+ workspace-config difference worth a human look).

## Maintenance notes

- The `hk.instance.popLayer` vs `hk.popLayer` inconsistency in
  `createLayer.ts:34` is benign today; if `HotkeysInstance.popLayer` ever
  gains behavior (e.g. devtools events or signal writes beyond the
  subscription), the cleanup path would silently miss it — normalize then.
- Plan 008 (React adapter) should mirror this suite one-to-one; keep case
  names framework-neutral.
- Reviewer: scrutinize that reactive-combo tests assert the OLD binding is
  gone (`getBindings().length`), not just that the new one fires — that's the
  leak this suite exists to catch.
