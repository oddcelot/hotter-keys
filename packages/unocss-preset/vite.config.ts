import { defineConfig } from "vite-plus";
import UnoCSS from "unocss/vite";

// @ts-expect-error — Vite's recursive UserConfig type exceeds oxlint stack depth
export default defineConfig(({ command }) => ({
  plugins: command === "serve" ? UnoCSS() : [],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: ["@unocss/core"],
    },
  },
}));
