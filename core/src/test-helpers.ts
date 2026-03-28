export function fireKey(
  target: EventTarget,
  key: string,
  mods: Partial<{
    ctrlKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    repeat: boolean;
  }> = {}
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
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

export function fireKeyUp(
  target: EventTarget,
  key: string,
  mods: Partial<{
    ctrlKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
    altKey: boolean;
  }> = {}
): KeyboardEvent {
  const event = new KeyboardEvent("keyup", {
    key,
    ctrlKey: mods.ctrlKey ?? false,
    shiftKey: mods.shiftKey ?? false,
    metaKey: mods.metaKey ?? false,
    altKey: mods.altKey ?? false,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}
