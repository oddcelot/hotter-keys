/**
 * hotkeys — a correct, cross-browser, layout-aware keyboard shortcut library.
 *
 * Design principles (per https://blog.duvallj.pw/posts/2025-01-10-all-javascript-keyboard-shortcut-libraries-are-broken.html):
 *   1. Match on `key`, never `code`/`keyCode`/`which`
 *   2. Only a-z and 0-9 are safe non-modifier keys across layouts
 *   3. Normalize case via toLowerCase()
 *   4. Shift is only allowed with a-z (Shift+2 produces locale-dependent symbols)
 *   5. Alt/Option is allowed as an explicit modifier (`alt`, `option`, or `mod2`).
 *      On macOS, Alt/Option transforms the character (e.g. Alt+c → ç), so the
 *      `mod2` virtual keyword resolves to Ctrl on macOS and Alt on Windows/Linux,
 *      giving a safe cross-platform secondary modifier.
 *   6. Progressive enhancement: use the Keyboard API (Chrome) when available
 *      to support `code`-based matching for broader key coverage
 *
 * Features inspired by solid-primitives/keyboard:
 *   - Held-keys tracking with stale-modifier recovery
 *   - Blur / contextmenu reset to prevent phantom stuck keys
 *   - Key sequences / chords (e.g. "ctrl+k ctrl+c")
 *   - Single-key hold detection
 *   - requireReset mode: shortcut fires once per press cycle
 */

export type {
  Modifiers,
  SafeKey,
  Shortcut,
  ShortcutSequence,
  ShortcutHandler,
  BindingOptions,
  Binding,
  HeldKeysListener,
  KeyHoldListener,
  LayerChangeListener,
  HotkeysOptions,
  RecordedShortcut,
  DevtoolsEvent,
  DevtoolsHook,
} from "./types";

export {
  isMac,
  parseShortcut,
  parseSequence,
  formatShortcut,
  formatSequence,
  translateForPlatform,
} from "./parse";

export { Hotkeys, createHotkeys } from "./hotkeys";

export { recordShortcut } from "./record";
