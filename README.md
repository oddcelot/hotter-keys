<p align="center">
  <img src="docs/public/logo.svg" alt="Hotter Keys" width="120" />
</p>

<h1 align="center">Hotter Keys</h1>

<p align="center">
  A correct, cross-browser, layout-aware keyboard shortcut library.
</p>

<p align="center">
  <a href="https://jsr.io/@hotter-keys/core"><img src="https://jsr.io/badges/@hotter-keys/core" alt="JSR" /></a>
  <a href="https://www.npmjs.com/package/@hotter-keys/core"><img src="https://img.shields.io/npm/v/@hotter-keys/core" alt="npm" /></a>
  <a href="https://oddcelot.github.io/hotter-keys"><img src="https://img.shields.io/badge/docs-website-blue" alt="docs" /></a>
</p>

---

## Packages

| Package | npm | JSR | Description |
|---------|-----|-----|-------------|
| [`@hotter-keys/core`](core/) | [![npm](https://img.shields.io/npm/v/@hotter-keys/core)](https://www.npmjs.com/package/@hotter-keys/core) | [![JSR](https://jsr.io/badges/@hotter-keys/core)](https://jsr.io/@hotter-keys/core) | Core library — zero dependencies |
| [`@hotter-keys/solid`](packages/solid/) | [![npm](https://img.shields.io/npm/v/@hotter-keys/solid)](https://www.npmjs.com/package/@hotter-keys/solid) | — | Solid.js primitives |
| [`@hotter-keys/devtools`](packages/vite-plugin-devtools/) | [![npm](https://img.shields.io/npm/v/@hotter-keys/devtools)](https://www.npmjs.com/package/@hotter-keys/devtools) | — | Devtools for Vite, Astro & @vitejs/devtools |

## Quick start

```bash
npm install @hotter-keys/core
```

```ts
import { createHotkeys, displayShortcut } from "@hotter-keys/core";

const hk = createHotkeys();

// Single shortcut
hk.add("mod+s", () => save());

// Multi-chord sequence
hk.add("mod+k mod+c", () => toggleComment());

// Layers for priority override
hk.add("mod+z", () => undo(), { layer: "editor" });
hk.pushLayer("editor");

// Scopes for context switching
hk.add("mod+z", () => undoText(), { scope: "text" });
hk.add("mod+z", () => undoStroke(), { scope: "draw" });
hk.setScope("text");

// Platform-aware display
displayShortcut("mod+s"); // "⌘S" on Mac, "Ctrl+S" elsewhere
```

## Features

- **Correct key matching** — uses `key`, not `code`/`keyCode`
- **Layout-aware** — only safe keys (a-z, 0-9) to avoid cross-layout issues
- **Cross-platform modifiers** — `mod` (Cmd/Ctrl), `mod2` (Ctrl/Alt)
- **Key sequences** — multi-chord shortcuts like `Ctrl+K Ctrl+C`
- **Layers** — priority stack for shortcut override
- **Scopes** — context-based filtering
- **Held keys tracking** — reactive key state with hold detection
- **Shortcut recording** — "press a key to rebind" UI support
- **Zero dependencies** — core has no runtime deps
- **DevTools** — real-time binding inspector for Vite, Astro & @vitejs/devtools

## Solid.js

```bash
npm install @hotter-keys/solid
```

```tsx
import { createHotkeys, createShortcut, createLayer, Hotkey } from "@hotter-keys/solid";

function App() {
  const hk = createHotkeys(); // auto-destroys on cleanup
  const editor = createLayer(hk, "editor", { active: true });

  createShortcut(hk, "mod+s", () => save());

  return (
    <>
      <Hotkey hk={hk} combo="mod+z" onFire={() => undo()} options={{ layer: "editor" }} />
      <p>Editor: {editor.isActive() ? "active" : "inactive"}</p>
      <p>Layers: {hk.layers().join(" → ")}</p>
    </>
  );
}
```

## DevTools

```bash
npm install -D @hotter-keys/devtools
```

```ts
// Astro
import { hotterKeysDevtoolsIntegration } from "@hotter-keys/devtools";
// → adds a Dev Toolbar app with bindings, events, and settings tabs

// @vitejs/devtools
import { hotterKeysViteDevtools } from "@hotter-keys/devtools/vite";
// → registers a browsable panel with binding inspector
```

## Try it

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/oddcelot/hotter-keys/tree/main/examples/demo?startScript=dev)

## Documentation

Full docs at **[oddcelot.github.io/hotter-keys](https://oddcelot.github.io/hotter-keys)**

- [Getting Started](https://oddcelot.github.io/hotter-keys/guides/getting-started)
- [Layers](https://oddcelot.github.io/hotter-keys/guides/layers)
- [Scopes](https://oddcelot.github.io/hotter-keys/guides/scopes)
- [DevTools](https://oddcelot.github.io/hotter-keys/guides/devtools)
- [API Reference](https://oddcelot.github.io/hotter-keys/reference/api)

## License

GPL-3.0-only
