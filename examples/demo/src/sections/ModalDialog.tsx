import { For } from "solid-js";
import { displayShortcut as fmt } from "@hotter-keys/core";
import { BINDINGS, layerOf } from "../bindings";

interface Props {
  ref: (el: HTMLDialogElement) => void;
  onClose: () => void;
}

export default function ModalDialog(props: Props) {
  return (
    <dialog
      ref={props.ref}
      class="modal-dialog"
      onClose={props.onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div class="modal-content">
        <div class="flex items-center justify-between mb-sm">
          <h2 style={{ margin: "0", color: "var(--hk-ink)" }}>
            Command Palette
          </h2>
          <span class="badge badge-orange">modal layer</span>
        </div>
        <p class="mb-sm">
          The <strong style={{ color: "var(--hk-ink)" }}>modal</strong> layer is
          pushed on top of the stack. It consumes matching keys before lower
          layers see them. Close the dialog to pop it.
        </p>
        <div class="card">
          <For each={BINDINGS.filter((b) => layerOf(b) === "modal")}>
            {(b) => (
              <div class="row">
                <kbd>{fmt(b.raw)}</kbd>
                <span class="flex-1 text-sm">{b.action}</span>
              </div>
            )}
          </For>
        </div>
        <div style={{ "margin-top": "0.75rem", "text-align": "right" }}>
          <button class="btn" onClick={props.onClose}>
            Close{" "}
            <kbd class="kbd-inline">Esc</kbd>
          </button>
        </div>
      </div>
    </dialog>
  );
}
