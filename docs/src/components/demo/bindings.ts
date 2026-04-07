import type { BindingOptions } from "@hotter-keys/core";
import type { BadgeColor } from "../Badge";

export type { BadgeColor };

export interface Binding {
  raw: string;
  action: string;
  options?: BindingOptions;
  handler?: "openModal";
}

export const LAYER_COLORS: Record<string, BadgeColor> = {
  global: "purple",
  editor: "green",
  canvas: "blue",
  modal: "orange",
};

export const SCOPE_COLORS: Record<string, BadgeColor> = {
  "*": "purple",
  "text-editor": "green",
  drawing: "blue",
};

// prettier-ignore
export const BINDINGS: Binding[] = [
  // Global (always active)
  { raw: "mod+p",       action: "Open modal",         handler: "openModal" },
  { raw: "mod+s",       action: "Save" },
  { raw: "mod+shift+p", action: "Quick search" },
  { raw: "mod+k mod+c", action: "Toggle comment" },

  // Editor layer
  { raw: "mod+z",       action: "Undo",                options: { layer: "editor" } },
  { raw: "mod+shift+z", action: "Redo",                options: { layer: "editor" } },

  // Canvas layer
  { raw: "mod+d",       action: "Duplicate",           options: { layer: "canvas" } },
  { raw: "mod+g",       action: "Group",               options: { layer: "canvas" } },

  // Modal layer
  { raw: "mod+1",       action: "Copy link",           options: { layer: "modal" } },
  { raw: "mod+2",       action: "Export",              options: { layer: "modal" } },
  { raw: "mod+3",       action: "Delete",              options: { layer: "modal" } },

  // Scoped (same key, different action per scope)
  { raw: "mod+z",       action: "Undo text",           options: { scope: "text-editor" } },
  { raw: "mod+z",       action: "Undo stroke",         options: { scope: "drawing" } },
  { raw: "mod+shift+z", action: "Redo text",           options: { scope: "text-editor" } },
  { raw: "mod+shift+z", action: "Redo stroke",         options: { scope: "drawing" } },
  { raw: "mod+a",       action: "Select all text",     options: { scope: "text-editor" } },
  { raw: "mod+a",       action: "Select all objects",  options: { scope: "drawing" } },
];

export const layerOf = (b: Binding) => b.options?.layer ?? "global";
export const layerColorOf = (b: Binding): BadgeColor => LAYER_COLORS[layerOf(b)] ?? "purple";
export const scopeOf = (b: Binding) => b.options?.scope;
