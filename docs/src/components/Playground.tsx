import { createSignal, onCleanup, onMount, For, Show } from "solid-js";
import { createHotkeys, recordShortcut, formatShortcut } from "hotter-keys";
import type { Hotkeys, RecordedShortcut } from "hotter-keys";

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
  id: number;
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
// Initial data
// ---------------------------------------------------------------------------

let nextId = 0;
const mkId = () => ++nextId;

const INITIAL_SHORTCUTS: ShortcutRow[] = [
  { id: mkId(), label: "Ctrl+K", combo: "ctrl+k", description: "Command palette" },
  { id: mkId(), label: "Ctrl+S", combo: "ctrl+s", description: "Save" },
  { id: mkId(), label: "Ctrl+Shift+P", combo: "ctrl+shift+p", description: "Quick open" },
  { id: mkId(), label: "Meta+B", combo: "meta+b", description: "Toggle sidebar" },
  { id: mkId(), label: "Ctrl+J", combo: "ctrl+j", description: "Toggle panel" },
  { id: mkId(), label: "Ctrl+D", combo: "ctrl+d", description: "Select word" },
];

const INITIAL_SEQUENCES: ShortcutRow[] = [
  { id: mkId(), label: "Ctrl+K Ctrl+C", combo: "ctrl+k ctrl+c", description: "Comment block" },
  { id: mkId(), label: "Ctrl+K Ctrl+U", combo: "ctrl+k ctrl+u", description: "Uncomment block" },
  { id: mkId(), label: "Ctrl+K Ctrl+S", combo: "ctrl+k ctrl+s", description: "Save all" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function recordedToCombo(r: RecordedShortcut): string {
  return [
    r.ctrl ? "ctrl" : "",
    r.shift ? "shift" : "",
    r.meta ? "meta" : "",
    r.key,
  ].filter(Boolean).join("+");
}

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

export default function Playground() {
  // --- Reactive shortcut/sequence state ---
  const [shortcuts, setShortcuts] = createSignal<ShortcutRow[]>(INITIAL_SHORTCUTS);
  const [sequences, setSequences] = createSignal<ShortcutRow[]>(INITIAL_SEQUENCES);

  // --- Shared state ---
  const [heldKeys, setHeldKeys] = createSignal<readonly string[]>([]);
  const [shiftHeld, setShiftHeld] = createSignal(false);
  const [firedShortcuts, setFiredShortcuts] = createSignal<Record<string, number>>({});
  const [firedSequences, setFiredSequences] = createSignal<Record<string, number>>({});
  const [eventLog, setEventLog] = createSignal<LogEntry[]>([]);
  const [rawEvent, setRawEvent] = createSignal<RawEvent | null>(null);
  const [recording, setRecording] = createSignal(false);
  const [recorded, setRecorded] = createSignal<RecordedShortcut | null>(null);
  const [recordingRowId, setRecordingRowId] = createSignal<number | null>(null);

  let containerRef!: HTMLDivElement;
  let hk: Hotkeys;
  const unbindMap = new Map<number, () => void>();

  const now = () => {
    const d = new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map((n) => String(n).padStart(2, "0"))
      .join(":");
  };

  const pushLog = (text: string, type: LogEntry["type"]) => {
    setEventLog((prev) => [{ id: ++logId, time: now(), text, type }, ...prev].slice(0, 50));
  };

  const flash = (setter: typeof setFiredShortcuts, combo: string) => {
    setter((prev) => ({ ...prev, [combo]: Date.now() }));
    setTimeout(() => {
      setter((prev) => {
        const next = { ...prev };
        delete next[combo];
        return next;
      });
    }, 600);
  };

  const bindRow = (row: ShortcutRow, type: "shortcut" | "sequence") => {
    const setter = type === "shortcut" ? setFiredShortcuts : setFiredSequences;
    const unsub = hk.add(row.combo, () => {
      flash(setter, row.combo);
      pushLog(`${row.label} — ${row.description}`, type);
    });
    unbindMap.set(row.id, unsub);
  };

  // --- Rebind a row via recording ---
  const rebindRow = async (
    rowId: number,
    setter: typeof setShortcuts,
    type: "shortcut" | "sequence",
  ) => {
    setRecordingRowId(rowId);
    try {
      const result = await recordShortcut(containerRef);
      if (!result.safe) {
        pushLog(`Rejected: ${result.unsafeReason}`, "record");
        return;
      }
      const comboStr = recordedToCombo(result);
      const label = formatShortcut(result);

      // Remove old binding
      unbindMap.get(rowId)?.();

      // Update row state
      setter((rows) =>
        rows.map((r) => (r.id === rowId ? { ...r, combo: comboStr, label } : r))
      );

      // Add new binding
      const row = { id: rowId, combo: comboStr, label, description: setter === setShortcuts
        ? shortcuts().find((r) => r.id === rowId)!.description
        : sequences().find((r) => r.id === rowId)!.description };
      bindRow(row, type);

      pushLog(`Rebound to ${label}`, "record");
    } finally {
      setRecordingRowId(null);
    }
  };

  // --- Raw event capture ---
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
    hk = createHotkeys({ target: containerRef });

    hk.onHeldKeysChange((keys) => setHeldKeys(keys));
    hk.onKeyHold("shift", (held) => setShiftHeld(held));

    for (const s of shortcuts()) bindRow(s, "shortcut");
    for (const s of sequences()) bindRow(s, "sequence");

    containerRef.addEventListener("keydown", captureRaw);

    onCleanup(() => {
      hk.destroy();
      containerRef.removeEventListener("keydown", captureRaw);
    });
  });

  // --- Standalone record ---
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

  const isRecording = () => recordingRowId() !== null || recording();

  // --- Render ---
  return (
    <div
      ref={containerRef}
      tabIndex={0}
      style={{ ...MONO, outline: "none", cursor: "default" }}
    >
      <p style={{ "font-size": "0.8rem", color: "var(--sl-color-gray-3)", "margin-top": "0" }}>
        Click anywhere in the playground to focus, then start pressing keys. Use the record buttons to rebind shortcuts.
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
            <span style={{ ...BADGE_BASE, background: "#f59e0b", color: "#000", "margin-left": "auto" }}>
              SHIFT HELD ALONE
            </span>
          </Show>
        </div>
      </div>

      {/* ---- SHORTCUTS ---- */}
      <div style={SECTION}>
        <h4 style={{ margin: "0 0 0.75rem", "font-size": "0.9rem" }}>Shortcuts</h4>
        <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "0.4rem" }}>
          <For each={shortcuts()}>
            {(s) => {
              const fired = () => s.combo in firedShortcuts();
              const isThisRecording = () => recordingRowId() === s.id;
              return (
                <div
                  style={{
                    display: "flex",
                    "align-items": "center",
                    "justify-content": "space-between",
                    padding: "0.35rem 0.5rem",
                    "border-radius": "0.25rem",
                    background: isThisRecording()
                      ? "rgba(168,85,247,0.15)"
                      : fired()
                        ? "rgba(34,197,94,0.15)"
                        : "var(--sl-color-gray-6)",
                    transition: "background 0.15s",
                    gap: "0.4rem",
                  }}
                >
                  <span style={{ flex: "1", "min-width": "0" }}>
                    <kbd style={KBD}>{s.label}</kbd>{" "}
                    <span style={{ color: "var(--sl-color-gray-3)", "font-size": "0.75rem" }}>{s.description}</span>
                  </span>
                  <Show when={fired()}>
                    <span style={{ ...BADGE_BASE, background: "#22c55e", color: "#000" }}>FIRED</span>
                  </Show>
                  <button
                    onClick={() => rebindRow(s.id, setShortcuts, "shortcut")}
                    disabled={isRecording()}
                    style={{
                      ...SMALL_BTN,
                      ...(isThisRecording()
                        ? { background: "var(--sl-color-accent)", color: "var(--sl-color-accent-high)", border: "1px solid var(--sl-color-accent)" }
                        : {}),
                    }}
                  >
                    {isThisRecording() ? "Press key\u2026" : "Rebind"}
                  </button>
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
          Press the first chord, then the second within 1 second. Rebinding replaces the full sequence with a single chord.
        </p>
        <div style={{ display: "flex", "flex-direction": "column", gap: "0.4rem" }}>
          <For each={sequences()}>
            {(s) => {
              const fired = () => s.combo in firedSequences();
              const isThisRecording = () => recordingRowId() === s.id;
              return (
                <div
                  style={{
                    display: "flex",
                    "align-items": "center",
                    "justify-content": "space-between",
                    padding: "0.35rem 0.5rem",
                    "border-radius": "0.25rem",
                    background: isThisRecording()
                      ? "rgba(168,85,247,0.15)"
                      : fired()
                        ? "rgba(59,130,246,0.15)"
                        : "var(--sl-color-gray-6)",
                    transition: "background 0.15s",
                    gap: "0.4rem",
                  }}
                >
                  <span style={{ flex: "1", "min-width": "0" }}>
                    <kbd style={KBD}>{s.label}</kbd>{" "}
                    <span style={{ color: "var(--sl-color-gray-3)", "font-size": "0.75rem" }}>{s.description}</span>
                  </span>
                  <Show when={fired()}>
                    <span style={{ ...BADGE_BASE, background: "#3b82f6", color: "#fff" }}>FIRED</span>
                  </Show>
                  <button
                    onClick={() => rebindRow(s.id, setSequences, "sequence")}
                    disabled={isRecording()}
                    style={{
                      ...SMALL_BTN,
                      ...(isThisRecording()
                        ? { background: "var(--sl-color-accent)", color: "var(--sl-color-accent-high)", border: "1px solid var(--sl-color-accent)" }
                        : {}),
                    }}
                  >
                    {isThisRecording() ? "Press key\u2026" : "Rebind"}
                  </button>
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
            disabled={isRecording()}
            style={{
              padding: "0.4rem 0.75rem",
              "border-radius": "0.25rem",
              border: "1px solid var(--sl-color-gray-5)",
              background: recording() ? "var(--sl-color-accent)" : "var(--sl-color-bg-nav)",
              color: recording() ? "var(--sl-color-accent-high)" : "var(--sl-color-white)",
              cursor: isRecording() ? "default" : "pointer",
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
          <button onClick={() => setEventLog([])} style={SMALL_BTN}>Clear</button>
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
                    <span style={{ ...BADGE_BASE, background: color, color: entry.type === "sequence" ? "#fff" : "#000", "margin-right": "0.3rem" }}>
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
              <span style={{ color: "#22c55e", "font-weight": "700" }}>key</span>
              <span>
                <kbd style={KBD}>{ev().key}</kbd>{" "}
                <span style={{ ...BADGE_BASE, background: "#22c55e", color: "#000" }}>CORRECT</span>
              </span>

              <span style={{ color: "#ef4444", "text-decoration": "line-through" }}>code</span>
              <span>
                <kbd style={{ ...KBD, opacity: "0.6" }}>{ev().code}</kbd>{" "}
                <span style={{ ...BADGE_BASE, background: "#ef4444", color: "#fff" }}>WRONG</span>
                <span style={{ color: "var(--sl-color-gray-4)", "font-size": "0.7rem", "margin-left": "0.3rem" }}>layout-dependent</span>
              </span>

              <span style={{ color: "#ef4444", "text-decoration": "line-through" }}>keyCode</span>
              <span>
                <kbd style={{ ...KBD, opacity: "0.6" }}>{ev().keyCode}</kbd>{" "}
                <span style={{ ...BADGE_BASE, background: "#ef4444", color: "#fff" }}>DEPRECATED</span>
              </span>

              <span style={{ color: "#ef4444", "text-decoration": "line-through" }}>which</span>
              <span>
                <kbd style={{ ...KBD, opacity: "0.6" }}>{ev().which}</kbd>{" "}
                <span style={{ ...BADGE_BASE, background: "#ef4444", color: "#fff" }}>DEPRECATED</span>
              </span>

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
