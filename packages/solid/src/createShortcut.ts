import { createEffect, onCleanup, type Accessor } from "solid-js";
import type { BindingOptions, ShortcutHandler } from "@hotter-keys/core";
import type { HotkeysInstance } from "./createHotkeys.js";

/**
 * Register a shortcut that auto-cleans up on disposal.
 * If `combo` is a signal/accessor, the binding re-registers when it changes.
 *
 * ```tsx
 * // Static
 * createShortcut(hk, "mod+s", () => save());
 *
 * // Reactive (re-binds when combo changes)
 * const [combo, setCombo] = createSignal("mod+s");
 * createShortcut(hk, combo, () => save());
 * ```
 */
export function createShortcut(
  hk: HotkeysInstance,
  combo: string | Accessor<string>,
  handler: ShortcutHandler,
  options?: BindingOptions,
): void {
  if (typeof combo === "string") {
    const unsub = hk.instance.add(combo, handler, options);
    onCleanup(unsub);
  } else {
    let unsub: (() => void) | undefined;

    createEffect(() => {
      unsub?.();
      const raw = combo();
      if (raw) {
        unsub = hk.instance.add(raw, handler, options);
      }
    });

    onCleanup(() => unsub?.());
  }
}
