import { createOverlay } from './overlay.js';
import { setupSentinel, type DevtoolsLogEntry, type DevtoolsEventType } from './shared.js';

let overlay: ReturnType<typeof createOverlay> | null = null;
const buffer: DevtoolsLogEntry[] = [];

function pushEvent(entry: DevtoolsLogEntry) {
  if (overlay) {
    overlay.push(entry);
  } else {
    buffer.push(entry);
  }
}

function ensureOverlay() {
  if (overlay) return;
  overlay = createOverlay();
  for (const entry of buffer) overlay.push(entry);
  buffer.length = 0;
}

const events = (globalThis as any).__HOTTER_KEYS_EVENTS__ as DevtoolsEventType[] | undefined;
setupSentinel(pushEvent, events ? { events } : undefined);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ensureOverlay, { once: true });
} else {
  ensureOverlay();
}
