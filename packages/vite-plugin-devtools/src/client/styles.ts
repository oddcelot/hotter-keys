export const styles = /* css */ `
.__hk-devtools {
  --hk-bg: #1a1a2e;
  --hk-bg-alt: #16213e;
  --hk-border: #2a2a4a;
  --hk-text: #e0e0e0;
  --hk-text-muted: #888;
  --hk-accent: #7c4dff;
  --hk-green: #4caf50;
  --hk-blue: #2196f3;
  --hk-orange: #ff9800;
  --hk-red: #f44336;
  --hk-cyan: #00bcd4;

  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 2147483647;
  font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
  color: var(--hk-text);
}

.__hk-devtools * {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.__hk-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--hk-bg);
  border: 1px solid var(--hk-border);
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
  transition: border-color 0.15s;
}

.__hk-badge:hover {
  border-color: var(--hk-accent);
}

.__hk-badge-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--hk-green);
  flex-shrink: 0;
}

.__hk-badge-count {
  color: var(--hk-text-muted);
  font-size: 11px;
}

.__hk-panel {
  position: absolute;
  bottom: 40px;
  right: 0;
  width: 420px;
  max-height: 480px;
  background: var(--hk-bg);
  border: 1px solid var(--hk-border);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.__hk-panel[hidden] {
  display: none;
}

.__hk-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--hk-border);
  background: var(--hk-bg-alt);
}

.__hk-title {
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.03em;
}

.__hk-actions {
  display: flex;
  gap: 8px;
}

.__hk-btn {
  background: none;
  border: 1px solid var(--hk-border);
  color: var(--hk-text-muted);
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  font-size: 11px;
  transition: color 0.15s, border-color 0.15s;
}

.__hk-btn:hover {
  color: var(--hk-text);
  border-color: var(--hk-text-muted);
}

.__hk-log {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
  scrollbar-width: thin;
  scrollbar-color: var(--hk-border) transparent;
}

.__hk-log::-webkit-scrollbar {
  width: 6px;
}

.__hk-log::-webkit-scrollbar-track {
  background: transparent;
}

.__hk-log::-webkit-scrollbar-thumb {
  background: var(--hk-border);
  border-radius: 3px;
}

.__hk-entry {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 3px 14px;
  transition: background 0.1s;
}

.__hk-entry:hover {
  background: var(--hk-bg-alt);
}

.__hk-time {
  color: var(--hk-text-muted);
  font-size: 10px;
  flex-shrink: 0;
  min-width: 48px;
}

.__hk-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 3px;
  flex-shrink: 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.__hk-tag--fired    { background: rgba(76, 175, 80, 0.2); color: var(--hk-green); }
.__hk-tag--added    { background: rgba(33, 150, 243, 0.2); color: var(--hk-blue); }
.__hk-tag--removed  { background: rgba(244, 67, 54, 0.2); color: var(--hk-red); }
.__hk-tag--layer    { background: rgba(255, 152, 0, 0.2); color: var(--hk-orange); }
.__hk-tag--scope    { background: rgba(0, 188, 212, 0.2); color: var(--hk-cyan); }
.__hk-tag--held     { background: rgba(124, 77, 255, 0.2); color: var(--hk-accent); }
.__hk-tag--lifecycle { background: rgba(255, 255, 255, 0.1); color: var(--hk-text-muted); }

.__hk-detail {
  color: var(--hk-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.__hk-empty {
  padding: 32px 14px;
  text-align: center;
  color: var(--hk-text-muted);
  font-size: 11px;
}
`;
