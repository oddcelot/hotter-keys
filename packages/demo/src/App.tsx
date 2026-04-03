import { createSignal, onMount, onCleanup, For } from "solid-js";
import { createHotkeys, displayShortcut as fmt } from "hotter-keys";

interface LogEntry {
  id: number;
  shortcut: string;
  action: string;
}

interface ShortcutInfo {
  keys: string;
  action: string;
  layer: string;
  layerColor: string;
  scope?: string;
}

const SHORTCUTS: ShortcutInfo[] = [
  {
    keys: fmt("mod+p"),
    action: "Open modal",
    layer: "global",
    layerColor: "purple",
  },
  { keys: fmt("mod+s"), action: "Save", layer: "global", layerColor: "purple" },
  {
    keys: fmt("mod+shift+p"),
    action: "Quick search",
    layer: "global",
    layerColor: "purple",
  },
  {
    keys: fmt("mod+k mod+c"),
    action: "Toggle comment",
    layer: "global",
    layerColor: "purple",
  },
  { keys: fmt("mod+z"), action: "Undo", layer: "editor", layerColor: "green" },
  {
    keys: fmt("mod+shift+z"),
    action: "Redo",
    layer: "editor",
    layerColor: "green",
  },
  {
    keys: fmt("mod+d"),
    action: "Duplicate",
    layer: "canvas",
    layerColor: "blue",
  },
  { keys: fmt("mod+g"), action: "Group", layer: "canvas", layerColor: "blue" },
  {
    keys: fmt("mod+1"),
    action: "Copy link",
    layer: "modal",
    layerColor: "orange",
  },
  {
    keys: fmt("mod+2"),
    action: "Export",
    layer: "modal",
    layerColor: "orange",
  },
  {
    keys: fmt("mod+3"),
    action: "Delete",
    layer: "modal",
    layerColor: "orange",
  },
  {
    keys: fmt("mod+z"),
    action: "Undo text",
    layer: "global",
    layerColor: "purple",
    scope: "text-editor",
  },
  {
    keys: fmt("mod+z"),
    action: "Undo stroke",
    layer: "global",
    layerColor: "purple",
    scope: "drawing",
  },
  {
    keys: fmt("mod+shift+z"),
    action: "Redo text",
    layer: "global",
    layerColor: "purple",
    scope: "text-editor",
  },
  {
    keys: fmt("mod+shift+z"),
    action: "Redo stroke",
    layer: "global",
    layerColor: "purple",
    scope: "drawing",
  },
  {
    keys: fmt("mod+a"),
    action: "Select all text",
    layer: "global",
    layerColor: "purple",
    scope: "text-editor",
  },
  {
    keys: fmt("mod+a"),
    action: "Select all objects",
    layer: "global",
    layerColor: "purple",
    scope: "drawing",
  },
];

let nextId = 0;

