import { For, type Accessor } from "solid-js";
import { displayShortcut as fmt } from "@hotter-keys/core";
import { BINDINGS, layerOf } from "./bindings";
import s from "./demo.module.css";

interface Props {
  firedAction: Accessor<string | null>;
  onFocusLayer: (panel: string, layer: string) => void;
  onBlurLayer: (panel: string, layer: string) => void;
}

export default function LayerPanels(props: Props) {
  return (
    <div class="mb-6">
      <p class="mb-2">
        Layers form a <strong class="text-hk-canvas-text">stack</strong>. Higher layers consume key
        events first, preventing lower layers from firing. Use layers when UI regions add{" "}
        <em>extra</em> shortcuts on top of a base set — like an editor toolbar or a modal overlay.
        Click a panel to push its layer; blur to pop it.
      </p>
      <div class="grid grid-cols-2 gap-3">
        <section
          class={s.focusPanel}
          tabIndex={0}
          onFocus={() => props.onFocusLayer("editor", "editor")}
          onBlur={() => props.onBlurLayer("editor", "editor")}
        >
          <div class={s.focusPanelLabel}>
            <span class={s.focusDot} />
            Editor
          </div>
          <span class="text-hk-gray-4">Focus to activate editor layer</span>
          <div class="flex flex-col gap-1 mt-auto">
            <For each={BINDINGS.filter((b) => layerOf(b) === "editor")}>
              {(b) => (
                <kbd class={props.firedAction() === b.action ? s.kbdFired : ""}>{fmt(b.raw)}</kbd>
              )}
            </For>
          </div>
        </section>
        <section
          class={s.focusPanel}
          tabIndex={0}
          onFocus={() => props.onFocusLayer("canvas", "canvas")}
          onBlur={() => props.onBlurLayer("canvas", "canvas")}
        >
          <div class={s.focusPanelLabel}>
            <span class={s.focusDot} />
            Canvas
          </div>
          <span class="text-hk-gray-4">Focus to activate canvas layer</span>
          <div class="flex flex-col gap-1 mt-auto">
            <For each={BINDINGS.filter((b) => layerOf(b) === "canvas")}>
              {(b) => (
                <kbd class={props.firedAction() === b.action ? s.kbdFired : ""}>{fmt(b.raw)}</kbd>
              )}
            </For>
          </div>
        </section>
      </div>
    </div>
  );
}
