import { defineConfig, presetWind4 } from "unocss";
import { presetHotterKeys } from "@hotter-keys/unocss-preset";

export default defineConfig({
  presets: [presetWind4({ preflights: { reset: false } }), presetHotterKeys()],
});
