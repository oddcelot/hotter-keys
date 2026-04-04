import { defineConfig } from "vite-plus";
import solidPlugin from "vite-plugin-solid";
import UnoCSS from "unocss/vite";
// import { DevTools } from "@vitejs/devtools";
// import { hotterKeysViteDevtools } from "@hotter-keys/devtools/vite";

export default defineConfig({
  plugins: [
    UnoCSS(),
    // Uncomment for @vitejs/devtools panel (requires terminal auth):
    // DevTools(),
    // hotterKeysViteDevtools(),
    solidPlugin(),
  ],
});
