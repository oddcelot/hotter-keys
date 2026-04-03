import { getDevToolsRpcClient } from '@vitejs/devtools-kit/client';
import { setupSentinel, fmtSequence, type DevtoolsLogEntry } from './shared.js';

interface BindingData {
  formatted: string;
  layer: string;
  scope?: string;
}

async function init() {
  const client = await getDevToolsRpcClient();

  const registry = new Map<string, BindingData>();
  let activeLayers: string[] = ['global'];
  const firedLog: Array<{ shortcut: string; layer: string; timestamp: number }> = [];

  function pushState() {
    (client.call as any)('hotter-keys:update-state', {
      bindings: [...registry.values()],
      activeLayers,
      firedLog: firedLog.slice(-50),
    });
  }

  function onEvent(entry: DevtoolsLogEntry) {
    if (entry.type === 'binding:fired') {
      // Also notify server to emit a log
      (client.call as any)('hotter-keys:on-fired', {
        tag: entry.tag,
        detail: entry.detail,
      });
    }
  }

  function onRawEvent(event: any) {
    if (event.type === 'binding:fired') {
      firedLog.push({
        shortcut: fmtSequence(event.shortcut),
        layer: event.layer ?? 'global',
        timestamp: event.timestamp,
      });
      pushState();
    }

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
}

init();
