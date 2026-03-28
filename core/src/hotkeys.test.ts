import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hotkeys } from "./hotkeys";
import { fireKey, fireKeyUp } from "./test-helpers";

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
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "key", { value: undefined });
    target.dispatchEvent(event);
    expect(handler).not.toHaveBeenCalled();
  });
});

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
});

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
    fireKey(target, "k", { altKey: true });
    expect(hk.getHeldKeys().length).toBe(0);
  });
});

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
