import { For } from "solid-js";
import { displayShortcut as fmt } from "hotter-keys";
import { BINDINGS, layerOf, layerColorOf, scopeOf } from "../bindings";

export default function ShortcutTable() {
  return (
    <div class="section">
      <h2>Registered Shortcuts</h2>
      <div class="card">
        <For each={BINDINGS}>
          {(b) => (
            <div class="row">
              <kbd>{fmt(b.raw)}</kbd>
              <span class="flex-1 text-sm">{b.action}</span>
              {scopeOf(b) && (
                <span class="badge badge-green">{scopeOf(b)}</span>
              )}
              <span class={`badge badge-${layerColorOf(b)}`}>
                {layerOf(b)}
              </span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
