import { For, type Accessor } from "solid-js";
import { displayShortcut as fmt } from "@hotter-keys/core";
import type { BadgeColor } from "./Badge";
import { LayerBadge, ScopeBadge } from "./Badge";

export interface ShortcutEntry {
  raw: string;
  action: string;
  layer: string;
  layerColor: BadgeColor;
  scope?: string;
  scopeColor?: BadgeColor;
}

interface Props {
  shortcuts: ShortcutEntry[];
  firedAction: Accessor<string | null>;
  layers: string[];
  activeScope: Accessor<string>;
}

export default function ShortcutTable(props: Props) {
  const isActive = (s: ShortcutEntry) => {
    if (!props.layers.includes(s.layer)) return false;
    if (s.scope && props.activeScope() !== s.scope) return false;
    return true;
  };

  return (
    <div class="mb-6">
      <h2>Registered Shortcuts</h2>
      <div class="card">
        <For each={props.shortcuts}>
          {(s) => (
            <div
              class={`row ${props.firedAction() === s.action ? "row-fired" : ""}`}
              style={{ opacity: isActive(s) ? 1 : 0.35 }}
            >
              <kbd class={props.firedAction() === s.action ? "kbd-fired" : ""}>{fmt(s.raw)}</kbd>
              <span class="flex-1 min-w-0">{s.action}</span>
              {s.scope && <ScopeBadge color={s.scopeColor}>{s.scope}</ScopeBadge>}
              <LayerBadge color={s.layerColor}>{s.layer}</LayerBadge>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
