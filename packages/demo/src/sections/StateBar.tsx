import { For, type Accessor } from "solid-js";
import { displayShortcut as fmt } from "@hotter-keys/core";

interface Props {
  layers: string[];
  activeScope: Accessor<string>;
  onOpenModal: () => void;
}

export default function StateBar(props: Props) {
  return (
    <div class="layer-bar">
      <div class="flex gap-sm items-center flex-wrap">
        <h2 style={{ margin: "0" }}>State</h2>
        <span class="muted text-sm">Layers:</span>
        <For each={props.layers}>
          {(l) => <span class="layer-pill layer-pill-active">{l}</span>}
        </For>
        <span class="muted text-sm" style={{ "margin-left": "0.25rem" }}>
          Scope:
        </span>
        <span class="badge badge-green">{props.activeScope()}</span>
        <span class="flex-1" />
        <button class="btn btn-sm" onClick={props.onOpenModal}>
          Open Modal{" "}
          <kbd class="kbd-inline">{fmt("mod+p")}</kbd>
        </button>
      </div>
    </div>
  );
}
