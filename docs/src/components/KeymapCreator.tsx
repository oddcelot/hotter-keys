import { createSignal, createEffect, onMount, onCleanup, For, Show } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { recordShortcut } from "hotter-keys";
import type { RecordedShortcut } from "hotter-keys";
import { loadKeymap, saveKeymap, isOpfsAvailable } from "../lib/opfs";
import type { KeymapEntry } from "../lib/opfs";
import "../styles/demo.css";
import styles from "./KeymapCreator.module.css";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function recordedToCombo(r: RecordedShortcut): string {
  const parts: string[] = [];
  if (r.mod) {
    parts.push("mod");
  } else {
    if (r.ctrl) parts.push("ctrl");
    if (r.meta) parts.push("meta");
  }
  if (r.shift) parts.push("shift");
  parts.push(r.key);
  return parts.join("+");
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
// Component
// ---------------------------------------------------------------------------

export default function KeymapCreator() {
  const [entries, setEntries] = createStore<KeymapEntry[]>([]);
  const [loaded, setLoaded] = createSignal(false);
  const [recordingId, setRecordingId] = createSignal<string | null>(null);
  const [pendingChords, setPendingChords] = createSignal<string[]>([]);
  const [opfsOk, setOpfsOk] = createSignal(false);

  let containerRef!: HTMLDivElement;

  const suppressWhileRecording = (e: KeyboardEvent) => {
    if (recordingId() !== null) {
      e.preventDefault();
    }
  };

  onMount(async () => {
    containerRef.addEventListener("keydown", suppressWhileRecording, { capture: true });
    const available = isOpfsAvailable();
    setOpfsOk(available);
    if (available) {
      const data = await loadKeymap();
      setEntries(data);
    }
    setLoaded(true);

    onCleanup(() => {
      containerRef.removeEventListener("keydown", suppressWhileRecording, { capture: true });
    });
  });

  // Auto-save to OPFS (debounced)
  let saveTimer: ReturnType<typeof setTimeout>;
  createEffect(() => {
    // Deep-read every field so the effect re-runs on any property change
    const data = entries.map((e) => ({ ...e }));
    if (!loaded() || !opfsOk()) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      console.log("[keymap] saving to OPFS", data.length, "entries");
      saveKeymap(data)
        .then(() => console.log("[keymap] saved"))
        .catch((err) => console.error("[keymap] save failed", err));
    }, 500);
  });

  const getExportJson = () =>
    JSON.stringify(entries.map(({ id: _, ...rest }) => rest), null, 2);

  const saveToFile = async () => {
    const json = getExportJson();
    // Try File System Access API (Chrome/Edge)
    if ("showSaveFilePicker" in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: "keymap.json",
          types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return; // user cancelled
      }
    }
    // Fallback: download via blob link
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "keymap.json";
    a.click();
    URL.revokeObjectURL(url);
  };

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
    setPendingChords([]);
    containerRef.focus();

    const chords: string[] = [];
    let done = false;

    while (!done) {
      const ac = new AbortController();
      const onEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") { ac.abort(); e.preventDefault(); }
      };
      containerRef.addEventListener("keydown", onEscape, { capture: true });
      try {
        const result = await recordShortcut(containerRef, ac.signal);
        containerRef.removeEventListener("keydown", onEscape, { capture: true });
        if (!result.safe) {
          done = true;
        } else {
          chords.push(recordedToCombo(result));
          setPendingChords([...chords]);
        }
      } catch {
        containerRef.removeEventListener("keydown", onEscape, { capture: true });
        done = true;
      }
    }

    if (chords.length > 0) {
      const comboStr = chords.join(" ");
      const idx = entries.findIndex((e) => e.id === id);
      if (idx !== -1) setEntries(idx, "shortcut", comboStr);
    }

    setPendingChords([]);
    setRecordingId(null);
  };

  return (
    <div ref={containerRef} tabIndex={0} class="demo" style={{ outline: "none" }}>
      {/* Status bar */}
      <div class={styles.statusBar}>
        <div class={styles.statusActions}>
          <button onClick={addEntry} class="btn">+ Add Entry</button>
          <Show when={entries.length > 0}>
            <button onClick={saveToFile} class="btn-sm">Save as file</button>
          </Show>
        </div>
        <Show when={!opfsOk()}>
          <span class="badge badge-yellow">OPFS unavailable — changes won't persist</span>
        </Show>
      </div>

      {/* Table */}
      <Show
        when={entries.length > 0}
        fallback={
          <div class={styles.emptyState}>
            No entries yet. Click <strong>+ Add Entry</strong> to get started.
          </div>
        }
      >
        <div style={{ "overflow-x": "auto" }}>
          <table class={styles.table}>
            <thead>
              <tr class={styles.thead}>
                <th class={styles.th}>Name</th>
                <th class={styles.th}>Description</th>
                <th class={`${styles.th} ${styles.shortcutCol}`}>Shortcut</th>
                <th class={`${styles.th} ${styles.deleteCol}`}></th>
              </tr>
            </thead>
            <tbody>
              <For each={entries}>
                {(entry) => {
                  const isThisRecording = () => recordingId() === entry.id;
                  return (
                    <tr>
                      <td class={styles.td}>
                        <input
                          type="text"
                          value={entry.name}
                          onInput={(e) => updateField(entry.id, "name", e.currentTarget.value)}
                          placeholder="e.g. save"
                          class="input"
                        />
                      </td>
                      <td class={styles.td}>
                        <input
                          type="text"
                          value={entry.description}
                          onInput={(e) => updateField(entry.id, "description", e.currentTarget.value)}
                          placeholder="e.g. Save current file"
                          class="input"
                        />
                      </td>
                      <td class={styles.td}>
                        <div class={styles.shortcutCell}>
                          <Show when={isThisRecording() && pendingChords().length > 0}>
                            <For each={pendingChords()}>
                              {(chord) => <kbd class="kbd kbd-accent">{comboToLabel(chord)}</kbd>}
                            </For>
                          </Show>
                          <Show when={!isThisRecording() && entry.shortcut}>
                            <kbd class="kbd">{comboToLabel(entry.shortcut)}</kbd>
                          </Show>
                          <button
                            onClick={() => recordForRow(entry.id)}
                            disabled={recordingId() !== null}
                            class={`btn-sm ${isThisRecording() ? "btn-recording" : ""}`}
                          >
                            {isThisRecording()
                              ? pendingChords().length > 0
                                ? "Next chord (Esc to finish)"
                                : "Press key (Esc to cancel)"
                              : entry.shortcut ? "Rebind" : "Record"}
                          </button>
                        </div>
                      </td>
                      <td class={`${styles.td} ${styles.deleteCol}`}>
                        <button
                          onClick={() => deleteEntry(entry.id)}
                          class="btn-sm btn-danger"
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
        <details class={styles.jsonOutput}>
          <summary class={styles.jsonSummary}>JSON output</summary>
          <pre class={styles.jsonPre}>
            {getExportJson()}
          </pre>
        </details>
      </Show>
    </div>
  );
}
