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

async function getLayoutMap(): Promise<Map<string, string> | null> {
  try {
    const kbd = (navigator as any).keyboard;
    if (!kbd || typeof kbd.getLayoutMap !== "function") return null;
    const layoutMap: Map<string, string> = await kbd.getLayoutMap();
    const reverse = new Map<string, string>();
    for (const [code, value] of layoutMap.entries()) {
      reverse.set(value.toLowerCase(), code);
    }
    return reverse;
  } catch {
    return null;
  }
}

export class Hotkeys {
  private bindings: Binding[] = [];
  private scope: string;
  private target: EventTarget;
  private layoutMap: Map<string, string> | null = null;
  private listening = false;
  private sequenceTimeout: number;

  // --- Held-keys state (inspired by solid-primitives) ---
  private _heldKeys: string[] = [];
  private _heldKeysListeners = new Set<HeldKeysListener>();
  private _keyHolds = new Map<string, Set<KeyHoldListener>>();
  private _prevHeldSingle: string | null = null;

  // --- Layer stack ---
  private _layers: string[] = ["global"];
  private _layerListeners = new Set<LayerChangeListener>();

  // --- Deferred bindings (chord disambiguation) ---
  private _deferred: { binding: Binding; event: KeyboardEvent }[] = [];
  private _deferTimer: ReturnType<typeof setTimeout> | undefined;

  // --- Bound handlers ---
  private _onKeyDown = (e: Event) => this._handleKeyDown(e as KeyboardEvent);
  private _onKeyUp = (e: Event) => this._handleKeyUp(e as KeyboardEvent);
  private _onReset = () => this._resetHeldKeys();
  private _onContextMenu = (e: Event) => {
    if (!(e as MouseEvent).defaultPrevented) this._resetHeldKeys();
  };

  constructor(options: HotkeysOptions = {}) {
    this.target = options.target ?? document;
    this.scope = options.scope ?? "*";
    this.sequenceTimeout = options.sequenceTimeout ?? 1000;

    if (options.useKeyboardAPI !== false) {
      getLayoutMap().then((map) => {
        this.layoutMap = map;
      });
    }

    this.start();
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /** Start listening for keyboard events. Called automatically by the constructor. */
  start(): void {
    if (this.listening) return;
    this.target.addEventListener("keydown", this._onKeyDown);
    this.target.addEventListener("keyup", this._onKeyUp);
    this.target.addEventListener("blur", this._onReset);
    this.target.addEventListener("contextmenu", this._onContextMenu);
    this.listening = true;
  }

  /** Stop listening and remove all event listeners. */
  stop(): void {
    if (!this.listening) return;
    this.target.removeEventListener("keydown", this._onKeyDown);
    this.target.removeEventListener("keyup", this._onKeyUp);
    this.target.removeEventListener("blur", this._onReset);
    this.target.removeEventListener("contextmenu", this._onContextMenu);
    this.listening = false;
  }

  /** Remove all bindings, listeners, and stop listening. */
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

  // -----------------------------------------------------------------------
  // Scope
  // -----------------------------------------------------------------------

  getScope(): string {
    return this.scope;
  }

  setScope(scope: string): void {
    this.scope = scope;
  }

  // -----------------------------------------------------------------------
  // Layers
  // -----------------------------------------------------------------------

  /**
   * Get the current layer stack (bottom to top).
   * The bottom layer is always `"global"`.
   */
  getLayers(): ReadonlyArray<string> {
    return [...this._layers];
  }

  /**
   * Push a named layer onto the stack. Bindings in higher layers
   * take priority over lower layers for the same key combination.
   * No-op if the layer is already in the stack.
   */
  pushLayer(name: string): void {
    if (this._layers.includes(name)) return;
    this._layers.push(name);
    this._emitLayerChange();
  }

  /**
   * Pop a layer from the stack.
   *
   * - No arguments: pops the topmost layer (never pops `"global"`).
   *   Returns the popped name, or `undefined` if only global remains.
   * - With a name: removes that specific layer from anywhere in the stack.
   *   Returns `true` if found and removed, `false` otherwise.
   *   `"global"` cannot be removed.
   */
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
    // No-arg: pop topmost (but not global)
    if (this._layers.length <= 1) return undefined;
    const popped = this._layers.pop()!;
    this._emitLayerChange();
    return popped;
  }

  /**
   * Subscribe to layer stack changes. Returns an unsubscribe function.
   */
  onLayerChange(listener: LayerChangeListener): () => void {
    this._layerListeners.add(listener);
    return () => {
      this._layerListeners.delete(listener);
    };
  }

  private _emitLayerChange(): void {
    const snapshot = Object.freeze([...this._layers]);
    for (const listener of this._layerListeners) {
      listener(snapshot);
    }
  }

  // -----------------------------------------------------------------------
  // Held-keys tracking
  // -----------------------------------------------------------------------

  /**
   * Get the currently held keys (ordered from least to most recent).
   * Returns a snapshot — the array won't mutate.
   */
  getHeldKeys(): ReadonlyArray<string> {
    return this._heldKeys;
  }

