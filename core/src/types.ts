/** The modifier flags we track. */
export interface Modifiers {
  ctrl: boolean;
  shift: boolean;
  meta: boolean;
  alt: boolean;
}

type AlphaKey =
  | "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l" | "m"
  | "n" | "o" | "p" | "q" | "r" | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z";
type DigitKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

/** The set of keys that are safe to use across keyboard layouts. */
export type SafeKey = AlphaKey | DigitKey;

/**
 * A single chord: one non-modifier key + zero or more modifiers.
 * `key` is always lowercase a-z or digit 0-9.
 */
export interface Shortcut extends Modifiers {
  key: SafeKey;
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
   * released before it can fire again.
   * @default false
   */
  requireReset?: boolean;
  /**
   * If true, automatically translate `ctrl` ↔ `meta` based on platform:
   * on macOS, `ctrl` in a shortcut matches `meta` (Cmd); on Windows/Linux,
   * `meta` matches `ctrl`. Set to false for explicit per-platform bindings.
   * @default true
   */
  crossPlatform?: boolean;
  /**
   * The layer this binding belongs to. Bindings in higher layers take
   * priority over lower layers for the same key combination. Unmatched
   * keys fall through to lower layers.
   * @default "global"
   */
  layer?: string;
}

export interface Binding extends BindingOptions {
  readonly sequence: ShortcutSequence;
  readonly handler: ShortcutHandler;
}

/** Subscribe to held-keys changes. */
export type HeldKeysListener = (keys: ReadonlyArray<string>) => void;

/** Subscribe to key-hold state changes. */
export type KeyHoldListener = (held: boolean) => void;

/** Subscribe to layer stack changes. */
export type LayerChangeListener = (layers: ReadonlyArray<string>) => void;

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
  alt: boolean;
  /**
   * Whether the platform primary modifier was used
   * (Cmd on macOS, Ctrl on Windows/Linux). Use this to store
   * shortcuts as `mod+key` for cross-platform portability.
   */
  mod: boolean;
  /**
   * Whether the platform secondary modifier was used
   * (Ctrl on macOS, Alt on Windows/Linux). Use this to store
   * shortcuts as `mod2+key` for cross-platform portability.
   */
  mod2: boolean;
  /** Whether the recorded key is safe to use cross-layout. */
  safe: boolean;
  /** If unsafe, a human-readable reason. */
  unsafeReason?: string;
}
