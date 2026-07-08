# Plan 008: Build @hotter-keys/react by porting the Solid adapter's five primitives

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8a80f5e..HEAD -- packages/solid/ pnpm-workspace.yaml .github/workflows/publish.yml`
> If the Solid sources changed since planning, port from the live code, not
> the excerpts; if `pnpm-workspace.yaml`'s catalog or `publish.yml` diverge
> from the excerpts, STOP and re-check the affected step.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW (additive package; core untouched)
- **Depends on**: plans/003-solid-adapter-tests.md (its suite is the
  one-to-one template for this package's tests)
- **Category**: direction
- **Planned at**: commit `8a80f5e`, 2026-07-07

## Why this matters

The core library is framework-agnostic and exposes clean subscription hooks
(`onLayerChange`, `onHeldKeysChange`, `onKeyHold`) that map directly onto any
framework's reactivity. Today the only adapter is Solid — a small audience.
The Solid package is five tiny files (~200 lines total); a React adapter is a
mechanical port that materially expands who can adopt the library. This is a
maintainer strategy call already made if this plan was selected; the plan's
job is a faithful port, not API invention.

## Current state

The port source — all five files, read in full during planning
(`packages/solid/src/`):

- `createHotkeys.ts` (67 lines) — wraps core `createHotkeys`, exposes
  `{ instance, layers, heldKeys, scope, setScope, pushLayer, popLayer }`;
  signals fed by `instance.onLayerChange` / `onHeldKeysChange`; cleanup
  unsubscribes both and calls `instance.destroy()`.
- `createShortcut.ts` (40 lines) — static combo: `instance.add` + cleanup
  unsub. Reactive combo (accessor): re-register on change, unsub previous.
- `createLayer.ts` (44 lines) — optional `active: true` push on mount,
  auto-pop on cleanup, `{ isActive, push, pop }` with `isActive` derived from
  the layers signal.
- `createKeyHold.ts` (18 lines) — boolean signal over `instance.onKeyHold`.
- `Hotkey.tsx` (27 lines) — declarative component delegating to
  `createShortcut`; renders nothing.

React equivalents (the mapping to implement):

| Solid                              | React                                                                                                                                                                                                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createHotkeys()` in component     | `useHotkeys(options?)` — instance in `useState(() => ...)` initializer; destroy in `useEffect` cleanup                                                                                                                                                                                                        |
| signals from `on*Change`           | `useSyncExternalStore(subscribe, getSnapshot)` per store — cache snapshots; core returns fresh arrays from `getLayers()`/`getHeldKeys()` (see `packages/core/src/hotkeys.ts:167-169, 211-213`), so `getSnapshot` must return a cached reference updated only inside the subscription callback, or React loops |
| `createShortcut(hk, combo, fn)`    | `useShortcut(hk, combo, handler, options?)` — `useEffect` keyed on `[hk, combo, JSON-stable options]`; keep latest handler in a ref so handler identity doesn't re-bind                                                                                                                                       |
| `createLayer`                      | `useLayer(hk, name, { active }?)` — push/pop in `useEffect`; `isActive` derived from the layers store value                                                                                                                                                                                                   |
| `createKeyHold`                    | `useKeyHold(instance, key)` — `useSyncExternalStore` over `onKeyHold`                                                                                                                                                                                                                                         |
| `<Hotkey hk combo onFire options>` | same props, calls `useShortcut`, returns `null`                                                                                                                                                                                                                                                               |

Package scaffolding — mirror `packages/solid/package.json` exactly
(read in full during planning): name `@hotter-keys/react`, version `0.0.1`,
`"license": "GPL-3.0-only"`, repository with `"directory": "packages/react"`,
`"files": ["dist"]`, `"type": "module"`, `"sideEffects": false`,
main/types/exports pointing at `./dist/index.js|.d.ts`, scripts
`"build": "tsc"` / `"dev": "tsc --watch"`, peerDependencies
`"@hotter-keys/core": "workspace:*"` and `"react": ">=18.0.0"`,
devDependencies `"@hotter-keys/core": "workspace:*"`, `"react": "catalog:"`,
`"typescript": "catalog:default"` — plus the test deps from plan 003's
pattern (`"jsdom": "catalog:"`, `"vite-plus": "catalog:"`,
`"vitest": "catalog:"`, and `"@types/react": "catalog:"`).

Catalog: `pnpm-workspace.yaml`'s `catalogs.default` has NO react entries
today — add `react`, `react-dom` (only if tests need a renderer — prefer
renderer-less hook testing), and `@types/react` pinned to current stable.

Release wiring: `publish.yml`'s build job uploads
`packages/core/dist`, `packages/solid/dist`,
`packages/vite-plugin-devtools/dist` as artifacts — the new package's `dist`
must be added there, and the trailing comment about JSR (solid/devtools are
npm-only) applies to react too: do NOT create a `jsr.json`.

