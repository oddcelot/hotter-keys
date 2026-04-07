import { createSignal, onCleanup, onMount } from "solid-js";
import {
  createHotkeys,
  recordShortcut,
  formatShortcut,
  formatSequence,
  parseSequence,
  isMac,
} from "@hotter-keys/core";
import type { Hotkeys, RecordedShortcut, Shortcut } from "@hotter-keys/core";
import HeldKeys, { type RawEvent } from "./HeldKeys";
import ShortcutRows, { type ShortcutRow } from "./ShortcutRows";
import KeyRecorder from "./KeyRecorder";
import PlaygroundEventLog, { type LogEntry } from "./PlaygroundEventLog";

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

  return (
    <div ref={containerRef} tabIndex={0} class="demo outline-none cursor-default">
      <p class="demo-hint">
        Click anywhere in the playground to focus, then start pressing keys. Use the record buttons
        to rebind shortcuts.
      </p>

      <HeldKeys keys={heldKeys} shiftHeld={shiftHeld} rawEvent={rawEvent} />

      <ShortcutRows
        title="Shortcuts"
        rows={shortcuts}
        firedMap={firedShortcuts}
        color="green"
        formatCombo={comboLabel}
        recordingRowId={recordingRowId}
        isRecording={isRecording}
        onRebind={(id) => rebindRow(id, setShortcuts, "shortcut")}
        layout="grid"
      />

      <ShortcutRows
        title="Sequences"
        hint="Press the first chord, then the second within 1 second. Rebinding replaces the full sequence with a single chord."
        rows={sequences}
        firedMap={firedSequences}
        color="blue"
        formatCombo={comboLabel}
        recordingRowId={recordingRowId}
        isRecording={isRecording}
        onRebind={(id) => rebindRow(id, setSequences, "sequence")}
      />

      <KeyRecorder
        recording={recording}
        recorded={recorded}
        isRecording={isRecording}
        onRecord={doRecord}
      />

      <PlaygroundEventLog log={eventLog} onClear={() => setEventLog([])} />
    </div>
  );
}
