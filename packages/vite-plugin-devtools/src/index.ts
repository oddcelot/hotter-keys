import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { Plugin } from 'vite';
import type { AstroIntegration } from 'astro';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientEntry = resolve(__dirname, 'client', 'inject.js');
const toolbarAppEntry = resolve(__dirname, 'client', 'toolbar-app.js');

function buildGlobalsScript(options?: DevtoolsOptions): string {
  const parts: string[] = [];
  if (options?.debug) parts.push(`globalThis.__HOTTER_KEYS_DEBUG__ = true;`);
  if (options?.events) parts.push(`globalThis.__HOTTER_KEYS_EVENTS__ = ${JSON.stringify(options.events)};`);
  return parts.join('');
}

const KEYBOARD_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M6 12h.01"/><path d="M10 12h.01"/><path d="M14 12h.01"/><path d="M18 12h.01"/><path d="M8 16h8"/></svg>`;

import type { DevtoolsEventType } from './client/shared.js';

export type { DevtoolsEventType };

export interface DevtoolsOptions {
  /** Enable debug logging to the browser console. @default false */
  debug?: boolean;
  /**
   * Which event types to capture.
   * @default ['binding:fired', 'binding:added', 'binding:removed', 'layer:change', 'scope:change', 'lifecycle']
   */
  events?: DevtoolsEventType[];
}

/**
 * Vite plugin — works for standard Vite/SPA apps.
 * For Astro, use {@link hotterKeysDevtoolsIntegration} instead.
 */
export function hotterKeysDevtools(options?: DevtoolsOptions): Plugin {
  const globals = buildGlobalsScript(options);

  return {
    name: 'hotter-keys-devtools',
    apply: 'serve',

    transformIndexHtml() {
      return [
        {
          tag: 'script',
          attrs: { type: 'module' },
          children: `${globals}import '/@hotter-keys/devtools-client';`,
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
 * Astro integration — registers a Dev Toolbar App for the event log.
 */
export function hotterKeysDevtoolsIntegration(options?: DevtoolsOptions): AstroIntegration {
  const globals = buildGlobalsScript(options);

  return {
    name: 'hotter-keys-devtools',
    hooks: {
      'astro:config:setup'({ command, addDevToolbarApp, injectScript }) {
        if (command !== 'dev') return;

        if (globals) {
          injectScript('head-inline', globals);
        }

        addDevToolbarApp({
          id: 'hotter-keys-devtools',
          name: 'Hotter Keys',
          icon: KEYBOARD_ICON,
          entrypoint: toolbarAppEntry,
        });
      },
    },
  };
}
