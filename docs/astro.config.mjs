// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import starlight from "@astrojs/starlight";
import solidJs from "@astrojs/solid-js";
import starlightThemeHotterKeys from "starlight-theme-hotter-keys";

// https://astro.build/config
export default defineConfig({
  site: process.env.CI
    ? "https://oddcelot.github.io"
    : "http://localhost:4321",
  base: process.env.CI ? "/hotter-keys" : "/",
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: "Lilex",
      cssVariable: "--font-lilex",
    },
  ],
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
          items: [{ label: "Getting Started", slug: "guides/getting-started" }],
        },
        {
          label: "Reference",
          autogenerate: { directory: "reference" },
        },
        {
          label: "Tools",
          items: [
            { label: "Keymap Creator", slug: "tools/keymap-creator" },
            { label: "Layers Demo", slug: "tools/layers-demo" },
            { label: "Kitchen Sink", slug: "tools/kitchen-sink" },
          ],
        },
      ],
    }),
    solidJs(),
  ],
});
