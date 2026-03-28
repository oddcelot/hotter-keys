import { createSignal, createEffect, onMount, For, Show } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { recordShortcut, formatShortcut } from "hotter-keys";
import type { RecordedShortcut } from "hotter-keys";
import { loadKeymap, saveKeymap, isOpfsAvailable } from "../lib/opfs";
import type { KeymapEntry } from "../lib/opfs";

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

function comboToLabel(combo: string): string {
  if (!combo) return "";
  return combo
    .split(" ")
    .map((chord) =>
      chord
        .split("+")
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join("+")
    )
    .join(" ");
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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

const BTN: Record<string, string> = {
  padding: "0.3rem 0.6rem",
  "border-radius": "0.25rem",
  border: "1px solid var(--sl-color-gray-5)",
  background: "var(--sl-color-bg-nav)",
  color: "var(--sl-color-white)",
  cursor: "pointer",
  "font-family": "var(--sl-font-mono, monospace)",
  "font-size": "0.8rem",
};

const SMALL_BTN: Record<string, string> = {
  ...BTN,
  padding: "0.15rem 0.4rem",
  "font-size": "0.7rem",
  color: "var(--sl-color-gray-3)",
};

const INPUT: Record<string, string> = {
  padding: "0.3rem 0.5rem",
  "border-radius": "0.25rem",
  border: "1px solid var(--sl-color-gray-5)",
  background: "var(--sl-color-gray-7, var(--sl-color-gray-6))",
  color: "var(--sl-color-white)",
  "font-family": "var(--sl-font-mono, monospace)",
  "font-size": "0.8rem",
  width: "100%",
  "box-sizing": "border-box",
};

const CELL: Record<string, string> = {
  padding: "0.5rem",
  "border-bottom": "1px solid var(--sl-color-gray-6)",
  "vertical-align": "middle",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function KeymapCreator() {
  const [entries, setEntries] = createStore<KeymapEntry[]>([]);
  const [loaded, setLoaded] = createSignal(false);
  const [recordingId, setRecordingId] = createSignal<string | null>(null);
  const [saveStatus, setSaveStatus] = createSignal<string>("");
  const [opfsOk, setOpfsOk] = createSignal(false);

  let containerRef!: HTMLDivElement;

  onMount(async () => {
    const available = isOpfsAvailable();
    setOpfsOk(available);
    if (available) {
      const data = await loadKeymap();
      setEntries(data);
    }
    setLoaded(true);
  });

  // Auto-save on change (debounced)
  let saveTimer: ReturnType<typeof setTimeout>;
  createEffect(() => {
    const data = [...entries];
    if (!loaded() || !opfsOk()) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await saveKeymap(data);
        setSaveStatus("Saved");
        setTimeout(() => setSaveStatus(""), 2000);
      } catch {
        setSaveStatus("Save failed");
      }
    }, 500);
  });

  const addEntry = () => {
    setEntries(produce((list) => {
      list.push({ id: crypto.randomUUID(), name: "", description: "", shortcut: "" });
    }));
  };

  const deleteEntry = (id: string) => {
    setEntries(produce((list) => {
      const idx = list.findIndex((e) => e.id === id);
      if (idx !== -1) list.splice(idx, 1);
    }));
  };

  const updateField = (id: string, field: "name" | "description", value: string) => {
    const idx = entries.findIndex((e) => e.id === id);
    if (idx !== -1) setEntries(idx, field, value);
  };

  const recordForRow = async (id: string) => {
    setRecordingId(id);
    try {
      const result = await recordShortcut(containerRef);
      if (!result.safe) return;
      const comboStr = recordedToCombo(result);
      const idx = entries.findIndex((e) => e.id === id);
      if (idx !== -1) setEntries(idx, "shortcut", comboStr);
    } finally {
      setRecordingId(null);
    }
  };

  return (
    <div ref={containerRef} tabIndex={0} style={{ ...MONO, outline: "none" }}>
      {/* Status bar */}
      <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "1rem", gap: "0.5rem" }}>
        <div style={{ display: "flex", "align-items": "center", gap: "0.5rem" }}>
          <button onClick={addEntry} style={BTN}>
            + Add Entry
          </button>
          <Show when={saveStatus()}>
            <span style={{ ...BADGE_BASE, background: "#22c55e", color: "#000" }}>
              {saveStatus()}
            </span>
          </Show>
        </div>
        <Show
          when={opfsOk()}
          fallback={
            <span style={{ ...BADGE_BASE, background: "#f59e0b", color: "#000" }}>
              OPFS unavailable — changes won't persist
            </span>
          }
        >
          <span style={{ color: "var(--sl-color-gray-4)", "font-size": "0.7rem" }}>
            Stored in Origin Private File System
          </span>
        </Show>
      </div>

      {/* Table */}
      <Show
        when={entries.length > 0}
        fallback={
          <div style={{
            border: "1px dashed var(--sl-color-gray-5)",
            "border-radius": "0.5rem",
            padding: "2rem",
            "text-align": "center",
            color: "var(--sl-color-gray-4)",
          }}>
            No entries yet. Click <strong>+ Add Entry</strong> to get started.
          </div>
        }
      >
        <div style={{ "overflow-x": "auto" }}>
          <table style={{ width: "100%", "border-collapse": "collapse", "border-spacing": "0" }}>
            <thead>
              <tr style={{ "border-bottom": "2px solid var(--sl-color-gray-5)" }}>
                <th style={{ ...CELL, "text-align": "left", "font-size": "0.75rem", color: "var(--sl-color-gray-3)", "font-weight": "600" }}>Name</th>
                <th style={{ ...CELL, "text-align": "left", "font-size": "0.75rem", color: "var(--sl-color-gray-3)", "font-weight": "600" }}>Description</th>
                <th style={{ ...CELL, "text-align": "left", "font-size": "0.75rem", color: "var(--sl-color-gray-3)", "font-weight": "600", "min-width": "10rem" }}>Shortcut</th>
                <th style={{ ...CELL, width: "3rem" }}></th>
              </tr>
            </thead>
            <tbody>
              <For each={entries}>
                {(entry) => {
                  const isThisRecording = () => recordingId() === entry.id;
                  return (
                    <tr>
                      <td style={CELL}>
                        <input
                          type="text"
                          value={entry.name}
                          onInput={(e) => updateField(entry.id, "name", e.currentTarget.value)}
                          placeholder="e.g. save"
                          style={INPUT}
                        />
                      </td>
                      <td style={CELL}>
                        <input
                          type="text"
                          value={entry.description}
                          onInput={(e) => updateField(entry.id, "description", e.currentTarget.value)}
                          placeholder="e.g. Save current file"
                          style={INPUT}
                        />
                      </td>
                      <td style={CELL}>
                        <div style={{ display: "flex", "align-items": "center", gap: "0.4rem" }}>
                          <Show when={entry.shortcut}>
                            <kbd style={KBD}>{comboToLabel(entry.shortcut)}</kbd>
                          </Show>
                          <button
                            onClick={() => recordForRow(entry.id)}
                            disabled={recordingId() !== null}
                            style={{
                              ...SMALL_BTN,
                              ...(isThisRecording()
                                ? { background: "var(--sl-color-accent)", color: "var(--sl-color-accent-high)", border: "1px solid var(--sl-color-accent)" }
                                : {}),
                            }}
                          >
                            {isThisRecording() ? "Press key\u2026" : entry.shortcut ? "Rebind" : "Record"}
                          </button>
                        </div>
                      </td>
                      <td style={{ ...CELL, "text-align": "center" }}>
                        <button
                          onClick={() => deleteEntry(entry.id)}
                          style={{ ...SMALL_BTN, color: "#ef4444", border: "1px solid transparent" }}
                          title="Delete entry"
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  );
                }}
              </For>
            </tbody>
          </table>
        </div>
      </Show>

      {/* JSON preview */}
      <Show when={entries.length > 0}>
        <details style={{ "margin-top": "1.5rem" }}>
          <summary style={{ cursor: "pointer", color: "var(--sl-color-gray-3)", "font-size": "0.8rem" }}>
            JSON output
          </summary>
          <pre style={{
            "margin-top": "0.5rem",
            padding: "0.75rem",
            background: "var(--sl-color-gray-6)",
            "border-radius": "0.25rem",
            "overflow-x": "auto",
            "font-size": "0.75rem",
          }}>
            {JSON.stringify(
              entries.map(({ id: _, ...rest }) => rest),
              null,
              2,
            )}
          </pre>
        </details>
      </Show>
    </div>
  );
}
