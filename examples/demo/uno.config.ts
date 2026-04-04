import { defineConfig, presetMini } from "unocss";
import { presetHotterKeys } from "@hotter-keys/unocss-preset";

export default defineConfig({
  presets: [presetMini(), presetHotterKeys()],
});
