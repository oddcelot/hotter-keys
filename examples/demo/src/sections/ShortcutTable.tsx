import { For, type Accessor } from "solid-js";
import { displayShortcut as fmt } from "@hotter-keys/core";
import { BINDINGS, layerOf, layerColorOf, scopeOf } from "../bindings";
import Badge from "../components/Badge";

interface Props {
  firedAction: Accessor<string | null>;
}

export default function ShortcutTable(props: Props) {
  return (
    <div class="mb-6">
      <h2>Registered Shortcuts</h2>
      <div class="card">
        <For each={BINDINGS}>
          {(b) => (
            <div class={`row ${props.firedAction() === b.action ? "row-fired" : ""}`}>
              <kbd class={props.firedAction() === b.action ? "fired" : ""}>{fmt(b.raw)}</kbd>
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
