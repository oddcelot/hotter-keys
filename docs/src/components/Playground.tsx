import { createSignal, onCleanup, onMount, For, Show } from "solid-js";
import {
  createHotkeys,
  recordShortcut,
  formatShortcut,
  formatSequence,
  parseSequence,
  isMac,
} from "@hotter-keys/core";
import type { Hotkeys, RecordedShortcut, Shortcut } from "@hotter-keys/core";
import Gauge from "./Gauge";
import FireCounter from "./FireCounter";
import "../styles/demo.css";
import styles from "./Playground.module.css";

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
  { id: mkId(), combo: "mod+k", description: "Command palette" },
  { id: mkId(), combo: "mod+s", description: "Save" },
  { id: mkId(), combo: "mod+shift+p", description: "Quick open" },
  { id: mkId(), combo: "mod+b", description: "Toggle sidebar" },
  { id: mkId(), combo: "mod+j", description: "Toggle panel" },
  { id: mkId(), combo: "mod+d", description: "Select word" },
];

const INITIAL_SEQUENCES: ShortcutRow[] = [
  { id: mkId(), combo: "mod+k mod+c", description: "Comment block" },
  { id: mkId(), combo: "mod+k mod+u", description: "Uncomment block" },
  { id: mkId(), combo: "mod+k mod+s", description: "Save all" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function recordedToShortcut(r: RecordedShortcut): Shortcut {
  return { key: r.key as Shortcut["key"], ctrl: r.ctrl, shift: r.shift, meta: r.meta, alt: r.alt };
}

function recordedToCombo(r: RecordedShortcut): string {
  const parts: string[] = [];
  if (r.mod) {
    parts.push("mod");
  } else {
    if (r.ctrl) parts.push("ctrl");
    if (r.meta) parts.push("meta");
  }
  if (r.mod2) {
    parts.push("mod2");
  } else if (r.alt) {
    parts.push("alt");
  }
  if (r.shift) parts.push("shift");
  parts.push(r.key);
  return parts.join("+");
}

function comboLabel(combo: string): string {
  const mac = isMac();
  return formatSequence(parseSequence(combo, { mac }), mac);
}

const LOG_BADGE_CLASS: Record<string, string> = {
  shortcut: "badge badge-green",
  sequence: "badge badge-blue",
  record: "badge badge-purple",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

let logId = 0;

export default function Playground() {
  const [shortcuts, setShortcuts] = createSignal<ShortcutRow[]>(INITIAL_SHORTCUTS);
  const [sequences, setSequences] = createSignal<ShortcutRow[]>(INITIAL_SEQUENCES);
  const [heldKeys, setHeldKeys] = createSignal<readonly string[]>([]);
  const [shiftHeld, setShiftHeld] = createSignal(false);
  const [firedShortcuts, setFiredShortcuts] = createSignal<Record<string, number>>({});
  const [firedSequences, setFiredSequences] = createSignal<Record<string, number>>({});
  const [eventLog, setEventLog] = createSignal<LogEntry[]>([]);
  const [rawEvent, setRawEvent] = createSignal<RawEvent | null>(null);
  const [recording, setRecording] = createSignal(false);
  const [recorded, setRecorded] = createSignal<RecordedShortcut | null>(null);
  const [recordingRowId, setRecordingRowId] = createSignal<number | null>(null);
  const [fireCount, setFireCount] = createSignal(0);

  // eslint-disable-next-line no-unassigned-vars -- assigned by Solid's ref={} JSX binding
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
    setFireCount((c) => c + 1);
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
      pushLog(`${comboLabel(row.combo)} — ${row.description}`, type);
    });
    unbindMap.set(row.id, unsub);
  };

  const withEscapeCancel = (fn: (ac: AbortController) => void): AbortController => {
    const ac = new AbortController();
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        ac.abort();
        e.preventDefault();
      }
    };
    containerRef.addEventListener("keydown", onEscape, { capture: true });
    ac.signal.addEventListener("abort", () => {
      containerRef.removeEventListener("keydown", onEscape, { capture: true });
    });
    fn(ac);
    return ac;
  };

  const rebindRow = async (
    rowId: number,
    setter: typeof setShortcuts,
    type: "shortcut" | "sequence",
  ) => {
    setRecordingRowId(rowId);
    containerRef.focus();
    const ac = withEscapeCancel(() => {});
    try {
      const result = await recordShortcut(containerRef, ac.signal);
      if (!result.safe) {
        pushLog(`Rejected: ${result.unsafeReason}`, "record");
        return;
      }
      const comboStr = recordedToCombo(result);

      unbindMap.get(rowId)?.();
      setter((rows) => rows.map((r) => (r.id === rowId ? { ...r, combo: comboStr } : r)));
      const row = {
        id: rowId,
        combo: comboStr,
        description:
          setter === setShortcuts
            ? shortcuts().find((r) => r.id === rowId)!.description
            : sequences().find((r) => r.id === rowId)!.description,
      };
      bindRow(row, type);
      pushLog(`Rebound to ${comboLabel(comboStr)}`, "record");
    } catch {
      // aborted via Escape
    } finally {
      setRecordingRowId(null);
    }
  };

  const suppressWhileRecording = (e: KeyboardEvent) => {
    if (recordingRowId() !== null || recording()) {
      e.preventDefault();
    }
  };

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
    containerRef.addEventListener("keydown", suppressWhileRecording, { capture: true });
    containerRef.addEventListener("keydown", captureRaw);
    onCleanup(() => {
      hk.destroy();
      containerRef.removeEventListener("keydown", suppressWhileRecording, { capture: true });
      containerRef.removeEventListener("keydown", captureRaw);
    });
  });

  const doRecord = async () => {
    setRecording(true);
    setRecorded(null);
    containerRef.focus();
    const ac = withEscapeCancel(() => {});
    try {
      const result = await recordShortcut(containerRef, ac.signal);
      setRecorded(result);
      if (result.safe) {
        pushLog(`Recorded: ${formatShortcut(recordedToShortcut(result))}`, "record");
      } else {
        pushLog(`Recorded (unsafe): ${result.unsafeReason}`, "record");
      }
    } catch {
      // aborted via Escape
    } finally {
      setRecording(false);
    }
  };

  const isRecording = () => recordingRowId() !== null || recording();

  const rowClass = (isRec: boolean, isFired: boolean, color: "green" | "blue") =>
    `row ${isRec ? "row-recording" : isFired ? (color === "green" ? "row-fired-green" : "row-fired-blue") : ""}`;

  return (
    <div ref={containerRef} tabIndex={0} class={`demo ${styles.container}`}>
      <p class="demo-hint">
        Click anywhere in the playground to focus, then start pressing keys. Use the record buttons
        to rebind shortcuts.
      </p>

      {/* ---- HELD KEYS ---- */}
      <div class="section">
        <h4 class="section-title">Held Keys</h4>
        <div class={styles.instrumentRow}>
          <Gauge count={Math.min(heldKeys().length, 6)} />
          <div style={{ flex: "1" }}>
            <div class={styles.heldKeysRow}>
              <Show when={heldKeys().length > 0} fallback={<span class="muted">No keys held</span>}>
                <For each={[...heldKeys()]}>
                  {(key, i) => (
                    <span>
                      <span class={styles.heldKeysOrdinal}>{String(i() + 1).padStart(2, "0")}</span>
                      <kbd class="kbd kbd-accent">{key}</kbd>
                    </span>
                  )}
                </For>
              </Show>
              <Show when={shiftHeld()}>
                <span class={`badge badge-yellow ${styles.shiftBadge}`}>SHIFT HELD ALONE</span>
              </Show>
            </div>
          </div>
          <FireCounter count={fireCount()} />
        </div>
      </div>

      {/* ---- SHORTCUTS ---- */}
      <div class="section">
        <h4 class="section-title">Shortcuts</h4>
        <div class="grid-2col">
          <For each={shortcuts()}>
            {(s) => {
              const fired = () => s.combo in firedShortcuts();
              const isThisRec = () => recordingRowId() === s.id;
              return (
                <div class={rowClass(isThisRec(), fired(), "green")}>
                  <span class="row-label">
                    <kbd class="kbd">{comboLabel(s.combo)}</kbd>{" "}
                    <span class="row-desc">{s.description}</span>
                  </span>
                  <Show when={fired()}>
                    <span class="badge badge-green">FIRED</span>
                  </Show>
                  <button
                    onClick={() => rebindRow(s.id, setShortcuts, "shortcut")}
                    disabled={isRecording()}
                    class={`btn-sm ${isThisRec() ? "btn-recording" : ""}`}
                  >
                    {isThisRec() ? "Press key (Esc to cancel)" : "Rebind"}
                  </button>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      {/* ---- SEQUENCES ---- */}
      <div class="section">
        <h4 class="section-title">Sequences</h4>
        <p class={styles.seqHint}>
          Press the first chord, then the second within 1 second. Rebinding replaces the full
          sequence with a single chord.
        </p>
        <div class="stack">
          <For each={sequences()}>
            {(s) => {
              const fired = () => s.combo in firedSequences();
              const isThisRec = () => recordingRowId() === s.id;
              return (
                <div class={rowClass(isThisRec(), fired(), "blue")}>
                  <span class="row-label">
                    <kbd class="kbd">{comboLabel(s.combo)}</kbd>{" "}
                    <span class="row-desc">{s.description}</span>
                  </span>
                  <Show when={fired()}>
                    <span class="badge badge-blue">FIRED</span>
                  </Show>
                  <button
                    onClick={() => rebindRow(s.id, setSequences, "sequence")}
                    disabled={isRecording()}
                    class={`btn-sm ${isThisRec() ? "btn-recording" : ""}`}
                  >
                    {isThisRec() ? "Press key (Esc to cancel)" : "Rebind"}
                  </button>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      {/* ---- KEY RECORDER ---- */}
      <div class="section">
        <h4 class="section-title">Key Recorder</h4>
        <div class={styles.recordArea}>
          <button
            onClick={doRecord}
            disabled={isRecording()}
            class={`${styles.recordBtn} ${recording() ? styles.recordBtnActive : ""}`}
          >
            {recording() ? "Press any key (Esc to cancel)" : "Record Shortcut"}
          </button>
          <Show when={recorded()}>
            {(r) => (
              <Show
                when={r().safe}
                fallback={
                  <span class={styles.unsafeResult}>
                    <span class="badge badge-red log-badge">UNSAFE</span>
                    {r().unsafeReason}
                  </span>
                }
              >
                <span>
                  <span class="badge badge-green log-badge">SAFE</span>
                  <kbd class="kbd">{formatShortcut(recordedToShortcut(r()))}</kbd>
                </span>
              </Show>
            )}
          </Show>
        </div>
      </div>

      {/* ---- EVENT LOG ---- */}
      <div class="section">
        <div class="section-header">
          <h4 class="section-title">Event Log</h4>
          <button onClick={() => setEventLog([])} class="btn-sm">
            Clear
          </button>
        </div>
        <div class="log-scroll">
          <Show when={eventLog().length > 0} fallback={<span class="muted">No events yet</span>}>
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

      {/* ---- RAW EVENT INSPECTOR ---- */}
      <div class="section">
        <h4 class="section-title">Raw Event Inspector</h4>
        <Show when={rawEvent()} fallback={<span class="muted">Press a key to inspect</span>}>
          {(ev) => (
            <div class="inspector-grid">
              <span class="inspector-correct">key</span>
              <span>
                <kbd class="kbd">{ev().key}</kbd> <span class="badge badge-green">CORRECT</span>
              </span>

              <span class="inspector-deprecated">code</span>
              <span>
                <kbd class="kbd kbd-dim">{ev().code}</kbd>{" "}
                <span class="badge badge-red">WRONG</span>
                <span class="muted inspector-note">layout-dependent</span>
              </span>

              <span class="inspector-deprecated">keyCode</span>
              <span>
                <kbd class="kbd kbd-dim">{ev().keyCode}</kbd>{" "}
                <span class="badge badge-red">DEPRECATED</span>
              </span>

              <span class="inspector-deprecated">which</span>
              <span>
                <kbd class="kbd kbd-dim">{ev().which}</kbd>{" "}
                <span class="badge badge-red">DEPRECATED</span>
              </span>

              <span class="muted-light">ctrlKey</span>
              <span>
                <kbd class="kbd">{String(ev().ctrlKey)}</kbd>
              </span>

              <span class="muted-light">shiftKey</span>
              <span>
                <kbd class="kbd">{String(ev().shiftKey)}</kbd>
              </span>

              <span class="muted-light">metaKey</span>
              <span>
                <kbd class="kbd">{String(ev().metaKey)}</kbd>
              </span>

              <span class={ev().altKey ? styles.altWarning : "muted-light"}>altKey</span>
              <span>
                <kbd class="kbd">{String(ev().altKey)}</kbd>
                <Show when={ev().altKey}>
                  {" "}
                  <span class="badge badge-yellow">CAUTION</span>
                  <span class={styles.altNote}>
                    Alt transforms key values on macOS — use <code>mod2</code> for cross-platform
                  </span>
                </Show>
              </span>

              <span class="muted-light">repeat</span>
              <span>
                <kbd class="kbd">{String(ev().repeat)}</kbd>
              </span>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}
