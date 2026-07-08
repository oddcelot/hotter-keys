# Plan 007: Design spike — browser-default suppression (`claim`) and conflict detection

> **Executor instructions**: This is a DESIGN SPIKE with a working prototype.
> The deliverable is a design document plus prototype changes with tests on a
> branch, for maintainer review. Follow the steps in order; honor the STOP
> conditions. When done, update the status row in `plans/README.md` — unless
> a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8a80f5e..HEAD -- packages/core/src/hotkeys.ts examples/demo/src/App.tsx docs/src/components/DemoApp.tsx docs/src/components/KeymapCreator.tsx`
> On any mismatch with the excerpts below, STOP and report.

## Status

- **Priority**: P3
- **Effort**: M (coarse)
- **Risk**: MED — capture-phase `preventDefault` can swallow events other
  handlers expect; everything here must be opt-in
- **Depends on**: none (pairs well with plan 006; read its design doc if it exists)
- **Category**: direction
- **Planned at**: commit `8a80f5e`, 2026-07-07

## Why this matters

Every consumer in this repo that binds `mod+s`/`mod+p`-class shortcuts also
hand-rolls a capture-phase `keydown` suppressor to stop the browser's own
save/print/search actions — three near-identical copies exist. A library
whose pitch is "correct" shortcut handling should own this problem: an
opt-in way to claim combos from the browser, plus conflict detection over the
binding registry it already holds.

## Current state (all verified during planning)

**Why the hand-rolls exist — the load-bearing analysis.** Core's `add()`
defaults to `preventDefault: true` (`packages/core/src/hotkeys.ts:284`), and
`_matchBindings` calls `event.preventDefault()` on match
(`hotkeys.ts:431`). Cancelling `keydown` does suppress most browser
shortcut defaults, and the listener is attached WITHOUT capture
(`hotkeys.ts:116`: `this.target.addEventListener("keydown", this._onKeyDown)`).
So why do consumers still bolt on suppressors? Because `preventDefault`
only happens **when a binding actually matches and is active**. The gaps:

1. **Inactive layer/scope**: the demo binds `mod+z` on the `editor` layer.
   When that layer is popped, `mod+z` matches nothing → no `preventDefault`
   → the browser acts. The demo's suppressor
   (`examples/demo/src/App.tsx:51-60`) exists precisely for keys whose
   bindings are conditionally active:

   ```ts
   const globalKeys = new Set(["s", "p", "k"]);
   const globalShiftKeys = new Set(["p", "z"]);
   const suppress = (e: KeyboardEvent) => {
     const k = e.key.toLowerCase();
     if ((e.metaKey || e.ctrlKey) && globalKeys.has(k)) e.preventDefault();
     if ((e.metaKey || e.ctrlKey) && e.shiftKey && globalShiftKeys.has(k)) e.preventDefault();
   };
   document.addEventListener("keydown", suppress, { capture: true });
   ```

   (`docs/src/components/DemoApp.tsx:51-59` is a duplicate of this.)

2. **Bindings that opt out of preventDefault**: `KeymapCreator` registers
   with `preventDefault: false` (so recording UX stays intact) and instead
   suppresses wholesale while focused
   (`docs/src/components/KeymapCreator.tsx:86-96`: prevent everything during
   recording, and any `metaKey || ctrlKey` combo otherwise).
3. **Non-target listeners**: instances listening on a container element
   can't cancel events the browser handles before/il-respective of bubbling
   concerns; the hand-rolls all use `{ capture: true }`.

**What core already has for conflict detection**: `getBindings()`
(`hotkeys.ts:266`) returns every `Binding` with `sequence`, `layer`, `scope`;
`shortcutEquals` (`parse.ts:180-188`) compares chords. Nothing reports when
two bindings collide on the same sequence+layer+scope, or when a single-chord
binding shadows a sequence prefix (e.g. `mod+k` vs `mod+k mod+c` — core
handles runtime disambiguation via the deferred machinery at
`hotkeys.ts:455-515`, but authors get no visibility).

**Repo conventions**: options objects with JSDoc'd defaults
(`BindingOptions` in `packages/core/src/types.ts:58-87`); tests in
`packages/core/src/hotkeys.test.ts` style (jsdom, `fireKey` helper,
`expect(event.defaultPrevented)` assertions appear in the existing suite).

## Commands you will need

| Purpose    | Command                           | Expected on success |
| ---------- | --------------------------------- | ------------------- |
| Install    | `vp install`                      | exit 0              |
| Core tests | `cd packages/core && vp test run` | all pass            |
| Check      | `vp check`                        | exit 0              |

## Scope

**In scope**:

- `plans/design/suppression-and-conflicts.md` (create — primary deliverable)
- Prototype edits (branch only): `packages/core/src/hotkeys.ts`,
  `packages/core/src/types.ts`, new test file or additions to
  `packages/core/src/hotkeys.test.ts`

**Out of scope** (do NOT touch):

- Migrating the three hand-roll sites (follow-up after acceptance).
- Changing the default listener phase or `preventDefault` default — existing
  behavior must be byte-for-byte preserved when the new options are absent.
- The devtools packages (surfacing conflicts in devtools is a noted
  follow-up, not this spike).

## Git workflow

- Branch: `advisor/007-suppression-conflicts-spike`
- Commit style: short imperative subject.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Design doc — the suppression ("claim") API

Cover, with recommendations:

- API shape: `hk.claim("mod+s")` / `hk.claim(["mod+s", "mod+p"]) → unclaim fn`
  — registers a capture-phase canceller for combos regardless of whether an
  active binding matches. Alternative shapes to evaluate:
  `HotkeysOptions.capture: boolean` (moves the main listener to capture) and
  `BindingOptions.claim: boolean` (per-binding: suppress even when the
  binding's layer/scope is inactive — directly solves gap 1). Recommend which
  combination ships; the per-binding flag looks strongest against the
  evidence, with standalone `claim()` covering KeymapCreator's
  "preventDefault: false but still suppress" case (gap 2).
- Phase semantics: claims need their own capture-phase listener so they fire
  before page-level handlers; the matching listener stays bubble-phase.
- Interaction with `enableInInput` (should a claim suppress inside inputs? —
  recommend: claims respect the same `enableInInput` default, false).
- What claims can and cannot suppress (document honestly: browser-reserved
  combos like `mod+w`/`mod+t` are not cancelable from page JS — list them so
  users aren't misled; cite MDN rather than testing folklore).
- Lifecycle: claims removed on `destroy()`, included in `stop()`/`start()`.

**Verify**: doc section with API recommendation + rejected alternatives.

### Step 2: Design doc — `findConflicts()`

Specify a pure inspection API over `getBindings()`:

```ts
interface Conflict {
  kind: "duplicate" | "prefix-shadow";
  bindings: [Binding, Binding];
}
findConflicts(): Conflict[]
```

- `duplicate`: identical sequence + same layer + overlapping scope
  (`undefined`/`"*"` overlaps everything).
- `prefix-shadow`: one binding's sequence is a strict prefix of another's on
  the same layer/scope (runtime handles it via deferral; authors still want
  the report).
- Decide: live method on `Hotkeys` vs standalone function taking
  `ReadonlyArray<Binding>` (recommend method + exported pure helper, so
  devtools can reuse it).

**Verify**: doc section with the exact conflict taxonomy and worked examples
from the demo's own bindings (`examples/demo/src/bindings.ts` has `mod+z` on
both `editor` layer and two scopes — a legitimate non-conflict the taxonomy
must NOT flag; and `mod+k` prefix of `mod+k mod+c` in the global layer — a
prefix-shadow it MUST flag... note: the demo has `mod+k mod+c` but no bare
`mod+k` binding; construct the example accordingly).

### Step 3: Prototype both

Implement the recommended claim shape + `findConflicts` with zero behavior
change when unused. Keep the claim canceller a separate listener; do not
thread claim logic through `_matchBindings`.

**Verify**: `vp check` → 0; existing 850-line suite still green
(`cd packages/core && vp test run`).

### Step 4: Tests

- Claim suppresses default when no binding matches (assert
  `event.defaultPrevented` true after `fireKey` on a claimed combo with no
  active binding), and unclaim restores.
- Per-binding claim (if recommended): binding on popped layer still
  `preventDefault`s but does NOT fire its handler.
- Claims die with `destroy()`.
- `findConflicts`: duplicate detection, scope-overlap rules
  (`"*"` vs named vs `undefined`), prefix-shadow detection, and the
  demo-derived non-conflict cases (same combo on different layers/scopes →
  no conflict).

**Verify**: `cd packages/core && vp test run` → all pass, ≥ 10 new cases.

## Test plan

Step 4 enumerates it. Assert on `event.defaultPrevented` (the existing suite
already does this — match it) rather than mocking `preventDefault`.

## Done criteria

- [ ] `plans/design/suppression-and-conflicts.md` complete (claim API,
      cancelability honesty list, conflict taxonomy, rejected alternatives)
- [ ] Prototype + ≥ 10 tests pass; pre-existing suite untouched and green
- [ ] `vp check` exits 0
- [ ] With no claims registered, `git diff` shows zero changes to the
      keydown matching path semantics (reviewer-checkable: `_matchBindings`
      diff is empty or trivially additive)
- [ ] No files outside the in-scope list modified
- [ ] `plans/README.md` status row updated (DONE = spike ready for review)

## STOP conditions

Stop and report back if:

- Implementing claims requires moving the existing matching listener to
  capture phase (behavioral change for every current consumer — maintainer
  call).
- jsdom's `defaultPrevented` semantics make the suppression tests
  unrepresentative of real browsers in a way you can articulate — report
  instead of shipping tests that prove nothing.
- The conflict taxonomy needs more than the two kinds to be useful (scope
  semantics ambiguity) — write the open question, don't invent semantics.

## Maintenance notes

- Follow-up after acceptance: migrate the three hand-roll sites
  (`examples/demo/src/App.tsx`, `docs/src/components/DemoApp.tsx`,
  `docs/src/components/KeymapCreator.tsx`) to the new API — they then become
  the living documentation; also surface `findConflicts()` in the devtools
  panel (pairs with plan 004's suite).
- Plan 006 (named keys) widens what can be claimed (F-keys, `mod+enter`);
  cross-link the docs.
- Reviewer: the risk to scrutinize is silent over-suppression — every claim
  test should also assert that UNclaimed combos still have
  `defaultPrevented === false` when nothing matches.
