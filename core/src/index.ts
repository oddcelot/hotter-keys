/**
 * hotkeys — a correct, cross-browser, layout-aware keyboard shortcut library.
 *
 * Design principles (per https://blog.duvallj.pw/posts/2025-01-10-all-javascript-keyboard-shortcut-libraries-are-broken.html):
 *   1. Match on `key`, never `code`/`keyCode`/`which`
 *   2. Only a-z and 0-9 are safe non-modifier keys across layouts
 *   3. Normalize case via toLowerCase()
 *   4. Shift is only allowed with a-z (Shift+2 produces locale-dependent symbols)
 *   5. Alt/Option is forbidden (macOS transforms the character, e.g. Alt+c → ç)
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The modifier flags we track. Alt is intentionally excluded. */
export interface Modifiers {
  ctrl: boolean;
  shift: boolean;
  meta: boolean;
}

const EMPTY_MODS: Modifiers = { ctrl: false, shift: false, meta: false };

/**
 * A single chord: one non-modifier key + zero or more modifiers.
 * `key` is always lowercase a-z or digit 0-9.
 */
export interface Shortcut {
  key: string;
  ctrl: boolean;
  shift: boolean;
  meta: boolean;
}

/**
 * A sequence of one or more chords.
 * A single shortcut like "ctrl+k" is a sequence of length 1.
 * A multi-step shortcut like "ctrl+k ctrl+c" is length 2.
 */
export type ShortcutSequence = Shortcut[];

export type ShortcutHandler = (event: KeyboardEvent) => void;

export interface BindingOptions {
  /** When set, the binding only fires inside the given scope. */
  scope?: string;
  /** Prevent default browser behaviour. @default true */
  preventDefault?: boolean;
  /** Stop propagation. @default false */
  stopPropagation?: boolean;
  /** Also fire when the event target is an input/textarea/contenteditable. @default false */
  enableInInput?: boolean;
  /**
   * If true, the shortcut fires once per press cycle — all keys must be
   * released before it can fire again. Matches solid-primitives' `requireReset`.
   * @default false
   */
  requireReset?: boolean;
}

export interface Binding extends BindingOptions {
  sequence: ShortcutSequence;
  handler: ShortcutHandler;
  /** Internal: tracks progress through multi-chord sequences. */
  _seqIndex: number;
  /** Internal: tracks the reset state for requireReset bindings. */
  _awaitingReset: boolean;
  /** Internal: timeout handle for sequence expiry. */
  _seqTimer: ReturnType<typeof setTimeout> | undefined;
}

/** Subscribe to held-keys changes. */
export type HeldKeysListener = (keys: ReadonlyArray<string>) => void;

/** Subscribe to key-hold state changes. */
export type KeyHoldListener = (held: boolean) => void;

export interface HotkeysOptions {
  /**
   * The element to listen on.
   * @default document
   */
  target?: EventTarget;
  /**
   * The initial scope. Only bindings with a matching scope (or no scope) will fire.
   * @default "*"
   */
  scope?: string;
  /**
   * If true, attempt to use the experimental Keyboard API (Chrome 69+) to
   * build a layout map, enabling broader key support beyond a-z / 0-9.
   * Falls back silently when unavailable.
   * @default true
   */
  useKeyboardAPI?: boolean;
  /**
   * Time in ms to wait between chords in a sequence before resetting progress.
   * @default 1000
   */
  sequenceTimeout?: number;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const ALPHA = /^[a-z]$/;
const DIGIT = /^[0-9]$/;
const MODIFIER_NAMES: Record<string, keyof Modifiers> = {
  ctrl: "ctrl",
  control: "ctrl",
  meta: "meta",
  cmd: "meta",
  command: "meta",
  win: "meta",
  super: "meta",
  shift: "shift",
};

/**
 * Parse a single chord like `"ctrl+shift+k"` into a {@link Shortcut}.
 *
 * Modifiers: `ctrl` | `control` | `meta` | `cmd` | `command` | `win` | `super` | `shift`
 * Key:       a single letter a-z (case-insensitive) or digit 0-9
 *
 * @throws if the chord is malformed or violates safety rules.
 */
export function parseShortcut(raw: string): Shortcut {
  const parts = raw
    .toLowerCase()
    .split("+")
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    throw new Error(`Empty shortcut string`);
  }

