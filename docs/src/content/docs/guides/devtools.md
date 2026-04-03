---
title: DevTools
description: Inspect keyboard shortcuts in real time with the hotter-keys devtools plugin.
---

The `@hotter-keys/devtools` package provides real-time visibility into which shortcuts are registered, which layers/scopes are active, and what fires when you press keys.

## Install

```bash
npm install -D @hotter-keys/devtools
```

## Astro integration

For Astro sites, register it as an Astro integration. It adds a Dev Toolbar app:

```ts
// astro.config.mjs
import { hotterKeysDevtoolsIntegration } from "@hotter-keys/devtools";

export default defineConfig({
  integrations: [
    hotterKeysDevtoolsIntegration(),
  ],
});
```

The toolbar app shows:
- **Bindings tab** — all registered bindings grouped by layer, with scope info
- **Events tab** — table of fired shortcuts with layer, scope, and timestamp
- **Settings tab** — notification toggle

## Vite plugin (non-Astro)

For standard Vite apps, use the Vite plugin. It injects a custom overlay:

```ts
// vite.config.ts
import { hotterKeysDevtools } from "@hotter-keys/devtools";

export default defineConfig({
  plugins: [
    hotterKeysDevtools(),
  ],
});
```

## Vite DevTools panel

For projects using `@vitejs/devtools`, use the Vite DevTools plugin. It registers a browsable panel:

```ts
// vite.config.ts
import { DevTools } from "@vitejs/devtools";
import { hotterKeysViteDevtools } from "@hotter-keys/devtools/vite";

export default defineConfig({
  plugins: [
    DevTools(),
    hotterKeysViteDevtools(),
  ],
});
```

The panel shows:
- **Bindings** — bindings grouped by layer with active/inactive indicators
- **Events** — fired shortcut log with layer, scope, and time columns
- **Settings** — persistent notification toggle
- **Labels** — each fired event is labeled with `layer:name` and `scope:name` in the Logs panel

## Options

All three exports accept the same options:

```ts
hotterKeysDevtoolsIntegration({
  // Enable debug logging to the browser console
  debug: true,

  // Filter which event types to capture (default: all except held-keys)
  events: [
    "binding:fired",
    "binding:added",
    "binding:removed",
    "layer:change",
    "scope:change",
    "lifecycle",
  ],
});
```

### `debug`

When `true`, logs `[hk-devtools]` messages to the browser console showing sentinel setup, instance registration, and each event. Off by default.

### `events`

Controls which event types the devtools captures. Defaults to everything except `"held-keys:change"` (which fires on every keydown/keyup and would be noisy).

To include held keys:

```ts
import { DEFAULT_EVENT_TYPES } from "@hotter-keys/devtools";

hotterKeysDevtools({
  events: [...DEFAULT_EVENT_TYPES, "held-keys:change"],
});
```

## How it works

The devtools plugin attaches to `Hotkeys` instances via the `__devtools` hook — an opt-in callback on the `Hotkeys` class that emits structured events. When no devtools is attached, the hook is `undefined` and the check short-circuits (zero overhead).

Discovery is automatic:
1. If the devtools sentinel loads **before** your app creates hotkeys instances, they register eagerly via the constructor.
2. If instances are created **before** the sentinel, they're stashed on `globalThis.__HOTTER_KEYS_INSTANCES__` and drained when the sentinel loads.
3. On late-attach, existing bindings and layer state are replayed so the panel populates immediately.
