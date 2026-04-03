import { createSignal, onMount, onCleanup, For } from "solid-js";
import { createStore, produce } from "solid-js/store";
import {
  createHotkeys,
  displayShortcut as fmt,
  type BindingOptions,
} from "hotter-keys";

// ── Binding definitions (single source of truth) ─────────────────────────────

interface Binding {
  /** Raw shortcut string, e.g. "mod+k" */
  raw: string;
  action: string;
  options?: BindingOptions;
  /** Special handler override (e.g. open modal). If not set, just logs. */
  handler?: "openModal";
}

const LAYER_COLORS: Record<string, string> = {
  global: "purple",
  editor: "green",
  canvas: "blue",
  modal: "orange",
};

// prettier-ignore
const BINDINGS: Binding[] = [
  // Global (always active)
  { raw: "mod+p",       action: "Open modal",         handler: "openModal" },
  { raw: "mod+s",       action: "Save" },
  { raw: "mod+shift+p", action: "Quick search" },
  { raw: "mod+k mod+c", action: "Toggle comment" },

  // Editor layer
  { raw: "mod+z",       action: "Undo",                options: { layer: "editor" } },
  { raw: "mod+shift+z", action: "Redo",                options: { layer: "editor" } },

  // Canvas layer
  { raw: "mod+d",       action: "Duplicate",           options: { layer: "canvas" } },
  { raw: "mod+g",       action: "Group",               options: { layer: "canvas" } },

  // Modal layer
  { raw: "mod+1",       action: "Copy link",           options: { layer: "modal" } },
  { raw: "mod+2",       action: "Export",              options: { layer: "modal" } },
  { raw: "mod+3",       action: "Delete",              options: { layer: "modal" } },

  // Scoped (same key, different action per scope)
  { raw: "mod+z",       action: "Undo text",           options: { scope: "text-editor" } },
  { raw: "mod+z",       action: "Undo stroke",         options: { scope: "drawing" } },
  { raw: "mod+shift+z", action: "Redo text",           options: { scope: "text-editor" } },
  { raw: "mod+shift+z", action: "Redo stroke",         options: { scope: "drawing" } },
  { raw: "mod+a",       action: "Select all text",     options: { scope: "text-editor" } },
  { raw: "mod+a",       action: "Select all objects",  options: { scope: "drawing" } },
];

// ── Component ────────────────────────────────────────────────────────────────

let nextId = 0;

interface LogEntry {
  id: number;
  shortcut: string;
  action: string;
}

export default function App() {
  const [log, setLog] = createStore<LogEntry[]>([]);
  const [layers, setLayers] = createStore<string[]>(["global"]);
  const [focusedPanel, setFocusedPanel] = createSignal<string | null>(null);
  const [modalOpen, setModalOpen] = createSignal(false);
  const [activeScope, setActiveScope] = createSignal("*");
  let hk: ReturnType<typeof createHotkeys>;
  let dialogRef: HTMLDialogElement | undefined;

  function addLog(shortcut: string, action: string) {
    setLog(
      produce((l) => {
        l.unshift({ id: nextId++, shortcut, action });
        if (l.length > 30) l.length = 30;
      }),
    );
  }

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

    // Register all bindings from the single definition
    for (const b of BINDINGS) {
      const handler = () => {
        addLog(fmt(b.raw), b.action);
        if (b.handler === "openModal") openModal();
      };
      hk.add(b.raw, handler, b.options);
    }

    hk.onLayerChange((l) => setLayers([...l] as string[]));

    (window as any).__hk = hk;
    onCleanup(() => hk.destroy());
  });

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

  const layer = (b: Binding) => b.options?.layer ?? "global";
  const layerColor = (b: Binding) => LAYER_COLORS[layer(b)] ?? "purple";
  const scope = (b: Binding) => b.options?.scope;

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
          <For each={BINDINGS}>
            {(b) => (
              <div class="row">
                <kbd>{fmt(b.raw)}</kbd>
                <span class="flex-1 text-sm">{b.action}</span>
                {scope(b) && <span class="badge badge-green">{scope(b)}</span>}
                <span class={`badge badge-${layerColor(b)}`}>{layer(b)}</span>
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
              <For each={BINDINGS.filter((b) => layer(b) === "editor")}>
                {(b) => <kbd>{fmt(b.raw)}</kbd>}
              </For>
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
              <For each={BINDINGS.filter((b) => layer(b) === "canvas")}>
                {(b) => <kbd>{fmt(b.raw)}</kbd>}
              </For>
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
              <For each={BINDINGS.filter((b) => scope(b) === "text-editor")}>
                {(b) => (
                  <div class="flex gap-sm items-center">
                    <kbd>{fmt(b.raw)}</kbd>
                    <span class="muted text-sm">{b.action}</span>
                  </div>
                )}
              </For>
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
              <For each={BINDINGS.filter((b) => scope(b) === "drawing")}>
                {(b) => (
                  <div class="flex gap-sm items-center">
                    <kbd>{fmt(b.raw)}</kbd>
                    <span class="muted text-sm">{b.action}</span>
                  </div>
                )}
              </For>
            </div>
          </section>
        </div>
      </div>

      {/* Live log */}
      <div class="section">
        <div class="flex items-center justify-between mb-sm">
          <h2 style={{ margin: "0" }}>Event Log</h2>
          {log.length > 0 && (
            <button class="btn btn-ghost btn-sm" onClick={() => setLog([])}>
              clear
            </button>
          )}
        </div>
        <div class="card log-scroll">
          {log.length === 0 ? (
            <div
              class="row muted"
              style={{ "justify-content": "center", padding: "1.5rem" }}
            >
              Press a shortcut to see it here...
            </div>
          ) : (
            <For each={log}>
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
            <For each={BINDINGS.filter((b) => layer(b) === "modal")}>
              {(b) => (
                <div class="row">
                  <kbd>{fmt(b.raw)}</kbd>
                  <span class="flex-1 text-sm">{b.action}</span>
                </div>
              )}
            </For>
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
          <For each={layers}>
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
