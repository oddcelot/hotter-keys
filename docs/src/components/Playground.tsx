import { createSignal, onCleanup, onMount, For, Show } from "solid-js";
import { createHotkeys, recordShortcut, formatShortcut } from "hotter-keys";
import type { RecordedShortcut } from "hotter-keys";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LogEntry {
  id: number;
  time: string;
  text: string;
  type: "shortcut" | "sequence" | "record";
}

interface ShortcutRow {
  label: string;
  combo: string;
  description: string;
}

interface RawEvent {
  key: string;
  code: string;
  keyCode: number;
  which: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  repeat: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SHORTCUTS: ShortcutRow[] = [
  { label: "Ctrl+K", combo: "ctrl+k", description: "Command palette" },
  { label: "Ctrl+S", combo: "ctrl+s", description: "Save" },
  { label: "Ctrl+Shift+P", combo: "ctrl+shift+p", description: "Quick open" },
  { label: "Meta+B", combo: "meta+b", description: "Toggle sidebar" },
  { label: "Ctrl+J", combo: "ctrl+j", description: "Toggle panel" },
  { label: "Ctrl+D", combo: "ctrl+d", description: "Select word" },
];

const SEQUENCES: ShortcutRow[] = [
  { label: "Ctrl+K Ctrl+C", combo: "ctrl+k ctrl+c", description: "Comment block" },
  { label: "Ctrl+K Ctrl+U", combo: "ctrl+k ctrl+u", description: "Uncomment block" },
  { label: "Ctrl+K Ctrl+S", combo: "ctrl+k ctrl+s", description: "Save all" },
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

let logId = 0;

export default function Playground() {
  // --- Shared state ---
  const [heldKeys, setHeldKeys] = createSignal<readonly string[]>([]);
  const [shiftHeld, setShiftHeld] = createSignal(false);
  const [firedShortcuts, setFiredShortcuts] = createSignal<Record<string, number>>({});
  const [firedSequences, setFiredSequences] = createSignal<Record<string, number>>({});
  const [eventLog, setEventLog] = createSignal<LogEntry[]>([]);
  const [rawEvent, setRawEvent] = createSignal<RawEvent | null>(null);
  const [recording, setRecording] = createSignal(false);
  const [recorded, setRecorded] = createSignal<RecordedShortcut | null>(null);

  let containerRef!: HTMLDivElement;

  const now = () => {
    const d = new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map((n) => String(n).padStart(2, "0"))
      .join(":");
  };

  const pushLog = (text: string, type: LogEntry["type"]) => {
    setEventLog((prev) => [{ id: ++logId, time: now(), text, type }, ...prev].slice(0, 50));
  };

  const flash = (
    setter: typeof setFiredShortcuts,
    combo: string,
  ) => {
    setter((prev) => ({ ...prev, [combo]: Date.now() }));
    setTimeout(() => {
      setter((prev) => {
        const next = { ...prev };
        delete next[combo];
        return next;
      });
    }, 600);
  };

  // --- Raw event capture (separate listener so it captures everything including alt) ---
  const captureRaw = (e: Event) => {
    const ev = e as KeyboardEvent;
    if (typeof ev.key !== "string") return;
    setRawEvent({
      key: ev.key,
      code: ev.code,
      keyCode: ev.keyCode,
      which: ev.which,
      ctrlKey: ev.ctrlKey,
      shiftKey: ev.shiftKey,
      metaKey: ev.metaKey,
      altKey: ev.altKey,
      repeat: ev.repeat,
    });
  };

  onMount(() => {
    const hk = createHotkeys({ target: containerRef });

    // Held keys
    hk.onHeldKeysChange((keys) => setHeldKeys(keys));
    hk.onKeyHold("shift", (held) => setShiftHeld(held));

    // Single-chord shortcuts
    for (const s of SHORTCUTS) {
      hk.add(s.combo, () => {
        flash(setFiredShortcuts, s.combo);
        pushLog(`${s.label} — ${s.description}`, "shortcut");
      });
    }

    // Sequences
    for (const s of SEQUENCES) {
      hk.add(s.combo, () => {
        flash(setFiredSequences, s.combo);
        pushLog(`${s.label} — ${s.description}`, "sequence");
      });
    }

    // Raw event capture
    containerRef.addEventListener("keydown", captureRaw);

    onCleanup(() => {
      hk.destroy();
      containerRef.removeEventListener("keydown", captureRaw);
    });
  });

  // --- Record shortcut ---
  const doRecord = async () => {
    setRecording(true);
    setRecorded(null);
    try {
      const result = await recordShortcut(containerRef);
      setRecorded(result);
      if (result.safe) {
        pushLog(`Recorded: ${formatShortcut(result)}`, "record");
      } else {
        pushLog(`Recorded (unsafe): ${result.unsafeReason}`, "record");
      }
    } finally {
      setRecording(false);
    }
  };

  // --- Render ---
  return (
    <div
      ref={containerRef}
      tabIndex={0}
      style={{
        ...MONO,
        outline: "none",
        cursor: "default",
      }}
    >
      <p style={{ "font-size": "0.8rem", color: "var(--sl-color-gray-3)", "margin-top": "0" }}>
        Click anywhere in the playground to focus, then start pressing keys.
      </p>

      {/* ---- HELD KEYS ---- */}
      <div style={SECTION}>
        <h4 style={{ margin: "0 0 0.75rem", "font-size": "0.9rem" }}>Held Keys</h4>
        <div style={{ display: "flex", "align-items": "center", gap: "0.5rem", "flex-wrap": "wrap", "min-height": "2rem" }}>
          <Show
            when={heldKeys().length > 0}
            fallback={<span style={{ color: "var(--sl-color-gray-4)" }}>No keys held</span>}
          >
            <For each={[...heldKeys()]}>
              {(key) => (
                <kbd style={{ ...KBD, background: "var(--sl-color-accent)", color: "var(--sl-color-accent-high)" }}>
                  {key}
                </kbd>
              )}
            </For>
          </Show>
          <Show when={shiftHeld()}>
            <span style={{
              ...BADGE_BASE,
              background: "#f59e0b",
              color: "#000",
              "margin-left": "auto",
            }}>
              SHIFT HELD ALONE
            </span>
          </Show>
        </div>
      </div>

      {/* ---- SHORTCUTS ---- */}
      <div style={SECTION}>
        <h4 style={{ margin: "0 0 0.75rem", "font-size": "0.9rem" }}>Shortcuts</h4>
        <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "0.4rem" }}>
          <For each={SHORTCUTS}>
            {(s) => {
              const fired = () => s.combo in firedShortcuts();
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
                    <kbd style={KBD}>{s.label}</kbd>{" "}
                    <span style={{ color: "var(--sl-color-gray-3)", "font-size": "0.75rem" }}>{s.description}</span>
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

      {/* ---- SEQUENCES ---- */}
      <div style={SECTION}>
        <h4 style={{ margin: "0 0 0.75rem", "font-size": "0.9rem" }}>Sequences</h4>
        <p style={{ "font-size": "0.75rem", color: "var(--sl-color-gray-3)", margin: "0 0 0.5rem" }}>
          Press the first chord, then the second within 1 second.
        </p>
        <div style={{ display: "flex", "flex-direction": "column", gap: "0.4rem" }}>
          <For each={SEQUENCES}>
            {(s) => {
              const fired = () => s.combo in firedSequences();
              return (
                <div
                  style={{
                    display: "flex",
                    "align-items": "center",
                    "justify-content": "space-between",
                    padding: "0.35rem 0.5rem",
                    "border-radius": "0.25rem",
                    background: fired() ? "rgba(59,130,246,0.15)" : "var(--sl-color-gray-6)",
                    transition: "background 0.15s",
                  }}
                >
                  <span>
                    <kbd style={KBD}>{s.label}</kbd>{" "}
                    <span style={{ color: "var(--sl-color-gray-3)", "font-size": "0.75rem" }}>{s.description}</span>
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

      {/* ---- KEY RECORDER ---- */}
      <div style={SECTION}>
        <h4 style={{ margin: "0 0 0.75rem", "font-size": "0.9rem" }}>Key Recorder</h4>
        <div style={{ display: "flex", "align-items": "center", gap: "1rem", "flex-wrap": "wrap" }}>
          <button
            onClick={doRecord}
            disabled={recording()}
            style={{
              padding: "0.4rem 0.75rem",
              "border-radius": "0.25rem",
              border: "1px solid var(--sl-color-gray-5)",
              background: recording() ? "var(--sl-color-accent)" : "var(--sl-color-bg-nav)",
              color: recording() ? "var(--sl-color-accent-high)" : "var(--sl-color-white)",
              cursor: recording() ? "default" : "pointer",
              "font-family": "inherit",
              "font-size": "0.8rem",
            }}
          >
            {recording() ? "Press any key\u2026" : "Record Shortcut"}
          </button>
          <Show when={recorded()}>
            {(r) => (
              <Show
                when={r().safe}
                fallback={
                  <span style={{ color: "#ef4444" }}>
                    <span style={{ ...BADGE_BASE, background: "#ef4444", color: "#fff", "margin-right": "0.4rem" }}>UNSAFE</span>
                    {r().unsafeReason}
                  </span>
                }
              >
                <span>
                  <span style={{ ...BADGE_BASE, background: "#22c55e", color: "#000", "margin-right": "0.4rem" }}>SAFE</span>
                  <kbd style={KBD}>{formatShortcut(r())}</kbd>
                </span>
              </Show>
            )}
          </Show>
        </div>
      </div>

      {/* ---- EVENT LOG ---- */}
      <div style={SECTION}>
        <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "0.75rem" }}>
          <h4 style={{ margin: "0", "font-size": "0.9rem" }}>Event Log</h4>
          <button
            onClick={() => setEventLog([])}
            style={{
              padding: "0.2rem 0.5rem",
              "border-radius": "0.2rem",
              border: "1px solid var(--sl-color-gray-5)",
              background: "var(--sl-color-bg-nav)",
              color: "var(--sl-color-gray-3)",
              cursor: "pointer",
              "font-family": "inherit",
              "font-size": "0.7rem",
            }}
          >
            Clear
          </button>
        </div>
        <div style={{ "max-height": "10rem", "overflow-y": "auto" }}>
          <Show
            when={eventLog().length > 0}
            fallback={<span style={{ color: "var(--sl-color-gray-4)" }}>No events yet</span>}
          >
            <For each={eventLog()}>
              {(entry) => {
                const color = entry.type === "shortcut" ? "#22c55e" : entry.type === "sequence" ? "#3b82f6" : "#a855f7";
                return (
                  <div style={{ padding: "0.15rem 0", "border-bottom": "1px solid var(--sl-color-gray-6)" }}>
                    <span style={{ color: "var(--sl-color-gray-4)" }}>{entry.time}</span>{" "}
                    <span
                      style={{
                        ...BADGE_BASE,
                        background: color,
                        color: entry.type === "sequence" ? "#fff" : "#000",
                        "margin-right": "0.3rem",
                      }}
                    >
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

      {/* ---- RAW EVENT INSPECTOR ---- */}
      <div style={SECTION}>
        <h4 style={{ margin: "0 0 0.75rem", "font-size": "0.9rem" }}>Raw Event Inspector</h4>
        <Show
          when={rawEvent()}
          fallback={<span style={{ color: "var(--sl-color-gray-4)" }}>Press a key to inspect</span>}
        >
          {(ev) => (
            <div style={{ display: "grid", "grid-template-columns": "auto 1fr", gap: "0.2rem 0.75rem", "align-items": "center" }}>
              {/* key - correct */}
              <span style={{ color: "#22c55e", "font-weight": "700" }}>key</span>
              <span>
                <kbd style={KBD}>{ev().key}</kbd>{" "}
                <span style={{ ...BADGE_BASE, background: "#22c55e", color: "#000" }}>CORRECT</span>
              </span>

              {/* code - deprecated */}
              <span style={{ color: "#ef4444", "text-decoration": "line-through" }}>code</span>
              <span>
                <kbd style={{ ...KBD, opacity: "0.6" }}>{ev().code}</kbd>{" "}
                <span style={{ ...BADGE_BASE, background: "#ef4444", color: "#fff" }}>WRONG</span>
                <span style={{ color: "var(--sl-color-gray-4)", "font-size": "0.7rem", "margin-left": "0.3rem" }}>layout-dependent</span>
              </span>

              {/* keyCode - deprecated */}
              <span style={{ color: "#ef4444", "text-decoration": "line-through" }}>keyCode</span>
              <span>
                <kbd style={{ ...KBD, opacity: "0.6" }}>{ev().keyCode}</kbd>{" "}
                <span style={{ ...BADGE_BASE, background: "#ef4444", color: "#fff" }}>DEPRECATED</span>
              </span>

              {/* which - deprecated */}
              <span style={{ color: "#ef4444", "text-decoration": "line-through" }}>which</span>
              <span>
                <kbd style={{ ...KBD, opacity: "0.6" }}>{ev().which}</kbd>{" "}
                <span style={{ ...BADGE_BASE, background: "#ef4444", color: "#fff" }}>DEPRECATED</span>
              </span>

              {/* Modifier flags */}
              <span style={{ color: "var(--sl-color-gray-3)" }}>ctrlKey</span>
              <span><kbd style={KBD}>{String(ev().ctrlKey)}</kbd></span>

              <span style={{ color: "var(--sl-color-gray-3)" }}>shiftKey</span>
              <span><kbd style={KBD}>{String(ev().shiftKey)}</kbd></span>

              <span style={{ color: "var(--sl-color-gray-3)" }}>metaKey</span>
              <span><kbd style={KBD}>{String(ev().metaKey)}</kbd></span>

              <span style={{ color: ev().altKey ? "#ef4444" : "var(--sl-color-gray-3)", "font-weight": ev().altKey ? "700" : "400" }}>altKey</span>
              <span>
                <kbd style={KBD}>{String(ev().altKey)}</kbd>
                <Show when={ev().altKey}>
                  {" "}
                  <span style={{ ...BADGE_BASE, background: "#ef4444", color: "#fff" }}>BLOCKED</span>
                  <span style={{ color: "#ef4444", "font-size": "0.7rem", "margin-left": "0.3rem" }}>Alt transforms key values on macOS</span>
                </Show>
              </span>

              <span style={{ color: "var(--sl-color-gray-3)" }}>repeat</span>
              <span><kbd style={KBD}>{String(ev().repeat)}</kbd></span>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}
