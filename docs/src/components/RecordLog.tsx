import { For, Show } from "solid-js";
import { eventLog, clearLog } from "./state";

export interface LogEntry {
  id: number;
  time: string;
  text: string;
  type: "shortcut" | "sequence" | "record";
}

const LOG_BADGE_CLASS: Record<string, string> = {
  shortcut: "badge badge-green",
  sequence: "badge badge-blue",
  record: "badge badge-purple",
};

export default function RecordLog() {
  return (
    <div class="section">
      <div class="flex items-center justify-between mb-3">
        <h4 class="section-title mb-0">Event Log</h4>
        <button onClick={clearLog} class="btn-sm">
          Clear
        </button>
      </div>
      <div class="log-scroll">
        <Show when={eventLog().length > 0} fallback={<span class="muted">No events yet</span>}>
          <For each={eventLog()}>
            {(entry) => (
              <div class="log-entry">
                <span class="log-time">{entry.time}</span>{" "}
                <span class={`${LOG_BADGE_CLASS[entry.type]} log-badge`}>{entry.type}</span>
                {entry.text}
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
