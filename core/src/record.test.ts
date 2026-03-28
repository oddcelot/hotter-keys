import { describe, it, expect } from "vitest";
import { recordShortcut } from "./record";
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
