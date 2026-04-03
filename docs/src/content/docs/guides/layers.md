---
title: Layers
description: Use layers to manage shortcut priority and override behavior.
---

Layers form a **priority stack**. The highest layer consumes matching key events first, preventing lower layers from firing. Unmatched keys fall through to lower layers.

Every binding defaults to the `"global"` layer.

## Pushing and popping layers

```ts
const hk = createHotkeys();

// Global shortcut — always available
hk.add("mod+s", () => save());

// Editor shortcuts — only active when the editor layer is pushed
hk.add("mod+z", () => undo(), { layer: "editor" });
hk.add("mod+shift+z", () => redo(), { layer: "editor" });

hk.pushLayer("editor");   // editor shortcuts now active
hk.popLayer("editor");    // editor shortcuts deactivated
```

## Listening to layer changes

```ts
hk.onLayerChange((layers) => {
  console.log("Layer stack:", layers);
  // e.g. ["global", "editor"]
});
```

The callback receives the full stack as a frozen array.

## Reading the current stack

```ts
hk.getLayers();
// ["global", "editor"]
```

## Focus-activated layers

A common pattern is to push a layer when a UI region gains focus and pop it on blur:

```ts
const editorEl = document.getElementById("editor");

editorEl.addEventListener("focus", () => hk.pushLayer("editor"));
editorEl.addEventListener("blur", () => hk.popLayer("editor"));
```

This way, editor shortcuts like `Mod+Z` only fire when the editor panel is focused. When the user clicks elsewhere, the layer pops and the key combo falls through to the global layer (or does nothing).

## Modal layer pattern

For modal dialogs, push a layer when opening and pop on close:

```ts
function openModal() {
  hk.pushLayer("modal");
  dialogEl.showModal();
}

function closeModal() {
  hk.popLayer("modal");
  dialogEl.close();
}

// Modal-only shortcuts
hk.add("mod+1", () => copyLink(), { layer: "modal" });
hk.add("mod+2", () => exportItem(), { layer: "modal" });
```

The modal layer sits on top of the stack and intercepts key events before lower layers. When the dialog closes, the shortcuts disappear.

## Layer stack ordering

Layers are checked from the top of the stack down:

```
["global", "editor", "modal"]
   ↑ lowest priority       ↑ highest priority
```

If `"modal"` has a binding for `Mod+Z`, it fires. If not, it falls through to `"editor"`, then `"global"`.

## When to use layers

Use layers when:
- A UI region adds **extra** shortcuts on top of a base set
- You need **priority override** (e.g. a modal consuming keys before the editor)
- Shortcuts should **stack** (global + editor + modal all active simultaneously)

If you need the **same key** to do **different things** depending on context (rather than stacking), use [scopes](/guides/scopes) instead.
