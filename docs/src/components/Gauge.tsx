import { type Component } from "solid-js";

/**
 * Analog instrument gauge for displaying held-key count (0–6).
 * Pure SVG linework — thin strokes, no fills, currentColor inheritance.
 */
const Gauge: Component<{ count: number }> = (props) => {
  // Needle sweeps from -120° (0 keys) to +120° (6 keys)
  const startAngle = -120;
  const endAngle = 120;
  const needleAngle = () => startAngle + (props.count / 6) * (endAngle - startAngle);

  const cx = 60;
  const cy = 60;
  const radius = 42;
  const tickInner = 36;
  const tickOuter = 42;
  const labelRadius = 30;

  // Generate 7 tick positions (0–6)
  const ticks = Array.from({ length: 7 }, (_, i) => {
    const angle = startAngle + (i / 6) * (endAngle - startAngle);
    const rad = (angle * Math.PI) / 180;
    return {
      x1: cx + tickInner * Math.cos(rad - Math.PI / 2),
      y1: cy + tickInner * Math.sin(rad - Math.PI / 2),
      x2: cx + tickOuter * Math.cos(rad - Math.PI / 2),
      y2: cy + tickOuter * Math.sin(rad - Math.PI / 2),
      labelX: cx + labelRadius * Math.cos(rad - Math.PI / 2),
      labelY: cy + labelRadius * Math.sin(rad - Math.PI / 2),
      value: i,
      isMajor: i === 0 || i === 3 || i === 6,
    };
  });

  // Arc path for the dial
  const arcStartRad = ((startAngle - 90) * Math.PI) / 180;
  const arcEndRad = ((endAngle - 90) * Math.PI) / 180;
  const arcPath = `M ${cx + radius * Math.cos(arcStartRad)} ${cy + radius * Math.sin(arcStartRad)} A ${radius} ${radius} 0 1 1 ${cx + radius * Math.cos(arcEndRad)} ${cy + radius * Math.sin(arcEndRad)}`;

  return (
    <svg
      viewBox="0 0 120 90"
      width="120"
      height="90"
      style={{
        display: "block",
        color: "var(--hk-ink)",
      }}
    >
      {/* Dial arc */}
      <path d={arcPath} fill="none" stroke="currentColor" stroke-width="1" opacity="0.3" />

      {/* Tick marks */}
      {ticks.map((t) => (
        <line
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke="currentColor"
          stroke-width={t.isMajor ? "1.5" : "0.75"}
          opacity={t.isMajor ? "1" : "0.4"}
        />
      ))}

      {/* Labels at 0, 3, 6 */}
      {ticks
        .filter((t) => t.isMajor)
        .map((t) => (
          <text
            x={t.labelX}
            y={t.labelY}
            text-anchor="middle"
            dominant-baseline="central"
            fill="currentColor"
            font-family="var(--sl-font-mono)"
            font-size="6"
            opacity="0.5"
          >
            {t.value}
          </text>
        ))}

      {/* Needle */}
      <line
        x1={cx}
        y1={cy}
        x2={cx + 32 * Math.cos(((needleAngle() - 90) * Math.PI) / 180)}
        y2={cy + 32 * Math.sin(((needleAngle() - 90) * Math.PI) / 180)}
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        style={{ transition: "all 0.2s ease-out" }}
      />

      {/* Center dot */}
      <circle cx={cx} cy={cy} r="2" fill="currentColor" />
    </svg>
  );
};

export default Gauge;
