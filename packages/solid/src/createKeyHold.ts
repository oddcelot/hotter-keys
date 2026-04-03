import { createSignal, onCleanup, type Accessor } from "solid-js";
import type { Hotkeys } from "hotter-keys";

/**
 * Track whether a specific key is held alone.
 * Returns a reactive boolean signal.
 *
 * ```tsx
 * const shiftHeld = createKeyHold(hk.instance, "shift");
 * // shiftHeld() === true when Shift is the only key held
 * ```
 */
export function createKeyHold(instance: Hotkeys, key: string): Accessor<boolean> {
  const [held, setHeld] = createSignal(false);
  const unsub = instance.onKeyHold(key, setHeld);
  onCleanup(unsub);
  return held;
}
