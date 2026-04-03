import { createSignal, onCleanup, onMount, For, Show } from "solid-js";
import { createHotkeys, formatSequence, parseSequence, isMac } from "@hotter-keys/core";
import type { Hotkeys } from "@hotter-keys/core";
import "../styles/demo.css";
import styles from "./CommandBarDemo.module.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LogEntry {
  id: number;
  time: string;
  text: string;
  type: "global" | "commandbar" | "layer";
}

interface ActionRow {
  key: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const GLOBAL_SHORTCUTS: ActionRow[] = [
  { key: "mod+k", label: "Open Command Bar" },
  { key: "mod+s", label: "Save" },
  { key: "mod+p", label: "Quick Open" },
];

const COMMANDBAR_ACTIONS: ActionRow[] = [
  { key: "1", label: "Go to File" },
  { key: "2", label: "Go to Symbol" },
  { key: "3", label: "Toggle Terminal" },
  { key: "4", label: "Open Settings" },
  { key: "5", label: "Run Task" },
];

function comboLabel(combo: string): string {
  const mac = isMac();
  return formatSequence(parseSequence(combo, { mac }), mac);
}

const LOG_BADGE_CLASS: Record<string, string> = {
  global: "badge badge-green",
  commandbar: "badge badge-blue",
  layer: "badge badge-purple",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

let logId = 0;

export default function CommandBarDemo() {
  const [layers, setLayers] = createSignal<readonly string[]>(["global"]);
  const [commandBarOpen, setCommandBarOpen] = createSignal(false);
  const [firedGlobal, setFiredGlobal] = createSignal<Record<string, number>>({});
  const [firedCmd, setFiredCmd] = createSignal<Record<string, number>>({});
  const [eventLog, setEventLog] = createSignal<LogEntry[]>([]);

  let containerRef!: HTMLDivElement;
  let hk: Hotkeys;

  const now = () => {
    const d = new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map((n) => String(n).padStart(2, "0"))
      .join(":");
  };

  const pushLog = (text: string, type: LogEntry["type"]) => {
    setEventLog((prev) => [{ id: ++logId, time: now(), text, type }, ...prev].slice(0, 30));
  };

  const flash = (setter: typeof setFiredGlobal, key: string) => {
    setter((prev) => ({ ...prev, [key]: Date.now() }));
    setTimeout(() => {
      setter((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, 600);
  };

  const openCommandBar = () => {
    if (commandBarOpen()) return;
    hk.pushLayer("commandbar");
    setCommandBarOpen(true);
    pushLog("Command bar opened", "layer");
  };

  const closeCommandBar = () => {
    if (!commandBarOpen()) return;
    hk.popLayer("commandbar");
    setCommandBarOpen(false);
    pushLog("Command bar closed", "layer");
  };

  onMount(() => {
    hk = createHotkeys({ target: document });
    hk.onLayerChange((l) => setLayers(l));

    hk.add("mod+k", () => {
      flash(setFiredGlobal, "mod+k");
      openCommandBar();
      pushLog(`${comboLabel("mod+k")} — Open Command Bar`, "global");
    });
    hk.add("mod+s", () => {
      flash(setFiredGlobal, "mod+s");
      pushLog(`${comboLabel("mod+s")} — Save`, "global");
    });
    hk.add("mod+p", () => {
      flash(setFiredGlobal, "mod+p");
      pushLog(`${comboLabel("mod+p")} — Quick Open`, "global");
    });

    for (const action of COMMANDBAR_ACTIONS) {
      hk.add(action.key, () => {
        flash(setFiredCmd, action.key);
        pushLog(`${action.key} — ${action.label}`, "commandbar");
        closeCommandBar();
      }, { layer: "commandbar", preventDefault: false });
    }

    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && commandBarOpen()) {
        e.preventDefault();
        closeCommandBar();
      }
    };
    document.addEventListener("keydown", onEscape);

    const suppress = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && ["k", "s", "p"].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", suppress, { capture: true });

    onCleanup(() => {
      hk.destroy();
      document.removeEventListener("keydown", onEscape);
      document.removeEventListener("keydown", suppress, { capture: true });
    });
  });

  return (
    <div ref={containerRef} class="demo" style={{ position: "relative" }}>
      <p class="demo-hint">
        Press <kbd class="kbd">{comboLabel("mod+k")}</kbd> to open the command bar.
        Try <kbd class="kbd">{comboLabel("mod+s")}</kbd> and <kbd class="kbd">{comboLabel("mod+p")}</kbd> as global shortcuts.
      </p>

      {/* ---- GLOBAL SHORTCUTS ---- */}
      <div class="section">
        <h4 class="section-title">Global Shortcuts</h4>
        <div class="stack">
          <For each={GLOBAL_SHORTCUTS}>
            {(s) => {
              const fired = () => s.key in firedGlobal();
              return (
                <div class={`row ${fired() ? "row-fired-green" : ""}`}>
                  <span>
                    <kbd class="kbd">{comboLabel(s.key)}</kbd>{" "}
                    <span class="row-desc">{s.label}</span>
                  </span>
                  <Show when={fired()}>
                    <span class="badge badge-green">FIRED</span>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      {/* ---- COMMAND BAR OVERLAY ---- */}
      <Show when={commandBarOpen()}>
        <div class={styles.overlay}>
          <div class={styles.overlayHeader}>
            <span class={styles.overlayTitle}>Command Bar</span>
            <span class={styles.overlayHint}>Esc to close</span>
          </div>
          <div class="stack">
            <For each={COMMANDBAR_ACTIONS}>
              {(action) => {
                const fired = () => action.key in firedCmd();
                return (
                  <div class={`row ${fired() ? "row-fired-blue" : ""}`}>
                    <span>
                      <kbd class={`kbd kbd-accent ${styles.actionKey}`}>{action.key}</kbd>{" "}
                      <span class="row-desc">{action.label}</span>
                    </span>
                    <Show when={fired()}>
                      <span class="badge badge-blue">FIRED</span>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </Show>

      {/* ---- LAYER VISUALIZER ---- */}
      <div class="section">
        <h4 class="section-title">Layer Stack</h4>
        <div class="stack" style={{ "flex-direction": "column-reverse" }}>
          <For each={[...layers()]}>
            {(layer) => {
              const isActive = () => layer === layers()[layers().length - 1];
              const layerShortcuts = () =>
                layer === "commandbar"
                  ? COMMANDBAR_ACTIONS.map((a) => `${a.key}: ${a.label}`)
                  : GLOBAL_SHORTCUTS.map((s) => `${comboLabel(s.key)}: ${s.label}`);
              return (
                <div class={`${styles.layerBlock} ${isActive() ? styles.layerBlockActive : ""}`}>
                  <div style={{ display: "flex", "align-items": "center", gap: "0.5rem", "margin-bottom": "0.3rem" }}>
                    <span class={styles.layerName}>{layer}</span>
                    <Show when={isActive()}>
                      <span class="badge badge-accent">ACTIVE</span>
                    </Show>
                  </div>
                  <div class={styles.layerShortcuts}>
                    <For each={layerShortcuts()}>
                      {(s) => <span class={styles.layerShortcut}>{s}</span>}
                    </For>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      {/* ---- EVENT LOG ---- */}
      <div class="section">
        <div class="section-header">
          <h4 class="section-title">Event Log</h4>
          <button onClick={() => setEventLog([])} class="btn-sm">Clear</button>
        </div>
        <div class="log-scroll">
          <Show
            when={eventLog().length > 0}
            fallback={<span class="muted">No events yet</span>}
          >
            <For each={eventLog()}>
              {(entry) => (
                <div class="log-entry">
                  <span class="log-time">{entry.time}</span>{" "}
                  <span class={`${LOG_BADGE_CLASS[entry.type]} log-badge`}>{entry.type}</span>
                  {entry.text}
                </div>
              )}
            </For>
          </Show>
        </div>
      </div>
    </div>
  );
}
