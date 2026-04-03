---
title: Scopes
description: Use scopes to filter which bindings are active based on context.
---

Scopes **filter** which bindings are considered. Only the active scope's bindings fire — all others are invisible. This is different from [layers](/guides/layers), which control priority.

## Setting the scope

```ts
const hk = createHotkeys();

// These bindings only fire in their matching scope
hk.add("mod+z", () => undoText(), { scope: "text-editor" });
hk.add("mod+z", () => undoStroke(), { scope: "drawing" });

hk.setScope("text-editor");  // Mod+Z → undoText()
hk.setScope("drawing");      // Mod+Z → undoStroke()
```

The same key combo does completely different things depending on the active scope.

## Reading the current scope

```ts
hk.getScope();
// "text-editor"
```

## The wildcard scope

The default scope is `"*"`, which means "match everything". Bindings with no `scope` option fire in any scope:

```ts
// Always fires regardless of scope
hk.add("mod+s", () => save());

// Only fires in "text-editor" scope
hk.add("mod+z", () => undoText(), { scope: "text-editor" });

hk.setScope("text-editor");
// Mod+S fires (no scope → matches everything)
// Mod+Z fires (scope matches)

hk.setScope("drawing");
// Mod+S fires (no scope → matches everything)
// Mod+Z does NOT fire (scope mismatch)
```

## Focus-activated scopes

Switch scope when a UI panel gains focus:

```ts
textEditorEl.addEventListener("focus", () => hk.setScope("text-editor"));
canvasEl.addEventListener("focus", () => hk.setScope("drawing"));
```

## Layers vs scopes

| | Layers | Scopes |
|---|---|---|
| **Model** | Priority stack | Context filter |
| **Multiple active** | Yes (stacked) | No (one at a time) |
| **Same key, different action** | Higher layer wins | Active scope wins |
| **Unmatched keys** | Fall through to lower layers | Ignored |
| **Use case** | Additive shortcuts (editor + modal) | Context switching (text vs canvas) |

**Use layers** when UI regions add extra shortcuts on top of a base set.

**Use scopes** when the same key combo should do different things depending on which context is active.

You can combine both: layers for priority, scopes for filtering within a layer.
