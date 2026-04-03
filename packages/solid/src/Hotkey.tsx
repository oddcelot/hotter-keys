import type { BindingOptions, ShortcutHandler } from "@hotter-keys/core";
import type { HotkeysInstance } from "./createHotkeys.js";
import { createShortcut } from "./createShortcut.js";

interface HotkeyProps {
  /** The reactive hotkeys instance. */
  hk: HotkeysInstance;
  /** Shortcut combo string, e.g. "mod+s". */
  combo: string;
  /** Handler called when the shortcut fires. */
  onFire: ShortcutHandler;
  /** Binding options (layer, scope, etc.). */
  options?: BindingOptions;
}

/**
 * Declarative shortcut component. Registers on mount, cleans up on unmount.
 *
 * ```tsx
 * <Hotkey hk={hk} combo="mod+s" onFire={() => save()} />
 * <Hotkey hk={hk} combo="mod+z" onFire={() => undo()} options={{ layer: "editor" }} />
 * ```
 */
export function Hotkey(props: HotkeyProps): null {
  createShortcut(props.hk, () => props.combo, props.onFire, props.options);
  return null;
}
