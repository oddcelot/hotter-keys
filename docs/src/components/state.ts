import { createSignal } from "solid-js";
import {
  createHotkeys,
  recordShortcut,
  formatShortcut,
  formatSequence,
  parseSequence,
  isMac,
} from "@hotter-keys/core";
import type { Hotkeys, RecordedShortcut, Shortcut } from "@hotter-keys/core";
import type { RawEvent } from "./HeldKeys";
import type { ShortcutRow } from "./ShortcutRows";
import type { LogEntry } from "./EventLog";

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

export function comboLabel(combo: string): string {
  const mac = isMac();
  return formatSequence(parseSequence(combo, { mac }), mac);
}

// ---------------------------------------------------------------------------
// Shared signals
// ---------------------------------------------------------------------------

export const [shortcuts, setShortcuts] = createSignal<ShortcutRow[]>(INITIAL_SHORTCUTS);
export const [sequences, setSequences] = createSignal<ShortcutRow[]>(INITIAL_SEQUENCES);
export const [heldKeys, setHeldKeys] = createSignal<readonly string[]>([]);
export const [shiftHeld, setShiftHeld] = createSignal(false);
export const [firedShortcuts, setFiredShortcuts] = createSignal<Record<string, number>>({});
export const [firedSequences, setFiredSequences] = createSignal<Record<string, number>>({});
export const [eventLog, setEventLog] = createSignal<LogEntry[]>([]);
export const [rawEvent, setRawEvent] = createSignal<RawEvent | null>(null);
export const [recording, setRecording] = createSignal(false);
export const [recorded, setRecorded] = createSignal<RecordedShortcut | null>(null);
export const [recordingRowId, setRecordingRowId] = createSignal<number | null>(null);

export const isRecording = () => recordingRowId() !== null || recording();

// ---------------------------------------------------------------------------
// Hotkeys instance (lazily initialized)
// ---------------------------------------------------------------------------

let hk: Hotkeys | null = null;
const unbindMap = new Map<number, () => void>();
let logId = 0;

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
  if (!hk) return;
  const setter = type === "shortcut" ? setFiredShortcuts : setFiredSequences;
  const unsub = hk.add(row.combo, () => {
    flash(setter, row.combo);
    pushLog(`${comboLabel(row.combo)} — ${row.description}`, type);
  });
  unbindMap.set(row.id, unsub);
};

function withEscapeCancel(): AbortController {
  const ac = new AbortController();
  const onEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      ac.abort();
      e.preventDefault();
    }
  };
  document.addEventListener("keydown", onEscape, { capture: true });
  ac.signal.addEventListener("abort", () => {
    document.removeEventListener("keydown", onEscape, { capture: true });
  });
  return ac;
}

// ---------------------------------------------------------------------------
// Actions (called by section components)
// ---------------------------------------------------------------------------

export async function rebindShortcutRow(rowId: number) {
  await rebindRow(rowId, setShortcuts, "shortcut");
}

export async function rebindSequenceRow(rowId: number) {
  await rebindRow(rowId, setSequences, "sequence");
}

async function rebindRow(
  rowId: number,
  setter: typeof setShortcuts,
  type: "shortcut" | "sequence",
) {
  setRecordingRowId(rowId);
  const ac = withEscapeCancel();
  try {
    const result = await recordShortcut(document, ac.signal);
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
}

export async function doRecord() {
  setRecording(true);
  setRecorded(null);
  const ac = withEscapeCancel();
  try {
    const result = await recordShortcut(document, ac.signal);
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
}

export function clearLog() {
  setEventLog([]);
}

// ---------------------------------------------------------------------------
// Initialization — called once, auto-runs on first import in browser
// ---------------------------------------------------------------------------

let initialized = false;

export function initPlayground(): () => void {
  if (initialized) return () => {};
  initialized = true;

  hk = createHotkeys();
  hk.onHeldKeysChange((keys) => setHeldKeys(keys));
  hk.onKeyHold("shift", (held) => setShiftHeld(held));

  for (const s of shortcuts()) bindRow(s, "shortcut");
  for (const s of sequences()) bindRow(s, "sequence");

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

  document.addEventListener("keydown", suppressWhileRecording, { capture: true });
  document.addEventListener("keydown", captureRaw);

  return () => {
    initialized = false;
    hk?.destroy();
    hk = null;
    document.removeEventListener("keydown", suppressWhileRecording, { capture: true });
    document.removeEventListener("keydown", captureRaw);
  };
}
