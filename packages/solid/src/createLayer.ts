import { createMemo, onCleanup, type Accessor } from "solid-js";
import type { HotkeysInstance } from "./createHotkeys.js";

export interface LayerHandle {
  /** Reactive: whether this layer is currently in the stack. */
  isActive: Accessor<boolean>;
  /** Push this layer onto the stack. */
  push: () => void;
  /** Pop this layer from the stack. */
  pop: () => void;
}

/**
 * Manage a named layer with automatic cleanup.
 * Optionally auto-push on creation and auto-pop on cleanup.
 *
 * ```tsx
 * const modal = createLayer(hk, "modal");
 * modal.push();   // activate
 * modal.pop();    // deactivate
 * modal.isActive() // reactive boolean
 * ```
 */
export function createLayer(
  hk: HotkeysInstance,
  name: string,
  options?: { active?: boolean },
): LayerHandle {
  if (options?.active) {
    hk.pushLayer(name);
  }

  onCleanup(() => {
    hk.instance.popLayer(name);
  });

  const isActive = createMemo(() => hk.layers().includes(name));

  return {
    isActive,
    push: () => hk.pushLayer(name),
    pop: () => hk.popLayer(name),
  };
}