Docs surface to update: root `README.md` package table + a short "React"
section mirroring the existing "Solid.js" section (lines 70–93 of README.md).

`tsconfig.json`: copy `packages/solid/tsconfig.json` and adjust `jsx` to
`react-jsx` (read the solid one before copying; it was not excerpted here —
if it contains solid-specific `jsxImportSource`, replace accordingly).

## Commands you will need

| Purpose | Command                                            | Expected on success |
| ------- | -------------------------------------------------- | ------------------- |
| Install | `vp install`                                       | exit 0              |
| Build   | `vp run --cache --filter @hotter-keys/react build` | exit 0              |
| Test    | `cd packages/react && vp test run`                 | all pass            |
| All     | `vp check && vp run --cache -r test`               | exit 0              |

## Scope

**In scope**:

- `packages/react/**` (create everything)
- `pnpm-workspace.yaml` (catalog additions only)
- `.github/workflows/publish.yml` (artifact path addition only)
- `README.md` (package table row + React usage section)

**Out of scope** (do NOT touch):

- `packages/core/**`, `packages/solid/**` — if the port reveals a core
  API gap, STOP and report.
- Docs site (`docs/**`) — a follow-up documents the adapter.
- Adding a changeset — the maintainer decides the release moment.

## Git workflow

- Branch: `advisor/008-react-adapter`
- Commit per step; short imperative subjects.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Scaffold the package

Create `packages/react/` with package.json, tsconfig (per Current state), and
empty `src/index.ts`. Add catalog entries. `vp install`.

**Verify**: `vp install` → exit 0; `vp run --filter @hotter-keys/react build`
→ exit 0 (empty module builds).

### Step 2: Port the five primitives

`src/useHotkeys.ts`, `src/useShortcut.ts`, `src/useLayer.ts`,
`src/useKeyHold.ts`, `src/Hotkey.tsx`, `src/index.ts` (exports mirroring
`packages/solid/src/index.ts`). Follow the mapping table; JSDoc each hook the
way the Solid files do (they carry usage examples — port those to React
syntax).

**Verify**: `vp run --cache --filter @hotter-keys/react build` → exit 0;
`vp check` → exit 0.

### Step 3: Port plan 003's test suite

Mirror `packages/solid`'s test setup (vitest.config.ts with jsdom) and port
each case. Hook testing without a renderer: use React's `act` +
`react-dom/client` `createRoot` on a detached div, or
`@testing-library/react` ONLY if it is already installable from the catalog —
otherwise prefer the renderer-based approach with `react-dom` added to the
catalog. Same assertions as 003: registration, firing, re-bind on combo
change (drive via rerender with a new prop), and above all unmount cleanup
(`getBindings().length === 0`, layer popped, instance destroyed).

**Verify**: `cd packages/react && vp test run` → ≥ 14 tests pass;
`vp run --cache -r test` at root → everything green.

### Step 4: Wire release + README

- `publish.yml` build job artifact `path:` gains `packages/react/dist`.
- README: add the table row (npm badge pattern copied from the solid row)
  and a React section mirroring the Solid one.

**Verify**: `vp dlx actionlint` → exit 0 (or note skipped);
`grep -c "@hotter-keys/react" README.md` → ≥ 2.

## Test plan

Step 3 (ported one-to-one from plan 003's enumerated cases — see that plan's
Steps 2–4 for the case list).

## Done criteria

- [ ] `vp run --cache --filter @hotter-keys/react build` exits 0
- [ ] `cd packages/react && vp test run` exits 0 with ≥ 14 tests, including
      an unmount-cleanup assertion per hook
- [ ] `vp check && vp run --cache -r test` exits 0 at root
- [ ] `publish.yml` uploads `packages/react/dist`; no `jsr.json` exists in
      the package
- [ ] README table + section updated
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `useSyncExternalStore` snapshot caching cannot avoid infinite re-render
  loops without changing core (e.g. you find yourself wanting core to return
  stable references — that's a core design conversation).
- Plan 003 was not executed (no Solid test suite exists to port) — you may
  proceed using 003's written case list, but say so in your report.
- React/`@types/react` versions conflict with the workspace's TypeScript
  (catalog pins `typescript: 6.0.2`) in a way `vp check` can't resolve.

## Maintenance notes

- The three adapters (solid, react, future vue?) should stay behaviorally
  identical; any bug found in one adapter's lifecycle handling should be
  cross-checked against the others — the shared test case list is the
  contract.
- When plan 005's keymap API ships, each adapter gains a thin wrapper
  (`useKeymap`) — keep this package's file-per-hook layout so that lands as
  one new file.
- Reviewer: scrutinize the `useShortcut` effect dependency array — options
  objects created inline by callers must not cause re-bind churn (stable
  serialization or individual option deps).
