---
title: API
description: Complete API reference for the Hotkeys class.
---

## `createHotkeys(options?)`

Create a new `Hotkeys` instance. Starts listening immediately.

```ts
import { createHotkeys } from "hotter-keys";
const hk = createHotkeys();
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `target` | `EventTarget` | `document` | Element to listen on |
| `scope` | `string` | `"*"` | Initial scope |
| `sequenceTimeout` | `number` | `1000` | Ms between chords before resetting sequence progress |

## Binding methods

### `add(shortcut, handler, options?)`

Register a shortcut. Returns an unsubscribe function.

```ts
const unsub = hk.add("mod+k", () => console.log("fired"));
unsub(); // removes the binding
```

**`shortcut`** — a string (`"mod+k"`), a `Shortcut` object, or a `ShortcutSequence` array.

**`options`** — see [BindingOptions](#bindingoptions).

### `addMany(map, options?)`

Register multiple shortcuts at once. Returns a single unsubscribe function that removes all of them.

```ts
const unsub = hk.addMany({
  "mod+s": () => save(),
  "mod+k mod+c": () => toggleComment(),
});
```

### `remove(shortcut, options?)`

Remove all bindings matching a shortcut.

```ts
hk.remove("mod+k");
```

### `removeAll()`

Remove all bindings.

## BindingOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `scope` | `string` | — | Only fires in the matching scope |
| `layer` | `string` | `"global"` | Layer for priority ordering |
| `preventDefault` | `boolean` | `true` | Call `event.preventDefault()` |
| `stopPropagation` | `boolean` | `false` | Call `event.stopPropagation()` |
| `enableInInput` | `boolean` | `false` | Fire in `<input>`, `<textarea>`, `contenteditable` |
| `requireReset` | `boolean` | `false` | Fire once per press cycle (all keys must release first) |
| `crossPlatform` | `boolean` | `true` | Auto-translate `ctrl` ↔ `meta` per platform |

## Scope methods

### `getScope()`

Returns the current scope string.

### `setScope(scope)`

Set the active scope. Only bindings with a matching scope (or no scope) will fire.

## Layer methods

### `getLayers()`

Returns a readonly copy of the current layer stack.

```ts
hk.getLayers(); // ["global", "editor"]
```

### `pushLayer(name)`

Push a layer onto the stack. No-op if the layer is already present.

### `popLayer()`

Pop the topmost layer (except `"global"`). Returns the popped name, or `undefined` if only `"global"` remains.

### `popLayer(name)`

Remove a specific layer by name. Returns `true` if found, `false` otherwise. Cannot remove `"global"`.

### `onLayerChange(listener)`

Subscribe to layer stack changes. Returns an unsubscribe function.

```ts
const unsub = hk.onLayerChange((layers) => {
  console.log(layers); // ["global", "editor"]
});
```

## Held keys

### `getHeldKeys()`

Returns a readonly array of currently pressed keys.

### `onHeldKeysChange(listener)`

Subscribe to held-keys changes. Fires on every keydown/keyup. Returns an unsubscribe function.

### `onKeyHold(key, listener)`

Watch if a specific key is held **alone**. The listener fires with `true` when the key is the sole key pressed, and `false` when another key is pressed alongside it or when it's released.

```ts
hk.onKeyHold("shift", (held) => {
  // Show shortcut hints while Shift is held alone
  overlay.visible = held;
});
```

## Bindings inspection

### `getBindings()`

Returns a readonly array of all registered `Binding` objects. Useful for devtools and debugging.

## Lifecycle

### `start()`

Start listening for keyboard events. Called automatically by the constructor.

### `stop()`

Stop listening without destroying state. Call `start()` to resume.

### `destroy()`

Full cleanup: stops listening, removes all bindings, clears all state.
