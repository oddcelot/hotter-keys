import { For } from "solid-js";
import { LAYER_COLORS, SCOPE_COLORS } from "./bindings";
import { LayerBadge, ScopeBadge } from "./Badge";
import s from "./demo.module.css";

export interface LogEntry {
  id: number;
  shortcut: string;
  action: string;
  layer: string;
  scope?: string;
}

interface Props {
  log: LogEntry[];
  onClear: () => void;
}

export default function EventLog(props: Props) {
  return (
    <div class="mb-6">
      <div class="flex items-center justify-between mb-2">
        <h2>Event Log</h2>
        {props.log.length > 0 && (
          <button class={s.btnGhost} onClick={props.onClear}>
            clear
          </button>
        )}
      </div>
      <div class={`${s.card} ${s.logScroll}`}>
        {props.log.length === 0 ? (
          <div class={`${s.row} text-hk-gray-4 justify-center p-2`}>
            Press a shortcut to see it here...
          </div>
        ) : (
          <For each={props.log}>
            {(entry) => (
              <div class={`${s.row} ${s.rowFired}`}>
                <kbd class={s.kbdFired}>{entry.shortcut}</kbd>
                <span class="flex-1 min-w-0">{entry.action}</span>
                <LayerBadge color={LAYER_COLORS[entry.layer] ?? "purple"}>{entry.layer}</LayerBadge>
                {entry.scope && (
                  <ScopeBadge color={SCOPE_COLORS[entry.scope]}>{entry.scope}</ScopeBadge>
                )}
              </div>
            )}
          </For>
        )}
      </div>
    </div>
  );
}
