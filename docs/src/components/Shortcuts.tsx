import ShortcutRows from "./ShortcutRows";
import { shortcuts, firedShortcuts, rebindShortcutRow } from "./state";

export default function Shortcuts() {
  return (
    <ShortcutRows
      title="Shortcuts"
      rows={shortcuts}
      firedMap={firedShortcuts}
      color="green"
      onRebind={rebindShortcutRow}
      layout="grid"
    />
  );
}
