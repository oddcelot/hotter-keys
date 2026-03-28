import { createSignal, onCleanup, onMount } from "solid-js";
import { createHotkeys } from "hotter-keys";

export default function ShortcutDemo() {
  const [log, setLog] = createSignal<string[]>([]);
  let containerRef!: HTMLDivElement;

  const push = (msg: string) =>
    setLog((prev) => [...prev.slice(-9), msg]);

  onMount(() => {
    const hk = createHotkeys({ target: containerRef });

    hk.add("ctrl+k", () => push("ctrl+k → Command palette"));
    hk.add("ctrl+s", () => push("ctrl+s → Save"));
    hk.add("meta+shift+p", () => push("meta+shift+p → Quick open"));
    hk.add("ctrl+k ctrl+c", () => push("ctrl+k ctrl+c → Comment block (sequence)"));

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
        "min-height": "12rem",
        "font-family": "var(--sl-font-mono, monospace)",
        "font-size": "0.875rem",
        outline: "none",
        cursor: "text",
      }}
    >
      <p style={{ margin: "0 0 0.75rem", color: "var(--sl-color-gray-3)", "font-size": "0.8rem" }}>
        Click here and try: <kbd>Ctrl+K</kbd>, <kbd>Ctrl+S</kbd>, <kbd>Meta+Shift+P</kbd>, or the sequence <kbd>Ctrl+K</kbd> then <kbd>Ctrl+C</kbd>
      </p>
      {log().length === 0 ? (
        <p style={{ color: "var(--sl-color-gray-4)", margin: 0 }}>Waiting for input…</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, "list-style": "none" }}>
          {log().map((entry) => (
            <li style={{ padding: "0.15rem 0" }}>{entry}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
