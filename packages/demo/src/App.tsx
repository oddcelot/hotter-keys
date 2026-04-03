import { createSignal, onMount, onCleanup, For } from 'solid-js';
import { createHotkeys, isMac } from 'hotter-keys';

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
}

const mod = isMac() ? '\u2318' : 'Ctrl';

const SHORTCUTS: ShortcutInfo[] = [
  { keys: `${mod}+K`,           action: 'Command palette', layer: 'global',  layerColor: 'purple' },
  { keys: `${mod}+S`,           action: 'Save',            layer: 'global',  layerColor: 'purple' },
  { keys: `${mod}+Shift+P`,     action: 'Quick actions',   layer: 'global',  layerColor: 'purple' },
  { keys: `${mod}+K ${mod}+C`,  action: 'Toggle comment',  layer: 'global',  layerColor: 'purple' },
  { keys: `${mod}+Z`,           action: 'Undo',            layer: 'editor',  layerColor: 'green' },
  { keys: `${mod}+Shift+Z`,     action: 'Redo',            layer: 'editor',  layerColor: 'green' },
  { keys: `${mod}+D`,           action: 'Duplicate',       layer: 'canvas',  layerColor: 'blue' },
  { keys: `${mod}+G`,           action: 'Group',           layer: 'canvas',  layerColor: 'blue' },
  { keys: `${mod}+1`,           action: 'Modal action 1',  layer: 'modal',   layerColor: 'orange' },
  { keys: `${mod}+2`,           action: 'Modal action 2',  layer: 'modal',   layerColor: 'orange' },
];

let nextId = 0;

export default function App() {
  const [log, setLog] = createSignal<LogEntry[]>([]);
  const [layers, setLayers] = createSignal<string[]>(['global']);
  const [focusedPanel, setFocusedPanel] = createSignal<string | null>(null);
  let hk: ReturnType<typeof createHotkeys>;

  function addLog(shortcut: string, action: string) {
    setLog((prev) => [{ id: nextId++, shortcut, action }, ...prev].slice(0, 30));
  }

  onMount(() => {
    hk = createHotkeys();

    // Global shortcuts (always active)
    hk.add('mod+k', () => addLog(`${mod}+K`, 'Command palette'));
    hk.add('mod+s', () => addLog(`${mod}+S`, 'Save'));
    hk.add('mod+shift+p', () => addLog(`${mod}+Shift+P`, 'Quick actions'));
    hk.add('mod+k mod+c', () => addLog(`${mod}+K ${mod}+C`, 'Toggle comment'));

    // Editor layer shortcuts
    hk.add('mod+z', () => addLog(`${mod}+Z`, 'Undo'), { layer: 'editor' });
    hk.add('mod+shift+z', () => addLog(`${mod}+Shift+Z`, 'Redo'), { layer: 'editor' });

    // Canvas layer shortcuts
    hk.add('mod+d', () => addLog(`${mod}+D`, 'Duplicate'), { layer: 'canvas' });
    hk.add('mod+g', () => addLog(`${mod}+G`, 'Group'), { layer: 'canvas' });

    // Modal layer shortcuts
    hk.add('mod+1', () => addLog(`${mod}+1`, 'Modal action 1'), { layer: 'modal' });
    hk.add('mod+2', () => addLog(`${mod}+2`, 'Modal action 2'), { layer: 'modal' });

    hk.onLayerChange((l) => setLayers([...l]));

    (window as any).__hk = hk;
    onCleanup(() => hk.destroy());
  });

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
      <p style={{ 'margin-bottom': '1.5rem' }}>
        Open <strong style={{ color: 'var(--hk-ink)' }}>Vite DevTools</strong> and click the keyboard icon to capture events.
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
                <span class={`badge badge-${sc.layerColor}`}>{sc.layer}</span>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Layer controls */}
      <div class="section">
        <h2>Active Layers</h2>
        <div class="flex gap-sm items-center flex-wrap">
          <For each={layers()}>
            {(l) => {
              const active = () => layers().includes(l);
              return (
                <span class={`layer-pill ${active() ? 'layer-pill-active' : 'layer-pill-inactive'}`}>
                  {l}
                </span>
              );
            }}
          </For>
          <span style={{ width: '0.5rem' }} />
          <button class="btn btn-sm" onClick={() => (window as any).__hk?.pushLayer('modal')}>+ modal</button>
          <button class="btn btn-sm" onClick={() => (window as any).__hk?.popLayer('modal')}>- modal</button>
        </div>
      </div>

      {/* Focus-activated layers */}
      <div class="section">
        <h2>Focus-Activated Layers</h2>
        <p class="mb-sm">Click a panel to focus it. Its layer activates on focus and deactivates on blur.</p>
        <div class="panel-grid">
          <div
            class="focus-panel"
            tabIndex={0}
            onFocus={() => focusLayer('editor', 'editor')}
            onBlur={() => blurLayer('editor', 'editor')}
          >
            <div class="focus-panel-label">
              <span class="focus-dot" />
              Editor
            </div>
            <span class="focus-panel-hint">Focus to activate editor layer</span>
            <div class="focus-panel-shortcuts">
              <kbd>{mod}+Z</kbd>
              <kbd>{mod}+Shift+Z</kbd>
            </div>
          </div>
          <div
            class="focus-panel"
            tabIndex={0}
            onFocus={() => focusLayer('canvas', 'canvas')}
            onBlur={() => blurLayer('canvas', 'canvas')}
          >
            <div class="focus-panel-label">
              <span class="focus-dot" />
              Canvas
            </div>
            <span class="focus-panel-hint">Focus to activate canvas layer</span>
            <div class="focus-panel-shortcuts">
              <kbd>{mod}+D</kbd>
              <kbd>{mod}+G</kbd>
            </div>
          </div>
        </div>
      </div>

      {/* Live log */}
      <div class="section">
        <div class="flex items-center justify-between mb-sm">
          <h2 style={{ margin: '0' }}>Event Log</h2>
          {log().length > 0 && (
            <button class="btn btn-ghost btn-sm" onClick={() => setLog([])}>clear</button>
          )}
        </div>
        <div class="card log-scroll">
          {log().length === 0 ? (
            <div class="row muted" style={{ 'justify-content': 'center', padding: '1.5rem' }}>
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
    </div>
  );
}
