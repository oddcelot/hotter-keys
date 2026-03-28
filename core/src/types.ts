/** The modifier flags we track. Alt is intentionally excluded. */
export interface Modifiers {
  ctrl: boolean;
  shift: boolean;
  meta: boolean;
}

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
