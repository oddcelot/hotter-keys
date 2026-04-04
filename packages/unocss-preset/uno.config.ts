import { readFileSync } from "node:fs";
import { defineConfig, presetWind, type Preset } from "unocss";
import { hotterKeysTheme } from "./src/theme.js";

const read = (name: string) => readFileSync(new URL(`src/${name}`, import.meta.url), "utf-8");

function presetHotterKeysDev(): Preset {
  return {
    name: "preset-hotter-keys",
    theme: hotterKeysTheme,
    preflights: [
      {
        getCSS: () =>
          `@layer hk-reset, hk-tokens, hk-base;\n@layer hk-reset {\n${read("reset.css")}\n}`,
      },
      { getCSS: () => `@layer hk-tokens {\n${read("tokens.css")}\n}` },
      { getCSS: () => `@layer hk-base {\n${read("base.css")}\n}` },
    ],
    shortcuts: {
      section: "mb-6",
      muted: "text-hk-gray-4",
      "mb-sm": "mb-2",
      "gap-sm": "gap-[0.4rem]",
      "gap-md": "gap-3",
    },
  };
}

export default defineConfig({
  presets: [presetWind(), presetHotterKeysDev()],
});
