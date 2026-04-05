import { defineConfig, presetWind4 } from "unocss";
import { presetHotterKeys } from "@hotter-keys/unocss-preset";

export default defineConfig({
  presets: [presetWind4({ preflights: { reset: false } }), presetHotterKeys({ preflights: false })],
  theme: {
    colors: {
      hk: {
        ink: "var(--hk-ink)",
        danger: "var(--hk-danger)",
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
