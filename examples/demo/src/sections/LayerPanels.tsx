import { For } from "solid-js";
import { displayShortcut as fmt } from "@hotter-keys/core";
import { BINDINGS, layerOf } from "../bindings";

interface Props {
  onFocusLayer: (panel: string, layer: string) => void;
  onBlurLayer: (panel: string, layer: string) => void;
}

export default function LayerPanels(props: Props) {
  return (
    <div class="mb-6">
      <h2>Layers — Priority &amp; Override</h2>
      <p class="mb-2">
        Layers form a <strong class="text-hk-canvas-text">stack</strong>. Higher layers consume key
        events first, preventing lower layers from firing. Use layers when UI regions add{" "}
        <em>extra</em> shortcuts on top of a base set — like an editor toolbar or a modal overlay.
        Click a panel to push its layer; blur to pop it.
      </p>
      <div class="panel-grid">
        <section
          class="focus-panel"
          tabIndex={0}
          onFocus={() => props.onFocusLayer("editor", "editor")}
          onBlur={() => props.onBlurLayer("editor", "editor")}
        >
          <div class="focus-panel-label">
            <span class="focus-dot" />
            Editor
          </div>
          <span class="focus-panel-hint">Focus to activate editor layer</span>
          <div class="focus-panel-shortcuts">
            <For each={BINDINGS.filter((b) => layerOf(b) === "editor")}>
              {(b) => <kbd>{fmt(b.raw)}</kbd>}
            </For>
          </div>
        </section>
        <section
          class="focus-panel"
          tabIndex={0}
          onFocus={() => props.onFocusLayer("canvas", "canvas")}
          onBlur={() => props.onBlurLayer("canvas", "canvas")}
        >
          <div class="focus-panel-label">
            <span class="focus-dot" />
            Canvas
          </div>
          <span class="focus-panel-hint">Focus to activate canvas layer</span>
          <div class="focus-panel-shortcuts">
            <For each={BINDINGS.filter((b) => layerOf(b) === "canvas")}>
              {(b) => <kbd>{fmt(b.raw)}</kbd>}
            </For>
          </div>
        </section>
      </div>
    </div>
  );
}
