import type { DockClientScriptContext } from '@vitejs/devtools-kit/client';
import { setupSentinel, fmtSequence, type DevtoolsLogEntry } from './shared.js';

export default async function hotterKeysAction(context: DockClientScriptContext): Promise<void> {
  const { logs } = context;

  const summary = await logs.add({
    id: 'hotter-keys-summary',
    message: 'Listening for keyboard shortcuts\u2026',
    level: 'info',
    category: 'hotter-keys',
    status: 'loading',
    notify: true,
  });

  let eventCount = 0;

  function onEvent(entry: DevtoolsLogEntry) {
    eventCount++;

    logs.add({
      id: `hotter-keys-${Date.now()}-${eventCount}`,
      message: `${entry.tag.toUpperCase()}: ${entry.detail}`,
      level: entry.type === 'binding:fired' ? 'success' : 'info',
      category: 'hotter-keys',
    });

    summary.update({
      message: `Captured ${eventCount} event${eventCount === 1 ? '' : 's'}`,
      level: 'info',
      status: 'loading',
    });
  }

  function onRawEvent(event: any) {
    if (event.type === 'binding:added') {
      const formatted = fmtSequence(event.shortcut);
      const layer = event.options?.layer ?? 'global';
      logs.add({
        id: `hotter-keys-binding-${formatted}-${layer}`,
        message: `Binding registered: ${formatted}`,
        level: 'info',
        category: 'hotter-keys',
        description: `Layer: ${layer}${event.options?.scope ? ` | Scope: ${event.options.scope}` : ''}`,
      });
    }
  }

  setupSentinel(onEvent, undefined, onRawEvent);
}