  const mods: Modifiers = { ...EMPTY_MODS };
  let key: string | undefined;

  for (const part of parts) {
    const mod = MODIFIER_NAMES[part];
    if (mod) {
      mods[mod] = true;
      continue;
    }
    if (key !== undefined) {
      throw new Error(
        `Shortcut "${raw}" has more than one non-modifier key ("${key}" and "${part}")`
      );
    }
    key = part;
  }

  if (key === undefined) {
    throw new Error(`Shortcut "${raw}" has no non-modifier key`);
  }

  if (!ALPHA.test(key) && !DIGIT.test(key)) {
    throw new Error(
      `Shortcut key "${key}" is not a safe cross-layout key (only a-z and 0-9 are allowed)`
    );
  }

  // Rule 4: Shift is only safe with a-z
  if (mods.shift && !ALPHA.test(key)) {
    throw new Error(
      `Shift+${key} is not safe cross-layout (Shift changes digit symbols per locale)`
    );
  }

  return { key, ...mods };
}

/**
 * Parse a sequence string. Chords are separated by spaces.
 *
 * ```ts
 * parseSequence("ctrl+k ctrl+c") // => [{ key:"k", ctrl:true, … }, { key:"c", ctrl:true, … }]
 * parseSequence("ctrl+s")        // => [{ key:"s", ctrl:true, … }]
 * ```
 */
export function parseSequence(raw: string): ShortcutSequence {
  const chords = raw.trim().split(/\s+/);
  if (chords.length === 0 || (chords.length === 1 && chords[0] === "")) {
    throw new Error("Empty sequence string");
  }
  return chords.map(parseShortcut);
}

/**
 * Serialize a {@link Shortcut} back into a human-readable string.
 */
export function formatShortcut(s: Shortcut, mac = false): string {
  const parts: string[] = [];
  if (s.ctrl) parts.push(mac ? "⌃" : "Ctrl");
  if (s.shift) parts.push(mac ? "⇧" : "Shift");
  if (s.meta) parts.push(mac ? "⌘" : "Meta");
  parts.push(s.key.toUpperCase());
  return parts.join(mac ? "" : "+");
}

/**
 * Serialize a full sequence.
 */
export function formatSequence(seq: ShortcutSequence, mac = false): string {
  return seq.map((s) => formatShortcut(s, mac)).join(" ");
}

// ---------------------------------------------------------------------------
// Matching helpers
// ---------------------------------------------------------------------------

