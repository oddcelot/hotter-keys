import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { Hotkeys, createHotkeys } from "./hotkeys";
import { fireKey, fireKeyUp } from "./test-helpers";

describe("Hotkeys — basic matching", () => {
  let target: HTMLDivElement;
  let hk: Hotkeys;

  beforeEach(() => {
    target = document.createElement("div");
    hk = createHotkeys({ target });
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

  it("does not match when altKey is pressed but shortcut has no alt", () => {
    const handler = vi.fn();
    hk.add("ctrl+k", handler);
    fireKey(target, "k", { ctrlKey: true, altKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("fires handler when alt modifier matches", () => {
    const handler = vi.fn();
    hk.add("alt+k", handler);
    fireKey(target, "k", { altKey: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not fire alt+k when alt is not pressed", () => {
    const handler = vi.fn();
    hk.add("alt+k", handler);
    fireKey(target, "k");
    expect(handler).not.toHaveBeenCalled();
  });

  it("mod2 resolves and matches correctly", () => {
    // In jsdom, navigator.platform is empty, so isMac() returns false.
    // mod2 on non-mac = alt.
    const handler = vi.fn();
    hk.add("mod2+k", handler);
    fireKey(target, "k", { altKey: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("ctrl+alt+k matches when both modifiers specified", () => {
    const handler = vi.fn();
    hk.add("ctrl+alt+k", handler);
    fireKey(target, "k", { ctrlKey: true, altKey: true });
    expect(handler).toHaveBeenCalledOnce();
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
    hk.add({ key: "k", ctrl: true, shift: false, meta: false, alt: false }, handler);
    fireKey(target, "k", { ctrlKey: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("accepts pre-parsed ShortcutSequence array", () => {
    const handler = vi.fn();
    hk.add([{ key: "k", ctrl: true, shift: false, meta: false, alt: false }], handler);
    fireKey(target, "k", { ctrlKey: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("guards against e.key being undefined", () => {
    const handler = vi.fn();
    hk.add("ctrl+k", handler);
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "key", { value: undefined });
    target.dispatchEvent(event);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("Hotkeys — remove()", () => {
  let target: HTMLDivElement;
  let hk: Hotkeys;

  beforeEach(() => {
    target = document.createElement("div");
    hk = createHotkeys({ target });
  });

  afterEach(() => {
    hk.destroy();
  });

  it("remove() applies crossPlatform translation by default", () => {
    // In jsdom isMac() is false, so ctrl stays ctrl — no translation.
    // Use an explicit pre-translated shortcut to verify the lookup works.
    const handler = vi.fn();
    hk.add({ key: "k", ctrl: true, shift: false, meta: false, alt: false }, handler, {
      crossPlatform: false,
    });
    hk.remove("ctrl+k");
    fireKey(target, "k", { ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("remove() with pre-parsed Shortcut object", () => {
    const handler = vi.fn();
    hk.add("ctrl+k", handler);
    hk.remove({ key: "k", ctrl: true, shift: false, meta: false, alt: false });
    fireKey(target, "k", { ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("remove() with pre-parsed ShortcutSequence", () => {
    const handler = vi.fn();
    hk.add("ctrl+k ctrl+c", handler);
    hk.remove([
      { key: "k", ctrl: true, shift: false, meta: false, alt: false },
      { key: "c", ctrl: true, shift: false, meta: false, alt: false },
    ]);
    fireKey(target, "k", { ctrlKey: true });
    fireKey(target, "c", { ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("remove() cleans up sequence timers", () => {
    const handler = vi.fn();
    hk.add("ctrl+k ctrl+c", handler);
    // Start a sequence to create a timer
    fireKey(target, "k", { ctrlKey: true });
    // Remove while in-progress
    hk.remove("ctrl+k ctrl+c");
    fireKey(target, "c", { ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("Hotkeys — scopes", () => {
  let target: HTMLDivElement;
  let hk: Hotkeys;

  beforeEach(() => {
    target = document.createElement("div");
    hk = createHotkeys({ target });
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

describe("Hotkeys — input filtering", () => {
  let target: HTMLDivElement;
  let hk: Hotkeys;

  beforeEach(() => {
    target = document.createElement("div");
    hk = createHotkeys({ target });
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

describe("Hotkeys — lifecycle", () => {
  let target: HTMLDivElement;
  let hk: Hotkeys;

  beforeEach(() => {
    target = document.createElement("div");
    hk = createHotkeys({ target });
  });

  afterEach(() => {
    hk.destroy();
  });

  it("destroy() cancels in-progress sequence timers", () => {
    const handler = vi.fn();
    hk.add("ctrl+k ctrl+c", handler);
    fireKey(target, "k", { ctrlKey: true });
    hk.destroy();
    // After destroy, the timer should not fire or cause errors
    fireKey(target, "c", { ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();
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

describe("Hotkeys — sequences", () => {
  let target: HTMLDivElement;
  let hk: Hotkeys;

  beforeEach(() => {
    target = document.createElement("div");
    hk = createHotkeys({ target, sequenceTimeout: 500 });
  });

  afterEach(() => {
    hk.destroy();
  });

  it("fires on a two-chord sequence", () => {
    const handler = vi.fn();
    hk.add("ctrl+k ctrl+c", handler);

    fireKey(target, "k", { ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();

    fireKey(target, "c", { ctrlKey: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not fire if wrong second chord", () => {
    const handler = vi.fn();
    hk.add("ctrl+k ctrl+c", handler);

    fireKey(target, "k", { ctrlKey: true });
    fireKey(target, "x", { ctrlKey: true }); // wrong
    expect(handler).not.toHaveBeenCalled();

    fireKey(target, "c", { ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("resets sequence progress on timeout", async () => {
    const handler = vi.fn();
    hk.add("ctrl+k ctrl+c", handler);

    fireKey(target, "k", { ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();

    await new Promise((r) => setTimeout(r, 600));

    fireKey(target, "c", { ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("fires again after successful completion", () => {
    const handler = vi.fn();
    hk.add("ctrl+k ctrl+c", handler);

    fireKey(target, "k", { ctrlKey: true });
    fireKey(target, "c", { ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);

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

  it("completing a sequence suppresses single-chord bindings on the same chord", () => {
    const seqHandler = vi.fn();
    const singleHandler = vi.fn();
    hk.add("shift+h shift+j", seqHandler);
    hk.add("shift+j", singleHandler);

    fireKey(target, "h", { shiftKey: true });
    expect(seqHandler).not.toHaveBeenCalled();
    expect(singleHandler).not.toHaveBeenCalled();

    fireKey(target, "j", { shiftKey: true });
    expect(seqHandler).toHaveBeenCalledOnce();
    expect(singleHandler).not.toHaveBeenCalled();
  });

  it("completing a sequence suppresses single-chord even with key releases between chords", () => {
    const seqHandler = vi.fn();
    const singleHandler = vi.fn();
    hk.add("shift+h shift+j", seqHandler);
    hk.add("shift+j", singleHandler);

    // Press Shift+H
    fireKey(target, "Shift", { shiftKey: true });
    fireKey(target, "h", { shiftKey: true });
    // Release H, then Shift
    fireKeyUp(target, "h", { shiftKey: true });
    fireKeyUp(target, "Shift");

    expect(seqHandler).not.toHaveBeenCalled();
    expect(singleHandler).not.toHaveBeenCalled();

    // Press Shift+J (second chord)
    fireKey(target, "Shift", { shiftKey: true });
    fireKey(target, "j", { shiftKey: true });

    expect(seqHandler).toHaveBeenCalledOnce();
    expect(singleHandler).not.toHaveBeenCalled();
  });

  it("chord mode suppresses ctrl+c single binding during ctrl+k ctrl+c sequence", () => {
    const seqHandler = vi.fn();
    const singleHandler = vi.fn();
    hk.add("ctrl+k ctrl+c", seqHandler);
    hk.add("ctrl+c", singleHandler);

    // Press Ctrl+K (first chord)
    fireKey(target, "k", { ctrlKey: true });
    expect(seqHandler).not.toHaveBeenCalled();
    expect(singleHandler).not.toHaveBeenCalled();

    // Press Ctrl+C (second chord)
    fireKey(target, "c", { ctrlKey: true });
    expect(seqHandler).toHaveBeenCalledOnce();
    expect(singleHandler).not.toHaveBeenCalled();
  });

  it("single-chord still works after a sequence times out", async () => {
    const seqHandler = vi.fn();
    const singleHandler = vi.fn();
    hk.add("shift+h shift+j", seqHandler);
    hk.add("shift+j", singleHandler);

    fireKey(target, "h", { shiftKey: true });
    await new Promise((r) => setTimeout(r, 600));

    fireKey(target, "j", { shiftKey: true });
    expect(seqHandler).not.toHaveBeenCalled();
    expect(singleHandler).toHaveBeenCalledOnce();
  });
});

describe("Hotkeys — requireReset", () => {
  let target: HTMLDivElement;
  let hk: Hotkeys;

  beforeEach(() => {
    target = document.createElement("div");
    hk = createHotkeys({ target });
  });

  afterEach(() => {
    hk.destroy();
  });

  it("fires only once until keys are released", () => {
    const handler = vi.fn();
    hk.add("ctrl+k", handler, { requireReset: true });

    fireKey(target, "k", { ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);

    fireKey(target, "k", { ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);

    fireKeyUp(target, "k");
    fireKeyUp(target, "Control");

    fireKey(target, "k", { ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(2);
  });
});

describe("Hotkeys — held-keys tracking", () => {
  let target: HTMLDivElement;
  let hk: Hotkeys;

  beforeEach(() => {
    target = document.createElement("div");
    hk = createHotkeys({ target });
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

  it("tracks alt in held keys for display even though shortcuts don't match", () => {
    fireKey(target, "k", { altKey: true });
    const keys = [...hk.getHeldKeys()];
    expect(keys).toContain("alt");
    expect(keys).toContain("k");
  });
});

describe("Hotkeys — key hold", () => {
  let target: HTMLDivElement;
  let hk: Hotkeys;

  beforeEach(() => {
    target = document.createElement("div");
    hk = createHotkeys({ target });
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

describe("Hotkeys — layers", () => {
  let target: HTMLDivElement;
  let hk: Hotkeys;

  beforeEach(() => {
    target = document.createElement("div");
    hk = createHotkeys({ target });
  });

  afterEach(() => {
    hk.destroy();
  });

  it('defaults to ["global"]', () => {
    expect([...hk.getLayers()]).toEqual(["global"]);
  });

  it("pushLayer adds to the stack", () => {
    hk.pushLayer("commandbar");
    expect([...hk.getLayers()]).toEqual(["global", "commandbar"]);
  });

  it("pushLayer is a no-op for duplicate names", () => {
    hk.pushLayer("commandbar");
    hk.pushLayer("commandbar");
    expect([...hk.getLayers()]).toEqual(["global", "commandbar"]);
  });

  it("popLayer() pops the topmost layer", () => {
    hk.pushLayer("commandbar");
    const popped = hk.popLayer();
    expect(popped).toBe("commandbar");
    expect([...hk.getLayers()]).toEqual(["global"]);
  });

  it("popLayer() returns undefined when only global remains", () => {
    expect(hk.popLayer()).toBeUndefined();
    expect([...hk.getLayers()]).toEqual(["global"]);
  });

  it("popLayer(name) removes a specific layer", () => {
    hk.pushLayer("a");
    hk.pushLayer("b");
    expect(hk.popLayer("a")).toBe(true);
    expect([...hk.getLayers()]).toEqual(["global", "b"]);
  });

  it("popLayer(name) returns false for unknown layer", () => {
    expect(hk.popLayer("unknown")).toBe(false);
  });

  it("popLayer('global') is not allowed", () => {
    expect(hk.popLayer("global")).toBe(false);
    expect([...hk.getLayers()]).toEqual(["global"]);
  });

  it("higher layer overrides lower layer for the same shortcut", () => {
    const globalHandler = vi.fn();
    const cmdHandler = vi.fn();

    hk.add("ctrl+k", globalHandler);
    hk.add("ctrl+k", cmdHandler, { layer: "commandbar" });

    fireKey(target, "k", { ctrlKey: true });
    expect(globalHandler).toHaveBeenCalledOnce();
    expect(cmdHandler).not.toHaveBeenCalled();

    globalHandler.mockClear();

    hk.pushLayer("commandbar");
    fireKey(target, "k", { ctrlKey: true });
    expect(cmdHandler).toHaveBeenCalledOnce();
    expect(globalHandler).not.toHaveBeenCalled();
  });

  it("unmatched keys fall through to lower layers", () => {
    const globalSave = vi.fn();
    const cmdHandler = vi.fn();

    hk.add("ctrl+s", globalSave);
    hk.add("ctrl+k", cmdHandler, { layer: "commandbar" });

    hk.pushLayer("commandbar");

    fireKey(target, "s", { ctrlKey: true });
    expect(globalSave).toHaveBeenCalledOnce();
  });

  it("popping a layer restores lower layer behavior", () => {
    const globalHandler = vi.fn();
    const cmdHandler = vi.fn();

    hk.add("ctrl+k", globalHandler);
    hk.add("ctrl+k", cmdHandler, { layer: "commandbar" });

    hk.pushLayer("commandbar");
    hk.popLayer("commandbar");

    fireKey(target, "k", { ctrlKey: true });
    expect(globalHandler).toHaveBeenCalledOnce();
    expect(cmdHandler).not.toHaveBeenCalled();
  });

  it("onLayerChange fires on push and pop", () => {
    const listener = vi.fn();
    hk.onLayerChange(listener);

    hk.pushLayer("commandbar");
    expect(listener).toHaveBeenCalledTimes(1);
    expect([...listener.mock.calls[0][0]]).toEqual(["global", "commandbar"]);

    hk.popLayer();
    expect(listener).toHaveBeenCalledTimes(2);
    expect([...listener.mock.calls[1][0]]).toEqual(["global"]);
  });

  it("onLayerChange unsub stops notifications", () => {
    const listener = vi.fn();
    const unsub = hk.onLayerChange(listener);
    unsub();

    hk.pushLayer("commandbar");
    expect(listener).not.toHaveBeenCalled();
  });

  it("higher layer consuming a key resets in-progress sequences in lower layers", () => {
    const seqHandler = vi.fn();
    const cmdHandler = vi.fn();

    hk.add("ctrl+k ctrl+c", seqHandler);
    hk.add("ctrl+c", cmdHandler, { layer: "commandbar" });

    fireKey(target, "k", { ctrlKey: true });
    expect(seqHandler).not.toHaveBeenCalled();

    hk.pushLayer("commandbar");
    fireKey(target, "c", { ctrlKey: true });

    expect(cmdHandler).toHaveBeenCalledOnce();
    expect(seqHandler).not.toHaveBeenCalled();
  });

  it("three layers stacked — topmost wins", () => {
    const globalH = vi.fn();
    const middleH = vi.fn();
    const topH = vi.fn();

    hk.add("ctrl+k", globalH);
    hk.add("ctrl+k", middleH, { layer: "middle" });
    hk.add("ctrl+k", topH, { layer: "top" });

    hk.pushLayer("middle");
    hk.pushLayer("top");

    fireKey(target, "k", { ctrlKey: true });
    expect(topH).toHaveBeenCalledOnce();
    expect(middleH).not.toHaveBeenCalled();
    expect(globalH).not.toHaveBeenCalled();
  });

  it("scope and layer work together", () => {
    const handler = vi.fn();
    hk.add("ctrl+k", handler, { scope: "editor", layer: "commandbar" });

    hk.pushLayer("commandbar");

    fireKey(target, "k", { ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();

    hk.setScope("editor");
    fireKey(target, "k", { ctrlKey: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("bindings without layer default to global", () => {
    const handler = vi.fn();
    hk.add("ctrl+j", handler);

    hk.pushLayer("commandbar");
    fireKey(target, "j", { ctrlKey: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('destroy resets layers to ["global"]', () => {
    hk.pushLayer("commandbar");
    hk.destroy();
    expect([...hk.getLayers()]).toEqual(["global"]);
  });
});
