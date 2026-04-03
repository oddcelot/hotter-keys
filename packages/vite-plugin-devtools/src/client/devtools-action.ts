import type { DockClientScriptContext } from '@vitejs/devtools-kit/client';
import { setupSentinel, fmtSequence, type DevtoolsLogEntry } from './shared.js';

interface BindingData {
  formatted: string;
  layer: string;
  scope?: string;
}

export default async function hotterKeysAction(context: DockClientScriptContext): Promise<void> {
  const { rpc, logs } = context;

  const registry = new Map<string, BindingData>();
  let activeLayers: string[] = ['global'];
  const firedLog: Array<{ shortcut: string; timestamp: number }> = [];

  function pushState() {
    (rpc as any).call('hotter-keys:update-state', {
      bindings: [...registry.values()],
      activeLayers,
      firedLog: firedLog.slice(-50),
    });
  }

  function onEvent(entry: DevtoolsLogEntry) {
    if (entry.type === 'binding:fired') {
      firedLog.push({ shortcut: entry.detail, timestamp: entry.timestamp });
      pushState();
    }
  }

  function onRawEvent(event: any) {
    switch (event.type) {
      case 'binding:added': {
        const key = fmtSequence(event.shortcut);
        registry.set(key, {
          formatted: key,
          layer: event.options?.layer ?? 'global',
          scope: event.options?.scope,
        });
        pushState();
        break;
      }
      case 'binding:removed': {
        registry.delete(fmtSequence(event.shortcut));
        pushState();
        break;
      }
      case 'layer:change': {
        activeLayers = [...event.layers];
        pushState();
        break;
      }
    }
  }

  setupSentinel(onEvent, undefined, onRawEvent);

  await logs.add({
    id: 'hotter-keys-connected',
    message: 'Hotter Keys connected — capturing events',
    level: 'success',
    category: 'hotter-keys',
    notify: true,
    autoDismiss: 2000,
    autoDelete: 5000,
  });
}
