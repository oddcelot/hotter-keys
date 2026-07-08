# Plan 009: Feasibility spike — devtools as a build-tool-independent browser panel

> **Executor instructions**: This is a FEASIBILITY SPIKE. The deliverable is
> a written feasibility report plus a throwaway prototype demonstrating (or
> refuting) the approach — not a shippable extension. Follow the steps in
> order; honor the STOP conditions. When done, update the status row in
> `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8a80f5e..HEAD -- packages/vite-plugin-devtools/src/client/ packages/core/src/hotkeys.ts`
> On any mismatch with the excerpts below, STOP and report.

## Status

- **Priority**: P3
- **Effort**: L overall; this spike itself is scoped to M
- **Risk**: LOW (nothing shipped; prototype is isolated)
- **Depends on**: plans/004-devtools-tests.md (soft — the handshake suite is
  the safety net proving the protocol this spike reuses)
- **Category**: direction
- **Planned at**: commit `8a80f5e`, 2026-07-07

## Why this matters

The devtools' discovery protocol is pure JavaScript over `globalThis` — no
Vite, no Astro required — yet the only shipped entry points are an Astro
Dev Toolbar app and a `@vitejs/devtools` panel, so the devtools work only in
those dev servers. Every `Hotkeys` instance on ANY page already self-registers
into the protocol. A browser extension (or bookmarklet) would let developers
inspect bindings, layers, and events on any site running the library —
including production debugging — with almost no new protocol work. README
markets devtools as a headline feature; this widens its reach from "Vite/Astro
dev server" to "any browser tab".

## Current state (all verified during planning)

- Core self-registration — `packages/core/src/hotkeys.ts:95-105`
  (constructor): if `globalThis.__HOTTER_KEYS_DEVTOOLS__` exists, call its
  `__register(this)`; otherwise push onto `globalThis.__HOTTER_KEYS_INSTANCES__`.
  This runs in EVERY build of core, production included — which is what makes
  a late-attaching extension viable.
- The sentinel — `packages/vite-plugin-devtools/src/client/shared.ts:129-183`,
  `setupSentinel(onEvent, options?, onRawEvent?)`: installs the global,
  drains stashed instances, wires `instance.__devtools = hook`, and replays
  existing bindings (`binding:added` per binding via `getBindings()`) and the
  layer stack (`layer:change` via `getLayers()`) for late attachment. No DOM,
  no build-tool imports — the file's only imports are its own types.
- The existing UIs it feeds: `src/client/panel.ts` (250 lines, DOM event-log
  panel) and `src/client/toolbar-app.ts` (358 lines, Astro toolbar app);
  `src/client/devtools-action.ts` (79 lines). These are candidates for reuse
  in the prototype but NOT required — a minimal table render is enough to
  prove feasibility.
- Entry-point gating — `packages/vite-plugin-devtools/src/index.ts:35-57`:
  the Astro integration only acts when `command === "dev"`; the Vite variant
  (`src/vite-devtools.ts`) is dev-server-bound similarly.

The technical questions this spike must answer (write these into the report):

1. **World/context**: a Chrome MV3 content script runs in an ISOLATED world
   by default and cannot see the page's `globalThis`. Options:
   `"world": "MAIN"` content scripts (Chrome 111+), or injecting a `<script>`
   tag into the page. Which works, and what are the Firefox equivalents?
2. **Timing**: instances created before the sentinel attaches are covered by
   the stash + replay path (verified above) — confirm in practice that
   `document_start` vs `document_idle` injection both recover full state.
3. **CSP**: strict page CSP can block injected inline scripts — does the
   chosen injection route survive common CSP configurations?
4. **UI transport**: render in-page (floating panel, simplest) vs a real
   DevTools panel (`chrome.devtools.panels`, requires message passing between
   the MAIN-world script and the panel — postMessage/port relay). The spike
   may prototype in-page and only PAPER-design the DevTools-panel transport.
5. **Bookmarklet alternative**: a `javascript:` bookmarklet importing nothing
   and inlining `setupSentinel` + a tiny panel — zero distribution overhead,
   worse ergonomics. Worth shipping as a stopgap?

## Commands you will need

