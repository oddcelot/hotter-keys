import { styles } from './styles.js';

interface DevtoolsLogEntry {
  type: string;
  detail: string;
  tag: string;
  tagClass: string;
  timestamp: number;
}

const MAX_ENTRIES = 500;

export function createOverlay() {
  const entries: DevtoolsLogEntry[] = [];
  let panelVisible = false;
  let totalCount = 0;

  // --- Inject styles ---
  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);

  // --- Root ---
  const root = document.createElement('div');
  root.className = '__hk-devtools';

  // --- Badge (toggle button) ---
  const badge = document.createElement('div');
  badge.className = '__hk-badge';

  const dot = document.createElement('span');
  dot.className = '__hk-badge-dot';

  const badgeLabel = document.createElement('span');
  badgeLabel.textContent = 'hk';

  const badgeCount = document.createElement('span');
  badgeCount.className = '__hk-badge-count';
  badgeCount.textContent = '0';

  badge.append(dot, badgeLabel, badgeCount);

  // --- Panel ---
  const panel = document.createElement('div');
  panel.className = '__hk-panel';
  panel.hidden = true;

  const header = document.createElement('div');
  header.className = '__hk-header';

  const title = document.createElement('span');
  title.className = '__hk-title';
  title.textContent = 'Hotter Keys — Event Log';

  const actions = document.createElement('div');
  actions.className = '__hk-actions';

  const clearBtn = document.createElement('button');
  clearBtn.className = '__hk-btn';
  clearBtn.textContent = 'Clear';

  actions.append(clearBtn);
  header.append(title, actions);

  const log = document.createElement('div');
  log.className = '__hk-log';

  const emptyMsg = document.createElement('div');
  emptyMsg.className = '__hk-empty';
  emptyMsg.textContent = 'Waiting for events\u2026';
  log.appendChild(emptyMsg);

  panel.append(header, log);
  root.append(panel, badge);
  document.body.appendChild(root);

  // --- Interaction ---
  badge.addEventListener('click', () => {
    panelVisible = !panelVisible;
    panel.hidden = !panelVisible;
  });

  clearBtn.addEventListener('click', () => {
    entries.length = 0;
    totalCount = 0;
    badgeCount.textContent = '0';
    log.innerHTML = '';
    log.appendChild(emptyMsg);
  });

  // --- Rendering ---
  function formatTime(ts: number): string {
    const d = new Date(ts);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${h}:${m}:${s}.${ms}`;
  }

  function renderEntry(entry: DevtoolsLogEntry): HTMLElement {
    const row = document.createElement('div');
    row.className = '__hk-entry';

    const time = document.createElement('span');
    time.className = '__hk-time';
    time.textContent = formatTime(entry.timestamp);

    const tag = document.createElement('span');
    tag.className = `__hk-tag ${entry.tagClass}`;
    tag.textContent = entry.tag;

    const detail = document.createElement('span');
    detail.className = '__hk-detail';
    detail.textContent = entry.detail;

    row.append(time, tag, detail);
    return row;
  }

  // --- Public API ---
  function push(entry: DevtoolsLogEntry) {
    entries.push(entry);
    if (entries.length > MAX_ENTRIES) entries.shift();

    totalCount++;
    badgeCount.textContent = String(totalCount);

    if (emptyMsg.parentNode) emptyMsg.remove();

    const el = renderEntry(entry);
    log.appendChild(el);

    // Auto-scroll if near bottom
    const isNearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
    if (isNearBottom) {
      el.scrollIntoView({ block: 'end' });
    }
  }

  function destroy() {
    root.remove();
    styleEl.remove();
  }

  return { push, destroy };
}
