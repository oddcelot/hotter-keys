# Plan 005: Design spike — first-class keymap API (named actions, serialize/load, rebind)

> **Executor instructions**: This is a DESIGN SPIKE, not a build-everything
> plan. The deliverable is a design document plus a small prototype with
> tests, produced for maintainer review — not a merged feature. Follow the
> steps in order; honor the STOP conditions. When done, update the status row
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8a80f5e..HEAD -- packages/core/src/ docs/src/lib/opfs.ts docs/src/components/KeymapCreator.tsx examples/demo/src/bindings.ts`
> On any mismatch with the excerpts below, STOP and report.

## Status

- **Priority**: P2
- **Effort**: M (coarse — direction spikes are estimated loosely)
- **Risk**: LOW (additive API; prototype stays on a branch)
- **Depends on**: none (plans 001–002 recommended first for a working baseline)
- **Category**: direction
- **Planned at**: commit `8a80f5e`, 2026-07-07

## Why this matters

Three independent consumers inside this very repo hand-roll the same
"named action → shortcut" keymap concept, including its persistence format
and the rebind bookkeeping. That is the strongest possible demand signal: the
library's own showcase (a "Keymap Creator" docs tool) cannot be built on the
public API without reinventing a keymap layer. A first-class keymap API turns
"user-customizable shortcuts" — the headline use case for `recordShortcut` —
into a few lines for every consumer.

## Current state (the three hand-rolls — evidence, all verified)

1. `docs/src/lib/opfs.ts:1-36` — a persistence format plus OPFS load/save:

   ```ts
   export interface KeymapEntry {
     id: string;
     name: string;
     description: string;
     shortcut: string;
   }
   ```

2. `docs/src/components/KeymapCreator.tsx:60-81` — manual rebind bookkeeping:

   ```ts
   const unbindMap = new Map<string, () => void>();
   ...
   const rebindAll = () => {
     for (const unsub of unbindMap.values()) unsub();
     unbindMap.clear();
     for (const entry of entries) {
       if (!entry.shortcut) continue;
       try {
         const unsub = hk.add(entry.shortcut, () => flash(entry.id), {
           preventDefault: false,
         });
         unbindMap.set(entry.id, unsub);
       } catch {
         // invalid shortcut string — skip
       }
     }
   };
   ```

3. `examples/demo/src/bindings.ts:4-9` — the demo's own metadata-carrying
   binding shape, mapped onto `hk.add` in a loop in
   `examples/demo/src/App.tsx:63-72`:

   ```ts
   export interface Binding {
     raw: string;
     action: string;
     options?: BindingOptions;
     handler?: "openModal";
   }
   ```

What core offers today (`packages/core/src/hotkeys.ts`, read in full):

- `add(shortcut, handler, options) → unsub` (line 270), `addMany(map, options)`
  (line 315 — combo-keyed, no metadata), `remove(shortcut)` (combo-identity,
  line 322), `removeAll()`, `getBindings()` (line 266 — returns `Binding[]`,
  which carries `sequence`/`handler`/options but **no name, id, or
  description**, so live state cannot be serialized into a labeled keymap).
- `parseSequence`/`formatSequence` in `packages/core/src/parse.ts` handle the
  string↔chord round-trip; there is nothing at the keymap level.
- `recordShortcut` (`packages/core/src/record.ts`) produces a
  `RecordedShortcut` designed for "store as `mod+key`" portability — the
  producer side of exactly the format a keymap API would consume.

Design constraints from the codebase:

- Core is zero-dependency and framework-agnostic — the keymap API must be too.
- `docs/src/content/docs/` has a `tools/kitchen-sink.mdx` page documenting a
  canonical `keymap.json` shape (`{entries: [{name, shortcut}]}`) — the
  design should either adopt or explicitly supersede it.
- Naming/vocabulary in this repo: "binding" = live registration; "shortcut" =
  the combo string; "sequence" = parsed chords. Introduce "action" (the
  stable name) and "keymap" (action → shortcut mapping) consistently.

## Commands you will need

| Purpose    | Command                           | Expected on success |
| ---------- | --------------------------------- | ------------------- |
| Install    | `vp install`                      | exit 0              |
| Core tests | `cd packages/core && vp test run` | all pass            |
| Check      | `vp check`                        | exit 0              |

## Scope

**In scope**:

- `plans/design/keymap-api.md` (create — the primary deliverable)
- `packages/core/src/keymap.ts` + `packages/core/src/keymap.test.ts`
  (create — prototype, on the branch only)
- `packages/core/src/index.ts` (export the prototype symbols, prototype-only)

**Out of scope** (do NOT touch):

- Rewriting `KeymapCreator.tsx`, the demo, or `opfs.ts` — the design doc maps
  them onto the new API on paper; migrating them is a follow-up plan.
- `packages/core/src/hotkeys.ts` internals — the prototype should compose on
  the public surface (`add`/`getBindings`); if it cannot, that is a design
  finding to write down, not a license to refactor core.
- Any docs-site page.

## Git workflow

- Branch: `advisor/005-keymap-api-spike`
- Commit style: short imperative subject.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the requirements section from the three consumers

In `plans/design/keymap-api.md`, derive requirements strictly from the three
evidence sites: stable action ids, display name/description metadata,
combo-per-action (possibly empty = unbound), atomic rebind (replace an
action's combo without disturbing others), whole-map load/save round-trip
(JSON), invalid-combo tolerance (KeymapCreator's try/catch), per-action
`BindingOptions`, and handler lookup by action id (demo's `handler:
"openModal"` indirection).

**Verify**: the doc has a requirements table with a "source" column citing
each of the three files for every requirement.

### Step 2: Draft the API

Propose (and justify against alternatives) an API of roughly this shape —
adjust as the requirements demand, this is a starting sketch, not a spec:

```ts
interface KeymapAction {
  /** Stable id, e.g. "editor.save" */
  id: string;
  name?: string;
  description?: string;
  /** Default combo; users may override */
  shortcut?: string;
  options?: BindingOptions;
}

