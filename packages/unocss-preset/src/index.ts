import type { Preset } from "@unocss/core";
import { hotterKeysTheme } from "./theme.js";
import resetCSS from "./reset.css?raw";
import tokensCSS from "./tokens.css?raw";
import baseCSS from "./base.css?raw";

export function presetHotterKeys(): Preset {
  return {
    name: "preset-hotter-keys",
    theme: hotterKeysTheme,
    preflights: [
      {
        getCSS: () => `@layer hk-reset, hk-tokens, hk-base;\n@layer hk-reset {\n${resetCSS}\n}`,
      },
      {
        getCSS: () => `@layer hk-tokens {\n${tokensCSS}\n}`,
      },
      {
        getCSS: () => `@layer hk-base {\n${baseCSS}\n}`,
      },
    ],
  };
}

export default presetHotterKeys;
