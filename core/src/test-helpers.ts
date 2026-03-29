import { createRoot, createRenderEffect } from "solid-js";

type KeyMods = Partial<{
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  repeat: boolean;
}>;

function fire(type: "keydown" | "keyup", target: EventTarget, key: string, mods: KeyMods = {}): KeyboardEvent {
  const event = new KeyboardEvent(type, {
    key,
    ctrlKey: mods.ctrlKey ?? false,
    shiftKey: mods.shiftKey ?? false,
    metaKey: mods.metaKey ?? false,
    altKey: mods.altKey ?? false,
    repeat: mods.repeat ?? false,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

export function fireKey(target: EventTarget, key: string, mods: KeyMods = {}): KeyboardEvent {
  return fire("keydown", target, key, mods);
}

export function fireKeyUp(target: EventTarget, key: string, mods: KeyMods = {}): KeyboardEvent {
  return fire("keyup", target, key, mods);
}

/**
 * Track a reactive accessor synchronously in tests.
 * Calls `fn` on every change (including the initial value).
 * Returns a dispose function.
 */
export function trackSignal<T>(accessor: () => T, fn: (value: T) => void): () => void {
  let dispose!: () => void;
  createRoot((d) => {
    dispose = d;
    createRenderEffect(() => fn(accessor()));
  });
  return dispose;
}

/**
 * Create a derived accessor inside a reactive root and track it.
 * Use this when the factory (e.g. `createKeyHold`) internally creates a memo
 * and must be called inside a reactive scope to avoid warnings.
 */
export function trackDerived<T>(factory: () => () => T, fn: (value: T) => void): () => void {
  let dispose!: () => void;
  createRoot((d) => {
    dispose = d;
    const accessor = factory();
    createRenderEffect(() => fn(accessor()));
  });
  return dispose;
}
