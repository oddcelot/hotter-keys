// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import solidJs from "@astrojs/solid-js";

// https://astro.build/config
export default defineConfig({
  integrations: [
    starlight({
      pagefind: false,
      title: "Hotter Keys",
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
          items: [{ label: "Keymap Creator", slug: "tools/keymap-creator" }],
        },
      ],
    }),
    solidJs(),
  ],
});
