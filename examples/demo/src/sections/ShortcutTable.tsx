import { For } from "solid-js";
import { displayShortcut as fmt } from "@hotter-keys/core";
import { BINDINGS, layerOf, layerColorOf, scopeOf } from "../bindings";
import Badge from "../components/Badge";

export default function ShortcutTable() {
  return (
    <div class="mb-6">
      <h2>Registered Shortcuts</h2>
      <div class="card">
        <For each={BINDINGS}>
          {(b) => (
            <div class="row">
              <kbd>{fmt(b.raw)}</kbd>
              <span class="flex-1 min-w-0 ">{b.action}</span>
              {scopeOf(b) && <Badge color="green">{scopeOf(b)}</Badge>}
              <Badge color={layerColorOf(b)}>{layerOf(b)}</Badge>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