  /**
   * Subscribe to changes in the held-keys list.
   * Returns an unsubscribe function.
   *
   * ```ts
   * const unsub = hk.onHeldKeysChange((keys) => {
   *   console.log("held:", keys); // => ["control", "k"]
   * });
   * ```
   */
  onHeldKeysChange(listener: HeldKeysListener): () => void {
    this._heldKeysListeners.add(listener);
    return () => {
      this._heldKeysListeners.delete(listener);
    };
  }

  /**
   * Watch whether a specific key is being held *alone* (no other keys pressed).
   * Inspired by solid-primitives' `createKeyHold`.
   *
   * ```ts
   * const unsub = hk.onKeyHold("shift", (held) => {
   *   console.log("Shift held alone:", held);
   * });
   * ```
   */
  onKeyHold(key: string, listener: KeyHoldListener): () => void {
    const normalized = key.toLowerCase();
    let listeners = this._keyHolds.get(normalized);
    if (!listeners) {
      listeners = new Set();
      this._keyHolds.set(normalized, listeners);
    }
    listeners.add(listener);
    return () => {
      listeners!.delete(listener);
      if (listeners!.size === 0) this._keyHolds.delete(normalized);
    };
  }

  private _emitHeldKeys(): void {
    const frozen = Object.freeze([...this._heldKeys]);
    for (const listener of this._heldKeysListeners) {
      listener(frozen);
    }

    // Evaluate key-hold listeners: fire when exactly one key is held and
    // it just transitioned from not-single to single (or vice versa).
    const currentSingle = frozen.length === 1 ? frozen[0]! : null;
    if (currentSingle !== this._prevHeldSingle) {
      // Notify the old single key that it's no longer held alone
      if (this._prevHeldSingle !== null) {
        const oldListeners = this._keyHolds.get(this._prevHeldSingle);
        if (oldListeners) {
          for (const listener of oldListeners) listener(false);
        }
      }
      // Notify the new single key that it's now held alone
      if (currentSingle !== null) {
        const newListeners = this._keyHolds.get(currentSingle);
        if (newListeners) {
          for (const listener of newListeners) listener(true);
        }
      }
      this._prevHeldSingle = currentSingle;
    }
  }

  private _resetHeldKeys(): void {
    if (this._heldKeys.length === 0) return;
    this._heldKeys = [];
    this._emitHeldKeys();
    // Reset requireReset bindings when all keys are released
    for (const b of this.bindings) {
      b._awaitingReset = false;
    }
  }

  // -----------------------------------------------------------------------
  // Binding API
  // -----------------------------------------------------------------------

  /**
   * Register a shortcut or sequence.
   *
   * Single chord:
   * ```ts
   * hk.add("ctrl+k", handler);
   * ```
   *
   * Multi-chord sequence (space-separated):
   * ```ts
   * hk.add("ctrl+k ctrl+c", handler);
   * ```
   *
   * Pre-parsed:
   * ```ts
   * hk.add([{ key: "k", ctrl: true, shift: false, meta: false }], handler);
   * ```
   *
   * @returns An unsubscribe function.
   */
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

    // Cross-platform: translate ctrl ↔ meta based on platform
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

  /**
   * Register multiple shortcuts at once.
   *
   * ```ts
   * const unsub = hk.addMany({
   *   "ctrl+k":        () => openCommandPalette(),
   *   "ctrl+k ctrl+c": () => commentBlock(),
   * });
   * unsub(); // removes all
   * ```
   */
  addMany(
    map: Record<string, ShortcutHandler>,
    options: BindingOptions = {}
  ): () => void {
    const unsubs = Object.entries(map).map(([shortcut, handler]) =>
      this.add(shortcut, handler, options)
    );
    return () => unsubs.forEach((u) => u());
  }

  /**
   * Remove all bindings that match a given shortcut/sequence.
   */
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

  /** Remove all bindings. */
  removeAll(): void {
    for (const b of this.bindings) {
      if (b._seqTimer !== undefined) clearTimeout(b._seqTimer);
    }
    this.bindings = [];
  }

  // -----------------------------------------------------------------------
  // Event handlers
  // -----------------------------------------------------------------------

