import { For } from "solid-js";
import Badge from "../components/Badge";

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
        <h2 style={{ margin: "0" }}>Event Log</h2>
        {props.log.length > 0 && (
          <button class="btn-ghost" onClick={props.onClear}>
            clear
          </button>
        )}
      </div>
      <div class="card log-scroll">
        {props.log.length === 0 ? (
          <div
            class="row text-hk-gray-4"
            style={{ "justify-content": "center", padding: "1.5rem" }}
          >
            Press a shortcut to see it here...
          </div>
        ) : (
          <For each={props.log}>
            {(entry) => (
              <div class="row row-fired">
                <kbd class="fired">{entry.shortcut}</kbd>
                <span class="flex-1 min-w-0 ">{entry.action}</span>
                <Badge color="purple">{entry.layer}</Badge>
                {entry.scope && <Badge color="green">{entry.scope}</Badge>}
              </div>
            )}
          </For>
        )}
      </div>
    </div>
  );
}
