import { setupSentinel, formatTime, hkLog, type DevtoolsLogEntry } from './shared.js';

const MAX_ENTRIES = 500;

const KEYBOARD_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M6 12h.01"/><path d="M10 12h.01"/><path d="M14 12h.01"/><path d="M18 12h.01"/><path d="M8 16h8"/></svg>`;

export default {
  id: 'hotter-keys-devtools',
  name: 'Hotter Keys',
  icon: KEYBOARD_ICON,

  init(canvas: ShadowRoot, app: any, _server: any) {
    const entries: DevtoolsLogEntry[] = [];
    let panelOpen = false;

    // --- Styles (scoped to shadow DOM) ---
    const style = document.createElement('style');
    style.textContent = `
      :host { font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace; }
      .hk-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
      .hk-title { font-weight: 600; font-size: 14px; color: white; }
      .hk-log { overflow-y: auto; max-height: 400px; scrollbar-width: thin; }
      .hk-entry { display: flex; gap: 8px; align-items: center; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
      .hk-time { color: rgba(255,255,255,0.4); font-size: 11px; flex-shrink: 0; min-width: 80px; }
      .hk-detail { color: rgba(255,255,255,0.85); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .hk-empty { padding: 24px 0; text-align: center; color: rgba(255,255,255,0.4); font-size: 12px; }
    `;
    canvas.append(style);

    // --- Window container ---
    const win = document.createElement('astro-dev-toolbar-window');
    canvas.append(win);

    // --- Header ---
    const header = document.createElement('div');
    header.className = 'hk-header';

    const title = document.createElement('span');
    title.className = 'hk-title';
    title.textContent = 'Event Log';

    const clearBtn = document.createElement('astro-dev-toolbar-button');
    clearBtn.setAttribute('size', 'small');
    clearBtn.textContent = 'Clear';

    header.append(title, clearBtn);
    win.append(header);

    // --- Log ---
    const log = document.createElement('div');
    log.className = 'hk-log';

    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'hk-empty';
    emptyMsg.textContent = 'Waiting for events\u2026';
    log.append(emptyMsg);

    win.append(log);

    // --- Toggle handling ---
    app.onToggled(({ state }: { state: boolean }) => {
      panelOpen = state;
      if (state) {
        app.toggleNotification({ state: false });
      }
    });

    // --- Clear ---
    clearBtn.addEventListener('click', () => {
      entries.length = 0;
      log.innerHTML = '';
      log.append(emptyMsg);
    });

    // --- Render entry ---
    function renderEntry(entry: DevtoolsLogEntry): HTMLElement {
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

    // --- Push entry ---
    function pushEntry(entry: DevtoolsLogEntry) {
      entries.push(entry);
      if (entries.length > MAX_ENTRIES) {
        entries.shift();
        log.firstElementChild?.remove();
      }

      if (emptyMsg.parentNode) emptyMsg.remove();

      const el = renderEntry(entry);
      log.append(el);

      const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
      if (nearBottom) el.scrollIntoView({ block: 'end' });

      if (!panelOpen) {
        app.toggleNotification({ state: true, level: 'info' });
      }
    }

    // --- Wire up ---
    hkLog('toolbar app init called');
    const events = (globalThis as any).__HOTTER_KEYS_EVENTS__ as string[] | undefined;
    setupSentinel(pushEntry, events ? { events: events as any } : undefined);
  },
};
