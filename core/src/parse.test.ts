import { describe, it, expect } from "vitest";
import {
  parseShortcut,
  parseSequence,
  formatShortcut,
  formatSequence,
} from "./parse";
import type { Shortcut } from "./types";

describe("parseShortcut", () => {
  it("parses a simple letter", () => {
    expect(parseShortcut("k")).toEqual({ key: "k", ctrl: false, shift: false, meta: false });
  });

  it("parses a digit", () => {
    expect(parseShortcut("3")).toEqual({ key: "3", ctrl: false, shift: false, meta: false });
  });

  it("parses ctrl+letter", () => {
    expect(parseShortcut("ctrl+k")).toEqual({ key: "k", ctrl: true, shift: false, meta: false });
  });

  it("parses meta+shift+letter", () => {
    expect(parseShortcut("meta+shift+s")).toEqual({
      key: "s",
      ctrl: false,
      shift: true,
      meta: true,
    });
  });

  it("is case-insensitive", () => {
    expect(parseShortcut("Ctrl+K")).toEqual(parseShortcut("ctrl+k"));
  });

  it("accepts cmd / command / win / super as meta aliases", () => {
    const expected: Shortcut = { key: "a", ctrl: false, shift: false, meta: true };
    expect(parseShortcut("cmd+a")).toEqual(expected);
    expect(parseShortcut("command+a")).toEqual(expected);
    expect(parseShortcut("win+a")).toEqual(expected);
    expect(parseShortcut("super+a")).toEqual(expected);
  });

  it("handles extra whitespace around +", () => {
    expect(parseShortcut("ctrl + k")).toEqual(parseShortcut("ctrl+k"));
  });

  // Error cases
  it("throws on empty string", () => {
    expect(() => parseShortcut("")).toThrow("Empty shortcut");
  });

  it("throws when no non-modifier key is present", () => {
    expect(() => parseShortcut("ctrl+shift")).toThrow("no non-modifier key");
  });

  it("throws on multiple non-modifier keys", () => {
    expect(() => parseShortcut("a+b")).toThrow("more than one non-modifier");
  });

  it("throws on unsafe symbol keys", () => {
    expect(() => parseShortcut("ctrl+[")).toThrow("not a safe cross-layout key");
  });

  it("throws on shift+digit (locale-dependent)", () => {
    expect(() => parseShortcut("shift+2")).toThrow("per locale");
  });

  it("allows shift+letter", () => {
    expect(parseShortcut("shift+a")).toEqual({ key: "a", ctrl: false, shift: true, meta: false });
  });
});

describe("parseSequence", () => {
  it("parses a single chord", () => {
    const seq = parseSequence("ctrl+k");
    expect(seq).toHaveLength(1);
    expect(seq[0]).toEqual({ key: "k", ctrl: true, shift: false, meta: false });
  });

  it("parses a multi-chord sequence", () => {
    const seq = parseSequence("ctrl+k ctrl+c");
    expect(seq).toHaveLength(2);
    expect(seq[0]!.key).toBe("k");
    expect(seq[1]!.key).toBe("c");
    expect(seq[0]!.ctrl).toBe(true);
    expect(seq[1]!.ctrl).toBe(true);
  });

  it("handles extra whitespace between chords", () => {
    const seq = parseSequence("  ctrl+k   ctrl+c  ");
    expect(seq).toHaveLength(2);
  });

  it("throws on empty string", () => {
    expect(() => parseSequence("")).toThrow();
  });
});

describe("formatShortcut", () => {
  it("formats for non-mac", () => {
    expect(formatShortcut({ key: "k", ctrl: true, shift: false, meta: false })).toBe("Ctrl+K");
  });

  it("formats for mac", () => {
    expect(formatShortcut({ key: "s", ctrl: false, shift: true, meta: true }, true)).toBe("⇧⌘S");
  });

  it("formats plain key", () => {
    expect(formatShortcut({ key: "a", ctrl: false, shift: false, meta: false })).toBe("A");
  });
});

describe("formatSequence", () => {
  it("formats a multi-chord sequence", () => {
    const seq = parseSequence("ctrl+k ctrl+c");
    expect(formatSequence(seq)).toBe("Ctrl+K Ctrl+C");
    expect(formatSequence(seq, true)).toBe("⌃K ⌃C");
  });
});