| Purpose     | Command                                | Expected on success                                                        |
| ----------- | -------------------------------------- | -------------------------------------------------------------------------- |
| Install     | `vp install`                           | exit 0                                                                     |
| Demo server | `vp run --filter hotter-keys-demo dev` | dev server on localhost                                                    |
| Check       | `vp check`                             | exit 0 (spike code excluded from workspace checks if kept under examples/) |

## Scope

**In scope**:

- `plans/design/devtools-extension.md` (create — the feasibility report)
- `examples/extension-spike/**` (create — throwaway prototype: manifest.json,
  content script, minimal panel; NOT added to `pnpm-workspace.yaml`)

**Out of scope** (do NOT touch):

- `packages/vite-plugin-devtools/src/**` — the spike consumes `shared.ts` by
  copying or bundling it, never by editing it. If reuse requires an export
  restructure, write that in the report as a follow-up.
- `packages/core/**`.
- Store packaging, icons, signing, release wiring — feasibility only.

## Git workflow

- Branch: `advisor/009-devtools-extension-spike`
- Commit style: short imperative subject.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Answer the world/timing/CSP questions on paper

Research questions 1–3 (MDN/Chrome developer docs), write the findings with
citations into `plans/design/devtools-extension.md`, and pick the injection
approach for the prototype.

**Verify**: report sections for questions 1–3 exist with a chosen approach.

### Step 2: Build the minimal prototype

In `examples/extension-spike/`: an MV3 `manifest.json`, a MAIN-world content
script (or injector) that inlines/bundles `setupSentinel` from a copied
`shared.ts` plus a ~50-line floating panel (fixed-position list of
`DevtoolsLogEntry.detail` strings — reuse `fmtSequence`/`formatDetail` from
the copied module). No build step if avoidable; if one is needed, a single
`vp dlx`-invocable bundler command documented in the spike README.

**Verify**: extension loads unpacked in Chrome (`chrome://extensions`, Load
unpacked) without manifest errors.

### Step 3: Validate against the demo app

Run `vp run --filter hotter-keys-demo dev`, open the demo with the extension
active, and confirm: (a) the stashed instance is discovered (bindings replay
appears in the panel), (b) pressing demo shortcuts produces `binding:fired`
entries live, (c) layer push/pop shows `layer:change`. Screenshot or paste
the panel contents into the report. If a production-like check is easy, also
`vp run --filter hotter-keys-demo build && vp preview` and repeat.

**Verify**: all three behaviors observed and recorded in the report.

### Step 4: Write the verdict

Report conclusion: feasible/not, chosen architecture, what a shippable
version needs (packaging, Firefox support, DevTools-panel transport,
`shared.ts` export restructure so the extension imports instead of copies),
rough effort, and the bookmarklet-stopgap recommendation (question 5).

**Verify**: report has a "Verdict" section a maintainer can act on in one read.

## Test plan

No automated tests — the spike's Step 3 manual validation, recorded in the
report, is the evidence. (Plan 004's suite already covers the protocol
mechanics in CI.)

## Done criteria

- [ ] `plans/design/devtools-extension.md` answers questions 1–5 with a verdict
- [ ] `examples/extension-spike/` loads unpacked and demonstrably shows
      replay + live events against the demo (evidence in the report)
- [ ] `vp check` at root still exits 0 (spike dir not breaking workspace checks)
- [ ] No files outside the in-scope list modified
- [ ] `plans/README.md` status row updated (DONE = verdict delivered)

## STOP conditions

Stop and report back if:

- MAIN-world access to the page's `globalThis` is not achievable in current
  stable Chrome with documented APIs (the whole premise fails — write the
  negative verdict, which is a valid spike outcome, and stop).
- The prototype requires modifying `packages/vite-plugin-devtools` exports —
  record the needed change in the report instead of making it.
- A browser environment for manual validation is unavailable to you — deliver
  Steps 1 and 4 (paper feasibility + verdict marked "unvalidated") and say so.

## Maintenance notes

- If the verdict is positive, the follow-up plan should restructure
  `packages/vite-plugin-devtools` so `client/shared.ts` (and ideally the
  panel rendering) is an importable, build-tool-free entry point — the
  copied module in the spike is deliberate throwaway duplication.
- The `__HOTTER_KEYS_INSTANCES__` stash grows unbounded on pages that never
  attach devtools; if production inspection becomes a real feature, revisit
  whether core should cap or weak-reference the stash (core change —
  separate discussion).
