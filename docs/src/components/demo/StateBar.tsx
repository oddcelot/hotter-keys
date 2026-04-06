import { For, type Accessor } from "solid-js";
import { displayShortcut as fmt } from "@hotter-keys/core";
import { LAYER_COLORS, SCOPE_COLORS } from "./bindings";
import { LayerBadge, ScopeBadge } from "./Badge";
import s from "./demo.module.css";

interface Props {
  layers: string[];
  activeScope: Accessor<string>;
  onOpenModal: () => void;
}

export default function StateBar(props: Props) {
  return (
    <div class={s.stateBar}>
      <div class="flex gap-[0.4rem] items-center flex-wrap">
        <h2>State</h2>
        <span class="text-hk-gray-4">Layers:</span>
        <For each={props.layers}>
          {(l) => (
            <LayerBadge color={LAYER_COLORS[l] ?? "purple"} pill>
              {l}
            </LayerBadge>
          )}
        </For>
        <span class="text-hk-gray-4">Scope:</span>
        <ScopeBadge color={SCOPE_COLORS[props.activeScope()] ?? "green"}>
          {props.activeScope() === "*" ? "global" : props.activeScope()}
        </ScopeBadge>
        <span class="flex-1 min-w-0" />
        <button onClick={props.onOpenModal}>
          Open Modal <kbd>{fmt("mod+p")}</kbd>
        </button>
      </div>
    </div>
  );
}
