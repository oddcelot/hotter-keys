import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseShortcut,
  parseSequence,
  formatShortcut,
  formatSequence,
  Hotkeys,
  recordShortcut,
  type Shortcut,
} from "./index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fireKey(
  target: EventTarget,
  key: string,
  mods: Partial<{
    ctrlKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    repeat: boolean;
  }> = {}
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
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

function fireKeyUp(
  target: EventTarget,
  key: string,
  mods: Partial<{
    ctrlKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
    altKey: boolean;
  }> = {}
): KeyboardEvent {
  const event = new KeyboardEvent("keyup", {
    key,
    ctrlKey: mods.ctrlKey ?? false,
    shiftKey: mods.shiftKey ?? false,
    metaKey: mods.metaKey ?? false,
    altKey: mods.altKey ?? false,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

// ---------------------------------------------------------------------------
// parseShortcut
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// parseSequence
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// formatShortcut / formatSequence
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Hotkeys — basic shortcut matching
// ---------------------------------------------------------------------------

describe("Hotkeys — basic matching", () => {
  let target: HTMLDivElement;
  let hk: Hotkeys;

  beforeEach(() => {
    target = document.createElement("div");
    hk = new Hotkeys({ target });
  });

  afterEach(() => {
    hk.destroy();
  });

  it("fires handler on matching keydown", () => {
    const handler = vi.fn();
    hk.add("ctrl+k", handler);
    fireKey(target, "k", { ctrlKey: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not fire on partial match", () => {
    const handler = vi.fn();
    hk.add("ctrl+k", handler);
    fireKey(target, "k");
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects events with altKey", () => {
    const handler = vi.fn();
    hk.add("ctrl+k", handler);
    fireKey(target, "k", { ctrlKey: true, altKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("matches case-insensitively at runtime", () => {
    const handler = vi.fn();
    hk.add("ctrl+k", handler);
    fireKey(target, "K", { ctrlKey: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("unsubscribe function works", () => {
    const handler = vi.fn();
    const unsub = hk.add("ctrl+k", handler);
    unsub();
    fireKey(target, "k", { ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("addMany registers multiple shortcuts", () => {
    const a = vi.fn();
    const b = vi.fn();
    hk.addMany({ "ctrl+a": a, "ctrl+b": b });
    fireKey(target, "a", { ctrlKey: true });
    fireKey(target, "b", { ctrlKey: true });
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it("addMany unsub removes all", () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsub = hk.addMany({ "ctrl+a": a, "ctrl+b": b });
    unsub();
    fireKey(target, "a", { ctrlKey: true });
    fireKey(target, "b", { ctrlKey: true });
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it("remove() removes by shortcut string", () => {
    const handler = vi.fn();
    hk.add("ctrl+k", handler);
    hk.remove("ctrl+k");
    fireKey(target, "k", { ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("removeAll() clears everything", () => {
    const handler = vi.fn();
    hk.add("ctrl+k", handler);
    hk.add("ctrl+j", handler);
    hk.removeAll();
    fireKey(target, "k", { ctrlKey: true });
    fireKey(target, "j", { ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("accepts pre-parsed Shortcut object", () => {
    const handler = vi.fn();
    hk.add({ key: "k", ctrl: true, shift: false, meta: false }, handler);
    fireKey(target, "k", { ctrlKey: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("accepts pre-parsed ShortcutSequence array", () => {
    const handler = vi.fn();
    hk.add([{ key: "k", ctrl: true, shift: false, meta: false }], handler);
    fireKey(target, "k", { ctrlKey: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("guards against e.key being undefined", () => {
    const handler = vi.fn();
    hk.add("ctrl+k", handler);
    // Simulate the <datalist> edge case where e.key is undefined
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "key", { value: undefined });
    target.dispatchEvent(event);
    expect(handler).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Hotkeys — scopes
// ---------------------------------------------------------------------------

describe("Hotkeys — scopes", () => {
  let target: HTMLDivElement;
  let hk: Hotkeys;

  beforeEach(() => {
    target = document.createElement("div");
    hk = new Hotkeys({ target });
  });

  afterEach(() => {
    hk.destroy();
  });

  it("scoped binding does not fire in default scope", () => {
    const handler = vi.fn();
    hk.add("ctrl+k", handler, { scope: "editor" });
    fireKey(target, "k", { ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("scoped binding fires when scope matches", () => {
    const handler = vi.fn();
    hk.add("ctrl+k", handler, { scope: "editor" });
    hk.setScope("editor");
    fireKey(target, "k", { ctrlKey: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("unscopped bindings always fire", () => {
    const handler = vi.fn();
    hk.add("ctrl+k", handler);
    hk.setScope("editor");
    fireKey(target, "k", { ctrlKey: true });
    expect(handler).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Hotkeys — input filtering
// ---------------------------------------------------------------------------

describe("Hotkeys — input filtering", () => {
  let target: HTMLDivElement;
  let hk: Hotkeys;

  beforeEach(() => {
    target = document.createElement("div");
    hk = new Hotkeys({ target });
  });

  afterEach(() => {
    hk.destroy();
  });

  it("skips input elements by default", () => {
    const handler = vi.fn();
    hk.add("ctrl+k", handler);
    const input = document.createElement("input");
    target.appendChild(input);
    const event = new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(event);
    expect(handler).not.toHaveBeenCalled();
  });

  it("fires in input elements when enableInInput is true", () => {
    const handler = vi.fn();
    hk.add("ctrl+k", handler, { enableInInput: true });
    const input = document.createElement("input");
    target.appendChild(input);
    const event = new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(event);
    expect(handler).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Hotkeys — lifecycle
// ---------------------------------------------------------------------------

describe("Hotkeys — lifecycle", () => {
  let target: HTMLDivElement;
  let hk: Hotkeys;

  beforeEach(() => {
    target = document.createElement("div");
    hk = new Hotkeys({ target });
  });

  afterEach(() => {
    hk.destroy();
  });

  it("stop() pauses and start() resumes", () => {
    const handler = vi.fn();
    hk.add("ctrl+k", handler);
    hk.stop();
    fireKey(target, "k", { ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();

    hk.start();
    fireKey(target, "k", { ctrlKey: true });
    expect(handler).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Hotkeys — sequences (inspired by solid-primitives createShortcut)
// ---------------------------------------------------------------------------

describe("Hotkeys — sequences", () => {
  let target: HTMLDivElement;
  let hk: Hotkeys;

  beforeEach(() => {
    target = document.createElement("div");
    hk = new Hotkeys({ target, sequenceTimeout: 500 });
  });

  afterEach(() => {
    hk.destroy();
  });

  it("fires on a two-chord sequence", () => {
    const handler = vi.fn();
    hk.add("ctrl+k ctrl+c", handler);

    // First chord
    fireKey(target, "k", { ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();

    // Second chord
    fireKey(target, "c", { ctrlKey: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not fire if wrong second chord", () => {
    const handler = vi.fn();
    hk.add("ctrl+k ctrl+c", handler);

    fireKey(target, "k", { ctrlKey: true });
    fireKey(target, "x", { ctrlKey: true }); // wrong
    expect(handler).not.toHaveBeenCalled();

    // The sequence should have reset, so ctrl+c alone shouldn't fire it
    fireKey(target, "c", { ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("resets sequence progress on timeout", async () => {
    const handler = vi.fn();
    hk.add("ctrl+k ctrl+c", handler);

    fireKey(target, "k", { ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();

    // Wait for sequence timeout
    await new Promise((r) => setTimeout(r, 600));

    // Now ctrl+c should not complete the sequence
    fireKey(target, "c", { ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("fires again after successful completion", () => {
    const handler = vi.fn();
    hk.add("ctrl+k ctrl+c", handler);

    fireKey(target, "k", { ctrlKey: true });
    fireKey(target, "c", { ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);

    // Do it again
    fireKey(target, "k", { ctrlKey: true });
    fireKey(target, "c", { ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("single-chord shortcuts still work alongside sequences", () => {
    const seqHandler = vi.fn();
    const singleHandler = vi.fn();
    hk.add("ctrl+k ctrl+c", seqHandler);
    hk.add("ctrl+j", singleHandler);

    fireKey(target, "j", { ctrlKey: true });
    expect(singleHandler).toHaveBeenCalledOnce();
    expect(seqHandler).not.toHaveBeenCalled();
  });

  it("optimistically calls preventDefault on intermediate chords", () => {
    hk.add("ctrl+k ctrl+c", vi.fn());
    const event = fireKey(target, "k", { ctrlKey: true });
    expect(event.defaultPrevented).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Hotkeys — requireReset (inspired by solid-primitives)
// ---------------------------------------------------------------------------

describe("Hotkeys — requireReset", () => {
  let target: HTMLDivElement;
  let hk: Hotkeys;

  beforeEach(() => {
    target = document.createElement("div");
    hk = new Hotkeys({ target });
  });

  afterEach(() => {
    hk.destroy();
  });

  it("fires only once until keys are released", () => {
    const handler = vi.fn();
    hk.add("ctrl+k", handler, { requireReset: true });

    fireKey(target, "k", { ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);

    // Press again without releasing — should not fire
    fireKey(target, "k", { ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);

    // Release all keys
    fireKeyUp(target, "k");
    fireKeyUp(target, "Control");

    // Now it should fire again
    fireKey(target, "k", { ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Hotkeys — held-keys tracking (inspired by solid-primitives useKeyDownList)
// ---------------------------------------------------------------------------

describe("Hotkeys — held-keys tracking", () => {
  let target: HTMLDivElement;
  let hk: Hotkeys;

  beforeEach(() => {
    target = document.createElement("div");
    hk = new Hotkeys({ target });
  });

  afterEach(() => {
    hk.destroy();
  });

  it("tracks pressed keys in order", () => {
    fireKey(target, "Control", { ctrlKey: true });
    expect([...hk.getHeldKeys()]).toEqual(["control"]);

    fireKey(target, "k", { ctrlKey: true });
    expect([...hk.getHeldKeys()]).toEqual(["control", "k"]);
  });

  it("removes keys on keyup", () => {
    fireKey(target, "a");
    expect([...hk.getHeldKeys()]).toEqual(["a"]);

    fireKeyUp(target, "a");
    expect([...hk.getHeldKeys()]).toEqual([]);
  });

  it("ignores repeat events", () => {
    fireKey(target, "a");
    fireKey(target, "a", { repeat: true });
    fireKey(target, "a", { repeat: true });
    expect([...hk.getHeldKeys()]).toEqual(["a"]);
  });

  it("notifies listeners on change", () => {
    const listener = vi.fn();
    hk.onHeldKeysChange(listener);

    fireKey(target, "a");
    expect(listener).toHaveBeenCalledTimes(1);
    expect([...listener.mock.calls[0][0]]).toEqual(["a"]);

    fireKey(target, "b");
    expect(listener).toHaveBeenCalledTimes(2);
    expect([...listener.mock.calls[1][0]]).toEqual(["a", "b"]);

    fireKeyUp(target, "a");
    expect(listener).toHaveBeenCalledTimes(3);
    expect([...listener.mock.calls[2][0]]).toEqual(["b"]);
  });

  it("unsubscribe stops notifications", () => {
    const listener = vi.fn();
    const unsub = hk.onHeldKeysChange(listener);
    unsub();
    fireKey(target, "a");
    expect(listener).not.toHaveBeenCalled();
  });

  it("resets on blur", () => {
    fireKey(target, "a");
    expect(hk.getHeldKeys().length).toBe(1);

    target.dispatchEvent(new Event("blur"));
    expect(hk.getHeldKeys().length).toBe(0);
  });

  it("resets on contextmenu (unless default prevented)", () => {
    fireKey(target, "a");
    expect(hk.getHeldKeys().length).toBe(1);

    target.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    expect(hk.getHeldKeys().length).toBe(0);
  });

  it("does NOT reset on contextmenu if defaultPrevented", () => {
    fireKey(target, "a");
    const evt = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    evt.preventDefault();
    target.dispatchEvent(evt);
    expect(hk.getHeldKeys().length).toBe(1);
  });

  it("recovers stale modifiers (modifier pressed before tracking started)", () => {
    // Simulate: ctrl was already held when focus arrived, first event is a non-modifier
    fireKey(target, "k", { ctrlKey: true });
    const keys = [...hk.getHeldKeys()];
    expect(keys).toContain("control");
    expect(keys).toContain("k");
    expect(keys.indexOf("control")).toBeLessThan(keys.indexOf("k"));
  });

  it("recovers multiple stale modifiers", () => {
    fireKey(target, "k", { ctrlKey: true, shiftKey: true, metaKey: true });
    const keys = [...hk.getHeldKeys()];
    expect(keys).toContain("meta");
    expect(keys).toContain("control");
    expect(keys).toContain("shift");
    expect(keys).toContain("k");
  });

  it("does NOT recover stale alt (rule 5)", () => {
    // altKey events are rejected entirely by _handleKeyDown, so nothing gets tracked
    fireKey(target, "k", { altKey: true });
    expect(hk.getHeldKeys().length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Hotkeys — key hold (inspired by solid-primitives createKeyHold)
// ---------------------------------------------------------------------------

describe("Hotkeys — key hold", () => {
  let target: HTMLDivElement;
  let hk: Hotkeys;

  beforeEach(() => {
    target = document.createElement("div");
    hk = new Hotkeys({ target });
  });

  afterEach(() => {
    hk.destroy();
  });

  it("fires true when a key is held alone", () => {
    const listener = vi.fn();
    hk.onKeyHold("shift", listener);

    fireKey(target, "Shift", { shiftKey: true });
    expect(listener).toHaveBeenCalledWith(true);
  });

  it("fires false when a second key is pressed", () => {
    const listener = vi.fn();
    hk.onKeyHold("shift", listener);

    fireKey(target, "Shift", { shiftKey: true });
    expect(listener).toHaveBeenLastCalledWith(true);

    fireKey(target, "a", { shiftKey: true });
    expect(listener).toHaveBeenLastCalledWith(false);
  });

  it("fires false when the held key is released", () => {
    const listener = vi.fn();
    hk.onKeyHold("shift", listener);

    fireKey(target, "Shift", { shiftKey: true });
    fireKeyUp(target, "Shift");
    expect(listener).toHaveBeenLastCalledWith(false);
  });

  it("unsubscribe stops notifications", () => {
    const listener = vi.fn();
    const unsub = hk.onKeyHold("shift", listener);
    unsub();

    fireKey(target, "Shift", { shiftKey: true });
    expect(listener).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// recordShortcut
// ---------------------------------------------------------------------------

describe("recordShortcut", () => {
  it("resolves with the pressed shortcut", async () => {
    const target = document.createElement("div");
    const promise = recordShortcut(target);
    queueMicrotask(() => fireKey(target, "k", { ctrlKey: true }));
    const result = await promise;
    expect(result.key).toBe("k");
    expect(result.ctrl).toBe(true);
    expect(result.safe).toBe(true);
  });

  it("marks alt-modified shortcuts as unsafe", async () => {
    const target = document.createElement("div");
    const promise = recordShortcut(target);
    queueMicrotask(() => fireKey(target, "ç", { altKey: true }));
    const result = await promise;
    expect(result.safe).toBe(false);
    expect(result.unsafeReason).toContain("Alt");
  });

  it("marks symbol keys as unsafe", async () => {
    const target = document.createElement("div");
    const promise = recordShortcut(target);
    queueMicrotask(() => fireKey(target, "[", { ctrlKey: true }));
    const result = await promise;
    expect(result.safe).toBe(false);
    expect(result.unsafeReason).toContain("not a safe cross-layout key");
  });

  it("ignores lone modifier presses", async () => {
    const target = document.createElement("div");
    const promise = recordShortcut(target);
    queueMicrotask(() => {
      fireKey(target, "Shift");
      fireKey(target, "a", { shiftKey: true });
    });
    const result = await promise;
    expect(result.key).toBe("a");
    expect(result.shift).toBe(true);
  });

  it("rejects on abort", async () => {
    const target = document.createElement("div");
    const ac = new AbortController();
    const promise = recordShortcut(target, ac.signal);
    queueMicrotask(() => ac.abort());
    await expect(promise).rejects.toThrow("Aborted");
  });
});
