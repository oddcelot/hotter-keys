import type { JsonRenderer, JsonRenderElement, JsonRenderSpec, PluginWithDevTools } from '@vitejs/devtools-kit';
import { defineRpcFunction } from '@vitejs/devtools-kit';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, normalize } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientScript = resolve(__dirname, 'client', 'devtools-action.js');

// ── Spec builder ─────────────────────────────────────────────────────────────

interface BindingData {
  formatted: string;
  layer: string;
  scope?: string;
}

interface PanelState {
  bindings: BindingData[];
  activeLayers: string[];
  firedLog: Array<{ shortcut: string; layer: string; timestamp: number }>;
}

function buildSpec(state: PanelState): JsonRenderSpec {
  const elements: Record<string, JsonRenderElement> = {};
  const rootChildren: string[] = ['header', 'divider0'];

  // ── Header ──
  elements['header'] = {
    type: 'Stack',
    props: { direction: 'horizontal', gap: 8, align: 'center', justify: 'space-between' },
    children: ['header-left', 'refresh-btn'],
  };
  elements['header-left'] = {
    type: 'Stack',
    props: { direction: 'horizontal', gap: 8, align: 'center' },
    children: ['header-icon', 'title'],
  };
  elements['header-icon'] = {
    type: 'Icon',
    props: { name: 'ph:keyboard-duotone', size: 20 },
  };
  elements['title'] = {
    type: 'Text',
    props: { content: 'Hotter Keys', variant: 'heading' },
  };
  elements['refresh-btn'] = {
    type: 'Button',
    props: { label: 'Refresh', variant: 'ghost', icon: 'ph:arrows-clockwise' },
    on: { press: { action: 'hotter-keys:refresh' } },
  };
  elements['divider0'] = { type: 'Divider', props: {} };

  // ── Active layer stack ──
  rootChildren.push('layer-stack');
  const stackChildren: string[] = ['layer-stack-label'];

  for (let i = 0; i < state.activeLayers.length; i++) {
    const layer = state.activeLayers[i]!;
    const id = `active-layer-${i}`;
    stackChildren.push(id);
    elements[id] = {
      type: 'Badge',
      props: {
        text: `${i + 1}. ${layer}`,
        variant: 'success',
      },
    };
  }

  // Show inactive layers that have bindings
  const activeSet0 = new Set(state.activeLayers);
  const inactiveLayers = [...new Set(state.bindings.map(b => b.layer))].filter(l => !activeSet0.has(l));
  for (let i = 0; i < inactiveLayers.length; i++) {
    const id = `inactive-layer-${i}`;
    stackChildren.push(id);
    elements[id] = {
      type: 'Badge',
      props: {
        text: inactiveLayers[i]!,
        variant: 'default',
      },
    };
  }

  elements['layer-stack-icon'] = {
    type: 'Icon',
    props: { name: 'ph:stack-duotone', size: 16 },
  };
  elements['layer-stack-label'] = {
    type: 'Text',
    props: { content: 'Layer Stack:', variant: 'caption' },
  };
  stackChildren.unshift('layer-stack-icon');
  elements['layer-stack'] = {
    type: 'Stack',
    props: { direction: 'horizontal', gap: 6, align: 'center' },
    children: stackChildren,
  };

  rootChildren.push('divider-layers');
  elements['divider-layers'] = { type: 'Divider', props: {} };

  // ── Group bindings by layer ──
  const groups = new Map<string, BindingData[]>();
  for (const b of state.bindings) {
    let list = groups.get(b.layer);
    if (!list) { list = []; groups.set(b.layer, list); }
    list.push(b);
  }

  // Sort: active first, then alphabetical
  const activeSet = new Set(state.activeLayers);
  const sortedLayers = [...groups.keys()].sort((a, b) => {
    const aA = activeSet.has(a), bA = activeSet.has(b);
    if (aA !== bA) return aA ? -1 : 1;
    if (aA && bA) return state.activeLayers.indexOf(a) - state.activeLayers.indexOf(b);
    return a.localeCompare(b);
  });

  // ── Layer cards ──
  if (sortedLayers.length === 0) {
    rootChildren.push('empty');
    elements['empty'] = {
      type: 'Stack',
      props: { direction: 'horizontal', gap: 8, align: 'center' },
      children: ['empty-icon', 'empty-text'],
    };
    elements['empty-icon'] = {
      type: 'Icon',
      props: { name: 'ph:plugs-connected-duotone', size: 16 },
    };
    elements['empty-text'] = {
      type: 'Text',
      props: { content: 'No bindings registered. Click "Connect Hotter Keys" to start capturing.', variant: 'caption' },
    };
  }

  for (const layer of sortedLayers) {
    const bindings = groups.get(layer)!;
    const active = activeSet.has(layer);
    const cardId = `layer-${layer}`;
    const headerRowId = `${cardId}-header`;
    const badgeId = `${cardId}-badge`;
    const statusId = `${cardId}-status`;
    const listId = `${cardId}-list`;

    rootChildren.push(cardId);

    const iconId = `${cardId}-icon`;
    const headerChildren = [iconId, badgeId, statusId];

    elements[iconId] = {
      type: 'Icon',
      props: {
        name: active ? 'ph:check-circle-duotone' : 'ph:circle-dashed',
        size: 16,
      },
    };
    elements[headerRowId] = {
      type: 'Stack',
      props: { direction: 'horizontal', gap: 8, align: 'center' },
      children: headerChildren,
    };
    elements[badgeId] = {
      type: 'Badge',
      props: {
        text: layer,
        variant: active ? 'success' : 'default',
      },
    };
    elements[statusId] = {
      type: 'Text',
      props: { content: active ? 'active' : 'inactive', variant: 'caption' },
    };

    // Binding rows as a table
    const rows = bindings.map((b) => ({
      shortcut: b.formatted,
      scope: b.scope ?? '\u2014',
    }));

    elements[listId] = {
      type: 'DataTable',
      props: {
        columns: [
          { key: 'shortcut', label: 'Shortcut' },
          { key: 'scope', label: 'Scope', width: '100px' },
        ],
        rows,
      },
    };

    const cardContentId = `${cardId}-content`;
    elements[cardContentId] = {
      type: 'Stack',
      props: { direction: 'vertical', gap: 4 },
      children: [headerRowId, listId],
    };

    elements[cardId] = {
      type: 'Card',
      props: {
        title: active
          ? `${layer} \u2014 active (${bindings.length})`
          : `${layer} \u2014 inactive (${bindings.length})`,
        collapsible: true,
      },
      children: [cardContentId],
    };
  }

  // ── Recent fired shortcuts ──
  if (state.firedLog.length > 0) {
    rootChildren.push('divider1', 'fired-card');
    elements['divider1'] = { type: 'Divider', props: {} };

    const firedRows = state.firedLog.slice(-20).reverse().map((e) => ({
      shortcut: e.shortcut,
      layer: e.layer,
      time: new Date(e.timestamp).toLocaleTimeString(),
    }));

    elements['fired-table'] = {
      type: 'DataTable',
      props: {
        columns: [
          { key: 'shortcut', label: 'Shortcut' },
          { key: 'layer', label: 'Layer', width: '80px' },
          { key: 'time', label: 'Time', width: '100px' },
        ],
        rows: firedRows,
        maxHeight: '200px',
      },
    };
    elements['fired-card'] = {
      type: 'Card',
      props: { title: `Recent Events (${state.firedLog.length})`, collapsible: true },
      children: ['fired-table'],
    };
  }

  elements['root'] = {
    type: 'Stack',
    props: { direction: 'vertical', gap: 12, padding: 4 },
    children: rootChildren,
  };

  return { root: 'root', elements };
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export function hotterKeysViteDevtools(): PluginWithDevTools {
  return {
    name: 'hotter-keys-vite-devtools',
    apply: 'serve',

    // Auto-inject client script to set up sentinel and push state to panel
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          attrs: { type: 'module' },
          children: `import '/@fs/${normalize(clientScript)}';`,
          injectTo: 'body',
        },
      ];
    },

    devtools: {
      setup(context) {
        let panelState: PanelState = { bindings: [], activeLayers: ['global'], firedLog: [] };
        const ui = context.createJsonRenderer(buildSpec(panelState));

        function refresh() {
          const total = panelState.bindings.length;
          ui.updateSpec(buildSpec(panelState));
          context.docks.update({
            id: 'hotter-keys',
            type: 'json-render',
            title: 'Hotter Keys',
            icon: 'ph:keyboard-duotone',
            ui,
            badge: total > 0 ? String(total) : undefined,
          });
        }

        context.docks.register({
          type: 'json-render',
          id: 'hotter-keys',
          title: 'Hotter Keys',
          icon: 'ph:keyboard-duotone',
          category: 'app',
          ui,
        });

        // RPC: receive state updates from the client
        context.rpc.register(defineRpcFunction({
          name: 'hotter-keys:update-state',
          type: 'action',
          setup: () => ({
            handler: async (data: PanelState) => {
              panelState = data;
              refresh();
            },
          }),
        }));

        context.rpc.register(defineRpcFunction({
          name: 'hotter-keys:refresh',
          type: 'action',
          setup: () => ({
            handler: async () => {
              refresh();
            },
          }),
        }));

        let firedCount = 0;

        context.rpc.register(defineRpcFunction({
          name: 'hotter-keys:on-fired',
          type: 'action',
          setup: (ctx) => ({
            handler: async (data: { tag: string; detail: string }) => {
              firedCount++;
              ctx.logs.add({
                id: `hk-fired-${Date.now()}-${firedCount}`,
                message: `${data.tag}: ${data.detail}`,
                level: 'success',
                category: 'hotter-keys',
                notify: true,
                autoDismiss: 3000,
                autoDelete: 30000,
              });
            },
          }),
        }));

        context.logs.add({
          message: 'Hotter Keys devtools active — capturing keyboard shortcuts',
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
