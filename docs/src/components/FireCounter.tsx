import { type Component } from "solid-js";

/**
 * Dark circle fire counter — solid circle with a large serif number.
 * Mirrors the RealFeel/temperature circles from the weather UI reference.
 */
const FireCounter: Component<{ count: number; label?: string }> = (props) => {
  return (
    <div
      style={{
        width: "80px",
        height: "80px",
        "border-radius": "50%",
        background: "var(--hk-ink)",
        display: "flex",
        "flex-direction": "column",
        "align-items": "center",
        "justify-content": "center",
        "flex-shrink": "0",
      }}
    >
      <span
        style={{
          "font-family": "var(--hk-font-display)",
          "font-size": "1.75rem",
          "line-height": "1",
          color: "var(--hk-ink-inverse)",
        }}
      >
        {props.count}
      </span>
      <span
        style={{
          "font-family": "var(--sl-font-mono)",
          "font-size": "var(--hk-label-size)",
          "text-transform": "uppercase",
          "letter-spacing": "var(--hk-label-tracking)",
          color: "var(--hk-ink-inverse)",
          opacity: "0.5",
          "margin-top": "2px",
        }}
      >
        {props.label ?? "fired"}
      </span>
    </div>
  );
};

export default FireCounter;
