import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
// import { DevTools } from "@vitejs/devtools";
// import { hotterKeysViteDevtools } from "@hotter-keys/devtools/vite";

export default defineConfig({
  plugins: [
    // Uncomment for @vitejs/devtools panel (requires terminal auth):
    // DevTools(),
    // hotterKeysViteDevtools(),
    solidPlugin(),
  ],
});
