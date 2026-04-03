import { createSignal, onCleanup, type Accessor } from "solid-js";
import {
  createHotkeys as coreCreateHotkeys,
  type Hotkeys,
  type HotkeysOptions,
  type Binding,
} from "@hotter-keys/core";

export interface HotkeysInstance {
  /** The underlying Hotkeys instance. */
  instance: Hotkeys;
  /** Reactive array of the current layer stack. */
  layers: Accessor<readonly string[]>;
  /** Reactive array of currently held keys. */
  heldKeys: Accessor<readonly string[]>;
  /** Reactive current scope string. */
  scope: Accessor<string>;
  /** Set the active scope (updates both the instance and the reactive signal). */
  setScope: (scope: string) => void;
  /** Push a layer onto the stack. */
  pushLayer: (name: string) => void;
  /** Pop a layer from the stack. */
  popLayer: (name?: string) => string | boolean | undefined;
}

/**
 * Create a reactive Hotkeys instance that auto-destroys on cleanup.
 *
 * ```tsx
 * const hk = createHotkeys();
 * hk.instance.add("mod+s", () => save());
 * // hk.layers() — reactive layer stack
 * // hk.heldKeys() — reactive held keys
 * ```
 */
export function createHotkeys(options?: HotkeysOptions): HotkeysInstance {
  const instance = coreCreateHotkeys(options);

  const [layers, setLayers] = createSignal<readonly string[]>(instance.getLayers());
  const [heldKeys, setHeldKeys] = createSignal<readonly string[]>(instance.getHeldKeys());
  const [scope, setScope] = createSignal(instance.getScope());

  const unsubLayers = instance.onLayerChange((l) => setLayers(l));
  const unsubHeldKeys = instance.onHeldKeysChange((k) => setHeldKeys(k));

  onCleanup(() => {
    unsubLayers();
    unsubHeldKeys();
    instance.destroy();
  });

  return {
    instance,
    layers,
    heldKeys,
    scope,
    setScope: (s: string) => {
      instance.setScope(s);
      setScope(s);
    },
    pushLayer: (name: string) => {
      instance.pushLayer(name);
    },
    popLayer: (name?: string) => {
      return name !== undefined ? instance.popLayer(name) : instance.popLayer();
    },
  };
}
