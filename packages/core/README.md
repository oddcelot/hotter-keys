# @hotter-keys/core

A correct, cross-browser, layout-aware keyboard shortcut library. Zero dependencies.

## Install

```bash
npm install @hotter-keys/core
```

## Usage

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
hk.setScope("text");

// Platform-aware display
displayShortcut("mod+s"); // "⌘S" on Mac, "Ctrl+S" elsewhere

// Clean up
hk.destroy();
```

## Features

- **Correct key matching** — uses `key`, not `code`/`keyCode`
- **Layout-aware** — only safe keys (a-z, 0-9) to avoid cross-layout issues
- **Cross-platform modifiers** — `mod` (Cmd/Ctrl), `mod2` (Ctrl/Alt)
- **Key sequences** — multi-chord shortcuts like `Ctrl+K Ctrl+C`
- **Layers** — priority stack for shortcut override
- **Scopes** — context-based filtering
- **Held keys tracking** — reactive key state
- **Zero dependencies**

## Docs

https://oddcelot.github.io/hotter-keys
