import ShortcutRows from "./ShortcutRows";
import { sequences, firedSequences, rebindSequenceRow } from "./state";

export default function Sequences() {
  return (
    <ShortcutRows
      hint="Press the first chord, then the second within 1 second. Rebinding replaces the full sequence with a single chord."
      rows={sequences}
      firedMap={firedSequences}
      color="blue"
      onRebind={rebindSequenceRow}
    />
  );
}
