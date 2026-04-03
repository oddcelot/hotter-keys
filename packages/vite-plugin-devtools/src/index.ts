import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { Plugin } from 'vite';
import type { AstroIntegration } from 'astro';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientEntry = resolve(__dirname, 'client', 'inject.js');

/**
 * Vite plugin — works for standard Vite/SPA apps.
 * For Astro, use {@link hotterKeysDevtoolsIntegration} instead.
 */
export function hotterKeysDevtools(): Plugin {
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

/**
 * Astro integration — injects the devtools client into all server-rendered pages.
 */
export function hotterKeysDevtoolsIntegration(): AstroIntegration {
  return {
    name: 'hotter-keys-devtools',
    hooks: {
      'astro:config:setup'({ command, injectScript }) {
        if (command !== 'dev') return;
        injectScript('before-hydration', `import '${clientEntry}';`);
      },
    },
  };
}
