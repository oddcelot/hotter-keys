import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { Plugin } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function hotterKeysDevtools(): Plugin {
  const clientEntry = resolve(__dirname, 'client', 'inject.js');

  return {
    name: 'hotter-keys-devtools',
    apply: 'serve',

    transformIndexHtml() {
      return [
        {
          tag: 'script',
          attrs: { type: 'module' },
          children: `import '/@hotter-keys/devtools-client';`,
          injectTo: 'head-prepend',
        },
      ];
    },

    resolveId(id) {
      if (id === '/@hotter-keys/devtools-client') return clientEntry;
    },
  };
}
