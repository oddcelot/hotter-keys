// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import solidJs from "@astrojs/solid-js";
import UnoCSS from "@unocss/astro";
import starlightThemeHotterKeys from "@hotter-keys/starlight-theme";
import { hotterKeysDevtoolsIntegration } from "@hotter-keys/devtools";

// https://astro.build/config
export default defineConfig({
  site: process.env.CI ? "https://oddcelot.github.io" : "http://localhost:4321",
  base: process.env.CI ? "/hotter-keys" : "/",
  integrations: [
    starlight({
      pagefind: false,
      title: "Hotter Keys",
      logo: {
        src: "./public/logo.svg",
      },
      plugins: [starlightThemeHotterKeys()],
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/withastro/starlight",
        },
      ],
      sidebar: [
        {
          label: "Guides",
          items: [
            { label: "Getting Started", slug: "guides/getting-started" },
            { label: "Layers", slug: "guides/layers" },
            { label: "Scopes", slug: "guides/scopes" },
            { label: "DevTools", slug: "guides/devtools" },
          ],
        },
        {
          label: "Reference",
          autogenerate: { directory: "reference" },
        },
        {
          label: "Tools",
          items: [
            { label: "Interactive Demo", slug: "tools/interactive-demo" },
            { label: "Keymap Creator", slug: "tools/keymap-creator" },
            { label: "Layers Demo", slug: "tools/layers-demo" },
            { label: "Kitchen Sink", slug: "tools/kitchen-sink" },
          ],
        },
      ],
    }),
    UnoCSS(),
    solidJs(),
    hotterKeysDevtoolsIntegration({ debug: true }),
  ],
});
