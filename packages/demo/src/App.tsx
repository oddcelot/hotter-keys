import { createSignal, onMount, onCleanup, For } from 'solid-js';
import { createHotkeys } from 'hotter-keys';

interface LogEntry {
  id: number;
  shortcut: string;
  action: string;
}

let nextId = 0;

export default function App() {
  const [log, setLog] = createSignal<LogEntry[]>([]);
  const [layers, setLayers] = createSignal<string[]>(['global']);

  function addLog(shortcut: string, action: string) {
    setLog((prev) => [{ id: nextId++, shortcut, action }, ...prev].slice(0, 30));
  }

  onMount(() => {
    const hk = createHotkeys();

    // Global shortcuts
    hk.add('mod+k', () => addLog('Mod+K', 'Command palette'));
    hk.add('mod+s', () => addLog('Mod+S', 'Save'));
    hk.add('mod+shift+p', () => addLog('Mod+Shift+P', 'Quick actions'));
    hk.add('mod+k mod+c', () => addLog('Mod+K Mod+C', 'Toggle comment'));

    // Editor layer
    hk.add('mod+z', () => addLog('Mod+Z', 'Undo'), { layer: 'editor' });
    hk.add('mod+shift+z', () => addLog('Mod+Shift+Z', 'Redo'), { layer: 'editor' });

    // Modal layer
    hk.add('mod+1', () => addLog('Mod+1', 'Modal action 1'), { layer: 'modal' });
    hk.add('mod+2', () => addLog('Mod+2', 'Modal action 2'), { layer: 'modal' });

    hk.onLayerChange((l) => setLayers([...l]));
    hk.pushLayer('editor');

    // Expose for layer buttons
    (window as any).__hk = hk;

    onCleanup(() => hk.destroy());
  });

  return (
    <div style={{ 'max-width': '560px', margin: '48px auto', 'font-family': 'system-ui, sans-serif', padding: '0 16px' }}>
      <h1 style={{ 'font-size': '22px', 'margin-bottom': '4px' }}>Hotter Keys Demo</h1>
      <p style={{ color: '#888', 'margin-bottom': '24px', 'font-size': '14px' }}>
        Open <strong>Vite DevTools</strong> and click the keyboard icon to capture events.
        Then press shortcuts below.
      </p>

      {/* Layer controls */}
      <div style={{ 'margin-bottom': '20px', display: 'flex', gap: '8px', 'align-items': 'center', 'flex-wrap': 'wrap' }}>
        <span style={{ 'font-size': '13px', color: '#666' }}>Layers:</span>
        <For each={layers()}>
          {(l) => (
            <code style={{ padding: '2px 8px', background: '#f0f0f0', 'border-radius': '4px', 'font-size': '12px' }}>{l}</code>
          )}
        </For>
        <span style={{ 'margin-left': '8px' }} />
        <button onClick={() => (window as any).__hk?.pushLayer('modal')}>+ modal</button>
        <button onClick={() => (window as any).__hk?.popLayer('modal')}>- modal</button>
      </div>

      {/* Live log */}
      <div style={{ border: '1px solid #e0e0e0', 'border-radius': '8px', 'font-size': '13px', 'max-height': '320px', 'overflow-y': 'auto' }}>
        {log().length === 0 ? (
          <div style={{ padding: '32px', 'text-align': 'center', color: '#aaa' }}>Press a shortcut...</div>
        ) : (
          <For each={log()}>
            {(entry) => (
              <div style={{ display: 'flex', gap: '12px', padding: '6px 12px', 'border-bottom': '1px solid #f0f0f0' }}>
                <code style={{ 'font-weight': '600', 'min-width': '110px' }}>{entry.shortcut}</code>
                <span style={{ color: '#555' }}>{entry.action}</span>
              </div>
            )}
          </For>
        )}
      </div>
    </div>
  );
}
