import type {
  Binding,
  BindingOptions,
  HeldKeysListener,
  HotkeysOptions,
  KeyHoldListener,
  LayerChangeListener,
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

type KeyHoldEntry = { listener: KeyHoldListener; held: boolean };

export class Hotkeys {
  private bindings: Binding[] = [];
  private scope: string;
  private target: EventTarget;
  private listening = false;
  private sequenceTimeout: number;

  // --- Held-keys state ---
  private _heldKeys: string[] = [];
  private _heldKeysListeners = new Set<HeldKeysListener>();
  private _keyHolds = new Map<string, Set<KeyHoldEntry>>();

  // --- Layer stack ---
  private _layers: string[] = ["global"];
  private _layerListeners = new Set<LayerChangeListener>();

  // --- Deferred bindings (chord disambiguation) ---
  private _deferred: { binding: Binding; event: KeyboardEvent }[] = [];
  private _deferTimer: ReturnType<typeof setTimeout> | undefined;

  // --- Bound handlers ---
  private _onKeyDown = (e: Event): void => {
    if (!(e instanceof KeyboardEvent)) return;
    this._handleKeyDown(e);
  };
  private _onKeyUp = (e: Event): void => {
    if (!(e instanceof KeyboardEvent)) return;
    this._handleKeyUp(e);
  };
  private _onReset = (): void => this._resetHeldKeys();
  private _onContextMenu = (e: Event): void => {
    if (!e.defaultPrevented) this._resetHeldKeys();
  };

  constructor(options: HotkeysOptions = {}) {
    this.target = options.target ?? document;
    this.scope = options.scope ?? "*";
    this.sequenceTimeout = options.sequenceTimeout ?? 1000;
    this.start();
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  start(): void {
    if (this.listening) return;
    this.target.addEventListener("keydown", this._onKeyDown);
    this.target.addEventListener("keyup", this._onKeyUp);
    this.target.addEventListener("blur", this._onReset);
    this.target.addEventListener("contextmenu", this._onContextMenu);
    this.listening = true;
  }

  stop(): void {
    if (!this.listening) return;
    this.target.removeEventListener("keydown", this._onKeyDown);
    this.target.removeEventListener("keyup", this._onKeyUp);
    this.target.removeEventListener("blur", this._onReset);
    this.target.removeEventListener("contextmenu", this._onContextMenu);
    this.listening = false;
  }

  destroy(): void {
    this.stop();
    this._cancelDeferred();
    for (const b of this.bindings) {
      if (b._seqTimer !== undefined) clearTimeout(b._seqTimer);
    }
    this.bindings = [];
    this._heldKeys = [];
    this._heldKeysListeners.clear();
    this._keyHolds.clear();
    this._layers = ["global"];
    this._layerListeners.clear();
  }

  // ---------------------------------------------------------------------------
  // Scope
  // ---------------------------------------------------------------------------

  getScope(): string {
    return this.scope;
  }

  setScope(scope: string): void {
    this.scope = scope;
  }

  // ---------------------------------------------------------------------------
  // Layers
  // ---------------------------------------------------------------------------

  getLayers(): ReadonlyArray<string> {
    return [...this._layers];
  }

  pushLayer(name: string): void {
    if (this._layers.includes(name)) return;
    this._layers.push(name);
    this._emitLayerChange();
  }

  popLayer(): string | undefined;
  popLayer(name: string): boolean;
  popLayer(name?: string): string | boolean | undefined {
    if (name !== undefined) {
      if (name === "global") return false;
      const idx = this._layers.indexOf(name);
      if (idx === -1) return false;
      this._layers.splice(idx, 1);
      this._emitLayerChange();
      return true;
    }
    if (this._layers.length <= 1) return undefined;
    const popped = this._layers.pop()!;
    this._emitLayerChange();
    return popped;
  }

  onLayerChange(listener: LayerChangeListener): () => void {
    this._layerListeners.add(listener);
    return () => { this._layerListeners.delete(listener); };
  }

  private _emitLayerChange(): void {
    const snapshot = Object.freeze([...this._layers]);
    for (const listener of this._layerListeners) listener(snapshot);
  }

  // ---------------------------------------------------------------------------
  // Held-keys tracking
  // ---------------------------------------------------------------------------

  getHeldKeys(): ReadonlyArray<string> {
    return this._heldKeys;
  }

  onHeldKeysChange(listener: HeldKeysListener): () => void {
    this._heldKeysListeners.add(listener);
    return () => { this._heldKeysListeners.delete(listener); };
  }

  onKeyHold(key: string, listener: KeyHoldListener): () => void {
    const normalized = key.toLowerCase();
    const entry: KeyHoldEntry = { listener, held: false };
    let entries = this._keyHolds.get(normalized);
    if (!entries) {
      entries = new Set();
      this._keyHolds.set(normalized, entries);
    }
    entries.add(entry);
    return () => {
      entries!.delete(entry);
      if (entries!.size === 0) this._keyHolds.delete(normalized);
    };
  }

  private _emitHeldKeys(): void {
    const frozen = Object.freeze([...this._heldKeys]);
    for (const listener of this._heldKeysListeners) listener(frozen);

    // Key-hold: check each watched key against the current single-key state
    const single = frozen.length === 1 ? frozen[0]! : null;
    for (const [key, entries] of this._keyHolds) {
      const held = single === key;
      for (const entry of entries) {
        if (entry.held !== held) {
          entry.held = held;
          entry.listener(held);
        }
      }
    }
  }

  private _resetHeldKeys(): void {
    if (this._heldKeys.length === 0) return;
    this._heldKeys = [];
    this._emitHeldKeys();
    for (const b of this.bindings) b._awaitingReset = false;
  }

  // ---------------------------------------------------------------------------
  // Binding API
  // ---------------------------------------------------------------------------

  add(
    shortcut: string | Shortcut | ShortcutSequence,
    handler: ShortcutHandler,
    options: BindingOptions = {}
  ): () => void {
    let sequence: ShortcutSequence;

    if (typeof shortcut === "string") {
      sequence = parseSequence(shortcut);
    } else if (Array.isArray(shortcut)) {
      sequence = shortcut;
    } else {
      sequence = [shortcut];
    }

    if (options.crossPlatform !== false) {
      sequence = sequence.map((s) => translateForPlatform(s));
    }

    const binding: Binding = {
      sequence,
      handler,
      preventDefault: options.preventDefault ?? true,
      stopPropagation: options.stopPropagation ?? false,
      enableInInput: options.enableInInput ?? false,
      requireReset: options.requireReset ?? false,
      scope: options.scope,
      layer: options.layer,
      _seqIndex: 0,
      _awaitingReset: false,
      _seqTimer: undefined,
    };

    this.bindings.push(binding);

    return () => {
      const idx = this.bindings.indexOf(binding);
      if (idx !== -1) this.bindings.splice(idx, 1);
      if (binding._seqTimer !== undefined) clearTimeout(binding._seqTimer);
    };
  }

  addMany(
    map: Record<string, ShortcutHandler>,
    options: BindingOptions = {}
  ): () => void {
    const unsubs = Object.entries(map).map(([shortcut, handler]) =>
      this.add(shortcut, handler, options)
    );
    return () => unsubs.forEach((u) => u());
  }

  remove(shortcut: string | Shortcut | ShortcutSequence): void {
    let target: ShortcutSequence;
    if (typeof shortcut === "string") {
      target = parseSequence(shortcut);
    } else if (Array.isArray(shortcut)) {
      target = shortcut;
    } else {
      target = [shortcut];
    }

    this.bindings = this.bindings.filter((b) => {
      if (b.sequence.length !== target.length) return true;
      return !b.sequence.every((chord, i) => shortcutEquals(chord, target[i]!));
    });
  }

  removeAll(): void {
    for (const b of this.bindings) {
      if (b._seqTimer !== undefined) clearTimeout(b._seqTimer);
    }
    this.bindings = [];
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  private _handleKeyDown(event: KeyboardEvent): void {
    if (typeof event.key !== "string") return;
    if (!event.repeat) this._trackKeyDown(event);
    this._reconcileModifiers(event);

    // Modifier-only and Alt keypresses never match shortcuts
    if (event.altKey || isModifierKey(event.key)) return;

    this._resolveDeferredBindings(event);

    const { consumed, consumedLayerIdx, completedBindings, hasSequenceAdvance } =
      this._matchBindings(event);

    this._resolveCompletedBindings(completedBindings, hasSequenceAdvance);

    if (consumed) this._resetLowerLayerSequences(consumedLayerIdx);
  }

  private _resolveDeferredBindings(event: KeyboardEvent): void {
    if (this._deferred.length === 0) return;

    const continues = this.bindings.some(
      (b) => b._seqIndex > 0 && eventMatchesShortcut(event, b.sequence[b._seqIndex]!)
    );

    if (continues) {
      this._cancelDeferred();
    } else {
      this._flushDeferred();
    }
  }

  private _matchBindings(event: KeyboardEvent) {
    let consumed = false;
    let consumedLayerIdx = -1;
    const completedBindings: { binding: Binding; event: KeyboardEvent }[] = [];
    let hasSequenceAdvance = false;

    // Chord mode: find the highest layer index with an in-progress sequence.
    // Bindings at or below that layer are suppressed unless already in progress.
    // Higher layers can still match freely (e.g. commandbar overriding global).
    let chordLayerIdx = -1;
    for (const b of this.bindings) {
      if (b._seqIndex > 0) {
        const idx = this._layers.indexOf(b.layer ?? "global");
        if (idx > chordLayerIdx) chordLayerIdx = idx;
      }
    }

    for (let li = this._layers.length - 1; li >= 0 && !consumed; li--) {
      const layerName = this._layers[li]!;

      for (const binding of this.bindings) {
        const bindingLayer = binding.layer ?? "global";
        if (bindingLayer !== layerName) continue;
        if (binding.scope && binding.scope !== "*" && binding.scope !== this.scope) continue;
        if (!binding.enableInInput && isInputElement(event.target)) continue;
        if (binding._awaitingReset) continue;

        // In chord mode, suppress fresh bindings at or below the in-progress layer
        if (binding._seqIndex === 0 && li <= chordLayerIdx) continue;

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
              this._resetBindingSequence(binding);
              this._flushDeferred();
            }, this.sequenceTimeout);
          }
        } else if (binding._seqIndex > 0) {
          this._resetBindingSequence(binding);
        }
      }
    }

    return { consumed, consumedLayerIdx, completedBindings, hasSequenceAdvance };
  }

  private _resolveCompletedBindings(
    completedBindings: { binding: Binding; event: KeyboardEvent }[],
    hasSequenceAdvance: boolean
  ): void {
    for (const { binding, event } of completedBindings) {
      this._resetBindingSequence(binding);
      if (hasSequenceAdvance) {
        this._deferred.push({ binding, event });
        if (this._deferTimer !== undefined) clearTimeout(this._deferTimer);
        this._deferTimer = setTimeout(() => this._flushDeferred(), this.sequenceTimeout);
      } else {
        if (binding.requireReset) binding._awaitingReset = true;
        binding.handler(event);
      }
    }
  }

  private _resetLowerLayerSequences(consumedLayerIdx: number): void {
    for (const binding of this.bindings) {
      const idx = this._layers.indexOf(binding.layer ?? "global");
      if (idx < consumedLayerIdx && binding._seqIndex > 0) {
        this._resetBindingSequence(binding);
      }
    }
  }

  private _flushDeferred(): void {
    if (this._deferTimer !== undefined) {
      clearTimeout(this._deferTimer);
      this._deferTimer = undefined;
    }
    for (const { binding, event } of this._deferred) {
      if (binding.requireReset) binding._awaitingReset = true;
      binding.handler(event);
    }
    this._deferred = [];
  }

  private _cancelDeferred(): void {
    if (this._deferTimer !== undefined) {
      clearTimeout(this._deferTimer);
      this._deferTimer = undefined;
    }
    this._deferred = [];
  }

  private _handleKeyUp(event: KeyboardEvent): void {
    if (typeof event.key !== "string") return;

    const key = event.key.toLowerCase();
    const idx = this._heldKeys.indexOf(key);
    if (idx !== -1) {
      this._heldKeys = this._heldKeys.filter((k) => k !== key);

      // On macOS, releasing Meta/Cmd swallows pending keyup events for
      // non-modifier keys that were held alongside it. Flush them.
      if (key === "meta" || key === "control") {
        this._heldKeys = this._heldKeys.filter((k) => isModifierKey(k));
      }

      this._emitHeldKeys();
    }

    this._reconcileModifiers(event);

    if (this._heldKeys.length === 0) {
      for (const b of this.bindings) b._awaitingReset = false;
    }
  }

  private _trackKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    if (this._heldKeys.includes(key)) return;

    const keys = [...this._heldKeys];

    // Stale-modifier recovery: if held list is empty and the event shows
    // modifiers are pressed, they were pressed before we started tracking.
    if (keys.length === 0 && !isModifierKey(key)) {
      if (event.metaKey) keys.push("meta");
      if (event.ctrlKey) keys.push("control");
      if (event.shiftKey) keys.push("shift");
      if (event.altKey) keys.push("alt");
    }

    keys.push(key);
    this._heldKeys = keys;
    this._emitHeldKeys();
  }

  private _reconcileModifiers(event: KeyboardEvent): void {
    let changed = false;
    const keys = [...this._heldKeys];

    for (const { event: prop, held } of MOD_MAP) {
      const idx = keys.indexOf(held);
      if (!event[prop] && idx !== -1) {
        keys.splice(idx, 1);
        changed = true;
      }
    }

    if (changed) {
      this._heldKeys = keys;
      this._emitHeldKeys();
    }
  }

  private _resetBindingSequence(binding: Binding): void {
    binding._seqIndex = 0;
    if (binding._seqTimer !== undefined) {
      clearTimeout(binding._seqTimer);
      binding._seqTimer = undefined;
    }
  }
}

/**
 * Create a new {@link Hotkeys} instance.
 *
 * ```ts
 * const hk = createHotkeys();
 * hk.add("ctrl+k", () => console.log("command palette"));
 * hk.add("ctrl+k ctrl+c", () => console.log("comment block"));
 * ```
 */
export function createHotkeys(options?: HotkeysOptions): Hotkeys {
  return new Hotkeys(options);
}
