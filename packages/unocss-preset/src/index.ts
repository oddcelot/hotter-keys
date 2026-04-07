import type { Preset } from "@unocss/core";
import { hotterKeysTheme } from "./theme.js";
import resetCSS from "./reset.css?raw";
import tokensCSS from "./tokens.css?raw";
import baseCSS from "./base.css?raw";

export interface PresetHotterKeysOptions {
  /**
   * Control which preflights are emitted.
   * - `true` (default): all three preflights (reset, tokens, base)
   * - `false`: no preflights
   * - Object: pick individually `{ reset?: boolean; tokens?: boolean; base?: boolean }`
   */
  preflights?: boolean | { reset?: boolean; tokens?: boolean; base?: boolean };
}

export function presetHotterKeys(options?: PresetHotterKeysOptions): Preset {
  const pf = options?.preflights ?? true;
  const enable = {
    reset: pf === true || (typeof pf === "object" && pf.reset !== false),
    tokens: pf === true || (typeof pf === "object" && pf.tokens !== false),
    base: pf === true || (typeof pf === "object" && pf.base !== false),
  };

  const preflights: Preset["preflights"] = [];

  if (enable.reset) {
    preflights.push({
      getCSS: () => `@layer hk-reset, hk-tokens, hk-base;\n@layer hk-reset {\n${resetCSS}\n}`,
    });
  }

  if (enable.tokens) {
    preflights.push({
      getCSS: () => `@layer hk-tokens {\n${tokensCSS}\n}`,
    });
  }

  if (enable.base) {
    preflights.push({
      getCSS: () => `@layer hk-base {\n${baseCSS}\n}`,
    });
  }

  return {
    name: "preset-hotter-keys",
    theme: hotterKeysTheme,
    preflights,
  };
}

export default presetHotterKeys;
