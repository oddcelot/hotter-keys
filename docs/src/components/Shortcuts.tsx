import ShortcutRows from "./ShortcutRows";
import { shortcuts, firedShortcuts, rebindShortcutRow } from "./state";

export default function Shortcuts() {
  return (
    <ShortcutRows
      rows={shortcuts}
      firedMap={firedShortcuts}
      color="green"
      onRebind={rebindShortcutRow}
      layout="grid"
    />
  );
}
