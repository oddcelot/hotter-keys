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
}

const mod = isMac() ? '\u2318' : 'Ctrl';

const SHORTCUTS: ShortcutInfo[] = [
  { keys: `${mod}+K`, action: 'Command palette', layer: 'global' },
  { keys: `${mod}+S`, action: 'Save', layer: 'global' },
  { keys: `${mod}+Shift+P`, action: 'Quick actions', layer: 'global' },
  { keys: `${mod}+K ${mod}+C`, action: 'Toggle comment', layer: 'global' },
  { keys: `${mod}+Z`, action: 'Undo', layer: 'editor' },
  { keys: `${mod}+Shift+Z`, action: 'Redo', layer: 'editor' },
  { keys: `${mod}+1`, action: 'Modal action 1', layer: 'modal' },
  { keys: `${mod}+2`, action: 'Modal action 2', layer: 'modal' },
];

let nextId = 0;

export default function App() {
  const [log, setLog] = createSignal<LogEntry[]>([]);
  const [layers, setLayers] = createSignal<string[]>(['global']);

  function addLog(shortcut: string, action: string) {
    setLog((prev) => [{ id: nextId++, shortcut, action }, ...prev].slice(0, 30));
  }

  onMount(() => {
    const hk = createHotkeys();

    hk.add('mod+k', () => addLog(`${mod}+K`, 'Command palette'));
    hk.add('mod+s', () => addLog(`${mod}+S`, 'Save'));
    hk.add('mod+shift+p', () => addLog(`${mod}+Shift+P`, 'Quick actions'));
    hk.add('mod+k mod+c', () => addLog(`${mod}+K ${mod}+C`, 'Toggle comment'));

    hk.add('mod+z', () => addLog(`${mod}+Z`, 'Undo'), { layer: 'editor' });
    hk.add('mod+shift+z', () => addLog(`${mod}+Shift+Z`, 'Redo'), { layer: 'editor' });

    hk.add('mod+1', () => addLog(`${mod}+1`, 'Modal action 1'), { layer: 'modal' });
    hk.add('mod+2', () => addLog(`${mod}+2`, 'Modal action 2'), { layer: 'modal' });

    hk.onLayerChange((l) => setLayers([...l]));
    hk.pushLayer('editor');

    (window as any).__hk = hk;
    onCleanup(() => hk.destroy());
  });

  const layerColor = (layer: string) =>
    layer === 'global' ? '#6366f1' : layer === 'editor' ? '#059669' : '#d97706';

  return (
    <div style={{ 'max-width': '600px', margin: '48px auto', 'font-family': 'system-ui, sans-serif', padding: '0 16px' }}>
      <h1 style={{ 'font-size': '22px', 'margin-bottom': '4px' }}>Hotter Keys Demo</h1>
      <p style={{ color: '#888', 'margin-bottom': '24px', 'font-size': '14px' }}>
        Open <strong>Vite DevTools</strong> and click the keyboard icon to capture events.
      </p>

      {/* Shortcut reference */}
      <h2 style={{ 'font-size': '14px', 'margin-bottom': '8px', color: '#555' }}>Registered Shortcuts</h2>
      <div style={{ 'margin-bottom': '24px', 'border-radius': '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <For each={SHORTCUTS}>
          {(sc) => (
            <div style={{
              display: 'flex', 'align-items': 'center', gap: '12px',
              padding: '8px 14px', 'border-bottom': '1px solid #f3f4f6', 'font-size': '13px',
            }}>
              <kbd style={{
                'font-family': 'ui-monospace, monospace', 'font-size': '12px', 'font-weight': '600',
                background: '#f9fafb', border: '1px solid #e5e7eb', padding: '2px 8px',
                'border-radius': '4px', 'min-width': '120px', 'text-align': 'center',
                'box-shadow': '0 1px 0 #d1d5db',
              }}>
                {sc.keys}
              </kbd>
              <span style={{ flex: '1', color: '#374151' }}>{sc.action}</span>
              <span style={{
                'font-size': '10px', 'font-weight': '600', 'text-transform': 'uppercase',
                'letter-spacing': '0.05em', color: layerColor(sc.layer),
                background: `${layerColor(sc.layer)}15`, padding: '2px 8px', 'border-radius': '3px',
              }}>
                {sc.layer}
              </span>
            </div>
          )}
        </For>
      </div>

      {/* Layer controls */}
      <h2 style={{ 'font-size': '14px', 'margin-bottom': '8px', color: '#555' }}>Active Layers</h2>
      <div style={{ 'margin-bottom': '24px', display: 'flex', gap: '8px', 'align-items': 'center', 'flex-wrap': 'wrap' }}>
        <For each={layers()}>
          {(l) => (
            <span style={{
              padding: '3px 10px', 'border-radius': '4px', 'font-size': '12px',
              'font-family': 'ui-monospace, monospace', 'font-weight': '600',
              color: layerColor(l), background: `${layerColor(l)}12`,
              border: `1px solid ${layerColor(l)}30`,
            }}>
              {l}
            </span>
          )}
        </For>
        <span style={{ 'margin-left': '4px' }} />
        <button
          onClick={() => (window as any).__hk?.pushLayer('modal')}
          style={{ 'font-size': '12px', padding: '3px 10px', cursor: 'pointer' }}
        >
          + modal
        </button>
        <button
          onClick={() => (window as any).__hk?.popLayer('modal')}
          style={{ 'font-size': '12px', padding: '3px 10px', cursor: 'pointer' }}
        >
          - modal
        </button>
      </div>

      {/* Live log */}
      <h2 style={{ 'font-size': '14px', 'margin-bottom': '8px', color: '#555' }}>
        Event Log
        {log().length > 0 && (
          <button
            onClick={() => setLog([])}
            style={{ 'margin-left': '8px', 'font-size': '11px', color: '#999', cursor: 'pointer', background: 'none', border: 'none' }}
          >
            clear
          </button>
        )}
      </h2>
      <div style={{
        border: '1px solid #e5e7eb', 'border-radius': '8px', 'font-size': '13px',
        'max-height': '260px', 'overflow-y': 'auto',
      }}>
        {log().length === 0 ? (
          <div style={{ padding: '32px', 'text-align': 'center', color: '#bbb' }}>Press a shortcut to see it here...</div>
        ) : (
          <For each={log()}>
            {(entry) => (
              <div style={{ display: 'flex', gap: '12px', padding: '6px 14px', 'border-bottom': '1px solid #f3f4f6', 'align-items': 'center' }}>
                <kbd style={{
                  'font-family': 'ui-monospace, monospace', 'font-size': '12px', 'font-weight': '600',
                  background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '2px 8px',
                  'border-radius': '4px', 'min-width': '110px', 'text-align': 'center',
                  color: '#166534',
                }}>
                  {entry.shortcut}
                </kbd>
                <span style={{ color: '#555' }}>{entry.action}</span>
              </div>
            )}
          </For>
        )}
      </div>
    </div>
  );
}
