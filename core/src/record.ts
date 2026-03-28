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
  signal?: AbortSignal
): Promise<RecordedShortcut> {
  return new Promise<RecordedShortcut>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const handler = (e: Event) => {
      const event = e as KeyboardEvent;

      // Ignore lone modifier presses
      if (["Control", "Shift", "Meta", "Alt"].includes(event.key)) return;

      event.preventDefault();
      event.stopPropagation();
      cleanup();

      const key = event.key.toLowerCase();
      const ctrl = event.ctrlKey;
      const shift = event.shiftKey;
      const meta = event.metaKey;

      // Platform primary modifier: Cmd on macOS, Ctrl elsewhere.
      // Only set when exclusively the primary modifier is used (not both ctrl+meta).
      const mod = isMac()
        ? (meta && !ctrl)
        : (ctrl && !meta);

      let safe = true;
      let unsafeReason: string | undefined;

      if (event.altKey) {
        safe = false;
        unsafeReason = "Alt/Option modifies the key value on macOS";
      } else if (!ALPHA.test(key) && !DIGIT.test(key)) {
        safe = false;
        unsafeReason = `"${key}" is not a safe cross-layout key (only a-z and 0-9)`;
      } else if (shift && !ALPHA.test(key)) {
        safe = false;
        unsafeReason = `Shift+${key} produces locale-dependent symbols`;
      }

      resolve({ key, ctrl, shift, meta, mod, safe, unsafeReason });
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
