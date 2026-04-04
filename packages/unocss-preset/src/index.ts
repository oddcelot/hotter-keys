import type { Preset } from "@unocss/core";
import { hotterKeysTheme } from "./theme.js";
import { resetCSS } from "./preflights/reset.js";
import { tokensCSS } from "./preflights/tokens.js";
import { componentsCSS } from "./preflights/components.js";

export function presetHotterKeys(): Preset {
  return {
    name: "preset-hotter-keys",
    theme: hotterKeysTheme,
    preflights: [
      {
        getCSS: () =>
          `@layer hk-reset, hk-tokens, hk-components;\n@layer hk-reset {\n${resetCSS}\n}`,
      },
      {
        getCSS: () => `@layer hk-tokens {\n${tokensCSS}\n}`,
      },
      {
        getCSS: () => `@layer hk-components {\n${componentsCSS}\n}`,
      },
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

export default presetHotterKeys;
