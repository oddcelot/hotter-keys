import { createSignal, onMount, onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { createHotkeys, displayShortcut as fmt } from "hotter-keys";
import { BINDINGS } from "./bindings";
import ShortcutTable from "./sections/ShortcutTable";
import LayerPanels from "./sections/LayerPanels";
import ScopePanels from "./sections/ScopePanels";
import EventLog, { type LogEntry } from "./sections/EventLog";
import ModalDialog from "./sections/ModalDialog";
import StateBar from "./sections/StateBar";

let nextId = 0;

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

  return (
    <div class="container">
      <h1>Hotter Keys Demo</h1>
      <p style={{ "margin-bottom": "1.5rem" }}>
        Open <strong style={{ color: "var(--hk-ink)" }}>Vite DevTools</strong>{" "}
        and click the keyboard icon to capture events.
      </p>

      <ShortcutTable />
      <LayerPanels onFocusLayer={focusLayer} onBlurLayer={blurLayer} />
      <ScopePanels activeScope={activeScope} onSwitchScope={switchScope} />
      <EventLog log={log} onClear={() => setLog([])} />
      <ModalDialog ref={(el) => (dialogRef = el)} onClose={closeModal} />
      <StateBar
        layers={layers}
        activeScope={activeScope}
        onOpenModal={openModal}
      />
    </div>
  );
}
