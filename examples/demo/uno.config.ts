import { defineConfig, presetWind4 } from "unocss";
import presetIcons from "@unocss/preset-icons";
import { presetHotterKeys } from "@hotter-keys/unocss-preset";

export default defineConfig({
  presets: [
    presetWind4({ preflights: { reset: false } }),
    presetIcons({ scale: 1.2, extraProperties: { "vertical-align": "text-bottom" } }),
    presetHotterKeys(),
  ],
});
