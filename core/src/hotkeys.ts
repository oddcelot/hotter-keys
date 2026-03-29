import { createSignal, createMemo, type Accessor } from "solid-js";
import type {
  Binding,
  BindingOptions,
  HotkeysInstance,
  HotkeysOptions,
  Shortcut,
  ShortcutHandler,
  ShortcutSequence,
} from "./types";
import {
  parseSequence,
  eventMatchesShortcut,
  isInputElement,
  shortcutEquals,
  translateForPlatform,
} from "./parse";

const MODIFIER_KEYS = new Set(["control", "shift", "meta", "alt"]);

function isModifierKey(key: string): boolean {
  return MODIFIER_KEYS.has(key.toLowerCase());
}

const MOD_MAP = [
  { event: "metaKey", held: "meta" },
  { event: "ctrlKey", held: "control" },
  { event: "shiftKey", held: "shift" },
  { event: "altKey", held: "alt" },
] as const;

/**
 * Create a keyboard shortcut manager.
 *
 * ```ts
 * const hk = createHotkeys();
 * hk.add("ctrl+k", () => console.log("command palette"));
 * hk.add("ctrl+k ctrl+c", () => console.log("comment block"));
 * ```
 */
export function createHotkeys(options: HotkeysOptions = {}): HotkeysInstance {
  const target = options.target ?? document;
  const sequenceTimeout = options.sequenceTimeout ?? 1000;

  // ---------------------------------------------------------------------------
  // Reactive state
  // ---------------------------------------------------------------------------

  const [heldKeys, setHeldKeys] = createSignal<readonly string[]>([]);
  const [layers, setLayers] = createSignal<readonly string[]>(["global"]);
  const [scope, setScope] = createSignal<string>(options.scope ?? "*");

  // Internal mutable mirrors (mutated in-place, then published to signals)
  let heldInternal: string[] = [];
  let layersInternal: string[] = ["global"];

  function publishHeldKeys() {
    setHeldKeys(Object.freeze([...heldInternal]));
  }

  function publishLayers() {
    setLayers(Object.freeze([...layersInternal]));
  }

  // ---------------------------------------------------------------------------
  // Imperative state (binding state machine)
  // ---------------------------------------------------------------------------

  let bindings: Binding[] = [];
  let deferred: { binding: Binding; event: KeyboardEvent }[] = [];
  let deferTimer: ReturnType<typeof setTimeout> | undefined;
  let listening = false;

  // ---------------------------------------------------------------------------
  // Key-hold factory
  // ---------------------------------------------------------------------------

  function createKeyHold(key: string): Accessor<boolean> {
    const normalized = key.toLowerCase();
    return createMemo(() => {
      const keys = heldKeys();
      return keys.length === 1 && keys[0] === normalized;
    });
  }

  // ---------------------------------------------------------------------------
  // Layer management
  // ---------------------------------------------------------------------------

  function pushLayer(name: string): void {
    if (layersInternal.includes(name)) return;
    layersInternal.push(name);
    publishLayers();
  }

  function popLayer(): string | undefined;
  function popLayer(name: string): boolean;
  function popLayer(name?: string): string | boolean | undefined {
    if (name !== undefined) {
      if (name === "global") return false;
      const idx = layersInternal.indexOf(name);
      if (idx === -1) return false;
      layersInternal.splice(idx, 1);
      publishLayers();
      return true;
    }
    if (layersInternal.length <= 1) return undefined;
    const popped = layersInternal.pop()!;
    publishLayers();
    return popped;
  }

  // ---------------------------------------------------------------------------
  // Held-keys tracking
  // ---------------------------------------------------------------------------

  function trackKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    if (heldInternal.includes(key)) return;

    const keys = [...heldInternal];

    // Stale-modifier recovery: if held list is empty and the event shows
    // modifiers are pressed, they were pressed before we started tracking.
    if (keys.length === 0 && !isModifierKey(key)) {
      if (event.metaKey) keys.push("meta");
      if (event.ctrlKey) keys.push("control");
      if (event.shiftKey) keys.push("shift");
      if (event.altKey) keys.push("alt");
    }

    keys.push(key);
    heldInternal = keys;
    publishHeldKeys();
  }

  function reconcileModifiers(event: KeyboardEvent): void {
    let changed = false;
    const keys = [...heldInternal];

    for (const { event: prop, held } of MOD_MAP) {
      const idx = keys.indexOf(held);
      if (!event[prop] && idx !== -1) {
        keys.splice(idx, 1);
        changed = true;
      }
    }

    if (changed) {
      heldInternal = keys;
      publishHeldKeys();
    }
  }

  function resetHeldKeys(): void {
    if (heldInternal.length === 0) return;
    heldInternal = [];
    publishHeldKeys();
    for (const b of bindings) b._awaitingReset = false;
  }

  // ---------------------------------------------------------------------------
  // Binding API
  // ---------------------------------------------------------------------------

  function add(
    shortcut: string | Shortcut | ShortcutSequence,
    handler: ShortcutHandler,
    opts: BindingOptions = {}
  ): () => void {
    let sequence: ShortcutSequence;

    if (typeof shortcut === "string") {
      sequence = parseSequence(shortcut);
    } else if (Array.isArray(shortcut)) {
      sequence = shortcut;
    } else {
      sequence = [shortcut];
    }

    if (opts.crossPlatform !== false) {
      sequence = sequence.map((s) => translateForPlatform(s));
    }

    const binding: Binding = {
      sequence,
      handler,
      preventDefault: opts.preventDefault ?? true,
      stopPropagation: opts.stopPropagation ?? false,
      enableInInput: opts.enableInInput ?? false,
      requireReset: opts.requireReset ?? false,
      scope: opts.scope,
      layer: opts.layer,
      _seqIndex: 0,
      _awaitingReset: false,
      _seqTimer: undefined,
    };

    bindings.push(binding);

    return () => {
      const idx = bindings.indexOf(binding);
      if (idx !== -1) bindings.splice(idx, 1);
      if (binding._seqTimer !== undefined) clearTimeout(binding._seqTimer);
    };
  }

  function addMany(
    map: Record<string, ShortcutHandler>,
    opts: BindingOptions = {}
  ): () => void {
    const unsubs = Object.entries(map).map(([shortcut, handler]) =>
      add(shortcut, handler, opts)
    );
    return () => unsubs.forEach((u) => u());
  }

  function remove(shortcut: string | Shortcut | ShortcutSequence): void {
    let seq: ShortcutSequence;
    if (typeof shortcut === "string") {
      seq = parseSequence(shortcut);
    } else if (Array.isArray(shortcut)) {
      seq = shortcut;
    } else {
      seq = [shortcut];
    }

    bindings = bindings.filter((b) => {
      if (b.sequence.length !== seq.length) return true;
      return !b.sequence.every((chord, i) => shortcutEquals(chord, seq[i]!));
    });
  }

  function removeAll(): void {
    for (const b of bindings) {
      if (b._seqTimer !== undefined) clearTimeout(b._seqTimer);
    }
    bindings = [];
  }

  // ---------------------------------------------------------------------------
  // Sequence helpers
  // ---------------------------------------------------------------------------

  function resetBindingSequence(binding: Binding): void {
    binding._seqIndex = 0;
    if (binding._seqTimer !== undefined) {
      clearTimeout(binding._seqTimer);
      binding._seqTimer = undefined;
    }
  }

  function flushDeferred(): void {
    if (deferTimer !== undefined) {
      clearTimeout(deferTimer);
      deferTimer = undefined;
    }
    for (const { binding, event } of deferred) {
      if (binding.requireReset) binding._awaitingReset = true;
      binding.handler(event);
    }
    deferred = [];
  }

  function cancelDeferred(): void {
    if (deferTimer !== undefined) {
      clearTimeout(deferTimer);
      deferTimer = undefined;
    }
    deferred = [];
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  function handleKeyDown(event: KeyboardEvent): void {
    if (typeof event.key !== "string") return;
    if (!event.repeat) trackKeyDown(event);
    reconcileModifiers(event);
    if (event.altKey) return;

    resolveDeferredBindings(event);

    const { consumed, consumedLayerIdx, completedBindings, hasSequenceAdvance } =
      matchBindings(event);

    resolveCompletedBindings(completedBindings, hasSequenceAdvance);

    if (consumed) resetLowerLayerSequences(consumedLayerIdx);
  }

  function resolveDeferredBindings(event: KeyboardEvent): void {
    if (deferred.length === 0) return;

    const continues = bindings.some(
      (b) => b._seqIndex > 0 && eventMatchesShortcut(event, b.sequence[b._seqIndex]!)
    );

    if (continues) {
      cancelDeferred();
    } else {
      flushDeferred();
    }
  }

  function matchBindings(event: KeyboardEvent) {
    let consumed = false;
    let consumedLayerIdx = -1;
    const completedBindings: { binding: Binding; event: KeyboardEvent }[] = [];
    let hasSequenceAdvance = false;
    const currentScope = scope();

    for (let li = layersInternal.length - 1; li >= 0 && !consumed; li--) {
      const layerName = layersInternal[li]!;

      for (const binding of bindings) {
        const bindingLayer = binding.layer ?? "global";
        if (bindingLayer !== layerName) continue;
        if (binding.scope && binding.scope !== "*" && binding.scope !== currentScope) continue;
        if (!binding.enableInInput && isInputElement(event.target)) continue;
        if (binding._awaitingReset) continue;

        const target = binding.sequence[binding._seqIndex]!;

        if (eventMatchesShortcut(event, target)) {
          consumed = true;
          consumedLayerIdx = li;

          if (binding.preventDefault !== false) event.preventDefault();
          if (binding.stopPropagation) event.stopPropagation();

          binding._seqIndex++;

          if (binding._seqIndex >= binding.sequence.length) {
            completedBindings.push({ binding, event });
          } else {
            hasSequenceAdvance = true;
            if (binding._seqTimer !== undefined) clearTimeout(binding._seqTimer);
            binding._seqTimer = setTimeout(() => {
              resetBindingSequence(binding);
              flushDeferred();
            }, sequenceTimeout);
          }
        } else if (binding._seqIndex > 0) {
          resetBindingSequence(binding);
        }
      }
    }

    return { consumed, consumedLayerIdx, completedBindings, hasSequenceAdvance };
  }

  function resolveCompletedBindings(
    completedBindings: { binding: Binding; event: KeyboardEvent }[],
    hasSequenceAdvance: boolean
  ): void {
    for (const { binding, event } of completedBindings) {
      resetBindingSequence(binding);
      if (hasSequenceAdvance) {
        deferred.push({ binding, event });
        if (deferTimer !== undefined) clearTimeout(deferTimer);
        deferTimer = setTimeout(() => flushDeferred(), sequenceTimeout);
      } else {
        if (binding.requireReset) binding._awaitingReset = true;
        binding.handler(event);
      }
    }
  }

  function resetLowerLayerSequences(consumedLayerIdx: number): void {
    for (const binding of bindings) {
      const idx = layersInternal.indexOf(binding.layer ?? "global");
      if (idx < consumedLayerIdx && binding._seqIndex > 0) {
        resetBindingSequence(binding);
      }
    }
  }

  function handleKeyUp(event: KeyboardEvent): void {
    if (typeof event.key !== "string") return;

    const key = event.key.toLowerCase();
    const idx = heldInternal.indexOf(key);
    if (idx !== -1) {
      heldInternal = heldInternal.filter((k) => k !== key);

      // On macOS, releasing Meta/Cmd swallows pending keyup events for
      // non-modifier keys that were held alongside it. Flush them.
      if (key === "meta" || key === "control") {
        heldInternal = heldInternal.filter((k) => isModifierKey(k));
      }

      publishHeldKeys();
    }

    reconcileModifiers(event);

    if (heldInternal.length === 0) {
      for (const b of bindings) b._awaitingReset = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Bound event handlers
  // ---------------------------------------------------------------------------

  const onKeyDown = (e: Event) => handleKeyDown(e as KeyboardEvent);
  const onKeyUp = (e: Event) => handleKeyUp(e as KeyboardEvent);
  const onReset = () => resetHeldKeys();
  const onContextMenu = (e: Event) => {
    if (!(e as MouseEvent).defaultPrevented) resetHeldKeys();
  };

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  function start(): void {
    if (listening) return;
    target.addEventListener("keydown", onKeyDown);
    target.addEventListener("keyup", onKeyUp);
    target.addEventListener("blur", onReset);
    target.addEventListener("contextmenu", onContextMenu);
    listening = true;
  }

  function stop(): void {
    if (!listening) return;
    target.removeEventListener("keydown", onKeyDown);
    target.removeEventListener("keyup", onKeyUp);
    target.removeEventListener("blur", onReset);
    target.removeEventListener("contextmenu", onContextMenu);
    listening = false;
  }

  function destroy(): void {
    stop();
    cancelDeferred();
    for (const b of bindings) {
      if (b._seqTimer !== undefined) clearTimeout(b._seqTimer);
    }
    bindings = [];
    heldInternal = [];
    layersInternal = ["global"];
    setHeldKeys([]);
    setLayers(["global"]);
  }

  // Auto-start
  start();

  return {
    heldKeys,
    layers,
    scope,
    createKeyHold,
    setScope,
    pushLayer,
    popLayer,
    add,
    addMany,
    remove,
    removeAll,
    start,
    stop,
    destroy,
  };
}
