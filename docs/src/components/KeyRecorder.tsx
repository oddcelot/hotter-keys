import { Show, type Accessor } from "solid-js";
import { formatShortcut } from "@hotter-keys/core";
import type { RecordedShortcut, Shortcut } from "@hotter-keys/core";

function recordedToShortcut(r: RecordedShortcut): Shortcut {
  return { key: r.key as Shortcut["key"], ctrl: r.ctrl, shift: r.shift, meta: r.meta, alt: r.alt };
}

interface Props {
  recording: Accessor<boolean>;
  recorded: Accessor<RecordedShortcut | null>;
  isRecording: Accessor<boolean>;
  onRecord: () => void;
}

export default function KeyRecorder(props: Props) {
  return (
    <div class="section">
      <h4 class="section-title">Key Recorder</h4>
      <div class="flex items-center gap-4 flex-wrap">
        <button
          onClick={props.onRecord}
          disabled={props.isRecording()}
          class={`py-[0.4rem] px-3 rounded-[3px] border border-hk-card-border bg-transparent text-hk-ink font-mono hk-label disabled:cursor-default ${props.recording() ? "text-hk-danger border-hk-danger" : ""}`}
        >
          {props.recording() ? "Press any key (Esc to cancel)" : "Record Shortcut"}
        </button>
        <Show when={props.recorded()}>
          {(r) => (
            <Show
              when={r().safe}
              fallback={
                <span class="text-hk-danger">
                  <span class="badge badge-red log-badge">UNSAFE</span>
                  {r().unsafeReason}
                </span>
              }
            >
              <span>
                <span class="badge badge-green log-badge">SAFE</span>
                <kbd class="kbd">{formatShortcut(recordedToShortcut(r()))}</kbd>
              </span>
            </Show>
          )}
        </Show>
      </div>
    </div>
  );
}
