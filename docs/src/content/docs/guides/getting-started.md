---
title: Getting Started
description: Install and use hotter-keys in your project.
---

## Install

```bash
npm install hotter-keys
```

## Quick start

```ts
import { createHotkeys } from "hotter-keys";

const hk = createHotkeys();

// Single shortcut
hk.add("ctrl+k", () => {
  console.log("Command palette!");
});

// Multi-chord sequence
hk.add("ctrl+k ctrl+c", () => {
  console.log("Comment block!");
});

// Clean up when done
hk.destroy();
```

## Held keys tracking

```ts
const hk = createHotkeys();

hk.onHeldKeysChange((keys) => {
  console.log("Currently held:", keys);
});

hk.onKeyHold("shift", (held) => {
  console.log("Shift held alone:", held);
});
```

## Record a shortcut

Useful for building "press a key to rebind" UIs:

```ts
import { recordShortcut, formatShortcut } from "hotter-keys";

const result = await recordShortcut();

if (result.safe) {
  console.log("Recorded:", formatShortcut(result));
} else {
  console.warn("Unsafe shortcut:", result.unsafeReason);
}
```

## Design principles

Based on [this analysis](https://blog.duvallj.pw/posts/2025-01-10-all-javascript-keyboard-shortcut-libraries-are-broken.html) of why existing keyboard shortcut libraries are broken:

1. **Match on `key`, never `code`/`keyCode`/`which`** — these are layout-dependent and unreliable.
2. **Only a-z and 0-9 are safe** — symbol keys change across keyboard layouts.
3. **Shift is only allowed with a-z** — `Shift+2` produces different symbols per locale.
4. **Alt/Option is forbidden** — macOS transforms the character (e.g. `Alt+c` → `ç`).
5. **Progressive enhancement** — uses the Keyboard API (Chrome) when available for broader support.
