import type { JsonRenderElement, JsonRenderSpec, PluginWithDevTools } from "@vitejs/devtools-kit";
import { defineRpcFunction } from "@vitejs/devtools-kit";
import { fileURLToPath } from "node:url";
import { dirname, resolve, normalize } from "node:path";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientScript = resolve(__dirname, "client", "devtools-action.js");

// ── Settings persistence ─────────────────────────────────────────────────────

interface PersistedSettings {
  notifyOnFired: boolean;
}

const DEFAULTS: PersistedSettings = { notifyOnFired: true };

function settingsPath(cwd: string): string {
  const dir = resolve(cwd, "node_modules", ".cache", "hotter-keys-devtools");
  mkdirSync(dir, { recursive: true });
  return resolve(dir, "settings.json");
}

function loadSettings(cwd: string): PersistedSettings {
  try {
    return {
      ...DEFAULTS,
      ...JSON.parse(readFileSync(settingsPath(cwd), "utf-8")),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings(cwd: string, settings: PersistedSettings): void {
  writeFileSync(settingsPath(cwd), JSON.stringify(settings, null, 2));
}

// ── Spec builder ─────────────────────────────────────────────────────────────

interface BindingData {
  formatted: string;
  layer: string;
  scope?: string;
}

type Tab = "bindings" | "events" | "settings";

interface PanelState {
  bindings: BindingData[];
  activeLayers: string[];
  firedLog: Array<{ shortcut: string; layer: string; scope: string; timestamp: number }>;
  notifyOnFired: boolean;
  activeTab: Tab;
}

function tabBtn(label: string, icon: string, tab: Tab, active: Tab): JsonRenderElement {
  return {
    type: "Button",
    props: {
      label,
      icon,
      variant: active === tab ? "primary" : "ghost",
    },
    on: { press: { action: `hotter-keys:tab:${tab}` } },
  };
}

function buildSpec(state: PanelState): JsonRenderSpec {
  const elements: Record<string, JsonRenderElement> = {};
  const contentChildren: string[] = [];
  const tab = state.activeTab;

  // ── Tabs ──
  elements["tabs"] = {
    type: "Stack",
    props: { direction: "horizontal", gap: 4 },
    children: ["tab-bindings", "tab-events", "tab-settings"],
  };
  elements["tab-bindings"] = tabBtn("Bindings", "ph:list-duotone", "bindings", tab);
  elements["tab-events"] = tabBtn(
    `Events${state.firedLog.length > 0 ? ` (${state.firedLog.length})` : ""}`,
    "ph:lightning-duotone",
    "events",
    tab,
  );
  elements["tab-settings"] = tabBtn("Settings", "ph:gear-duotone", "settings", tab);
  elements["divider0"] = { type: "Divider", props: {} };

  // ── TAB: Bindings ──
  if (tab === "bindings") {
    contentChildren.push("layer-stack");
    const stackChildren: string[] = ["layer-stack-icon", "layer-stack-label"];

    for (let i = 0; i < state.activeLayers.length; i++) {
      const layer = state.activeLayers[i]!;
      const id = `active-layer-${i}`;
      stackChildren.push(id);
      elements[id] = {
        type: "Badge",
        props: { text: `${i + 1}. ${layer}`, variant: "success" },
      };
    }

    elements["layer-stack-icon"] = {
      type: "Icon",
      props: { name: "ph:stack-duotone", size: 16 },
    };
    elements["layer-stack-label"] = {
      type: "Text",
      props: { content: "Layer Stack:", variant: "caption" },
    };
    elements["layer-stack"] = {
      type: "Stack",
      props: { direction: "horizontal", gap: 6, align: "center" },
      children: stackChildren,
    };

    contentChildren.push("divider-layers");
    elements["divider-layers"] = { type: "Divider", props: {} };

    const groups = new Map<string, BindingData[]>();
    for (const b of state.bindings) {
      let list = groups.get(b.layer);
      if (!list) {
        list = [];
        groups.set(b.layer, list);
      }
      list.push(b);
    }

    const activeSet = new Set(state.activeLayers);
    const sortedLayers = [...groups.keys()].sort((a, b) => {
      const aA = activeSet.has(a),
        bA = activeSet.has(b);
      if (aA !== bA) return aA ? -1 : 1;
      if (aA && bA) return state.activeLayers.indexOf(a) - state.activeLayers.indexOf(b);
      return a.localeCompare(b);
    });

    if (sortedLayers.length === 0) {
      contentChildren.push("empty");
      elements["empty"] = {
        type: "Text",
        props: { content: "No bindings registered yet.", variant: "caption" },
      };
    }

    for (const layer of sortedLayers) {
      const bindings = groups.get(layer)!;
      const active = activeSet.has(layer);
      const id = `layer-${layer}`;
      contentChildren.push(id);

      elements[`${id}-icon`] = {
        type: "Icon",
        props: {
          name: active ? "ph:check-circle-duotone" : "ph:circle-dashed",
          size: 16,
        },
      };
      elements[`${id}-badge`] = {
        type: "Badge",
        props: { text: layer, variant: active ? "success" : "default" },
      };
      elements[`${id}-count`] = {
        type: "Text",
        props: { content: `(${bindings.length})`, variant: "caption" },
      };
      elements[`${id}-header`] = {
        type: "Stack",
        props: { direction: "horizontal", gap: 8, align: "center" },
        children: [`${id}-icon`, `${id}-badge`, `${id}-count`],
      };
      elements[`${id}-list`] = {
        type: "DataTable",
        props: {
          columns: [
            { key: "shortcut", label: "Shortcut" },
            { key: "scope", label: "Scope", width: "100px" },
          ],
          rows: bindings.map((b) => ({
            shortcut: b.formatted,
            scope: b.scope ?? "\u2014",
          })),
        },
      };
      elements[id] = {
        type: "Stack",
        props: { direction: "vertical", gap: 4 },
        children: [`${id}-header`, `${id}-list`],
      };
    }
  }

  // ── TAB: Events ──
  if (tab === "events") {
    if (state.firedLog.length === 0) {
      contentChildren.push("events-empty");
      elements["events-empty"] = {
        type: "Text",
        props: {
          content: "No events captured yet. Press a shortcut in the app.",
          variant: "caption",
        },
      };
    } else {
      contentChildren.push("events-table");
      elements["events-table"] = {
        type: "DataTable",
        props: {
          columns: [
            { key: "shortcut", label: "Shortcut" },
            { key: "layer", label: "Layer", width: "80px" },
            { key: "scope", label: "Scope", width: "100px" },
            { key: "time", label: "Time", width: "100px" },
          ],
          rows: state.firedLog
            .slice(-50)
            .reverse()
            .map((e) => ({
              shortcut: e.shortcut,
              layer: e.layer,
              scope: e.scope,
              time: new Date(e.timestamp).toLocaleTimeString(),
            })),
          maxHeight: "400px",
        },
      };
    }
  }

  // ── TAB: Settings ──
  if (tab === "settings") {
    contentChildren.push("settings-notify");
    elements["settings-notify"] = {
      type: "Stack",
      props: {
        direction: "horizontal",
        gap: 8,
        align: "center",
        justify: "space-between",
      },
      children: ["notify-label", "notify-toggle"],
    };
    elements["notify-label"] = {
      type: "Text",
      props: {
        content: "Show notifications on fired shortcuts",
        variant: "body",
      },
    };
    elements["notify-toggle"] = {
      type: "Button",
      props: {
        label: state.notifyOnFired ? "On" : "Off",
        variant: state.notifyOnFired ? "primary" : "ghost",
        icon: state.notifyOnFired ? "ph:bell-ringing" : "ph:bell-slash",
      },
      on: { press: { action: "hotter-keys:toggle-notify" } },
    };
  }

  // ── Root ──
  elements["content"] = {
    type: "Stack",
    props: { direction: "vertical", gap: 12 },
    children: contentChildren,
  };
  elements["root"] = {
    type: "Stack",
    props: { direction: "vertical", gap: 8, padding: 4 },
    children: ["tabs", "divider0", "content"],
  };

  return { root: "root", elements };
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export function hotterKeysViteDevtools(): PluginWithDevTools {
  return {
    name: "hotter-keys-vite-devtools",
    apply: "serve",

    transformIndexHtml() {
      return [
        {
          tag: "script",
          attrs: { type: "module" },
          children: `import '/@fs/${normalize(clientScript)}';`,
          injectTo: "body",
        },
      ];
    },

    devtools: {
      setup(context) {
        const settings = loadSettings(context.cwd);
        let notifyOnFired = settings.notifyOnFired;
        let activeTab: Tab = "bindings";
        let panelState: PanelState = {
          bindings: [],
          activeLayers: ["global"],
          firedLog: [],
          notifyOnFired,
          activeTab,
        };
        const ui = context.createJsonRenderer(buildSpec(panelState));

        function refresh() {
          panelState = { ...panelState, notifyOnFired, activeTab };
          const total = panelState.bindings.length;
          void ui.updateSpec(buildSpec(panelState));
          context.docks.update({
            id: "hotter-keys",
            type: "json-render",
            title: "Hotter Keys",
            icon: "ph:keyboard-duotone",
            ui,
            badge: total > 0 ? String(total) : undefined,
          });
        }

        context.docks.register({
          type: "json-render",
          id: "hotter-keys",
          title: "Hotter Keys",
          icon: "ph:keyboard-duotone",
          category: "app",
          ui,
        });

        // RPC: receive state from client
        context.rpc.register(
          defineRpcFunction({
            name: "hotter-keys:update-state",
            type: "action",
            setup: () => ({
              handler: async (data: Partial<PanelState>) => {
                panelState = {
                  ...panelState,
                  bindings: data.bindings ?? panelState.bindings,
                  activeLayers: data.activeLayers ?? panelState.activeLayers,
                  firedLog: data.firedLog ?? panelState.firedLog,
                  notifyOnFired,
                  activeTab,
                };
                refresh();
              },
            }),
          }),
        );

        context.rpc.register(
          defineRpcFunction({
            name: "hotter-keys:refresh",
            type: "action",
            setup: () => ({
              handler: async () => {
                refresh();
              },
            }),
          }),
        );

        let firedCount = 0;

        context.rpc.register(
          defineRpcFunction({
            name: "hotter-keys:on-fired",
            type: "action",
            setup: (ctx) => ({
              handler: async (data: { shortcut: string; layer: string; scope?: string }) => {
                firedCount++;
                const labels = [`layer:${data.layer}`];
                if (data.scope) labels.push(`scope:${data.scope}`);
                void ctx.logs.add({
                  id: `hk-fired-${Date.now()}-${firedCount}`,
                  message: `fired: ${data.shortcut}`,
                  level: "success",
                  category: "hotter-keys",
                  labels,
                  notify: notifyOnFired,
                  autoDismiss: notifyOnFired ? 3000 : undefined,
                  autoDelete: 30000,
                });
              },
            }),
          }),
        );

        context.rpc.register(
          defineRpcFunction({
            name: "hotter-keys:toggle-notify",
            type: "action",
            setup: () => ({
              handler: async () => {
                notifyOnFired = !notifyOnFired;
                saveSettings(context.cwd, { notifyOnFired });
                refresh();
              },
            }),
          }),
        );

        for (const t of ["bindings", "events", "settings"] as Tab[]) {
          context.rpc.register(
            defineRpcFunction({
              name: `hotter-keys:tab:${t}`,
              type: "action",
              setup: () => ({
                handler: async () => {
                  activeTab = t;
                  refresh();
                },
              }),
            }),
          );
        }

        void context.logs.add({
          message: "Hotter Keys devtools active — capturing keyboard shortcuts",
          level: "info",
          notify: true,
          autoDismiss: 3000,
          autoDelete: 10000,
          category: "hotter-keys",
        });
      },
    },
  };
}
