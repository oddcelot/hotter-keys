type KeyMods = Partial<{
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  repeat: boolean;
}>;

function fire(
  type: "keydown" | "keyup",
  target: EventTarget,
  key: string,
  mods: KeyMods = {},
): KeyboardEvent {
  const event = new KeyboardEvent(type, {
    key,
    ctrlKey: mods.ctrlKey ?? false,
    shiftKey: mods.shiftKey ?? false,
    metaKey: mods.metaKey ?? false,
    altKey: mods.altKey ?? false,
    repeat: mods.repeat ?? false,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

export function fireKey(target: EventTarget, key: string, mods: KeyMods = {}): KeyboardEvent {
  return fire("keydown", target, key, mods);
}

export function fireKeyUp(target: EventTarget, key: string, mods: KeyMods = {}): KeyboardEvent {
  return fire("keyup", target, key, mods);
}
