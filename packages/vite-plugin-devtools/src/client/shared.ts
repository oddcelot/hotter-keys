export function hkLog(...args: any[]) {
  if ((globalThis as any).__HOTTER_KEYS_DEBUG__) console.log('[hk-devtools]', ...args);
}

export interface DevtoolsLogEntry {
  type: string;
  detail: string;
  tag: string;
  badgeColor: string;
  tagClass: string;
  timestamp: number;
}

interface TagInfo {
  tag: string;
  badgeColor: string;
  tagClass: string;
}

export type DevtoolsEventType =
  | 'binding:fired'
  | 'binding:added'
  | 'binding:removed'
  | 'layer:change'
  | 'scope:change'
  | 'held-keys:change'
  | 'lifecycle';

export const ALL_EVENT_TYPES: DevtoolsEventType[] = [
  'binding:fired', 'binding:added', 'binding:removed',
  'layer:change', 'scope:change', 'held-keys:change', 'lifecycle',
];

export const DEFAULT_EVENT_TYPES: DevtoolsEventType[] = [
  'binding:fired', 'binding:added', 'binding:removed',
  'layer:change', 'scope:change', 'lifecycle',
];

export const TAG_MAP: Record<string, TagInfo> = {
  'binding:fired':    { tag: 'fired',     badgeColor: 'green',  tagClass: '__hk-tag--fired' },
  'binding:added':    { tag: 'added',     badgeColor: 'blue',   tagClass: '__hk-tag--added' },
  'binding:removed':  { tag: 'removed',   badgeColor: 'red',    tagClass: '__hk-tag--removed' },
  'layer:change':     { tag: 'layer',     badgeColor: 'yellow', tagClass: '__hk-tag--layer' },
  'scope:change':     { tag: 'scope',     badgeColor: 'purple', tagClass: '__hk-tag--scope' },
  'held-keys:change': { tag: 'held',      badgeColor: 'purple', tagClass: '__hk-tag--held' },
  'lifecycle':        { tag: 'lifecycle',  badgeColor: 'gray',   tagClass: '__hk-tag--lifecycle' },
};

export function fmtSequence(
  seq: Array<{ key: string; ctrl: boolean; shift: boolean; meta: boolean; alt: boolean }>
): string {
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

export function formatDetail(event: any): string {
  switch (event.type) {
    case 'binding:fired': {
      const parts = [fmtSequence(event.shortcut), `[${event.layer ?? 'global'}]`];
      if (event.scope) parts.push(`(${event.scope})`);
      return parts.join(' ');
    }
    case 'binding:added':
    case 'binding:removed':
      return fmtSequence(event.shortcut);
    case 'layer:change':
      return (event.layers as string[]).join(' \u2192 ');
    case 'scope:change':
      return `${event.previous} \u2192 ${event.scope}`;
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

export function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

function toEntry(event: any): DevtoolsLogEntry {
  const info = TAG_MAP[event.type] ?? { tag: event.type, badgeColor: 'gray', tagClass: '' };
  return {
    type: event.type,
    detail: formatDetail(event),
    tag: info.tag,
    badgeColor: info.badgeColor,
    tagClass: info.tagClass,
    timestamp: event.timestamp ?? Date.now(),
  };
}

/**
 * Install the devtools sentinel on globalThis, drain any pending instances,
 * and wire all current + future Hotkeys instances to call `onEvent` for each
 * devtools event.
 */
export interface SentinelOptions {
  events?: DevtoolsEventType[];
}

export function setupSentinel(
  onEvent: (entry: DevtoolsLogEntry) => void,
  options?: SentinelOptions,
  onRawEvent?: (event: any) => void,
): void {
  const allowedTypes = new Set(options?.events ?? DEFAULT_EVENT_TYPES);
  const instances = new Set<any>();

  function hook(event: any) {
    onRawEvent?.(event);
    if (!allowedTypes.has(event.type)) return;
    hkLog('event:', event.type);
    onEvent(toEntry(event));
  }

  const sentinel = {
    __register(instance: any) {
      if (instances.has(instance)) return;
      hkLog('registered instance', instance);
      instances.add(instance);
      instance.__devtools = hook;

      // Replay existing state for late-attached instances.
      if (typeof instance.getBindings === 'function') {
        const now = Date.now();
        for (const binding of instance.getBindings()) {
          hook({
            type: 'binding:added',
            shortcut: binding.sequence,
            options: binding,
            timestamp: now,
          });
        }
      }
      if (typeof instance.getLayers === 'function') {
        hook({
          type: 'layer:change',
          layers: instance.getLayers(),
          timestamp: Date.now(),
        });
      }
    },
  };

  hkLog('sentinel installed');
  (globalThis as any).__HOTTER_KEYS_DEVTOOLS__ = sentinel;

  // Drain instances created before the sentinel was ready.
  const pending = (globalThis as any).__HOTTER_KEYS_INSTANCES__ as any[] | undefined;
  hkLog('pending instances:', pending?.length ?? 0);
  if (pending) {
    for (const instance of pending) sentinel.__register(instance);
    pending.length = 0;
  }
}
