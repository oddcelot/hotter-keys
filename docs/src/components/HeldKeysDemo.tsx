import { createSignal, onCleanup, onMount } from "solid-js";
import { createHotkeys } from "hotter-keys";

export default function HeldKeysDemo() {
  const [heldKeys, setHeldKeys] = createSignal<readonly string[]>([]);
  let containerRef!: HTMLDivElement;

  onMount(() => {
    const hk = createHotkeys({ target: containerRef });

    hk.onHeldKeysChange((keys) => setHeldKeys(keys));

    onCleanup(() => hk.destroy());
  });

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      style={{
        border: "1px solid var(--sl-color-gray-5)",
        "border-radius": "0.5rem",
        padding: "1rem",
        "min-height": "5rem",
        "font-family": "var(--sl-font-mono, monospace)",
        "font-size": "0.875rem",
        display: "flex",
        "flex-direction": "column",
        "align-items": "center",
        "justify-content": "center",
        gap: "0.75rem",
        outline: "none",
        cursor: "text",
      }}
    >
      <p style={{ margin: 0, color: "var(--sl-color-gray-3)", "font-size": "0.8rem" }}>
        Click here and hold any keys
      </p>
      <div style={{ display: "flex", gap: "0.5rem", "flex-wrap": "wrap", "justify-content": "center" }}>
        {heldKeys().length === 0 ? (
          <span style={{ color: "var(--sl-color-gray-4)" }}>No keys held</span>
        ) : (
          heldKeys().map((key) => (
            <kbd
              style={{
                padding: "0.25rem 0.5rem",
                background: "var(--sl-color-accent)",
                color: "var(--sl-color-accent-high)",
                "border-radius": "0.25rem",
                "font-size": "0.9rem",
              }}
            >
              {key}
            </kbd>
          ))
        )}
      </div>
    </div>
  );
}
