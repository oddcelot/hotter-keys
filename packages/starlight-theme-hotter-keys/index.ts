import type { StarlightPlugin } from "@astrojs/starlight/types";

export default function starlightThemeHotterKeys(): StarlightPlugin {
  return {
    name: "starlight-theme-hotter-keys",
    hooks: {
      "config:setup"({ updateConfig }) {
        updateConfig({
          customCss: [
            "starlight-theme-hotter-keys/styles/layers",
            "starlight-theme-hotter-keys/styles/theme",
            "starlight-theme-hotter-keys/styles/base",
            "starlight-theme-hotter-keys/styles/demo",
          ],
          components: {
            Head: "starlight-theme-hotter-keys/overrides/Head.astro",
            Header: "starlight-theme-hotter-keys/overrides/Header.astro",
            Footer: "starlight-theme-hotter-keys/overrides/Footer.astro",
          },
        });
      },
    },
  };
}
