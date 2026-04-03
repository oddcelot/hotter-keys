import { createOverlay } from './overlay.js';

/** Format a shortcut sequence to a human-readable string. */
function fmtSequence(seq: Array<{ key: string; ctrl: boolean; shift: boolean; meta: boolean; alt: boolean }>): string {
  return seq.map((chord) => {
    const parts: string[] = [];
    if (chord.ctrl) parts.push('Ctrl');
    if (chord.meta) parts.push('Meta');
    if (chord.shift) parts.push('Shift');
    if (chord.alt) parts.push('Alt');
    parts.push(chord.key.toUpperCase());
    return parts.join('+');
  }).join(' ');
}

type TagInfo = { tag: string; tagClass: string };

const TAG_MAP: Record<string, TagInfo> = {
  'binding:fired':   { tag: 'fired',     tagClass: '__hk-tag--fired' },
  'binding:added':   { tag: 'added',     tagClass: '__hk-tag--added' },
  'binding:removed': { tag: 'removed',   tagClass: '__hk-tag--removed' },
  'layer:change':    { tag: 'layer',     tagClass: '__hk-tag--layer' },
  'scope:change':    { tag: 'scope',     tagClass: '__hk-tag--scope' },
  'held-keys:change':{ tag: 'held',      tagClass: '__hk-tag--held' },
  'lifecycle':       { tag: 'lifecycle',  tagClass: '__hk-tag--lifecycle' },
};

function formatDetail(event: any): string {
  switch (event.type) {
    case 'binding:fired':
    case 'binding:added':
    case 'binding:removed':
      return fmtSequence(event.shortcut);
    case 'layer:change':
      return (event.layers as string[]).join(' → ');
    case 'scope:change':
      return `${event.previous} → ${event.scope}`;
    case 'held-keys:change': {
      const keys = event.keys as string[];
      return keys.length > 0 ? keys.join(' + ') : '(none)';
    }
    case 'lifecycle':
      return event.action;
    default:
      return JSON.stringify(event);
  }
}

function setup() {
  const overlay = createOverlay();

  // The devtools hook function called by each Hotkeys instance.
  function hook(event: any) {
    const info = TAG_MAP[event.type] ?? { tag: event.type, tagClass: '' };
    overlay.push({
      type: event.type,
      detail: formatDetail(event),
      tag: info.tag,
      tagClass: info.tagClass,
      timestamp: event.timestamp ?? Date.now(),
    });
  }

  // Track registered instances for potential future use (inspector, etc.)
  const instances = new Set<any>();

  const sentinel = {
    __register(instance: any) {
      instances.add(instance);
      instance.__devtools = hook;
    },
  };

  (globalThis as any).__HOTTER_KEYS_DEVTOOLS__ = sentinel;
}

setup();
