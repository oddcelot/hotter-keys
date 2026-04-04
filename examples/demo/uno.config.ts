import { defineConfig, presetWind } from "unocss";
import { presetHotterKeys } from "@hotter-keys/unocss-preset";

export default defineConfig({
  presets: [presetWind({ preflight: false }), presetHotterKeys()],
});
