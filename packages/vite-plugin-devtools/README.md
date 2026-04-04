# @hotter-keys/devtools

Devtools integration for [hotter-keys](https://jsr.io/@hotter-keys/core) — inspect bindings, layers, scopes, and events in real time.

## Install

```bash
npm install -D @hotter-keys/devtools
```

## Astro

```ts
import { hotterKeysDevtoolsIntegration } from "@hotter-keys/devtools";

export default defineConfig({
  integrations: [hotterKeysDevtoolsIntegration()],
});
```

## Vite DevTools

```ts
import { DevTools } from "@vitejs/devtools";
import { hotterKeysViteDevtools } from "@hotter-keys/devtools/vite";

export default defineConfig({
  plugins: [DevTools(), hotterKeysViteDevtools()],
});
```

## Docs

https://oddcelot.github.io/hotter-keys/guides/devtools
