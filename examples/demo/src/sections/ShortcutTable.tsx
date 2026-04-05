import { For, type Accessor } from "solid-js";
import { displayShortcut as fmt } from "@hotter-keys/core";
import { type Binding, BINDINGS, SCOPE_COLORS, layerOf, layerColorOf, scopeOf } from "../bindings";
import { LayerBadge, ScopeBadge } from "../components/Badge";

interface Props {
  firedAction: Accessor<string | null>;
  layers: string[];
  activeScope: Accessor<string>;
}

export default function ShortcutTable(props: Props) {
  const isActive = (b: Binding) => {
    const layer = layerOf(b);
    if (!props.layers.includes(layer)) return false;
    const scope = scopeOf(b);
    if (scope && props.activeScope() !== scope) return false;
    return true;
  };

  return (
    <div class="mb-6">
      <h2>Registered Shortcuts</h2>
      <div class="card">
        <For each={BINDINGS}>
          {(b) => (
            <div
              class={`row ${props.firedAction() === b.action ? "row-fired" : ""}`}
              style={{ opacity: isActive(b) ? 1 : 0.35 }}
            >
              <kbd class={props.firedAction() === b.action ? "fired" : ""}>{fmt(b.raw)}</kbd>
              <span class="flex-1 min-w-0 ">{b.action}</span>
              {scopeOf(b) && (
                <ScopeBadge color={SCOPE_COLORS[scopeOf(b)!]}>{scopeOf(b)}</ScopeBadge>
              )}
              <LayerBadge color={layerColorOf(b)}>{layerOf(b)}</LayerBadge>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
