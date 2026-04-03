import { setupSentinel, formatTime, fmtSequence, hkLog, type DevtoolsLogEntry } from './shared.js';

const MAX_LOG_ENTRIES = 500;

const KEYBOARD_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M6 12h.01"/><path d="M10 12h.01"/><path d="M14 12h.01"/><path d="M18 12h.01"/><path d="M8 16h8"/></svg>`;

export default {
  id: 'hotter-keys-devtools',
  name: 'Hotter Keys',
  icon: KEYBOARD_ICON,

  init(canvas: ShadowRoot, app: any, _server: any) {
    // ── State ──────────────────────────────────────────────────────────────

    interface BindingRecord {
      shortcut: any[];
      layer: string;
      scope?: string;
      formatted: string;
    }

    const registry = new Map<string, BindingRecord>();
    let activeLayers: readonly string[] = ['global'];
    const logEntries: DevtoolsLogEntry[] = [];
    let panelOpen = false;
    let activeTab: 'bindings' | 'log' = 'bindings';

    // ── Styles ─────────────────────────────────────────────────────────────

    const style = document.createElement('style');
    style.textContent = `
      :host { font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace; }

      .hk-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
      .hk-tabs { display: flex; gap: 4px; }
      .hk-actions { display: flex; gap: 4px; }

      .hk-panel { overflow-y: auto; max-height: 400px; scrollbar-width: thin; }
      .hk-panel[hidden] { display: none; }

      /* ── Event log ── */
      .hk-entry { display: flex; gap: 8px; align-items: center; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
      .hk-time { color: rgba(255,255,255,0.4); font-size: 11px; flex-shrink: 0; min-width: 80px; }
      .hk-detail { color: rgba(255,255,255,0.85); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .hk-empty { padding: 24px 0; text-align: center; color: rgba(255,255,255,0.4); font-size: 12px; }

      /* ── Bindings panel ── */
      .hk-layer-group { margin-bottom: 12px; }
      .hk-layer-group[data-active="true"] { border-left: 2px solid rgba(76, 175, 80, 0.6); padding-left: 8px; }
      .hk-layer-group[data-active="false"] { border-left: 2px solid rgba(255,255,255,0.1); padding-left: 8px; }
      .hk-layer-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
      .hk-layer-status { font-size: 10px; color: rgba(76, 175, 80, 0.8); text-transform: uppercase; letter-spacing: 0.05em; }
      .hk-binding-list { display: flex; flex-direction: column; gap: 3px; }
      .hk-binding-row { display: flex; align-items: center; gap: 8px; padding: 2px 0; }
      .hk-shortcut {
        font-size: 12px; color: rgba(255,255,255,0.9);
        background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 4px;
      }
      .hk-scope { font-size: 10px; color: rgba(255,255,255,0.35); }
    `;
    canvas.append(style);

    // ── Window ─────────────────────────────────────────────────────────────

    const win = document.createElement('astro-dev-toolbar-window');
    canvas.append(win);

    // ── Header with tabs ───────────────────────────────────────────────────

    const header = document.createElement('div');
    header.className = 'hk-header';

    const tabs = document.createElement('div');
    tabs.className = 'hk-tabs';

    const bindingsTab = document.createElement('astro-dev-toolbar-button');
    bindingsTab.setAttribute('size', 'small');
    bindingsTab.setAttribute('button-style', 'purple');
    bindingsTab.textContent = 'Bindings';

    const logTab = document.createElement('astro-dev-toolbar-button');
    logTab.setAttribute('size', 'small');
    logTab.setAttribute('button-style', 'ghost');
    logTab.textContent = 'Event Log';

    tabs.append(bindingsTab, logTab);

    const actions = document.createElement('div');
    actions.className = 'hk-actions';

    const clearBtn = document.createElement('astro-dev-toolbar-button');
    clearBtn.setAttribute('size', 'small');
    clearBtn.textContent = 'Clear';
    clearBtn.style.display = 'none';

    actions.append(clearBtn);
    header.append(tabs, actions);
    win.append(header);

    // ── Bindings panel ─────────────────────────────────────────────────────

    const bindingsPanel = document.createElement('div');
    bindingsPanel.className = 'hk-panel';

    const bindingsEmpty = document.createElement('div');
    bindingsEmpty.className = 'hk-empty';
    bindingsEmpty.textContent = 'No bindings registered\u2026';
    bindingsPanel.append(bindingsEmpty);

    // ── Log panel ──────────────────────────────────────────────────────────

    const logPanel = document.createElement('div');
    logPanel.className = 'hk-panel';
    logPanel.hidden = true;

    const logEmpty = document.createElement('div');
    logEmpty.className = 'hk-empty';
    logEmpty.textContent = 'Waiting for events\u2026';
    logPanel.append(logEmpty);

    win.append(bindingsPanel, logPanel);

    // ── Tab switching ──────────────────────────────────────────────────────

    function switchTab(tab: 'bindings' | 'log') {
      activeTab = tab;
      bindingsPanel.hidden = tab !== 'bindings';
      logPanel.hidden = tab !== 'log';
      bindingsTab.setAttribute('button-style', tab === 'bindings' ? 'purple' : 'ghost');
      logTab.setAttribute('button-style', tab === 'log' ? 'purple' : 'ghost');
      clearBtn.style.display = tab === 'log' ? '' : 'none';
    }

    bindingsTab.addEventListener('click', () => switchTab('bindings'));
    logTab.addEventListener('click', () => switchTab('log'));

    // ── Toggle handling ────────────────────────────────────────────────────

    app.onToggled(({ state }: { state: boolean }) => {
      panelOpen = state;
      if (state) app.toggleNotification({ state: false });
    });

    // ── Clear log ──────────────────────────────────────────────────────────

    clearBtn.addEventListener('click', () => {
      logEntries.length = 0;
      logPanel.innerHTML = '';
      logPanel.append(logEmpty);
    });

    // ── Bindings panel rendering ───────────────────────────────────────────

    function renderBindingsPanel() {
      bindingsPanel.innerHTML = '';

      if (registry.size === 0) {
        bindingsPanel.append(bindingsEmpty);
        return;
      }

      // Group by layer
      const groups = new Map<string, BindingRecord[]>();
      for (const record of registry.values()) {
        let list = groups.get(record.layer);
        if (!list) { list = []; groups.set(record.layer, list); }
        list.push(record);
      }

      // Sort: active layers first (in stack order), then inactive alphabetically
      const activeSet = new Set(activeLayers);
      const sortedLayers = [...groups.keys()].sort((a, b) => {
        const aActive = activeSet.has(a);
        const bActive = activeSet.has(b);
        if (aActive !== bActive) return aActive ? -1 : 1;
        if (aActive && bActive) return activeLayers.indexOf(a) - activeLayers.indexOf(b);
        return a.localeCompare(b);
      });

      for (const layerName of sortedLayers) {
        const bindings = groups.get(layerName)!;
        const isActive = activeSet.has(layerName);

        const group = document.createElement('div');
        group.className = 'hk-layer-group';
        group.setAttribute('data-active', String(isActive));

        // Header
        const layerHeader = document.createElement('div');
        layerHeader.className = 'hk-layer-header';

        const badge = document.createElement('astro-dev-toolbar-badge');
        badge.setAttribute('badge-style', isActive ? 'green' : 'gray');
        badge.setAttribute('size', 'small');
        badge.textContent = layerName;

        layerHeader.append(badge);

        if (isActive) {
          const status = document.createElement('span');
          status.className = 'hk-layer-status';
          status.textContent = 'active';
          layerHeader.append(status);
        }

        group.append(layerHeader);

        // Binding rows
        const list = document.createElement('div');
        list.className = 'hk-binding-list';

        for (const record of bindings) {
          const row = document.createElement('div');
          row.className = 'hk-binding-row';

          const shortcut = document.createElement('span');
          shortcut.className = 'hk-shortcut';
          shortcut.textContent = record.formatted;

          row.append(shortcut);

          if (record.scope) {
            const scope = document.createElement('span');
            scope.className = 'hk-scope';
            scope.textContent = `scope: ${record.scope}`;
            row.append(scope);
          }

          list.append(row);
        }

        group.append(list);
        bindingsPanel.append(group);
      }
    }

    // ── Raw event handler (for binding registry) ───────────────────────────

    function handleRawEvent(event: any) {
      switch (event.type) {
        case 'binding:added': {
          const formatted = fmtSequence(event.shortcut);
          const layer = event.options?.layer ?? 'global';
          const scope = event.options?.scope;
          const key = `${formatted}|${layer}|${scope ?? ''}`;
          registry.set(key, {
            shortcut: event.shortcut,
            layer,
            scope,
            formatted,
          });
          renderBindingsPanel();
          break;
        }
        case 'binding:removed': {
          const formatted = fmtSequence(event.shortcut);
          for (const [k] of registry) {
            if (k.startsWith(`${formatted}|`)) registry.delete(k);
          }
          renderBindingsPanel();
          break;
        }
        case 'layer:change': {
          activeLayers = event.layers;
          renderBindingsPanel();
          break;
        }
      }
    }

    // ── Log entry rendering ────────────────────────────────────────────────

    function renderLogEntry(entry: DevtoolsLogEntry): HTMLElement {
      const row = document.createElement('div');
      row.className = 'hk-entry';

      const time = document.createElement('span');
      time.className = 'hk-time';
      time.textContent = formatTime(entry.timestamp);

      const badge = document.createElement('astro-dev-toolbar-badge');
      badge.setAttribute('badge-style', entry.badgeColor);
      badge.setAttribute('size', 'small');
      badge.textContent = entry.tag;

      const detail = document.createElement('span');
      detail.className = 'hk-detail';
      detail.textContent = entry.detail;

      row.append(time, badge, detail);
      return row;
    }

    function pushLogEntry(entry: DevtoolsLogEntry) {
      logEntries.push(entry);
      if (logEntries.length > MAX_LOG_ENTRIES) {
        logEntries.shift();
        logPanel.firstElementChild?.remove();
      }

      if (logEmpty.parentNode) logEmpty.remove();

      const el = renderLogEntry(entry);
      logPanel.append(el);

      const nearBottom = logPanel.scrollHeight - logPanel.scrollTop - logPanel.clientHeight < 60;
      if (nearBottom) el.scrollIntoView({ block: 'end' });

      if (!panelOpen) {
        app.toggleNotification({ state: true, level: 'info' });
      }
    }

    // ── Wire up ────────────────────────────────────────────────────────────

    hkLog('toolbar app init called');
    const events = (globalThis as any).__HOTTER_KEYS_EVENTS__ as string[] | undefined;
    setupSentinel(pushLogEntry, events ? { events: events as any } : undefined, handleRawEvent);
  },
};