const km = createKeymap(hk, actions, handlers /* Record<id, ShortcutHandler> */);
km.rebind("editor.save", "mod+shift+s"); // replaces just that binding
km.reset("editor.save"); // back to the action default
km.toJSON(); // {version, entries: [{id, shortcut}]}
km.load(json); // apply persisted overrides
km.destroy();
```

Required design decisions to document (each with a recommendation):

- Overrides-only vs full-map serialization (recommend overrides-only: defaults
  live in code, JSON stores deviations — versionable and merge-friendly).
- Unknown action ids in loaded JSON (recommend: ignore + report via return
  value, matching KeymapCreator's tolerance).
- Invalid combo strings in loaded JSON (recommend: skip entry, collect errors,
  never throw mid-load).
- Relationship to `addMany` (combo-keyed, metadata-less — subsume or leave).
- Whether `Binding` gains an optional `id` so `getBindings()` output can be
  correlated with actions (devtools would benefit; keep `Binding` shape
  backward-compatible).
- Adoption/supersession of the documented `keymap.json` shape in
  `docs/.../tools/kitchen-sink.mdx`.

**Verify**: doc contains the API sketch, the decision list with
recommendations, and a "rejected alternatives" subsection.

### Step 3: Prototype in `packages/core/src/keymap.ts`

Implement the minimal surface (`createKeymap`, `rebind`, `toJSON`, `load`,
`destroy`) purely on top of `hk.add`/unsub functions — mirroring, and thereby
replacing, KeymapCreator's `unbindMap` dance. Zero new dependencies.

**Verify**: `vp check` exits 0; prototype is ≤ ~150 lines.

### Step 4: Prototype tests

`packages/core/src/keymap.test.ts`, modeled on `hotkeys.test.ts` (jsdom,
`fireKey` helper from `./test-helpers`): register-and-fire by action, rebind
replaces old combo (old no longer fires, `getBindings()` count stable),
round-trip `toJSON` → fresh instance `load` → same firing behavior, invalid
combo in `load` skipped without throwing, `destroy` unbinds everything.

**Verify**: `cd packages/core && vp test run` → old suite + new tests pass.

### Step 5: Map the three consumers onto the API (on paper)

Final doc section: for each of KeymapCreator, the demo, and `opfs.ts`, show
the before/after in prose + short snippets, and list what each still has to
hand-roll (e.g. OPFS storage itself stays userland — fine). Note open
questions for the maintainer.

**Verify**: doc section exists; each consumer's `unbindMap`-equivalent is
eliminated in the "after" sketch.

## Test plan

Step 4 is the test plan (≥ 6 cases, listed there).

## Done criteria

- [ ] `plans/design/keymap-api.md` exists with: requirements table (sourced),
      API sketch, decisions with recommendations, rejected alternatives,
      consumer mapping, open questions
- [ ] Prototype + tests compile and pass: `cd packages/core && vp test run` → 0
- [ ] `vp check` exits 0
- [ ] No files outside the in-scope list modified
- [ ] `plans/README.md` status row updated (DONE = design ready for review;
      shipping the API is a follow-up decision)

## STOP conditions

Stop and report back if:

- The prototype cannot express atomic rebind on the public API without
  touching `hotkeys.ts` internals (document why in the design doc, then stop
  before modifying core).
- You find the `Binding` type must change incompatibly to support
  serialization — that's a maintainer decision, not a spike decision.
- The design doc exceeds ~3 pages of open questions — the feature needs a
  product conversation, not more prototyping.

## Maintenance notes

- If accepted, follow-ups are: promote prototype to shipped API + docs page,
  migrate KeymapCreator/demo to it (deleting `opfs.ts`'s `KeymapEntry` in
  favor of the library type), and consider devtools showing action ids
  (pairs with plan 004's suite).
- Interacts with plan 006 (named keys): a persisted keymap must tolerate
  combos that parse only after 006 lands — the invalid-combo tolerance
  decision covers this; note it in the doc.
