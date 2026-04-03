---
title: Types
description: TypeScript type definitions exported by hotter-keys.
---

## Core types

### `Modifiers`

```ts
interface Modifiers {
  ctrl: boolean;
  shift: boolean;
  meta: boolean;
  alt: boolean;
}
```

### `SafeKey`

Keys that are safe to use across keyboard layouts: `a`–`z` and `0`–`9`.

```ts
type SafeKey = "a" | "b" | ... | "z" | "0" | "1" | ... | "9";
```

### `Shortcut`

A single chord: one non-modifier key plus zero or more modifiers.

```ts
interface Shortcut extends Modifiers {
  key: SafeKey;
}
```

### `ShortcutSequence`

A sequence of one or more chords. `"ctrl+k ctrl+c"` parses to a sequence of length 2.

```ts
type ShortcutSequence = Shortcut[];
```

### `ShortcutHandler`

```ts
type ShortcutHandler = (event: KeyboardEvent) => void;
```

## Binding types

### `BindingOptions`

Options passed to `hk.add()`.

```ts
interface BindingOptions {
  scope?: string;            // Only fires in this scope
  preventDefault?: boolean;  // Default: true
  stopPropagation?: boolean; // Default: false
  enableInInput?: boolean;   // Default: false
  requireReset?: boolean;    // Default: false
  crossPlatform?: boolean;   // Default: true
  layer?: string;            // Default: "global"
}
```

### `Binding`

A resolved binding (returned by `getBindings()`).

```ts
interface Binding extends Omit<BindingOptions, "crossPlatform"> {
  readonly sequence: ShortcutSequence;
  readonly handler: ShortcutHandler;
}
```

## Options types

### `HotkeysOptions`

Options for `createHotkeys()`.

```ts
interface HotkeysOptions {
  target?: EventTarget;      // Default: document
  scope?: string;            // Default: "*"
  sequenceTimeout?: number;  // Default: 1000 (ms)
}
```

## Listener types

### `HeldKeysListener`

```ts
type HeldKeysListener = (keys: ReadonlyArray<string>) => void;
```

### `KeyHoldListener`

Fires `true` when the key is the sole key held, `false` otherwise.

```ts
type KeyHoldListener = (held: boolean) => void;
```

### `LayerChangeListener`

```ts
type LayerChangeListener = (layers: ReadonlyArray<string>) => void;
```

## Recording types

### `RecordedShortcut`

Returned by `recordShortcut()`.

```ts
interface RecordedShortcut {
  key: string;           // Raw key, lowercased
  ctrl: boolean;
  shift: boolean;
  meta: boolean;
  alt: boolean;
  mod: boolean;          // Platform primary (Cmd on Mac, Ctrl elsewhere)
  mod2: boolean;         // Platform secondary (Ctrl on Mac, Alt elsewhere)
  safe: boolean;         // Whether the key is safe cross-layout
  unsafeReason?: string; // Explanation if unsafe
}
```

## Devtools types

### `DevtoolsEvent`

Discriminated union of all events emitted via the `__devtools` hook.

```ts
type DevtoolsEvent =
  | { type: "binding:fired"; shortcut: ShortcutSequence; layer: string; scope: string | undefined; event: KeyboardEvent; timestamp: number }
  | { type: "binding:added"; shortcut: ShortcutSequence; options: BindingOptions; timestamp: number }
  | { type: "binding:removed"; shortcut: ShortcutSequence; timestamp: number }
  | { type: "layer:change"; layers: readonly string[]; timestamp: number }
  | { type: "scope:change"; scope: string; previous: string; timestamp: number }
  | { type: "held-keys:change"; keys: readonly string[]; timestamp: number }
  | { type: "lifecycle"; action: "start" | "stop" | "destroy"; timestamp: number };
```

### `DevtoolsHook`

```ts
type DevtoolsHook = (event: DevtoolsEvent) => void;
```
