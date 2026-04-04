/**
 * @module
 *
 * A correct, cross-browser, layout-aware keyboard shortcut library.
 *
 * @example
 * ```ts
 * import { createHotkeys, displayShortcut } from "@hotter-keys/core";
 *
 * const hk = createHotkeys();
 *
 * // Single shortcut
 * hk.add("mod+s", () => console.log("Save!"));
 *
 * // Multi-chord sequence
 * hk.add("mod+k mod+c", () => console.log("Comment!"));
 *
 * // Layers for priority
 * hk.add("mod+z", () => undo(), { layer: "editor" });
 * hk.pushLayer("editor");
 *
 * // Scopes for context switching
 * hk.add("mod+z", () => undoText(), { scope: "text" });
 * hk.add("mod+z", () => undoStroke(), { scope: "draw" });
 * hk.setScope("text");
 *
 * // Display shortcuts for the current platform
 * displayShortcut("mod+s"); // "⌘S" on Mac, "Ctrl+S" elsewhere
 *
 * // Clean up
 * hk.destroy();
 * ```
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
  displayShortcut,
  translateForPlatform,
} from "./parse";

export { Hotkeys, createHotkeys } from "./hotkeys";

export { recordShortcut } from "./record";
