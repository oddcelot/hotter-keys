import type { RecordedShortcut } from "./types";
import { ALPHA, DIGIT, isMac } from "./parse";

/**
 * Returns a promise that resolves with the next shortcut the user presses.
 * Useful for "press a key to rebind" UIs.
 *
 * @param target  The element to listen on (default: `document`).
 * @param signal  An AbortSignal to cancel recording.
 */
export function recordShortcut(
  target: EventTarget = document,
  signal?: AbortSignal,
): Promise<RecordedShortcut> {
  return new Promise<RecordedShortcut>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const handler = (e: Event) => {
      if (!(e instanceof KeyboardEvent)) return;

      // Ignore lone modifier presses
      if (["Control", "Shift", "Meta", "Alt"].includes(e.key)) return;

      e.preventDefault();
      e.stopPropagation();
      cleanup();

      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey;
      const shift = e.shiftKey;
      const meta = e.metaKey;
      const alt = e.altKey;
      const mac = isMac();

      // Platform primary modifier: Cmd on macOS, Ctrl elsewhere.
      // Only set when exclusively the primary modifier is used (not both ctrl+meta).
      const mod = mac ? meta && !ctrl : ctrl && !meta;

      // Platform secondary modifier: Ctrl on macOS, Alt elsewhere.
      // Only set when exclusively the secondary modifier is used.
      const mod2 = mac ? ctrl && !meta : alt && !ctrl && !meta;

      let safe = true;
      let unsafeReason: string | undefined;

      if (!ALPHA.test(key) && !DIGIT.test(key)) {
        safe = false;
        unsafeReason =
          alt && mac
            ? "Alt/Option modifies the key value on macOS"
            : `"${key}" is not a safe cross-layout key (only a-z and 0-9)`;
      } else if (shift && !ALPHA.test(key)) {
        safe = false;
        unsafeReason = `Shift+${key} produces locale-dependent symbols`;
      }

      resolve({ key, ctrl, shift, meta, alt, mod, mod2, safe, unsafeReason });
    };

    const onAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };

    const cleanup = () => {
      target.removeEventListener("keydown", handler);
      signal?.removeEventListener("abort", onAbort);
    };

    target.addEventListener("keydown", handler);
    signal?.addEventListener("abort", onAbort);
  });
}
