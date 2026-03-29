import { createSignal, onCleanup, onMount, For, Show } from "solid-js";
import { createHotkeys } from "hotter-keys";
import type { Hotkeys } from "hotter-keys";

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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const SECTION: Record<string, string> = {
  border: "1px solid var(--sl-color-gray-5)",
  "border-radius": "0.5rem",
  padding: "1rem",
  "margin-bottom": "1.5rem",
};

const MONO: Record<string, string> = {
  "font-family": "var(--sl-font-mono, monospace)",
  "font-size": "0.8125rem",
};

const KBD: Record<string, string> = {
  display: "inline-block",
  padding: "0.15rem 0.4rem",
  background: "var(--sl-color-gray-6)",
  "border-radius": "0.2rem",
  "font-family": "var(--sl-font-mono, monospace)",
  "font-size": "0.8rem",
  "line-height": "1.4",
  "white-space": "nowrap",
};

const BADGE_BASE: Record<string, string> = {
  display: "inline-block",
  padding: "0.1rem 0.4rem",
  "border-radius": "0.2rem",
  "font-size": "0.7rem",
  "font-weight": "700",
  "text-transform": "uppercase",
  "letter-spacing": "0.04em",
};

const SMALL_BTN: Record<string, string> = {
  padding: "0.15rem 0.4rem",
  "border-radius": "0.2rem",
  border: "1px solid var(--sl-color-gray-5)",
  background: "var(--sl-color-bg-nav)",
  color: "var(--sl-color-gray-3)",
  cursor: "pointer",
  "font-family": "var(--sl-font-mono, monospace)",
  "font-size": "0.65rem",
  "white-space": "nowrap",
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
    hk = createHotkeys({ target: containerRef });

    // Track layer changes
    hk.onLayerChange((l) => setLayers(l));

    // Global shortcuts
    hk.add("mod+k", () => {
      flash(setFiredGlobal, "mod+k");
      openCommandBar();
      pushLog("Mod+K — Open Command Bar", "global");
    });
    hk.add("mod+s", () => {
      flash(setFiredGlobal, "mod+s");
      pushLog("Mod+S — Save", "global");
    });
    hk.add("mod+p", () => {
      flash(setFiredGlobal, "mod+p");
      pushLog("Mod+P — Quick Open", "global");
    });

    // CommandBar shortcuts (only active when commandbar layer is pushed)
    for (const action of COMMANDBAR_ACTIONS) {
      hk.add(action.key, () => {
        flash(setFiredCmd, action.key);
        pushLog(`${action.key} — ${action.label}`, "commandbar");
        closeCommandBar();
      }, { layer: "commandbar", preventDefault: false });
    }

    // Escape to close (not a-z/0-9, so handle via raw keydown)
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && commandBarOpen()) {
        e.preventDefault();
        closeCommandBar();
      }
    };
    containerRef.addEventListener("keydown", onEscape);

    // Suppress browser shortcuts when focused
    const suppress = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && ["k", "s", "p"].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };
    containerRef.addEventListener("keydown", suppress, { capture: true });

    onCleanup(() => {
      hk.destroy();
      containerRef.removeEventListener("keydown", onEscape);
      containerRef.removeEventListener("keydown", suppress, { capture: true });
    });
  });

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      style={{ ...MONO, outline: "none", cursor: "default", position: "relative" }}
    >
      <p style={{ "font-size": "0.8rem", color: "var(--sl-color-gray-3)", "margin-top": "0" }}>
        Click here to focus, then press <kbd style={KBD}>Mod+K</kbd> to open the command bar.
        Try <kbd style={KBD}>Mod+S</kbd> and <kbd style={KBD}>Mod+P</kbd> as global shortcuts.
      </p>

      {/* ---- GLOBAL SHORTCUTS ---- */}
      <div style={SECTION}>
        <h4 style={{ margin: "0 0 0.75rem", "font-size": "0.9rem" }}>Global Shortcuts</h4>
        <div style={{ display: "flex", "flex-direction": "column", gap: "0.4rem" }}>
          <For each={GLOBAL_SHORTCUTS}>
            {(s) => {
              const fired = () => s.key in firedGlobal();
              return (
                <div
                  style={{
                    display: "flex",
                    "align-items": "center",
                    "justify-content": "space-between",
                    padding: "0.35rem 0.5rem",
                    "border-radius": "0.25rem",
                    background: fired() ? "rgba(34,197,94,0.15)" : "var(--sl-color-gray-6)",
                    transition: "background 0.15s",
                  }}
                >
                  <span>
                    <kbd style={KBD}>{s.key.replace("mod+", "Mod+").toUpperCase()}</kbd>{" "}
                    <span style={{ color: "var(--sl-color-gray-3)", "font-size": "0.75rem" }}>{s.label}</span>
                  </span>
                  <Show when={fired()}>
                    <span style={{ ...BADGE_BASE, background: "#22c55e", color: "#000" }}>FIRED</span>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      {/* ---- COMMAND BAR OVERLAY ---- */}
      <Show when={commandBarOpen()}>
        <div
          style={{
            position: "absolute",
            top: "0",
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(24rem, 90%)",
            "z-index": "10",
            background: "var(--sl-color-bg-nav)",
            border: "1px solid var(--sl-color-accent)",
            "border-radius": "0.5rem",
            padding: "0.75rem",
            "box-shadow": "0 8px 32px rgba(0,0,0,0.3)",
            "margin-top": "0.5rem",
          }}
        >
          <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "0.5rem" }}>
            <span style={{ "font-weight": "700", "font-size": "0.85rem" }}>Command Bar</span>
            <span style={{ color: "var(--sl-color-gray-4)", "font-size": "0.7rem" }}>
              Esc to close
            </span>
          </div>
          <div style={{ display: "flex", "flex-direction": "column", gap: "0.3rem" }}>
            <For each={COMMANDBAR_ACTIONS}>
              {(action) => {
                const fired = () => action.key in firedCmd();
                return (
                  <div
                    style={{
                      display: "flex",
                      "align-items": "center",
                      "justify-content": "space-between",
                      padding: "0.35rem 0.5rem",
                      "border-radius": "0.25rem",
                      background: fired() ? "rgba(59,130,246,0.2)" : "var(--sl-color-gray-6)",
                      transition: "background 0.15s",
                    }}
                  >
                    <span>
                      <kbd style={{ ...KBD, background: "var(--sl-color-accent)", color: "var(--sl-color-accent-high)", "min-width": "1.2rem", "text-align": "center" }}>
                        {action.key}
                      </kbd>{" "}
                      <span style={{ color: "var(--sl-color-gray-3)", "font-size": "0.75rem" }}>{action.label}</span>
                    </span>
                    <Show when={fired()}>
                      <span style={{ ...BADGE_BASE, background: "#3b82f6", color: "#fff" }}>FIRED</span>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </Show>

      {/* ---- LAYER VISUALIZER ---- */}
      <div style={SECTION}>
        <h4 style={{ margin: "0 0 0.75rem", "font-size": "0.9rem" }}>Layer Stack</h4>
        <div style={{ display: "flex", "flex-direction": "column-reverse", gap: "0.4rem" }}>
          <For each={[...layers()]}>
            {(layer) => {
              const isActive = () => layer === layers()[layers().length - 1];
              const shortcuts = () =>
                layer === "commandbar"
                  ? COMMANDBAR_ACTIONS.map((a) => `${a.key}: ${a.label}`)
                  : GLOBAL_SHORTCUTS.map((s) => `${s.key.replace("mod+", "Mod+").toUpperCase()}: ${s.label}`);
              return (
                <div
                  style={{
                    padding: "0.5rem 0.75rem",
                    "border-radius": "0.25rem",
                    border: isActive()
                      ? "1px solid var(--sl-color-accent)"
                      : "1px solid var(--sl-color-gray-5)",
                    background: isActive()
                      ? "rgba(var(--sl-color-accent-rgb, 59,130,246), 0.08)"
                      : "var(--sl-color-gray-6)",
                    opacity: isActive() ? "1" : "0.6",
                    transition: "all 0.2s",
                  }}
                >
                  <div style={{ display: "flex", "align-items": "center", gap: "0.5rem", "margin-bottom": "0.3rem" }}>
                    <span style={{ "font-weight": "700", "font-size": "0.8rem" }}>{layer}</span>
                    <Show when={isActive()}>
                      <span style={{ ...BADGE_BASE, background: "var(--sl-color-accent)", color: "var(--sl-color-accent-high)" }}>
                        ACTIVE
                      </span>
                    </Show>
                  </div>
                  <div style={{ display: "flex", "flex-wrap": "wrap", gap: "0.25rem" }}>
                    <For each={shortcuts()}>
                      {(s) => (
                        <span style={{ "font-size": "0.7rem", color: "var(--sl-color-gray-3)" }}>{s}</span>
                      )}
                    </For>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      {/* ---- EVENT LOG ---- */}
      <div style={SECTION}>
        <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "0.75rem" }}>
          <h4 style={{ margin: "0", "font-size": "0.9rem" }}>Event Log</h4>
          <button onClick={() => setEventLog([])} style={SMALL_BTN}>Clear</button>
        </div>
        <div style={{ "max-height": "10rem", "overflow-y": "auto" }}>
          <Show
            when={eventLog().length > 0}
            fallback={<span style={{ color: "var(--sl-color-gray-4)" }}>No events yet</span>}
          >
            <For each={eventLog()}>
              {(entry) => {
                const color = entry.type === "global" ? "#22c55e" : entry.type === "commandbar" ? "#3b82f6" : "#a855f7";
                return (
                  <div style={{ padding: "0.15rem 0", "border-bottom": "1px solid var(--sl-color-gray-6)" }}>
                    <span style={{ color: "var(--sl-color-gray-4)" }}>{entry.time}</span>{" "}
                    <span style={{ ...BADGE_BASE, background: color, color: entry.type === "commandbar" ? "#fff" : "#000", "margin-right": "0.3rem" }}>
                      {entry.type}
                    </span>
                    {entry.text}
                  </div>
                );
              }}
            </For>
          </Show>
        </div>
      </div>
    </div>
  );
}
