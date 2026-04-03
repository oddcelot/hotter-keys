import { DevTools } from '@vitejs/devtools';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import { hotterKeysViteDevtools } from '@hotter-keys/vite-plugin-devtools/vite-devtools';

export default defineConfig({
  plugins: [
    DevTools(),
    solidPlugin(),
    hotterKeysViteDevtools(),
  ],
});
