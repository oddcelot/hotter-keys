import { For, type Accessor } from "solid-js";
import { displayShortcut as fmt } from "@hotter-keys/core";
import { BINDINGS, SCOPE_COLORS, scopeOf } from "./bindings";
import { ScopeBadge } from "./Badge";
import s from "./demo.module.css";

interface Props {
  firedAction: Accessor<string | null>;
  activeScope: Accessor<string>;
  onSwitchScope: (scope: string) => void;
}

export default function ScopePanels(props: Props) {
  return (
    <div class="mb-6">
      <h2>Scopes — Context Switching</h2>
      <p class="mb-2">
        Scopes <strong class="text-hk-canvas-text">filter</strong> which bindings are considered.
        Only the active scope's bindings fire — others are invisible. Use scopes when the{" "}
        <em>same</em> key combo should do different things depending on context, like {fmt("mod+z")}{" "}
        meaning "undo text" in an editor vs "undo stroke" on a canvas. Click a panel to switch
        scope.
      </p>
      <div class="flex gap-[0.4rem] items-center mb-2">
        <span class="text-hk-gray-4">Active scope:</span>
        <ScopeBadge color={SCOPE_COLORS[props.activeScope()] ?? "green"}>
          {props.activeScope() === "*" ? "global" : props.activeScope()}
        </ScopeBadge>
        {props.activeScope() !== "*" && (
          <button class={s.btnGhost} onClick={() => props.onSwitchScope("*")}>
            clear
          </button>
        )}
      </div>
      <div class="grid grid-cols-2 gap-3">
        <section
          class={s.focusPanel}
          tabIndex={0}
          onFocus={() => props.onSwitchScope("text-editor")}
        >
          <div class={s.focusPanelLabel}>
            <span class={s.focusDot} />
            Text Editor
          </div>
          <span class="text-hk-gray-4">scope: text-editor</span>
          <div class="flex flex-col gap-1 mt-auto">
            <For each={BINDINGS.filter((b) => scopeOf(b) === "text-editor")}>
              {(b) => (
                <div class="flex gap-[0.4rem] items-center">
                  <kbd class={props.firedAction() === b.action ? s.kbdFired : ""}>{fmt(b.raw)}</kbd>
                  <span class="text-hk-gray-4">{b.action}</span>
                </div>
              )}
            </For>
          </div>
        </section>
        <section class={s.focusPanel} tabIndex={0} onFocus={() => props.onSwitchScope("drawing")}>
          <div class={s.focusPanelLabel}>
            <span class={s.focusDot} />
            Drawing Canvas
          </div>
          <span class="text-hk-gray-4">scope: drawing</span>
          <div class="flex flex-col gap-1 mt-auto">
            <For each={BINDINGS.filter((b) => scopeOf(b) === "drawing")}>
              {(b) => (
                <div class="flex gap-[0.4rem] items-center">
                  <kbd class={props.firedAction() === b.action ? s.kbdFired : ""}>{fmt(b.raw)}</kbd>
                  <span class="text-hk-gray-4">{b.action}</span>
                </div>
              )}
            </For>
          </div>
        </section>
      </div>
    </div>
  );
}
