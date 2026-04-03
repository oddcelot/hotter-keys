import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import { hotterKeysDevtools } from '@hotter-keys/vite-plugin-devtools';

export default defineConfig({
  plugins: [
    solidPlugin(),
    hotterKeysDevtools({ debug: true }),
  ],
});
