# Core Review

**Overall: solid, well-designed library.** The code is clean, well-typed, and thoroughly tested. The design constraints (safe keys only, no alt, no `code`/`keyCode`) are principled and consistently enforced. A few observations:

## Strengths

- **Type safety** — `SafeKey` as a union literal prevents invalid keys at compile time. `as const satisfies` on `MODIFIER_NAMES` is a nice touch.
- **Edge case handling** — stale-modifier recovery, macOS Meta keyup swallowing, blur/contextmenu flush, `repeat` filtering. These are the bugs that bite real apps and they're all covered with tests.
- **Chord disambiguation** — the deferred binding mechanism (`_deferred` / `_flushDeferred` / `_cancelDeferred`) correctly resolves "ctrl+k" vs "ctrl+k ctrl+c" ambiguity. The tests at lines 303-371 of `hotkeys.test.ts` verify this thoroughly.
- **Clean public API** — `add()` returns an unsubscribe function, `addMany()` composes them, `createHotkeys()` factory. Idiomatic and framework-agnostic.

## Issues

1. **`navigator.platform` is deprecated** (`parse.ts:12`). Browsers still ship it but the spec recommends `navigator.userAgentData?.platform` (available in Chromium) with `navigator.platform` as fallback. The index.ts header mentions "progressive enhancement" — this would be a natural fit.

2. **`remove()` doesn't apply `crossPlatform` translation** (`hotkeys.ts:283-289`). When `add("ctrl+k", handler)` is called, the sequence is translated (e.g. ctrl→meta on macOS). But `remove("ctrl+k")` compares against the *untranslated* parse result, so it won't find the binding on macOS. Either document that `remove()` requires the translated form, or apply the same translation.

3. **`remove()` doesn't clean up timers** (`hotkeys.ts:286`). The `filter` drops `BindingState` objects that may have active `seqTimer` timeouts. These orphaned timers will fire `_resetBindingState` on a stale reference — harmless but wasteful. Compare with `removeAll()` which correctly clears timers.

4. **`_matchBindings` calls `preventDefault`/`stopPropagation` for *all* matching bindings at the consumed layer** (`hotkeys.ts:372-373`). If two bindings on the same layer match the same chord (e.g. one is at `seqIndex: 1` and another at `seqIndex: 0`), both will call `preventDefault`. This is probably fine in practice since `consumed = true` after the first match stops lower layers, but the inner loop continues for the same layer. This means multiple handlers on the same layer for the same key all advance — which may be intentional, but worth documenting.

5. **`onKeyHold` only fires when exactly one key is held** (`hotkeys.ts:212`). This is a deliberate design choice (hold detection = "single key held alone"), but it means `onKeyHold("control", cb)` won't report `held=true` if you press Ctrl while another key is already down. The JSDoc on `KeyHoldListener` doesn't mention this constraint.

6. **`_handleKeyUp` meta flush is overly broad** (`hotkeys.ts:452-453`). When `meta` or `control` is released, it flushes *all* non-modifier keys from `_heldKeys`. The comment says "macOS swallows keyup for non-modifier keys held alongside Meta" — but the code also does this for `control`, and on all platforms. On Windows/Linux, releasing Ctrl doesn't swallow other keyup events, so this produces incorrect held-key state.

7. **Missing `crossPlatform` on `Binding` type** (`types.ts:64`). `Binding extends BindingOptions`, but `add()` (`hotkeys.ts:246-255`) only spreads specific fields and omits `crossPlatform`. This means `binding.crossPlatform` is always `undefined` on the stored binding. Not a bug since translation happens at registration time, but the type suggests it's stored.

## Minor / Style

- `test-helpers.ts` is excluded from the npm package (`package.json` files field) but included in JSR (`jsr.json` excludes it). Good.
- The `MatchResult` interface at `hotkeys.ts:513` is declared after the class that uses it. Works fine, just unusual — could be co-located with `BindingState`.
- `_heldKeys` is reconstructed via spread on every mutation (`[...this._heldKeys]`). For a small array this is fine, but it's worth noting this is O(n) per keypress.

## Test Coverage Gaps

- No test for `remove()` with a pre-parsed `Shortcut` or `ShortcutSequence` argument
- No test for `remove()` when `crossPlatform` translation was active (relates to issue #2)
- No test for the `_onContextMenu` handler when `defaultPrevented` is set *after* dispatch (the test uses `evt.preventDefault()` before dispatch which is correct)
- No test for `destroy()` cancelling in-progress sequence timers
- `recordShortcut` with an already-aborted signal is tested implicitly but could be explicit

## Recommendations (priority order)

1. **Fix `remove()` cross-platform mismatch** — this is a real bug users will hit
2. **Fix `remove()` timer cleanup** — easy win, copy pattern from `removeAll()`
3. **Scope the meta/control keyup flush to macOS only** — prevents incorrect held-key state on other platforms
4. **Add `navigator.userAgentData` progressive enhancement** — future-proofing
5. **Document the single-key constraint on `onKeyHold`** — prevents confusion
