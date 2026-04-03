import type { StarlightPlugin } from "@astrojs/starlight/types";

export default function starlightThemeHotterKeys(): StarlightPlugin {
  return {
    name: "@hotter-keys/starlight-theme",
    hooks: {
      "config:setup"({ updateConfig }) {
        updateConfig({
          customCss: [
            "@hotter-keys/starlight-theme/styles/layers",
            "@hotter-keys/starlight-theme/styles/theme",
            "@hotter-keys/starlight-theme/styles/base",
            "@hotter-keys/starlight-theme/styles/demo",
          ],
          components: {
            Head: "@hotter-keys/starlight-theme/overrides/Head.astro",
            Footer: "@hotter-keys/starlight-theme/overrides/Footer.astro",
          },
        });
      },
    },
  };
}
