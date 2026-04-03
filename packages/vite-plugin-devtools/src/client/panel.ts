import { getDevToolsRpcClient } from '@vitejs/devtools-kit/client';
import { setupSentinel, fmtSequence, type DevtoolsLogEntry } from './shared.js';

interface BindingData {
  formatted: string;
  layer: string;
  scope?: string;
}

interface FiredEntry {
  shortcut: string;
  layer: string;
  time: string;
}

type Tab = 'bindings' | 'events' | 'settings';

// ── State ──────────────────────────────────────────────────────────────────

const registry = new Map<string, BindingData>();
let activeLayers: string[] = ['global'];
const firedLog: FiredEntry[] = [];
let activeTab: Tab = 'bindings';
let notifyOnFired = true;
let rpc: any;

// ── DOM refs ───────────────────────────────────────────────────────────────

const tabBtns = document.querySelectorAll<HTMLButtonElement>('[data-tab]');
const panels = document.querySelectorAll<HTMLElement>('[data-panel]');
const bindingsContent = document.getElementById('bindings-content')!;
const eventsContent = document.getElementById('events-content')!;
const notifyBtn = document.getElementById('notify-toggle')!;
const notifyIcon = document.getElementById('notify-icon')!;
const notifyLabel = document.getElementById('notify-label-text')!;

// ── Tab switching ──────────────────────────────────────────────────────────

function switchTab(tab: Tab) {
  activeTab = tab;
  tabBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  panels.forEach((p) => {
    p.hidden = p.dataset.panel !== tab;
  });
}

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab as Tab));
});

// ── Render bindings ────────────────────────────────────────────────────────

function renderBindings() {
  const groups = new Map<string, BindingData[]>();
  for (const b of registry.values()) {
    let list = groups.get(b.layer);
    if (!list) { list = []; groups.set(b.layer, list); }
    list.push(b);
  }

  const activeSet = new Set(activeLayers);
  const sorted = [...groups.keys()].sort((a, b) => {
    const aA = activeSet.has(a), bA = activeSet.has(b);
    if (aA !== bA) return aA ? -1 : 1;
    if (aA && bA) return activeLayers.indexOf(a) - activeLayers.indexOf(b);
    return a.localeCompare(b);
  });

  // Layer stack
  const stackEl = document.getElementById('layer-stack-badges')!;
  stackEl.innerHTML = '';
  for (const layer of activeLayers) {
    const badge = document.createElement('span');
    badge.className = 'badge badge-success';
    badge.textContent = layer;
    stackEl.appendChild(badge);
  }
  const inactiveWithBindings = [...new Set(registry.values())].map(b => b.layer).filter(l => !activeSet.has(l));
  for (const layer of [...new Set(inactiveWithBindings)]) {
    const badge = document.createElement('span');
    badge.className = 'badge badge-default';
    badge.textContent = layer;
    stackEl.appendChild(badge);
  }

  // Layer groups
  const container = document.getElementById('layer-groups')!;
  container.innerHTML = '';

  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty">No bindings registered yet.</div>';
    return;
  }

  for (const layer of sorted) {
    const bindings = groups.get(layer)!;
    const active = activeSet.has(layer);

    const group = document.createElement('details');
    group.className = 'layer-group';
    group.open = true;

    const summary = document.createElement('summary');
    summary.className = 'layer-header';
    summary.innerHTML = `
      <span class="layer-icon">${active ? '●' : '○'}</span>
      <span class="badge ${active ? 'badge-success' : 'badge-default'}">${layer}</span>
      <span class="layer-status">${active ? 'active' : 'inactive'}</span>
      <span class="layer-count">${bindings.length}</span>
    `;
    group.appendChild(summary);

    const table = document.createElement('table');
    table.className = 'data-table';
    table.innerHTML = `
      <thead><tr><th>Shortcut</th><th>Scope</th></tr></thead>
      <tbody>
        ${bindings.map(b => `<tr><td><code>${b.formatted}</code></td><td>${b.scope ?? '\u2014'}</td></tr>`).join('')}
      </tbody>
    `;
    group.appendChild(table);
    container.appendChild(group);
  }
}

// ── Render events ──────────────────────────────────────────────────────────

function renderEvents() {
  if (firedLog.length === 0) {
    eventsContent.innerHTML = '<div class="empty">No events captured yet. Press a shortcut in the app.</div>';
    return;
  }

  const rows = [...firedLog].reverse();
  eventsContent.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Shortcut</th><th>Layer</th><th>Time</th></tr></thead>
      <tbody>
        ${rows.map(e => `<tr><td><code>${e.shortcut}</code></td><td>${e.layer}</td><td>${e.time}</td></tr>`).join('')}
      </tbody>
    </table>
  `;

  // Update events tab badge
  const badge = document.getElementById('events-badge')!;
  badge.textContent = String(firedLog.length);
  badge.hidden = firedLog.length === 0;
}

// ── Render settings ────────────────────────────────────────────────────────

function renderSettings() {
  notifyBtn.classList.toggle('active', notifyOnFired);
  notifyIcon.textContent = notifyOnFired ? '🔔' : '🔕';
  notifyLabel.textContent = notifyOnFired ? 'On' : 'Off';
}

notifyBtn.addEventListener('click', async () => {
  notifyOnFired = !notifyOnFired;
  renderSettings();
  rpc?.call('hotter-keys:toggle-notify');
});

// ── Push state to server ───────────────────────────────────────────────────

function pushState() {
  rpc?.call('hotter-keys:update-state', {
    bindings: [...registry.values()],
    activeLayers,
    firedLog: firedLog.slice(-50).map(e => ({ shortcut: e.shortcut, layer: e.layer, timestamp: Date.now() })),
  });
}

// ── Sentinel wiring ────────────────────────────────────────────────────────

function onEvent(entry: DevtoolsLogEntry) {
  if (entry.type === 'binding:fired') {
    rpc?.call('hotter-keys:on-fired', { tag: entry.tag, detail: entry.detail });
  }
}

function onRawEvent(event: any) {
  if (event.type === 'binding:fired') {
    firedLog.push({
      shortcut: fmtSequence(event.shortcut),
      layer: event.layer ?? 'global',
      time: new Date(event.timestamp).toLocaleTimeString(),
    });
    if (firedLog.length > 200) firedLog.shift();
    renderEvents();
    pushState();
  }

  switch (event.type) {
    case 'binding:added': {
      const key = fmtSequence(event.shortcut);
      registry.set(key, {
        formatted: key,
        layer: event.options?.layer ?? 'global',
        scope: event.options?.scope,
      });
      renderBindings();
      pushState();
      break;
    }
    case 'binding:removed': {
      registry.delete(fmtSequence(event.shortcut));
      renderBindings();
      pushState();
      break;
    }
    case 'layer:change': {
      activeLayers = [...event.layers];
      renderBindings();
      pushState();
      break;
    }
  }
}

// ── Init ───────────────────────────────────────────────────────────────────

async function init() {
  const client = await getDevToolsRpcClient();
  rpc = client;

  // Load persisted settings from server
  try {
    const settings = await (client.call as any)('hotter-keys:get-settings');
    if (settings) {
      notifyOnFired = settings.notifyOnFired ?? true;
      renderSettings();
    }
  } catch {}

  setupSentinel(onEvent, undefined, onRawEvent);
  renderBindings();
  renderEvents();
  renderSettings();
}

init();
