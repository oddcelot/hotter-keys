import { defineConfig, presetWind4 } from "unocss";
import presetIcons from "@unocss/preset-icons";
import { presetHotterKeys } from "@hotter-keys/unocss-preset";

export default defineConfig({
  presets: [
    presetWind4({ preflights: { reset: false } }),
    presetIcons({ scale: 1.2, extraProperties: { "vertical-align": "text-bottom" } }),
    presetHotterKeys({ preflights: false }),
  ],
  theme: {
    colors: {
      hk: {
        ink: "var(--hk-ink)",
        danger: "var(--hk-danger)",
        "accent-color": "var(--hk-accent-color)",
        "card-bg": "var(--hk-card-bg)",
        "card-border": "var(--hk-card-border)",
        rule: "var(--hk-rule)",
        "gray-text": "var(--hk-gray-text)",
        "canvas-text": "var(--hk-canvas-text)",
        canvas: "var(--hk-canvas)",
        green: "var(--hk-green)",
        "green-low": "var(--hk-green-low)",
        blue: "var(--hk-blue)",
        purple: "var(--hk-purple)",
        orange: "var(--hk-orange)",
        gray: {
          1: "var(--sl-color-gray-1)",
          2: "var(--sl-color-gray-2)",
          3: "var(--sl-color-gray-3)",
          4: "var(--sl-color-gray-4)",
          5: "var(--sl-color-gray-5)",
          6: "var(--sl-color-gray-6)",
        },
      },
    },
  },
  shortcuts: {
    "hk-label":
      "text-[length:var(--hk-label-size,0.5rem)] uppercase tracking-[var(--hk-label-tracking,0.16em)]",
  },
});
