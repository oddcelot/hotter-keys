import { For, Show, type Accessor } from "solid-js";

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

interface Props {
  log: Accessor<LogEntry[]>;
  onClear: () => void;
}

export default function PlaygroundEventLog(props: Props) {
  return (
    <div class="section">
      <div class="flex items-center justify-between mb-3">
        <h4 class="section-title mb-0">Event Log</h4>
        <button onClick={props.onClear} class="btn-sm">
          Clear
        </button>
      </div>
      <div class="log-scroll">
        <Show when={props.log().length > 0} fallback={<span class="muted">No events yet</span>}>
          <For each={props.log()}>
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