  private _handleKeyDown(event: KeyboardEvent): void {
    // e.key may be undefined in some edge cases (e.g. <datalist>)
    if (typeof event.key !== "string") return;

    // Track held keys before any early returns so Alt still shows
    if (!event.repeat) {
      this._trackKeyDown(event);
    }

    // Reconcile modifier state
    this._reconcileModifiers(event);

    // Rule 5: Ignore any keydown where Alt is held (for shortcut matching only).
    if (event.altKey) return;

    // If we have deferred bindings from a previous chord, check if this
    // keydown continues a sequence or should flush the deferred ones.
    if (this._deferred.length > 0) {
      // Check if any in-progress sequence matches this chord
      let sequenceAdvanced = false;
      for (const binding of this.bindings) {
        if (binding._seqIndex > 0) {
          const target = binding.sequence[binding._seqIndex]!;
          if (eventMatchesShortcut(event, target)) {
            sequenceAdvanced = true;
            break;
          }
        }
      }
      if (!sequenceAdvanced) {
        // No sequence matched — flush deferred bindings, then process normally
        this._flushDeferred();
      } else {
        // A sequence is advancing — cancel the deferred single-chord bindings
        this._cancelDeferred();
      }
    }

    // Match bindings — iterate layers top-to-bottom.
    let consumed = false;
    let consumedLayerIdx = -1;
    const completedBindings: { binding: Binding; event: KeyboardEvent }[] = [];
    let hasSequenceAdvance = false;

    for (let li = this._layers.length - 1; li >= 0 && !consumed; li--) {
      const layerName = this._layers[li]!;

      for (const binding of this.bindings) {
        const bindingLayer = binding.layer ?? "global";
        if (bindingLayer !== layerName) continue;

        if (binding.scope && binding.scope !== "*" && binding.scope !== this.scope) continue;
        if (!binding.enableInInput && isInputElement(event.target)) continue;
        if (binding._awaitingReset) continue;

        const target = binding.sequence[binding._seqIndex]!;

        if (eventMatchesShortcut(event, target)) {
          consumed = true;
          consumedLayerIdx = li;

          if (binding.preventDefault !== false) {
            event.preventDefault();
          }
          if (binding.stopPropagation) {
            event.stopPropagation();
          }

          binding._seqIndex++;

          if (binding._seqIndex >= binding.sequence.length) {
            // Full match — collect it (might be deferred)
            completedBindings.push({ binding, event });
          } else {
            // Intermediate chord in a sequence
            hasSequenceAdvance = true;
            if (binding._seqTimer !== undefined) clearTimeout(binding._seqTimer);
            binding._seqTimer = setTimeout(() => {
              this._resetBindingSequence(binding);
              // Also flush any deferred bindings when the sequence times out
              this._flushDeferred();
            }, this.sequenceTimeout);
          }
        } else if (binding._seqIndex > 0) {
          this._resetBindingSequence(binding);
        }
      }
    }

    // Chord disambiguation: if a single-chord binding completed but a
    // sequence also advanced on the same chord, defer the completed
    // binding until we know whether the sequence continues.
    for (const { binding, event: evt } of completedBindings) {
      if (hasSequenceAdvance) {
        // Defer — fire later if the sequence doesn't complete
        this._resetBindingSequence(binding);
        this._deferred.push({ binding, event: evt });
        if (this._deferTimer !== undefined) clearTimeout(this._deferTimer);
        this._deferTimer = setTimeout(() => {
          this._flushDeferred();
        }, this.sequenceTimeout);
      } else {
        // No conflict — fire immediately
        this._resetBindingSequence(binding);
        if (binding.requireReset) {
          binding._awaitingReset = true;
        }
        binding.handler(evt);
      }
    }

    // Reset in-progress sequences in lower layers
    if (consumed) {
      for (const binding of this.bindings) {
        const bindingLayer = binding.layer ?? "global";
        const bindingLayerIdx = this._layers.indexOf(bindingLayer);
        if (bindingLayerIdx < consumedLayerIdx && binding._seqIndex > 0) {
          this._resetBindingSequence(binding);
        }
      }
    }
  }

  private _flushDeferred(): void {
    if (this._deferTimer !== undefined) {
      clearTimeout(this._deferTimer);
      this._deferTimer = undefined;
    }
    for (const { binding, event } of this._deferred) {
      if (binding.requireReset) {
        binding._awaitingReset = true;
      }
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

    // Reconcile modifiers on keyup too
    this._reconcileModifiers(event);

    // When all keys are released, reset requireReset bindings
    if (this._heldKeys.length === 0) {
      for (const b of this.bindings) {
        b._awaitingReset = false;
      }
    }
  }

  /**
   * Track a key being pressed, with stale-modifier recovery.
   * Inspired by solid-primitives' useKeyDownList.
   */
  private _trackKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();

    if (this._heldKeys.includes(key)) return;

    const keys = [...this._heldKeys];

    // Stale-modifier recovery: if held list is empty and the event shows
    // modifiers are pressed, they were pressed before we started tracking.
    // Retroactively add them. (Adopted from solid-primitives.)
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

  /**
   * Reconcile held modifier keys with the actual event state.
   * On macOS, keyup events for modifiers are often missed when
   * preventDefault was called on a shortcut. This cleans up stale entries.
   */
  private _reconcileModifiers(event: KeyboardEvent): void {
    let changed = false;
    const keys = [...this._heldKeys];

    if (!event.metaKey && keys.includes("meta")) {
      keys.splice(keys.indexOf("meta"), 1);
      changed = true;
    }
    if (!event.ctrlKey && keys.includes("control")) {
      keys.splice(keys.indexOf("control"), 1);
      changed = true;
    }
    if (!event.shiftKey && keys.includes("shift")) {
      keys.splice(keys.indexOf("shift"), 1);
      changed = true;
    }
    if (!event.altKey && keys.includes("alt")) {
      keys.splice(keys.indexOf("alt"), 1);
      changed = true;
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
