import { describe, it, expect, vi } from "vitest";
import { recordShortcut } from "./record";
import * as parse from "./parse";
import { fireKey } from "./test-helpers";

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

  it("sets mod=true when platform primary modifier is used (non-mac)", async () => {
    vi.spyOn(parse, "isMac").mockReturnValue(false);
    const target = document.createElement("div");
    const promise = recordShortcut(target);
    queueMicrotask(() => fireKey(target, "s", { ctrlKey: true }));
    const result = await promise;
    expect(result.mod).toBe(true);
    expect(result.ctrl).toBe(true);
    expect(result.meta).toBe(false);
    vi.restoreAllMocks();
  });

  it("sets mod=true when platform primary modifier is used (mac)", async () => {
    vi.spyOn(parse, "isMac").mockReturnValue(true);
    const target = document.createElement("div");
    const promise = recordShortcut(target);
    queueMicrotask(() => fireKey(target, "s", { metaKey: true }));
    const result = await promise;
    expect(result.mod).toBe(true);
    expect(result.meta).toBe(true);
    expect(result.ctrl).toBe(false);
    vi.restoreAllMocks();
  });

  it("sets mod=false when both ctrl and meta are pressed", async () => {
    vi.spyOn(parse, "isMac").mockReturnValue(true);
    const target = document.createElement("div");
    const promise = recordShortcut(target);
    queueMicrotask(() => fireKey(target, "s", { ctrlKey: true, metaKey: true }));
    const result = await promise;
    expect(result.mod).toBe(false);
    expect(result.ctrl).toBe(true);
    expect(result.meta).toBe(true);
    vi.restoreAllMocks();
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
