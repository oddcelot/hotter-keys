import { For, type Accessor } from "solid-js";
import { displayShortcut as fmt } from "@hotter-keys/core";
import { BINDINGS, scopeOf } from "../bindings";

interface Props {
  activeScope: Accessor<string>;
  onSwitchScope: (scope: string) => void;
}

export default function ScopePanels(props: Props) {
  return (
    <div class="section">
      <h2>Scopes — Context Switching</h2>
      <p class="mb-sm">
        Scopes <strong style={{ color: "var(--hk-ink)" }}>filter</strong> which
        bindings are considered. Only the active scope's bindings fire — others
        are invisible. Use scopes when the <em>same</em> key combo should do
        different things depending on context, like {fmt("mod+z")} meaning "undo
        text" in an editor vs "undo stroke" on a canvas. Click a panel to switch
        scope.
      </p>
      <div class="flex gap-sm items-center mb-sm">
        <span class="text-sm muted">Active scope:</span>
        <span class="badge badge-purple">{props.activeScope()}</span>
      </div>
      <div class="panel-grid">
        <section
          class="focus-panel"
          tabIndex={0}
          onFocus={() => props.onSwitchScope("text-editor")}
        >
          <div class="focus-panel-label">
            <span class="focus-dot" />
            Text Editor
          </div>
          <span class="focus-panel-hint">scope: text-editor</span>
          <div class="focus-panel-shortcuts">
            <For each={BINDINGS.filter((b) => scopeOf(b) === "text-editor")}>
              {(b) => (
                <div class="flex gap-sm items-center">
                  <kbd>{fmt(b.raw)}</kbd>
                  <span class="muted text-sm">{b.action}</span>
                </div>
              )}
            </For>
          </div>
        </section>
        <section
          class="focus-panel"
          tabIndex={0}
          onFocus={() => props.onSwitchScope("drawing")}
        >
          <div class="focus-panel-label">
            <span class="focus-dot" />
            Drawing Canvas
          </div>
          <span class="focus-panel-hint">scope: drawing</span>
          <div class="focus-panel-shortcuts">
            <For each={BINDINGS.filter((b) => scopeOf(b) === "drawing")}>
              {(b) => (
                <div class="flex gap-sm items-center">
                  <kbd>{fmt(b.raw)}</kbd>
                  <span class="muted text-sm">{b.action}</span>
                </div>
              )}
            </For>
          </div>
        </section>
      </div>
    </div>
  );
}
