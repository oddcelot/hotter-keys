# @hotter-keys/solid

Solid.js primitives for [hotter-keys](https://github.com/oddcelot/hotter-keys) — reactive keyboard shortcut management with automatic cleanup.

## Install

```bash
npm install hotter-keys @hotter-keys/solid
```

## Primitives

### `createHotkeys(options?)`

Create a reactive hotkeys instance. Auto-destroys when the owner scope is disposed.

```tsx
import { createHotkeys } from "@hotter-keys/solid";

function App() {
  const hk = createHotkeys();

  hk.instance.add("mod+s", () => save());

  return (
    <div>
      <p>Layers: {hk.layers().join(" → ")}</p>
      <p>Held: {hk.heldKeys().join(" + ")}</p>
      <p>Scope: {hk.scope()}</p>
    </div>
  );
}
```

**Returns:**

| Property | Type | Description |
|----------|------|-------------|
| `instance` | `Hotkeys` | The underlying core instance |
| `layers` | `Accessor<readonly string[]>` | Reactive layer stack |
| `heldKeys` | `Accessor<readonly string[]>` | Reactive held keys |
| `scope` | `Accessor<string>` | Reactive current scope |
| `setScope(s)` | `(string) => void` | Set scope (updates signal + instance) |
| `pushLayer(name)` | `(string) => void` | Push a layer |
| `popLayer(name?)` | `(string?) => ...` | Pop a layer |

### `createShortcut(hk, combo, handler, options?)`

Register a shortcut with automatic cleanup. Supports reactive combos.

```tsx
import { createHotkeys, createShortcut } from "@hotter-keys/solid";

function Editor() {
  const hk = createHotkeys();

  // Static combo
  createShortcut(hk, "mod+s", () => save());

  // Reactive combo — re-binds when the signal changes
  const [combo, setCombo] = createSignal("mod+z");
  createShortcut(hk, combo, () => undo());

  // With options
  createShortcut(hk, "mod+shift+z", () => redo(), { layer: "editor" });
}
```

### `createLayer(hk, name, options?)`

Manage a named layer. Auto-pops when the component unmounts.

```tsx
import { createHotkeys, createLayer, createShortcut } from "@hotter-keys/solid";

function Modal(props: { onClose: () => void }) {
  const hk = createHotkeys();

  // Push immediately, auto-pop on unmount
  const modal = createLayer(hk, "modal", { active: true });

  createShortcut(hk, "mod+1", () => copyLink(), { layer: "modal" });
  createShortcut(hk, "mod+2", () => exportItem(), { layer: "modal" });

  return (
    <dialog open>
      <p>Modal layer {modal.isActive() ? "active" : "inactive"}</p>
      <button onClick={props.onClose}>Close</button>
    </dialog>
  );
}
```

**Returns:**

| Property | Type | Description |
|----------|------|-------------|
| `isActive` | `Accessor<boolean>` | Whether this layer is in the stack |
| `push()` | `() => void` | Push the layer |
| `pop()` | `() => void` | Pop the layer |

### `createKeyHold(instance, key)`

Track whether a key is held alone. Returns a reactive boolean.

```tsx
import { createHotkeys, createKeyHold } from "@hotter-keys/solid";

function App() {
  const hk = createHotkeys();
  const shiftHeld = createKeyHold(hk.instance, "shift");

  return (
    <div>
      {shiftHeld() && <div class="shortcut-hints">...</div>}
    </div>
  );
}
```

## Component

### `<Hotkey>`

Declarative shortcut registration. Mounts with the component, cleans up on unmount.

```tsx
import { createHotkeys, Hotkey } from "@hotter-keys/solid";

function App() {
  const hk = createHotkeys();

  return (
    <>
      <Hotkey hk={hk} combo="mod+s" onFire={() => save()} />
      <Hotkey hk={hk} combo="mod+z" onFire={() => undo()} options={{ layer: "editor" }} />
      <Hotkey hk={hk} combo="mod+1" onFire={() => action()} options={{ layer: "modal", scope: "modal" }} />
    </>
  );
}
```

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `hk` | `HotkeysInstance` | From `createHotkeys()` |
| `combo` | `string` | Shortcut string |
| `onFire` | `ShortcutHandler` | Handler |
| `options?` | `BindingOptions` | Layer, scope, etc. |

## Patterns

### Focus-activated layers

```tsx
function EditorPanel() {
  const hk = createHotkeys();
  const editor = createLayer(hk, "editor");

  createShortcut(hk, "mod+z", () => undo(), { layer: "editor" });
  createShortcut(hk, "mod+shift+z", () => redo(), { layer: "editor" });

  return (
    <section
      tabIndex={0}
      onFocus={() => editor.push()}
      onBlur={() => editor.pop()}
    >
      Editor — {editor.isActive() ? "active" : "inactive"}
    </section>
  );
}
```

### Scope switching

```tsx
function App() {
  const hk = createHotkeys();

  createShortcut(hk, "mod+z", () => undoText(), { scope: "text" });
  createShortcut(hk, "mod+z", () => undoStroke(), { scope: "draw" });

  return (
    <div>
      <section tabIndex={0} onFocus={() => hk.setScope("text")}>Text Editor</section>
      <section tabIndex={0} onFocus={() => hk.setScope("draw")}>Canvas</section>
      <p>Scope: {hk.scope()}</p>
    </div>
  );
}
```

### Conditional shortcuts with `<Show>`

```tsx
function App() {
  const hk = createHotkeys();
  const [modalOpen, setModalOpen] = createSignal(false);

  createShortcut(hk, "mod+p", () => setModalOpen(true));

  return (
    <Show when={modalOpen()}>
      <Hotkey hk={hk} combo="mod+1" onFire={() => action1()} options={{ layer: "modal" }} />
      <Hotkey hk={hk} combo="mod+2" onFire={() => action2()} options={{ layer: "modal" }} />
    </Show>
  );
}
```

Shortcuts inside `<Show>` auto-register when the condition is true and auto-clean up when it becomes false.
