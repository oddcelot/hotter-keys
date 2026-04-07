import { For, type Accessor } from "solid-js";
import { displayShortcut as fmt } from "@hotter-keys/core";
import { BINDINGS, layerOf } from "./bindings";
import { LayerBadge } from "../Badge";
import s from "./demo.module.css";

interface Props {
  firedAction: Accessor<string | null>;
  ref: (el: HTMLDialogElement) => void;
  onClose: () => void;
}

export default function ModalDialog(props: Props) {
  return (
    <dialog
      ref={props.ref}
      class={s.modalDialog}
      onClose={props.onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div class={s.modalContent}>
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-hk-canvas-text">Command Palette</h2>
          <LayerBadge color="orange">modal layer</LayerBadge>
        </div>
        <p class="mb-2 text-xs">
          The <strong class="text-hk-canvas-text">modal</strong> layer is pushed on top of the
          stack. It consumes matching keys before lower layers see them. Close the dialog to pop it.
        </p>
        <div class={s.card}>
          <For each={BINDINGS.filter((b) => layerOf(b) === "modal")}>
            {(b) => (
              <div class={`${s.row} ${props.firedAction() === b.action ? s.rowFired : ""}`}>
                <kbd class={props.firedAction() === b.action ? s.kbdFired : ""}>{fmt(b.raw)}</kbd>
                <span class="flex-1 min-w-0">{b.action}</span>
              </div>
            )}
          </For>
        </div>
        <div class="mt-2 text-right">
          <button onClick={props.onClose}>
            Close <kbd>Esc</kbd>
          </button>
        </div>
      </div>
    </dialog>
  );
}
