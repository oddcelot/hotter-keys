import type { PluginWithDevTools } from '@vitejs/devtools-kit';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, normalize } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientScript = resolve(__dirname, 'client', 'devtools-action.js');

/**
 * Vite DevTools plugin — registers hotter-keys as a panel in `@vitejs/devtools`.
 * Use alongside `DevTools()` from `@vitejs/devtools` in your Vite config.
 */
export function hotterKeysViteDevtools(): PluginWithDevTools {
  return {
    name: 'hotter-keys-vite-devtools',
    devtools: {
      setup(context) {
        context.docks.register({
          type: 'action',
          id: 'hotter-keys',
          title: 'Hotter Keys — Event Log',
          icon: 'ph:keyboard-duotone',
          category: 'web',
          action: {
            importFrom: `/@fs/${normalize(clientScript)}`,
          },
        });

        context.logs.add({
          message: 'Hotter Keys devtools ready — click the keyboard icon to capture events',
          level: 'info',
          notify: true,
          autoDismiss: 3000,
          autoDelete: 10000,
          category: 'hotter-keys',
        });
      },
    },
  };
}
