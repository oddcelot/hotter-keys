---
title: Utilities
description: Parsing, formatting, and recording utility functions.
---

## Display

### `displayShortcut(raw)`

Parse a raw shortcut string and format it for the current platform. Auto-detects macOS vs other platforms.

```ts
import { displayShortcut } from "@hotter-keys/core";

displayShortcut("mod+k");       // "⌘K" on Mac, "Ctrl+K" elsewhere
displayShortcut("mod+k mod+c"); // "⌘K ⌘C" on Mac, "Ctrl+K Ctrl+C" elsewhere
displayShortcut("mod+shift+p"); // "⌘⇧P" on Mac, "Ctrl+Shift+P" elsewhere
```

This is a convenience wrapper around `formatSequence(parseSequence(raw), isMac())`.

## Formatting

### `formatShortcut(shortcut, mac?)`

Serialize a `Shortcut` object to a human-readable string.

```ts
import { formatShortcut } from "@hotter-keys/core";

formatShortcut({ key: "k", ctrl: false, meta: true, shift: false, alt: false }, true);
// "⌘K"

formatShortcut({ key: "k", ctrl: true, meta: false, shift: false, alt: false }, false);
// "Ctrl+K"
```

### `formatSequence(sequence, mac?)`

Serialize a `ShortcutSequence` (array of chords) to a human-readable string.

```ts
import { formatSequence } from "@hotter-keys/core";

formatSequence([
  { key: "k", ctrl: false, meta: true, shift: false, alt: false },
  { key: "c", ctrl: false, meta: true, shift: false, alt: false },
], true);
// "⌘K ⌘C"
```

## Parsing

### `parseShortcut(raw, platform?)`

Parse a single chord string into a `Shortcut` object.

```ts
import { parseShortcut } from "@hotter-keys/core";

parseShortcut("ctrl+k");
// { key: "k", ctrl: true, shift: false, meta: false, alt: false }

parseShortcut("mod+k");
// On Mac: { key: "k", ctrl: false, shift: false, meta: true, alt: false }
// Elsewhere: { key: "k", ctrl: true, shift: false, meta: false, alt: false }
```

### `parseSequence(raw, platform?)`

Parse a multi-chord string (space-separated) into a `ShortcutSequence`.

```ts
import { parseSequence } from "@hotter-keys/core";

parseSequence("mod+k mod+c");
// [{ key: "k", meta: true, ... }, { key: "c", meta: true, ... }]  (on Mac)
```

## Platform detection

### `isMac()`

Returns `true` if the current platform is macOS. Uses `navigator.platform` with a fallback to `navigator.userAgent`.

```ts
import { isMac } from "@hotter-keys/core";

isMac(); // true on macOS, false elsewhere
```

## Translation

### `translateForPlatform(shortcut, platform?)`

Translate `ctrl` ↔ `meta` based on the current platform. Used internally when `crossPlatform: true` (the default).

On macOS, `ctrl` in a shortcut becomes `meta` (Cmd). On Windows/Linux, `meta` becomes `ctrl`.

## Recording

### `recordShortcut(target?, signal?)`

Wait for the user to press a key combination and return a `RecordedShortcut`. Useful for "press a key to rebind" UIs.

```ts
import { recordShortcut } from "@hotter-keys/core";

const result = await recordShortcut();

if (result.safe) {
  console.log("Recorded:", result.key, result.mod, result.shift);
} else {
  console.warn("Unsafe:", result.unsafeReason);
}
```

**`target`** — `EventTarget` to listen on. Defaults to `document`.

**`signal`** — `AbortSignal` to cancel recording.

The returned `RecordedShortcut` includes `mod` and `mod2` booleans for cross-platform storage.
