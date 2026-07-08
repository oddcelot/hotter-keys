# Plan 006: Design spike — layout-independent named keys (Escape, Enter, arrows, F-keys)

> **Executor instructions**: This is a DESIGN SPIKE with a working prototype.
> The deliverable is a design document plus prototype changes with tests on a
> branch, for maintainer review. Follow the steps in order; honor the STOP
> conditions. When done, update the status row in `plans/README.md` — unless
> a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8a80f5e..HEAD -- packages/core/src/`
> On any mismatch with the excerpts below, STOP and report.

## Status

- **Priority**: P2
- **Effort**: M (coarse)
- **Risk**: MED — touches the matching hot path and the public `SafeKey` type
- **Depends on**: plans/002-prerelease-hygiene.md (soft — 002 removes the
  stale "Keyboard API" docs claim this spike may later legitimately restore)
- **Category**: direction
- **Planned at**: commit `8a80f5e`, 2026-07-07

## Why this matters

The library's key set is a–z and 0–9, full stop. That means no `Escape` to
close a modal, no `mod+enter` to submit, no arrow-key navigation, no F-keys —
the bread and butter of real applications. The restriction exists for
layout-safety (symbol keys move between keyboard layouts), but **named keys
don't have that problem**: `KeyboardEvent.key` values like `"Escape"`,
`"Enter"`, `"ArrowUp"`, `"F5"` are layout-independent named values. The
repo's own docs tool proves the pain: it hand-rolls a raw capture-phase
listener just to handle Escape, and the recorder can _record_ keys the
library then refuses to _bind_.

## Current state (all verified during planning)

- The type gate — `packages/core/src/types.ts:9-39`: `SafeKey = AlphaKey | DigitKey`
  (a–z, 0–9). `Shortcut extends Modifiers { key: SafeKey }`.
- The parse gate — `packages/core/src/parse.ts:3-4` and `97-101`:

  ```ts
  export const ALPHA = /^[a-z]$/;
  export const DIGIT = /^[0-9]$/;
  ...
  if (!ALPHA.test(key) && !DIGIT.test(key)) {
    throw new Error(
      `Shortcut key "${key}" is not a safe cross-layout key (only a-z and 0-9 are allowed)`,
    );
  }
  ```

  Plus the Shift rule at `parse.ts:104-108`: `Shift+<digit>` rejected
  (locale-dependent symbols) — Shift with named keys has no such issue.

- Matching — `parse.ts:170-178` `eventMatchesShortcut` compares
  `e.key.toLowerCase() === s.key` plus exact modifier flags. Named keys
  lowercase cleanly (`"Escape"` → `"escape"`, `"ArrowUp"` → `"arrowup"`);
  the space key is the special case: `e.key === " "`, so a `"space"` token
  must map to `" "` (or matching must normalize).
- Recording — `packages/core/src/record.ts:49-58` marks anything outside
  ALPHA/DIGIT unsafe:

  ```ts
  if (!ALPHA.test(key) && !DIGIT.test(key)) {
    safe = false;
    unsafeReason = ... `"${key}" is not a safe cross-layout key (only a-z and 0-9)`;
  ```

- Display — `parse.ts:132-140` `formatShortcut` does
  `parts.push(s.key.toUpperCase())`; a named key would render as `"ESCAPE"` —
  needs a display map (mac: `⎋ ↵ ⇥ ␣ ← → ↑ ↓`; other: `Esc`, `Enter`, …).
- The in-repo pain point — `docs/src/components/KeymapCreator.tsx:248-253`:

  ```ts
  const onEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      ac.abort();
      e.preventDefault();
    }
  };
  containerRef.addEventListener("keydown", onEscape, { capture: true });
  ```

- Sequence semantics to preserve — chord matching, layers, scopes, and the
  deferred-disambiguation machinery live in
  `packages/core/src/hotkeys.ts:362-515`; the spike must not alter that logic,
  only what counts as a valid key.
- Design doctrine (docs/src/content/docs/guides/getting-started.md, principles
  1–4, based on the linked analysis blog post): match on `key`, only a-z/0-9
  are safe **among printable character keys**, Shift only with a-z. The spike
  extends the doctrine — it does not contradict it — because named keys are
  not printable character keys.
- Existing test suites to keep green: `parse.test.ts` (305 lines) includes
  cases asserting that non-safe keys THROW — those tests will need updating
  for whichever named keys become legal (that's expected, note it in the doc).

## Commands you will need

| Purpose    | Command                           | Expected on success |
| ---------- | --------------------------------- | ------------------- |
| Install    | `vp install`                      | exit 0              |
| Core tests | `cd packages/core && vp test run` | all pass            |
| Check      | `vp check`                        | exit 0              |

## Scope

**In scope**:

- `plans/design/named-keys.md` (create — primary deliverable)
- Prototype edits (branch only): `packages/core/src/types.ts`,
  `packages/core/src/parse.ts`, `packages/core/src/record.ts`, and their
  test files
- `packages/core/src/hotkeys.ts` ONLY if matching normalization (space key)
  cannot live in `parse.ts` — prefer parse-level normalization

**Out of scope** (do NOT touch):

- Docs-site pages (a follow-up documents the feature after acceptance).
- `navigator.keyboard.getLayoutMap()` implementation — phase-2 question,
  design-doc section only (see Step 5).
- The Solid adapter and devtools — they consume combo strings opaquely.
- Punctuation/symbol keys — explicitly NOT in the named-key set; that is the
  layout-dependent territory the library exists to avoid.

## Git workflow

- Branch: `advisor/006-named-keys-spike`
- Commit style: short imperative subject.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Decide and document the named-key set

In `plans/design/named-keys.md`, propose the set with rationale per group:
`escape`, `enter`, `tab`, `space`, `backspace`, `delete`, `home`, `end`,
`pageup`, `pagedown`, `arrowup/arrowdown/arrowleft/arrowright` (with `up`/
`down`/`left`/`right` aliases?), `f1`–`f12`. For each: the exact
`KeyboardEvent.key` value, layout-independence argument, and known hazards
(Tab = focus navigation; F-keys = browser/OS reserved combos; Space =
scrolling + the `" "` key value).

**Verify**: doc section exists with a table (token, event.key, hazards).

### Step 2: Document the design decisions

Each with a recommendation:

- Type strategy: widen `SafeKey` union (breaking for consumers doing
  exhaustive checks — unlikely) vs a new `NamedKey` union unioned into
  `Shortcut["key"]`. Recommend the latter for clarity.
- Shift rule for named keys (recommend: allowed — `shift+enter`,
  `shift+tab` are staple bindings and layout-safe).
- `enableInInput` interplay: `escape`/`enter` are exactly the keys users want
  inside inputs; recommend no special-casing, document the option.
- Modifier-less named keys (`escape` alone is the whole point) — confirm the
  parser accepts a bare named key (it accepts bare `a` today, so bare
  `escape` follows the same path).
- Display strings per platform (map in `formatShortcut`; mac symbols vs
  words).
- Sequence timeout interaction: none expected (named keys flow through the
  same chord machinery) — state it and cover with one test.
- `recordShortcut`: named keys flip from `safe: false` to `safe: true`; the
  `unsafeReason` for Alt-on-mac stays.

**Verify**: doc lists every bullet with a recommendation and a one-line risk.

### Step 3: Prototype

Implement in `parse.ts` (token table + validation + display map + space
normalization), `types.ts` (key union), `record.ts` (safety check update).
Keep `eventMatchesShortcut` a pure comparison — normalization happens at
parse time (store `" "` for space) so the hot path gains zero branches.

**Verify**: `vp check` → exit 0.

### Step 4: Tests

Extend `parse.test.ts` and `record.test.ts`, add matching cases to
`hotkeys.test.ts` style (or a new `named-keys.test.ts`): parse every token,
reject unknown names (`"escappe"` throws), bare `escape` binding fires on
Escape keydown, `mod+enter` fires, `shift+tab` fires, space binding fires on
`" "`, a sequence `"g g"` vs `"escape escape"` both work, display strings on
mac/non-mac (use the existing `platform` override parameter pattern —
`parseShortcut(raw, { mac: true })` — visible throughout `parse.test.ts`),
recorder marks `escape` safe now. Update the existing throw-assertions that
named keys previously violated; list each updated assertion in the report.

**Verify**: `cd packages/core && vp test run` → all pass, including the
pre-existing suite.

### Step 5: Phase-2 section — the Keyboard API question

Design-doc section only: could `navigator.keyboard.getLayoutMap()` (Chromium)
safely admit _printable_ keys beyond a–z/0–9 by resolving the user's actual
layout? Cover: availability (secure contexts, Chromium-only), fallback
story, whether it changes stored combo portability (a combo valid on one
layout may not exist on another — likely reason to recommend AGAINST or
behind an explicit opt-in). This section resolves the docs claim removed in
plan 002 with an honest answer instead of a false promise.

**Verify**: section exists with a clear recommendation.

## Test plan

Step 4 is the test plan (≥ 12 new/updated cases enumerated there).

## Done criteria

- [ ] `plans/design/named-keys.md` complete: key-set table, decisions with
      recommendations, phase-2 Keyboard API verdict, list of updated
      pre-existing tests
- [ ] Prototype compiles, `cd packages/core && vp test run` exits 0
- [ ] `vp check` exits 0
- [ ] `grep -n "escape" packages/core/src/parse.ts` shows the token wired in
- [ ] No files outside the in-scope list modified
- [ ] `plans/README.md` status row updated (DONE = spike ready for review)

## STOP conditions

Stop and report back if:

- Space-key normalization cannot be contained to parse time (i.e.
  `eventMatchesShortcut` or `hotkeys.ts` would need per-event branching) —
  that changes the hot-path risk profile and needs a maintainer call.
- Widening the key type breaks the public `.d.ts` in a way `vp check`
  flags in dependent packages (solid/devtools).
- More than ~4 pre-existing tests need semantic (not just fixture) changes —
  the doctrine conflict is bigger than this plan assumed.

## Maintenance notes

- Follow-ups if accepted: docs page update (Features list, getting-started
  principles — extend principle 2's wording to "printable keys"), README
  feature bullet, KeymapCreator's `onEscape` hand-roll replaced with a real
  binding, recorder UI in docs showing named keys as safe.
- Interacts with plan 005 (keymap API): persisted keymaps may contain named
  keys — 005's invalid-combo tolerance covers the transition window.
- Interacts with plan 007: F-key and `mod+<named>` combos raise the browser-
  default-suppression question more often (e.g. F5, mod+enter) — cross-link
  the two design docs.
