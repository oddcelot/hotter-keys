import { createSignal, onMount, onCleanup, For } from 'solid-js';
import { createHotkeys, formatShortcut, type Shortcut } from 'hotter-keys';

interface LogEntry {
  id: number;
  shortcut: string;
  action: string;
  timestamp: number;
}

let nextId = 0;

export default function App() {
  const [log, setLog] = createSignal<LogEntry[]>([]);
  const [scope, setScope] = createSignal('default');
  const [layers, setLayers] = createSignal<string[]>(['global']);

  function addLog(shortcut: string, action: string) {
    setLog((prev) => [{ id: nextId++, shortcut, action, timestamp: Date.now() }, ...prev].slice(0, 50));
  }

  onMount(() => {
    const hk = createHotkeys();

    // Global shortcuts
    hk.add('mod+k', () => addLog('Mod+K', 'Open command palette'));
    hk.add('mod+s', () => addLog('Mod+S', 'Save'));
    hk.add('mod+shift+p', () => addLog('Mod+Shift+P', 'Quick actions'));

    // Sequence shortcut
    hk.add('mod+k mod+c', () => addLog('Mod+K Mod+C', 'Toggle comment'));

    // Editor layer shortcuts
    hk.add('mod+z', () => addLog('Mod+Z', 'Undo (editor)'), { layer: 'editor' });
    hk.add('mod+shift+z', () => addLog('Mod+Shift+Z', 'Redo (editor)'), { layer: 'editor' });

    // Modal layer shortcuts
    hk.add('mod+1', () => addLog('Mod+1', 'Modal action 1'), { layer: 'modal' });
    hk.add('mod+2', () => addLog('Mod+2', 'Modal action 2'), { layer: 'modal' });

    hk.onLayerChange((l) => setLayers([...l]));

    // Push editor layer by default
    hk.pushLayer('editor');

    onCleanup(() => hk.destroy());

    // Expose for buttons
    (window as any).__demo_hk = hk;
  });

  function pushLayer(name: string) {
    (window as any).__demo_hk?.pushLayer(name);
  }

  function popLayer(name: string) {
    (window as any).__demo_hk?.popLayer(name);
  }

  return (
    <div style={{ 'max-width': '640px', margin: '40px auto', 'font-family': 'system-ui, sans-serif' }}>
      <h1 style={{ 'font-size': '24px', 'margin-bottom': '8px' }}>Hotter Keys Demo</h1>
      <p style={{ color: '#666', 'margin-bottom': '24px' }}>
        Press keyboard shortcuts to see them logged below. Open the devtools overlay (bottom-right badge) to see the event log.
      </p>

      {/* Layer controls */}
      <div style={{ 'margin-bottom': '24px', padding: '16px', background: '#f5f5f5', 'border-radius': '8px' }}>
        <h2 style={{ 'font-size': '16px', 'margin-bottom': '8px' }}>Layers</h2>
        <div style={{ display: 'flex', gap: '8px', 'align-items': 'center', 'flex-wrap': 'wrap' }}>
          <For each={layers()}>
            {(layer) => (
              <span style={{
                padding: '2px 10px',
                'border-radius': '4px',
                background: '#e0e0e0',
                'font-size': '13px',
                'font-family': 'monospace',
              }}>
                {layer}
              </span>
            )}
          </For>
        </div>
        <div style={{ display: 'flex', gap: '8px', 'margin-top': '12px' }}>
          <button onClick={() => pushLayer('editor')}>Push "editor"</button>
          <button onClick={() => popLayer('editor')}>Pop "editor"</button>
          <button onClick={() => pushLayer('modal')}>Push "modal"</button>
          <button onClick={() => popLayer('modal')}>Pop "modal"</button>
        </div>
      </div>

      {/* Shortcut reference */}
      <div style={{ 'margin-bottom': '24px', padding: '16px', background: '#f0f4ff', 'border-radius': '8px' }}>
        <h2 style={{ 'font-size': '16px', 'margin-bottom': '8px' }}>Registered Shortcuts</h2>
        <table style={{ width: '100%', 'font-size': '13px', 'border-collapse': 'collapse' }}>
          <thead>
            <tr style={{ 'text-align': 'left', 'border-bottom': '1px solid #ccc' }}>
              <th style={{ padding: '4px 8px' }}>Shortcut</th>
              <th style={{ padding: '4px 8px' }}>Action</th>
              <th style={{ padding: '4px 8px' }}>Layer</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={{ padding: '4px 8px', 'font-family': 'monospace' }}>Mod+K</td><td style={{ padding: '4px 8px' }}>Command palette</td><td style={{ padding: '4px 8px' }}>global</td></tr>
            <tr><td style={{ padding: '4px 8px', 'font-family': 'monospace' }}>Mod+S</td><td style={{ padding: '4px 8px' }}>Save</td><td style={{ padding: '4px 8px' }}>global</td></tr>
            <tr><td style={{ padding: '4px 8px', 'font-family': 'monospace' }}>Mod+Shift+P</td><td style={{ padding: '4px 8px' }}>Quick actions</td><td style={{ padding: '4px 8px' }}>global</td></tr>
            <tr><td style={{ padding: '4px 8px', 'font-family': 'monospace' }}>Mod+K Mod+C</td><td style={{ padding: '4px 8px' }}>Toggle comment</td><td style={{ padding: '4px 8px' }}>global</td></tr>
            <tr><td style={{ padding: '4px 8px', 'font-family': 'monospace' }}>Mod+Z</td><td style={{ padding: '4px 8px' }}>Undo</td><td style={{ padding: '4px 8px' }}>editor</td></tr>
            <tr><td style={{ padding: '4px 8px', 'font-family': 'monospace' }}>Mod+Shift+Z</td><td style={{ padding: '4px 8px' }}>Redo</td><td style={{ padding: '4px 8px' }}>editor</td></tr>
            <tr><td style={{ padding: '4px 8px', 'font-family': 'monospace' }}>Mod+1</td><td style={{ padding: '4px 8px' }}>Modal action 1</td><td style={{ padding: '4px 8px' }}>modal</td></tr>
            <tr><td style={{ padding: '4px 8px', 'font-family': 'monospace' }}>Mod+2</td><td style={{ padding: '4px 8px' }}>Modal action 2</td><td style={{ padding: '4px 8px' }}>modal</td></tr>
          </tbody>
        </table>
      </div>

      {/* Live log */}
      <div>
        <h2 style={{ 'font-size': '16px', 'margin-bottom': '8px' }}>
          Action Log
          <button onClick={() => setLog([])} style={{ 'margin-left': '12px', 'font-size': '12px' }}>Clear</button>
        </h2>
        <div style={{
          'max-height': '300px',
          'overflow-y': 'auto',
          border: '1px solid #e0e0e0',
          'border-radius': '8px',
          'font-size': '13px',
        }}>
          {log().length === 0 ? (
            <div style={{ padding: '24px', 'text-align': 'center', color: '#999' }}>
              Press a shortcut to see it here...
            </div>
          ) : (
            <For each={log()}>
              {(entry) => (
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '6px 12px',
                  'border-bottom': '1px solid #f0f0f0',
                  'align-items': 'center',
                }}>
                  <span style={{ 'font-family': 'monospace', 'font-weight': '600', 'min-width': '120px' }}>
                    {entry.shortcut}
                  </span>
                  <span style={{ color: '#444' }}>{entry.action}</span>
                  <span style={{ color: '#aaa', 'margin-left': 'auto', 'font-size': '11px' }}>
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </For>
          )}
        </div>
      </div>
    </div>
  );
}
