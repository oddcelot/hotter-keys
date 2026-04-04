import { For } from "solid-js";

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
    <div class="section">
      <div class="flex items-center justify-between mb-sm">
        <h2 style={{ margin: "0" }}>Event Log</h2>
        {props.log.length > 0 && (
          <button class="btn btn-ghost btn-sm" onClick={props.onClear}>
            clear
          </button>
        )}
      </div>
      <div class="card log-scroll">
        {props.log.length === 0 ? (
          <div
            class="row muted"
            style={{ "justify-content": "center", padding: "1.5rem" }}
          >
            Press a shortcut to see it here...
          </div>
        ) : (
          <For each={props.log}>
            {(entry) => (
              <div class="row row-fired">
                <kbd class="fired">{entry.shortcut}</kbd>
                <span class="flex-1 text-sm">{entry.action}</span>
                <span class="badge badge-purple">{entry.layer}</span>
                {entry.scope && <span class="badge badge-green">{entry.scope}</span>}
              </div>
            )}
          </For>
        )}
      </div>
    </div>
  );
}
