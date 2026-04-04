import { describe, it, expect } from "vite-plus/test";
import {
  parseShortcut,
  parseSequence,
  formatShortcut,
  formatSequence,
  translateForPlatform,
} from "./parse";
import type { Shortcut } from "./types";

describe("parseShortcut", () => {
  it("parses a simple letter", () => {
    expect(parseShortcut("k")).toEqual({
      key: "k",
      ctrl: false,
      shift: false,
      meta: false,
      alt: false,
    });
  });

  it("parses a digit", () => {
    expect(parseShortcut("3")).toEqual({
      key: "3",
      ctrl: false,
      shift: false,
      meta: false,
      alt: false,
    });
  });

  it("parses ctrl+letter", () => {
    expect(parseShortcut("ctrl+k")).toEqual({
      key: "k",
      ctrl: true,
      shift: false,
      meta: false,
      alt: false,
    });
  });

  it("parses meta+shift+letter", () => {
    expect(parseShortcut("meta+shift+s")).toEqual({
      key: "s",
      ctrl: false,
      shift: true,
      meta: true,
      alt: false,
    });
  });

  it("is case-insensitive", () => {
    expect(parseShortcut("Ctrl+K")).toEqual(parseShortcut("ctrl+k"));
  });

  it("accepts cmd / command / win / super as meta aliases", () => {
    const expected: Shortcut = { key: "a", ctrl: false, shift: false, meta: true, alt: false };
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
    expect(parseShortcut("shift+a")).toEqual({
      key: "a",
      ctrl: false,
      shift: true,
      meta: false,
      alt: false,
    });
  });

  it("parses alt+letter", () => {
    expect(parseShortcut("alt+k")).toEqual({
      key: "k",
      ctrl: false,
      shift: false,
      meta: false,
      alt: true,
    });
  });

  it("accepts option as alt alias", () => {
    expect(parseShortcut("option+k")).toEqual({
      key: "k",
      ctrl: false,
      shift: false,
      meta: false,
      alt: true,
    });
  });
});

describe("parseSequence", () => {
  it("parses a single chord", () => {
    const seq = parseSequence("ctrl+k");
    expect(seq).toHaveLength(1);
    expect(seq[0]).toEqual({ key: "k", ctrl: true, shift: false, meta: false, alt: false });
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
    expect(formatShortcut({ key: "k", ctrl: true, shift: false, meta: false, alt: false })).toBe(
      "Ctrl+K",
    );
  });

  it("formats for mac", () => {
    expect(
      formatShortcut({ key: "s", ctrl: false, shift: true, meta: true, alt: false }, true),
    ).toBe("⇧⌘S");
  });

  it("formats plain key", () => {
    expect(formatShortcut({ key: "a", ctrl: false, shift: false, meta: false, alt: false })).toBe(
      "A",
    );
  });

  it("formats alt modifier", () => {
    expect(formatShortcut({ key: "k", ctrl: false, shift: false, meta: false, alt: true })).toBe(
      "Alt+K",
    );
    expect(
      formatShortcut({ key: "k", ctrl: false, shift: false, meta: false, alt: true }, true),
    ).toBe("⌥K");
  });
});

describe("formatSequence", () => {
  it("formats a multi-chord sequence", () => {
    const seq = parseSequence("ctrl+k ctrl+c");
    expect(formatSequence(seq)).toBe("Ctrl+K Ctrl+C");
    expect(formatSequence(seq, true)).toBe("⌃K ⌃C");
  });
});

describe("mod keyword", () => {
  it("resolves mod to meta on macOS", () => {
    expect(parseShortcut("mod+s", { mac: true })).toEqual({
      key: "s",
      ctrl: false,
      shift: false,
      meta: true,
      alt: false,
    });
  });

  it("resolves mod to ctrl on non-macOS", () => {
    expect(parseShortcut("mod+s", { mac: false })).toEqual({
      key: "s",
      ctrl: true,
      shift: false,
      meta: false,
      alt: false,
    });
  });

  it("mod+shift works", () => {
    expect(parseShortcut("mod+shift+p", { mac: true })).toEqual({
      key: "p",
      ctrl: false,
      shift: true,
      meta: true,
      alt: false,
    });
  });

  it("mod works in sequences", () => {
    const seq = parseSequence("mod+k mod+c", { mac: true });
    expect(seq[0]!.meta).toBe(true);
    expect(seq[0]!.ctrl).toBe(false);
    expect(seq[1]!.meta).toBe(true);
  });
});

describe("mod2 keyword", () => {
  it("resolves mod2 to ctrl on macOS", () => {
    expect(parseShortcut("mod2+s", { mac: true })).toEqual({
      key: "s",
      ctrl: true,
      shift: false,
      meta: false,
      alt: false,
    });
  });

  it("resolves mod2 to alt on non-macOS", () => {
    expect(parseShortcut("mod2+s", { mac: false })).toEqual({
      key: "s",
      ctrl: false,
      shift: false,
      meta: false,
      alt: true,
    });
  });

  it("mod+mod2 works (Cmd+Ctrl on mac)", () => {
    expect(parseShortcut("mod+mod2+s", { mac: true })).toEqual({
      key: "s",
      ctrl: true,
      shift: false,
      meta: true,
      alt: false,
    });
  });

  it("mod+mod2 works (Ctrl+Alt on non-mac)", () => {
    expect(parseShortcut("mod+mod2+s", { mac: false })).toEqual({
      key: "s",
      ctrl: true,
      shift: false,
      meta: false,
      alt: true,
    });
  });

  it("mod2 works in sequences", () => {
    const seq = parseSequence("mod2+k mod2+c", { mac: false });
    expect(seq[0]!.alt).toBe(true);
    expect(seq[0]!.ctrl).toBe(false);
    expect(seq[1]!.alt).toBe(true);
  });
});

describe("translateForPlatform", () => {
  it("translates ctrl to meta on macOS", () => {
    const result = translateForPlatform(
      { key: "s", ctrl: true, shift: false, meta: false, alt: false },
      { mac: true },
    );
    expect(result).toEqual({ key: "s", ctrl: false, shift: false, meta: true, alt: false });
  });

  it("translates meta to ctrl on non-macOS", () => {
    const result = translateForPlatform(
      { key: "s", ctrl: false, shift: false, meta: true, alt: false },
      { mac: false },
    );
    expect(result).toEqual({ key: "s", ctrl: true, shift: false, meta: false, alt: false });
  });

  it("does not translate when both ctrl and meta are set", () => {
    const input: Shortcut = { key: "s", ctrl: true, shift: false, meta: true, alt: false };
    expect(translateForPlatform(input, { mac: true })).toEqual(input);
  });

  it("does not translate when neither ctrl nor meta is set", () => {
    const input: Shortcut = { key: "a", ctrl: false, shift: true, meta: false, alt: false };
    expect(translateForPlatform(input, { mac: true })).toEqual(input);
  });

  it("preserves shift alongside translation", () => {
    const result = translateForPlatform(
      { key: "p", ctrl: true, shift: true, meta: false, alt: false },
      { mac: true },
    );
    expect(result).toEqual({ key: "p", ctrl: false, shift: true, meta: true, alt: false });
  });
});
