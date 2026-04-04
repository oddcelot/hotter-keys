import { DevTools } from "@vitejs/devtools";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import { hotterKeysViteDevtools } from "@hotter-keys/devtools/vite";

export default defineConfig({
  plugins: [DevTools({ clientAuth: false }), solidPlugin(), hotterKeysViteDevtools()],
});
