import { For, Show } from "solid-js";
import { heldKeys, shiftHeld, rawEvent } from "./state";

export interface RawEvent {
  key: string;
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  repeat: boolean;
}

export default function HeldKeys() {
  return (
    <div class="section">
      <h4 class="section-title">Held Keys</h4>
      <div class="flex items-center gap-2 flex-wrap min-h-8">
        <Show when={heldKeys().length > 0} fallback={<span class="muted">No keys held</span>}>
          <For each={[...heldKeys()]}>
            {(key, i) => (
              <span>
                <span class="font-mono text-[length:var(--hk-label-size,0.5rem)] text-hk-gray-4 mr-[0.15rem] tabular-nums">
                  {String(i() + 1).padStart(2, "0")}
                </span>
                <kbd class="kbd kbd-accent">{key}</kbd>
              </span>
            )}
          </For>
        </Show>
        <Show when={shiftHeld()}>
          <span class="badge badge-yellow ml-auto">SHIFT HELD ALONE</span>
        </Show>
      </div>

      <Show when={rawEvent()}>
        {(ev) => (
          <div
            class="flex items-center gap-2 flex-wrap mt-3 pt-3"
            style={{ "border-top": "1px solid var(--hk-rule)" }}
          >
            <span class="muted-light">key</span>
            <kbd class="kbd">{ev().key}</kbd>
            <span class="muted-light">code</span>
            <kbd class="kbd kbd-dim">{ev().code}</kbd>
            <Show when={ev().ctrlKey}>
              <kbd class="kbd">ctrl</kbd>
            </Show>
            <Show when={ev().shiftKey}>
              <kbd class="kbd">shift</kbd>
            </Show>
            <Show when={ev().metaKey}>
              <kbd class="kbd">meta</kbd>
            </Show>
            <Show when={ev().altKey}>
              <kbd class="kbd kbd-accent">alt</kbd>
            </Show>
            <Show when={ev().repeat}>
              <span class="badge badge-yellow">repeat</span>
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
}
