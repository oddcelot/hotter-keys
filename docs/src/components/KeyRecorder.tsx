import { Show } from "solid-js";
import { formatShortcut } from "@hotter-keys/core";
import type { RecordedShortcut, Shortcut } from "@hotter-keys/core";
import { recording, recorded, isRecording, doRecord } from "./state";

function recordedToShortcut(r: RecordedShortcut): Shortcut {
  return { key: r.key as Shortcut["key"], ctrl: r.ctrl, shift: r.shift, meta: r.meta, alt: r.alt };
}

export default function KeyRecorder() {
  return (
    <div class="section">
      <h4 class="section-title">Key Recorder</h4>
      <div class="flex items-center gap-4 flex-wrap">
        <button
          onClick={doRecord}
          disabled={isRecording()}
          class={`py-[0.4rem] px-3 rounded-[3px] border border-hk-card-border bg-transparent text-hk-ink font-mono hk-label disabled:cursor-default ${recording() ? "text-hk-danger border-hk-danger" : ""}`}
        >
          {recording() ? "Press any key (Esc to cancel)" : "Record Shortcut"}
        </button>
        <Show when={recorded()}>
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
