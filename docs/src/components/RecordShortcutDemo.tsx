import { createSignal } from "solid-js";
import { recordShortcut, formatShortcut } from "hotter-keys";

export default function RecordShortcutDemo() {
  const [recording, setRecording] = createSignal(false);
  const [result, setResult] = createSignal<string | null>(null);
  let containerRef!: HTMLDivElement;

  const startRecording = async () => {
    setRecording(true);
    setResult(null);
    try {
      const recorded = await recordShortcut(containerRef);
      if (!recorded.safe) {
        setResult(`⚠ Unsafe: ${recorded.unsafeReason}`);
      } else {
        setResult(formatShortcut(recorded));
      }
    } finally {
      setRecording(false);
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      style={{
        border: "1px solid var(--sl-color-gray-5)",
        "border-radius": "0.5rem",
        padding: "1rem",
        "min-height": "6rem",
        "font-family": "var(--sl-font-mono, monospace)",
        "font-size": "0.875rem",
        display: "flex",
        "flex-direction": "column",
        "align-items": "center",
        "justify-content": "center",
        gap: "0.75rem",
        outline: "none",
      }}
    >
      <button
        onClick={startRecording}
        disabled={recording()}
        style={{
          padding: "0.5rem 1rem",
          "border-radius": "0.25rem",
          border: "1px solid var(--sl-color-gray-5)",
          background: recording() ? "var(--sl-color-accent)" : "var(--sl-color-bg-nav)",
          color: recording() ? "var(--sl-color-accent-high)" : "var(--sl-color-white)",
          cursor: recording() ? "default" : "pointer",
          "font-family": "inherit",
          "font-size": "inherit",
        }}
      >
        {recording() ? "Press any key…" : "Record shortcut"}
      </button>
      {result() && (
        <p style={{ margin: 0 }}>
          Recorded: <kbd>{result()}</kbd>
        </p>
      )}
    </div>
  );
}
