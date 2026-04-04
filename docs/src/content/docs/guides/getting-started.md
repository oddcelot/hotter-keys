---
title: Getting Started
description: Install and use hotter-keys in your project.
---

## Install

```bash
npm install @hotter-keys/core
```

## Quick start

```ts
import { createHotkeys } from "@hotter-keys/core";

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
import { recordShortcut, formatShortcut } from "@hotter-keys/core";

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
4. **Alt/Option is allowed as an explicit modifier** — macOS transforms the character when Alt/Option is pressed (e.g. `Alt+c` → `ç`), so the `mod2` virtual keyword resolves to Ctrl on macOS and Alt on Windows/Linux, providing a safe cross-platform secondary modifier.
5. **Progressive enhancement** — uses the Keyboard API (Chrome) when available for broader support.

## Cross-platform modifiers

hotter-keys provides two virtual modifier keywords that resolve differently per platform:

| Keyword | macOS    | Windows/Linux | Role               |
| ------- | -------- | ------------- | ------------------ |
| `mod`   | Cmd (⌘)  | Ctrl          | Primary modifier   |
| `mod2`  | Ctrl (⌃) | Alt           | Secondary modifier |

```ts
// Primary modifier — Cmd on macOS, Ctrl elsewhere
hk.add("mod+s", () => save());

// Secondary modifier — Ctrl on macOS, Alt elsewhere
hk.add("mod2+k", () => togglePanel());

// Both together — Cmd+Ctrl on macOS, Ctrl+Alt elsewhere
hk.add("mod+mod2+p", () => openSettings());
```

You can also use `alt` or `option` directly for explicit Alt bindings, but note that on macOS these will only work if the browser reports the untransformed key value.
