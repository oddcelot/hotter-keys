import { For } from "solid-js";
import { LayerBadge, ScopeBadge } from "../components/Badge";

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
          <button class="btn-ghost" onClick={props.onClear}>
            clear
          </button>
        )}
      </div>
      <div class="card log-scroll">
        {props.log.length === 0 ? (
          <div class="row text-hk-gray-4 justify-center p-2">
            Press a shortcut to see it here...
          </div>
        ) : (
          <For each={props.log}>
            {(entry) => (
              <div class="row row-fired">
                <kbd class="fired">{entry.shortcut}</kbd>
                <span class="flex-1 min-w-0 ">{entry.action}</span>
                <LayerBadge color="purple">{entry.layer}</LayerBadge>
                {entry.scope && <ScopeBadge>{entry.scope}</ScopeBadge>}
              </div>
            )}
          </For>
        )}
      </div>
    </div>
  );
}
