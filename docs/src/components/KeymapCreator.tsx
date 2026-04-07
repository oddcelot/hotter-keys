import { createSignal, createEffect, onMount, onCleanup, For, Show } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { createHotkeys, recordShortcut } from "@hotter-keys/core";
import type { Hotkeys, RecordedShortcut } from "@hotter-keys/core";
import { loadKeymap, saveKeymap, isOpfsAvailable } from "../lib/opfs";
import type { KeymapEntry } from "../lib/opfs";

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
  if (r.mod2) {
    parts.push("mod2");
  } else if (r.alt) {
    parts.push("alt");
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
        .join("+"),
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
  const [fileHandle, setFileHandle] = createSignal<FileSystemFileHandle | null>(null);
  const [fileName, setFileName] = createSignal<string | null>(null);
  const [firedId, setFiredId] = createSignal<string | null>(null);

  // eslint-disable-next-line no-unassigned-vars -- assigned by Solid's ref={} JSX binding
  let containerRef!: HTMLDivElement;
  let hk: Hotkeys;
  const unbindMap = new Map<string, () => void>();

  const flash = (id: string) => {
    setFiredId(id);
    setTimeout(() => setFiredId((cur) => (cur === id ? null : cur)), 600);
  };

  const rebindAll = () => {
    for (const unsub of unbindMap.values()) unsub();
    unbindMap.clear();
    for (const entry of entries) {
      if (!entry.shortcut) continue;
      try {
        const unsub = hk.add(entry.shortcut, () => flash(entry.id), {
          preventDefault: false,
        });
        unbindMap.set(entry.id, unsub);
      } catch {
        // invalid shortcut string — skip
      }
    }
  };

  // Suppress browser shortcuts while the container is focused:
  // during recording (all keys) and otherwise any Mod+key combos
  // so registered shortcuts can fire without triggering browser actions.
  const suppressBrowserShortcuts = (e: KeyboardEvent) => {
    if (recordingId() !== null) {
      e.preventDefault();
    } else if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
    }
  };

  onMount(async () => {
    hk = createHotkeys({ target: containerRef });
    containerRef.addEventListener("keydown", suppressBrowserShortcuts, { capture: true });
    const available = isOpfsAvailable();
    setOpfsOk(available);
    if (available) {
      const data = await loadKeymap();
      setEntries(data);
    }
    setLoaded(true);
    rebindAll();

    onCleanup(() => {
      hk.destroy();
      containerRef.removeEventListener("keydown", suppressBrowserShortcuts, { capture: true });
    });
  });

  // Re-bind shortcuts whenever entries change
  createEffect(() => {
    entries.forEach((e) => e.shortcut); // track all shortcut fields
    if (!loaded()) return;
    rebindAll();
  });

  const getExportJson = () =>
    JSON.stringify(
      entries.map(({ id: _, ...rest }) => rest),
      null,
      2,
    );

  // Write to a FileSystemFileHandle
  const writeToHandle = async (handle: FileSystemFileHandle, json: string) => {
    const writable = await handle.createWritable();
    await writable.write(json);
    await writable.close();
  };

  // Debounced auto-save: writes to file handle if set, otherwise OPFS
  let saveTimer: ReturnType<typeof setTimeout>;
  createEffect(() => {
    const data = entries.map((e) => ({ ...e }));
    if (!loaded()) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const json = JSON.stringify(data, null, 2);
      const handle = fileHandle();
      if (handle) {
        console.log("[keymap] saving to file", handle.name);
        writeToHandle(handle, json)
          .then(() => console.log("[keymap] saved to file"))
          .catch((err) => console.error("[keymap] file save failed", err));
      } else if (opfsOk()) {
        console.log("[keymap] saving to OPFS", data.length, "entries");
        saveKeymap(data)
          .then(() => console.log("[keymap] saved to OPFS"))
          .catch((err) => console.error("[keymap] OPFS save failed", err));
      }
    }, 500);
  });

  // Pick a file location — all future auto-saves go there
  const saveAs = async () => {
    if ("showSaveFilePicker" in window) {
      try {
        const handle: FileSystemFileHandle = await (window as any).showSaveFilePicker({
          suggestedName: "keymap.json",
          types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
        });
        await writeToHandle(handle, getExportJson());
        setFileHandle(handle);
        setFileName(handle.name);
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return;
      }
    }
    // Fallback: one-time download
    const blob = new Blob([getExportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "keymap.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Open a file — loads data and sets handle for future saves
  const openFile = async () => {
    if ("showOpenFilePicker" in window) {
      try {
        const [handle]: FileSystemFileHandle[] = await (window as any).showOpenFilePicker({
          types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
        });
        const file = await handle.getFile();
        const text = await file.text();
        const data = JSON.parse(text) as Omit<KeymapEntry, "id">[];
        // Assign IDs to loaded entries
        setEntries(data.map((e) => ({ ...e, id: crypto.randomUUID() })) as KeymapEntry[]);
        setFileHandle(handle);
        setFileName(handle.name);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
      }
    } else {
      // Fallback: file input
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const text = await file.text();
        const data = JSON.parse(text) as Omit<KeymapEntry, "id">[];
        setEntries(data.map((e) => ({ ...e, id: crypto.randomUUID() })) as KeymapEntry[]);
        setFileName(file.name);
      };
      input.click();
    }
  };

  const addEntry = () => {
    setEntries(
      produce((list) => {
        list.push({ id: crypto.randomUUID(), name: "", description: "", shortcut: "" });
      }),
    );
  };

  const deleteEntry = (id: string) => {
    setEntries(
      produce((list) => {
        const idx = list.findIndex((e) => e.id === id);
        if (idx !== -1) list.splice(idx, 1);
      }),
    );
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
        if (e.key === "Escape") {
          ac.abort();
          e.preventDefault();
        }
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
    <div ref={containerRef} tabIndex={0} class="demo outline-none">
      {/* Status bar */}
      <div class="flex items-center justify-between mb-4 gap-2">
        <div class="flex items-center gap-2">
          <button onClick={addEntry} class="btn">
            + Add Entry
          </button>
          <button onClick={openFile} class="btn-sm">
            Open
          </button>
          <Show when={entries.length > 0}>
            <button onClick={saveAs} class="btn-sm">
              Save as
            </button>
          </Show>
        </div>
        <Show
          when={fileName()}
          fallback={
            <Show when={!opfsOk() && !fileHandle()}>
              <span class="badge badge-yellow">No file — changes won't persist</span>
            </Show>
          }
        >
          <span class="text-hk-gray-4 hk-label">{fileName()}</span>
        </Show>
      </div>

      {/* Table */}
      <Show
        when={entries.length > 0}
        fallback={
          <div class="border border-dashed border-hk-card-border rounded-[6px] p-8 text-center text-hk-gray-4">
            No entries yet. Click <strong>+ Add Entry</strong> to get started.
          </div>
        }
      >
        <div class="overflow-x-auto">
          <table class="w-full border-collapse">
            <thead>
              <tr class="border-b border-hk-card-border">
                <th class="py-3 px-2 text-left hk-label text-hk-gray-3 font-bold border-b border-hk-rule align-middle">
                  Name
                </th>
                <th class="py-3 px-2 text-left hk-label text-hk-gray-3 font-bold border-b border-hk-rule align-middle">
                  Description
                </th>
                <th class="py-3 px-2 text-left hk-label text-hk-gray-3 font-bold border-b border-hk-rule align-middle min-w-40">
                  Shortcut
                </th>
                <th class="py-3 px-2 text-left hk-label text-hk-gray-3 font-bold border-b border-hk-rule align-middle w-12 text-center"></th>
              </tr>
            </thead>
            <tbody>
              <For each={entries}>
                {(entry) => {
                  const isThisRecording = () => recordingId() === entry.id;
                  const isFired = () => firedId() === entry.id;
                  return (
                    <tr class={isFired() ? "row-fired-green" : ""}>
                      <td class="py-3 px-2 border-b border-hk-rule align-middle transition-opacity duration-150">
                        <input
                          type="text"
                          value={entry.name}
                          onInput={(e) => updateField(entry.id, "name", e.currentTarget.value)}
                          placeholder="e.g. save"
                          class="input"
                        />
                      </td>
                      <td class="py-3 px-2 border-b border-hk-rule align-middle transition-opacity duration-150">
                        <input
                          type="text"
                          value={entry.description}
                          onInput={(e) =>
                            updateField(entry.id, "description", e.currentTarget.value)
                          }
                          placeholder="e.g. Save current file"
                          class="input"
                        />
                      </td>
                      <td class="py-3 px-2 border-b border-hk-rule align-middle transition-opacity duration-150">
                        <div class="flex items-center gap-1 flex-wrap">
                          <Show when={isThisRecording() && pendingChords().length > 0}>
                            <For each={pendingChords()}>
                              {(chord) => <kbd class="kbd kbd-accent">{comboToLabel(chord)}</kbd>}
                            </For>
                          </Show>
                          <Show when={!isThisRecording() && entry.shortcut}>
                            <kbd class="kbd">{comboToLabel(entry.shortcut)}</kbd>
                          </Show>
                          <Show when={isFired()}>
                            <span class="badge badge-green">FIRED</span>
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
                              : entry.shortcut
                                ? "Rebind"
                                : "Record"}
                          </button>
                        </div>
                      </td>
                      <td class="py-3 px-2 border-b border-hk-rule align-middle transition-opacity duration-150 w-12 text-center">
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
        <details class="mt-6">
          <summary class="cursor-pointer text-hk-gray-3 hk-label">JSON output</summary>
          <pre class="mt-2 p-5 bg-hk-card-bg border border-hk-card-border rounded-[6px] overflow-x-auto text-xs">
            {getExportJson()}
          </pre>
        </details>
      </Show>
    </div>
  );
}
