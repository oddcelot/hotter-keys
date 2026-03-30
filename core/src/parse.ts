import type { Modifiers, SafeKey, Shortcut, ShortcutSequence } from "./types";

export const ALPHA = /^[a-z]$/;
export const DIGIT = /^[0-9]$/;

/**
 * Detect whether the current platform is macOS/iOS.
 * On macOS the primary modifier is Meta (Cmd); elsewhere it is Ctrl.
 */
export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

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
 * Modifiers: `ctrl` | `control` | `meta` | `cmd` | `command` | `win` | `super` | `shift` | `mod`
 *
 * The `mod` modifier resolves to `meta` on macOS and `ctrl` on Windows/Linux,
 * making shortcuts portable across platforms.
 *
 * Key: a single letter a-z (case-insensitive) or digit 0-9
 *
 * @param raw The shortcut string to parse.
 * @param platform Override platform detection (for testing or SSR).
 * @throws if the chord is malformed or violates safety rules.
 */
export function parseShortcut(raw: string, platform?: { mac: boolean }): Shortcut {
  const mac = platform ? platform.mac : isMac();
  const parts = raw
    .toLowerCase()
    .split("+")
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    throw new Error(`Empty shortcut string`);
  }

  const mods: Modifiers = { ctrl: false, shift: false, meta: false };
  let key: string | undefined;

  for (const part of parts) {
    // `mod` resolves to the platform primary modifier
    if (part === "mod") {
      mods[mac ? "meta" : "ctrl"] = true;
      continue;
    }
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

  return { key: key as SafeKey, ...mods };
}

/**
 * Parse a sequence string. Chords are separated by spaces.
 *
 * ```ts
 * parseSequence("ctrl+k ctrl+c") // => [{ key:"k", ctrl:true, … }, { key:"c", ctrl:true, … }]
 * parseSequence("ctrl+s")        // => [{ key:"s", ctrl:true, … }]
 * ```
 */
export function parseSequence(raw: string, platform?: { mac: boolean }): ShortcutSequence {
  const chords = raw.trim().split(/\s+/);
  if (chords.length === 0 || (chords.length === 1 && chords[0] === "")) {
    throw new Error("Empty sequence string");
  }
  return chords.map((c) => parseShortcut(c, platform));
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

export function isInputElement(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

export function eventMatchesShortcut(e: KeyboardEvent, s: Shortcut): boolean {
  if (e.altKey) return false;
  return (
    e.key.toLowerCase() === s.key &&
    e.ctrlKey === s.ctrl &&
    e.shiftKey === s.shift &&
    e.metaKey === s.meta
  );
}

export function shortcutEquals(a: Shortcut, b: Shortcut): boolean {
  return a.key === b.key && a.ctrl === b.ctrl && a.shift === b.shift && a.meta === b.meta;
}

/**
 * Swap `ctrl` ↔ `meta` based on platform so that shortcuts registered with
 * one modifier work with the platform primary modifier.
 *
 * On macOS: `{ ctrl: true, meta: false }` → `{ ctrl: false, meta: true }`
 * On Windows/Linux: `{ ctrl: false, meta: true }` → `{ ctrl: true, meta: false }`
 *
 * If both or neither are set, the shortcut is left unchanged.
 */
export function translateForPlatform(s: Shortcut, platform?: { mac: boolean }): Shortcut {
  const mac = platform ? platform.mac : isMac();
  // Only translate when exactly one of ctrl/meta is set
  if (s.ctrl === s.meta) return s;
  if (mac && s.ctrl && !s.meta) {
    return { ...s, ctrl: false, meta: true };
  }
  if (!mac && s.meta && !s.ctrl) {
    return { ...s, ctrl: true, meta: false };
  }
  return s;
}
