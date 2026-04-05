import { For, type Accessor } from "solid-js";
import { displayShortcut as fmt } from "@hotter-keys/core";
import Badge from "../components/Badge";

interface Props {
  layers: string[];
  activeScope: Accessor<string>;
  onOpenModal: () => void;
}

export default function StateBar(props: Props) {
  return (
    <div class="layer-bar">
      <div class="flex gap-[0.4rem] items-center flex-wrap">
        <h2>State</h2>
        <span class="text-hk-gray-4 ">Layers:</span>
        <For each={props.layers}>
          {(l) => (
            <Badge color="green" pill>
              {l}
            </Badge>
          )}
        </For>
        <span class="text-hk-gray-4 ">Scope:</span>
        <Badge color="green">{props.activeScope()}</Badge>
        <span class="flex-1 min-w-0" />
        <button onClick={props.onOpenModal}>
          Open Modal <kbd>{fmt("mod+p")}</kbd>
        </button>
      </div>
    </div>
  );
}