function isInputElement(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

function eventMatchesShortcut(e: KeyboardEvent, s: Shortcut): boolean {
  if (e.altKey) return false;
  return (
    e.key.toLowerCase() === s.key &&
    e.ctrlKey === s.ctrl &&
    e.shiftKey === s.shift &&
    e.metaKey === s.meta
  );
}

function shortcutEquals(a: Shortcut, b: Shortcut): boolean {
  return a.key === b.key && a.ctrl === b.ctrl && a.shift === b.shift && a.meta === b.meta;
}

// ---------------------------------------------------------------------------
// Keyboard Layout Map (progressive enhancement)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Modifier key names (for held-keys tracking)
// ---------------------------------------------------------------------------

const MODIFIER_KEYS = new Set(["control", "shift", "meta", "alt"]);

function isModifierKey(key: string): boolean {
  return MODIFIER_KEYS.has(key.toLowerCase());
}

// ---------------------------------------------------------------------------
// Core class
// ---------------------------------------------------------------------------

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
    for (const b of this.bindings) {
      if (b._seqTimer !== undefined) clearTimeout(b._seqTimer);
    }
    this.bindings = [];
    this._heldKeys = [];
    this._heldKeysListeners.clear();
    this._keyHolds.clear();
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

    const binding: Binding = {
      sequence,
      handler,
      preventDefault: options.preventDefault ?? true,
      stopPropagation: options.stopPropagation ?? false,
      enableInInput: options.enableInInput ?? false,
      requireReset: options.requireReset ?? false,
      scope: options.scope,
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

    // Rule 5: Ignore any keydown where Alt is held.
    if (event.altKey) return;

    // Skip repeats for held-keys tracking
    if (!event.repeat) {
      this._trackKeyDown(event);
    }

    // Match bindings
    for (const binding of this.bindings) {
      // Scope check
      if (binding.scope && binding.scope !== "*" && binding.scope !== this.scope) {
        continue;
      }

      // Input check
      if (!binding.enableInInput && isInputElement(event.target)) {
        continue;
      }

      // requireReset: already fired, waiting for full release
      if (binding._awaitingReset) {
        continue;
      }

      const target = binding.sequence[binding._seqIndex]!;

      if (eventMatchesShortcut(event, target)) {
        // Optimistically preventDefault even on intermediate chords
        if (binding.preventDefault !== false) {
          event.preventDefault();
        }
        if (binding.stopPropagation) {
          event.stopPropagation();
        }

        binding._seqIndex++;

        if (binding._seqIndex >= binding.sequence.length) {
          // Full sequence matched — fire!
          this._resetBindingSequence(binding);
          if (binding.requireReset) {
            binding._awaitingReset = true;
          }
          binding.handler(event);
        } else {
          // Waiting for next chord in sequence — start timeout
          if (binding._seqTimer !== undefined) clearTimeout(binding._seqTimer);
          binding._seqTimer = setTimeout(() => {
            this._resetBindingSequence(binding);
          }, this.sequenceTimeout);
        }
      } else if (binding._seqIndex > 0) {
        // Wrong key during a sequence — reset progress
        this._resetBindingSequence(binding);
      }
    }
  }

  private _handleKeyUp(event: KeyboardEvent): void {
    if (typeof event.key !== "string") return;

    const key = event.key.toLowerCase();
    const idx = this._heldKeys.indexOf(key);
    if (idx !== -1) {
      this._heldKeys = this._heldKeys.filter((k) => k !== key);
      this._emitHeldKeys();
    }

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
      // Intentionally skip altKey — rule 5
    }

    keys.push(key);
    this._heldKeys = keys;
    this._emitHeldKeys();
  }

  private _resetBindingSequence(binding: Binding): void {
    binding._seqIndex = 0;
    if (binding._seqTimer !== undefined) {
      clearTimeout(binding._seqTimer);
      binding._seqTimer = undefined;
    }
  }
}

// ---------------------------------------------------------------------------
// Convenience factory
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Recording utility (for "press a key" rebinding UIs)
// ---------------------------------------------------------------------------

export interface RecordedShortcut {
  /** The raw KeyboardEvent.key, lowercased. */
  key: string;
  ctrl: boolean;
  shift: boolean;
  meta: boolean;
  /** Whether the recorded key is safe to use cross-layout. */
  safe: boolean;
  /** If unsafe, a human-readable reason. */
  unsafeReason?: string;
}

/**
 * Returns a promise that resolves with the next shortcut the user presses.
 * Useful for "press a key to rebind" UIs.
 *
 * @param target  The element to listen on (default: `document`).
 * @param signal  An AbortSignal to cancel recording.
 */
export function recordShortcut(
  target: EventTarget = document,
  signal?: AbortSignal
): Promise<RecordedShortcut> {
  return new Promise<RecordedShortcut>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const handler = (e: Event) => {
      const event = e as KeyboardEvent;

      // Ignore lone modifier presses
      if (["Control", "Shift", "Meta", "Alt"].includes(event.key)) return;

      event.preventDefault();
      event.stopPropagation();
      cleanup();

      const key = event.key.toLowerCase();
      const ctrl = event.ctrlKey;
      const shift = event.shiftKey;
      const meta = event.metaKey;

      let safe = true;
      let unsafeReason: string | undefined;

      if (event.altKey) {
        safe = false;
        unsafeReason = "Alt/Option modifies the key value on macOS";
      } else if (!ALPHA.test(key) && !DIGIT.test(key)) {
        safe = false;
        unsafeReason = `"${key}" is not a safe cross-layout key (only a-z and 0-9)`;
      } else if (shift && !ALPHA.test(key)) {
        safe = false;
        unsafeReason = `Shift+${key} produces locale-dependent symbols`;
      }

      resolve({ key, ctrl, shift, meta, safe, unsafeReason });
    };

    const onAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };

    const cleanup = () => {
      target.removeEventListener("keydown", handler);
      signal?.removeEventListener("abort", onAbort);
    };

    target.addEventListener("keydown", handler);
    signal?.addEventListener("abort", onAbort);
  });
}
