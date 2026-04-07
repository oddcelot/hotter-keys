import { For, Show } from "solid-js";
import type { Accessor } from "solid-js";
import { comboLabel, recordingRowId, isRecording } from "./state";

export interface ShortcutRow {
  id: number;
  combo: string;
  description: string;
}

interface Props {
  title: string;
  hint?: string;
  rows: Accessor<ShortcutRow[]>;
  firedMap: Accessor<Record<string, number>>;
  color: "green" | "blue";
  onRebind: (rowId: number) => void;
  layout?: "grid" | "stack";
}

export default function ShortcutRows(props: Props) {
  const rowClass = (isRec: boolean, isFired: boolean) =>
    `row ${isRec ? "row-recording" : isFired ? (props.color === "green" ? "row-fired-green" : "row-fired-blue") : ""}`;

  return (
    <div class="section">
      <h4 class="section-title">{props.title}</h4>
      <Show when={props.hint}>
        <p class="hk-label text-hk-gray-3 m-0 mb-2">{props.hint}</p>
      </Show>
      <div class={props.layout === "grid" ? "grid-2col" : "stack"}>
        <For each={props.rows()}>
          {(s) => {
            const fired = () => s.combo in props.firedMap();
            const isThisRec = () => recordingRowId() === s.id;
            return (
              <div class={rowClass(isThisRec(), fired())}>
                <span class="row-label">
                  <kbd class="kbd">{comboLabel(s.combo)}</kbd>{" "}
                  <span class="row-desc">{s.description}</span>
                </span>
                <Show when={fired()}>
                  <span class={`badge badge-${props.color}`}>FIRED</span>
                </Show>
                <button
                  onClick={() => props.onRebind(s.id)}
                  disabled={isRecording()}
                  class={`btn-sm ${isThisRec() ? "btn-recording" : ""}`}
                >
                  {isThisRec() ? "Press key (Esc to cancel)" : "Rebind"}
                </button>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