export default function App() {
  const [log, setLog] = createSignal<LogEntry[]>([]);
  const [layers, setLayers] = createSignal<string[]>(["global"]);
  const [focusedPanel, setFocusedPanel] = createSignal<string | null>(null);
  const [modalOpen, setModalOpen] = createSignal(false);
  const [activeScope, setActiveScope] = createSignal("*");
  let hk: ReturnType<typeof createHotkeys>;
  let dialogRef: HTMLDialogElement | undefined;

  function addLog(shortcut: string, action: string) {
    setLog((prev) =>
      [{ id: nextId++, shortcut, action }, ...prev].slice(0, 30),
    );
  }

  onMount(() => {
    hk = createHotkeys();

    // Suppress browser defaults only for globally-bound shortcuts
    const globalKeys = new Set(["s", "p", "k"]);
    const globalShiftKeys = new Set(["p", "z"]);
    const suppress = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && globalKeys.has(k)) e.preventDefault();
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && globalShiftKeys.has(k))
        e.preventDefault();
    };
    document.addEventListener("keydown", suppress, { capture: true });
    onCleanup(() =>
      document.removeEventListener("keydown", suppress, { capture: true }),
    );

    // Global shortcuts (always active)
    hk.add("mod+p", () => {
      addLog(fmt("mod+p"), "Open modal");
      openModal();
    });
    hk.add("mod+s", () => addLog(fmt("mod+s"), "Save"));
    hk.add("mod+shift+p", () => addLog(fmt("mod+shift+p"), "Quick search"));
    hk.add("mod+k mod+c", () => addLog(fmt("mod+k mod+c"), "Toggle comment"));

    // Editor layer shortcuts
    hk.add("mod+z", () => addLog(fmt("mod+z"), "Undo"), { layer: "editor" });
    hk.add("mod+shift+z", () => addLog(fmt("mod+shift+z"), "Redo"), {
      layer: "editor",
    });

    // Canvas layer shortcuts
    hk.add("mod+d", () => addLog(fmt("mod+d"), "Duplicate"), {
      layer: "canvas",
    });
    hk.add("mod+g", () => addLog(fmt("mod+g"), "Group"), { layer: "canvas" });

    // Modal layer shortcuts (only active when modal is open)
    hk.add("mod+1", () => addLog(fmt("mod+1"), "Copy link"), {
      layer: "modal",
    });
    hk.add("mod+2", () => addLog(fmt("mod+2"), "Export"), { layer: "modal" });
    hk.add("mod+3", () => addLog(fmt("mod+3"), "Delete"), { layer: "modal" });

    // Scoped shortcuts — same key, different behavior per scope
    hk.add("mod+z", () => addLog(fmt("mod+z"), "Undo text"), {
      scope: "text-editor",
    });
    hk.add("mod+z", () => addLog(fmt("mod+z"), "Undo stroke"), {
      scope: "drawing",
    });
    hk.add("mod+shift+z", () => addLog(fmt("mod+shift+z"), "Redo text"), {
      scope: "text-editor",
    });
    hk.add("mod+shift+z", () => addLog(fmt("mod+shift+z"), "Redo stroke"), {
      scope: "drawing",
    });
    hk.add("mod+a", () => addLog(fmt("mod+a"), "Select all text"), {
      scope: "text-editor",
    });
    hk.add("mod+a", () => addLog(fmt("mod+a"), "Select all objects"), {
      scope: "drawing",
    });

    hk.onLayerChange((l) => setLayers([...l]));

    (window as any).__hk = hk;
    onCleanup(() => hk.destroy());
  });

  function openModal() {
    if (modalOpen()) return;
    setModalOpen(true);
    hk.pushLayer("modal");
    dialogRef?.showModal();
  }

  function closeModal() {
    if (!modalOpen()) return;
    setModalOpen(false);
    hk.popLayer("modal");
    dialogRef?.close();
  }

  function switchScope(scope: string) {
    hk.setScope(scope);
    setActiveScope(scope);
  }

  function focusLayer(panel: string, layer: string) {
    setFocusedPanel(panel);
    hk.pushLayer(layer);
  }

  function blurLayer(panel: string, layer: string) {
    if (focusedPanel() === panel) {
      setFocusedPanel(null);
      hk.popLayer(layer);
    }
  }

  return (
    <div class="container">
      <h1>Hotter Keys Demo</h1>
      <p style={{ "margin-bottom": "1.5rem" }}>
        Open <strong style={{ color: "var(--hk-ink)" }}>Vite DevTools</strong>{" "}
        and click the keyboard icon to capture events.
      </p>

      {/* Shortcut reference */}
      <div class="section">
        <h2>Registered Shortcuts</h2>
        <div class="card">
          <For each={SHORTCUTS}>
            {(sc) => (
              <div class="row">
                <kbd>{sc.keys}</kbd>
                <span class="flex-1 text-sm">{sc.action}</span>
                {sc.scope && <span class="badge badge-green">{sc.scope}</span>}
                <span class={`badge badge-${sc.layerColor}`}>{sc.layer}</span>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Focus-activated layers */}
      <div class="section">
        <h2>Layers — Priority &amp; Override</h2>
        <p class="mb-sm">
          Layers form a{" "}
          <strong style={{ color: "var(--hk-ink)" }}>stack</strong>. Higher
          layers consume key events first, preventing lower layers from firing.
          Use layers when UI regions add <em>extra</em> shortcuts on top of a
          base set — like an editor toolbar or a modal overlay. Click a panel to
          push its layer; blur to pop it.
        </p>
        <div class="panel-grid">
          <section
            class="focus-panel"
            tabIndex={0}
            onFocus={() => focusLayer("editor", "editor")}
            onBlur={() => blurLayer("editor", "editor")}
          >
            <div class="focus-panel-label">
              <span class="focus-dot" />
              Editor
            </div>
            <span class="focus-panel-hint">Focus to activate editor layer</span>
            <div class="focus-panel-shortcuts">
              <kbd>{fmt("mod+z")}</kbd>
              <kbd>{fmt("mod+shift+z")}</kbd>
            </div>
          </section>
          <section
            class="focus-panel"
            tabIndex={0}
            onFocus={() => focusLayer("canvas", "canvas")}
            onBlur={() => blurLayer("canvas", "canvas")}
          >
            <div class="focus-panel-label">
              <span class="focus-dot" />
              Canvas
            </div>
            <span class="focus-panel-hint">Focus to activate canvas layer</span>
            <div class="focus-panel-shortcuts">
              <kbd>{fmt("mod+d")}</kbd>
              <kbd>{fmt("mod+g")}</kbd>
            </div>
          </section>
        </div>
      </div>

      {/* Scoped shortcuts */}
      <div class="section">
        <h2>Scopes — Context Switching</h2>
        <p class="mb-sm">
          Scopes <strong style={{ color: "var(--hk-ink)" }}>filter</strong>{" "}
          which bindings are considered. Only the active scope's bindings fire —
          others are invisible. Use scopes when the <em>same</em> key combo
          should do different things depending on context, like {fmt("mod+z")}{" "}
          meaning "undo text" in an editor vs "undo stroke" on a canvas. Click a
          panel to switch scope.
        </p>
        <div class="flex gap-sm items-center mb-sm">
          <span class="text-sm muted">Active scope:</span>
          <span class="badge badge-purple">{activeScope()}</span>
        </div>
        <div class="panel-grid">
          <section
            class="focus-panel"
            tabIndex={0}
            onFocus={() => switchScope("text-editor")}
          >
            <div class="focus-panel-label">
              <span class="focus-dot" />
              Text Editor
            </div>
            <span class="focus-panel-hint">scope: text-editor</span>
            <div class="focus-panel-shortcuts">
              <div class="flex gap-sm items-center">
                <kbd>{fmt("mod+z")}</kbd>{" "}
                <span class="muted text-sm">Undo text</span>
              </div>
              <div class="flex gap-sm items-center">
                <kbd>{fmt("mod+shift+z")}</kbd>{" "}
                <span class="muted text-sm">Redo text</span>
              </div>
              <div class="flex gap-sm items-center">
                <kbd>{fmt("mod+a")}</kbd>{" "}
                <span class="muted text-sm">Select all text</span>
              </div>
            </div>
          </section>
          <section
            class="focus-panel"
            tabIndex={0}
            onFocus={() => switchScope("drawing")}
          >
            <div class="focus-panel-label">
              <span class="focus-dot" />
              Drawing Canvas
            </div>
            <span class="focus-panel-hint">scope: drawing</span>
            <div class="focus-panel-shortcuts">
              <div class="flex gap-sm items-center">
                <kbd>{fmt("mod+z")}</kbd>{" "}
                <span class="muted text-sm">Undo stroke</span>
              </div>
              <div class="flex gap-sm items-center">
                <kbd>{fmt("mod+shift+z")}</kbd>{" "}
                <span class="muted text-sm">Redo stroke</span>
              </div>
              <div class="flex gap-sm items-center">
                <kbd>{fmt("mod+a")}</kbd>{" "}
                <span class="muted text-sm">Select all objects</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Live log */}
      <div class="section">
        <div class="flex items-center justify-between mb-sm">
          <h2 style={{ margin: "0" }}>Event Log</h2>
          {log().length > 0 && (
            <button class="btn btn-ghost btn-sm" onClick={() => setLog([])}>
              clear
            </button>
          )}
        </div>
        <div class="card log-scroll">
          {log().length === 0 ? (
            <div
              class="row muted"
              style={{ "justify-content": "center", padding: "1.5rem" }}
            >
              Press a shortcut to see it here...
            </div>
          ) : (
            <For each={log()}>
              {(entry) => (
                <div class="row row-fired">
                  <kbd class="fired">{entry.shortcut}</kbd>
                  <span class="flex-1 text-sm">{entry.action}</span>
                </div>
              )}
            </For>
          )}
        </div>
      </div>

      {/* Modal dialog — pushes "modal" layer when open */}
      <dialog
        ref={dialogRef}
        class="modal-dialog"
        onClose={closeModal}
        onClick={(e) => {
          if (e.target === dialogRef) closeModal();
        }}
      >
        <div class="modal-content">
          <div class="flex items-center justify-between mb-sm">
            <h2 style={{ margin: "0", color: "var(--hk-ink)" }}>
              Command Palette
            </h2>
            <span class="badge badge-orange">modal layer</span>
          </div>
          <p class="mb-sm">
            The <strong style={{ color: "var(--hk-ink)" }}>modal</strong> layer
            is pushed on top of the stack. It consumes matching keys before
            lower layers see them. Close the dialog to pop it.
          </p>
          <div class="card">
            <div class="row">
              <kbd>{fmt("mod+1")}</kbd>
              <span class="flex-1 text-sm">Copy link</span>
            </div>
            <div class="row">
              <kbd>{fmt("mod+2")}</kbd>
              <span class="flex-1 text-sm">Export</span>
            </div>
            <div class="row">
              <kbd>{fmt("mod+3")}</kbd>
              <span class="flex-1 text-sm">Delete</span>
            </div>
          </div>
          <div style={{ "margin-top": "0.75rem", "text-align": "right" }}>
            <button class="btn" onClick={closeModal}>
              Close{" "}
              <kbd
                style={{
                  "font-size": "0.55rem",
                  "min-width": "auto",
                  padding: "0 0.3rem",
                  "margin-left": "0.3rem",
                }}
              >
                Esc
              </kbd>
            </button>
          </div>
        </div>
      </dialog>

      {/* Fixed bottom state bar */}
      <div class="layer-bar">
        <div class="flex gap-sm items-center flex-wrap">
          <h2 style={{ margin: "0" }}>State</h2>
          <span class="muted text-sm">Layers:</span>
          <For each={layers()}>
            {(l) => <span class="layer-pill layer-pill-active">{l}</span>}
          </For>
          <span class="muted text-sm" style={{ "margin-left": "0.25rem" }}>
            Scope:
          </span>
          <span class="badge badge-green">{activeScope()}</span>
          <span class="flex-1" />
          <button class="btn btn-sm" onClick={openModal}>
            Open Modal{" "}
            <kbd
              style={{
                "font-size": "0.55rem",
                "min-width": "auto",
                padding: "0 0.3rem",
                "margin-left": "0.3rem",
              }}
            >
              {fmt("mod+p")}
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
