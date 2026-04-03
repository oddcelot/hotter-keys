import { isMac, parseSequence, formatSequence } from "@hotter-keys/core";

/**
 * Renders a shortcut string (e.g. "mod+k mod+c") formatted for the current
 * platform: ⌘K ⌘C on macOS, Ctrl+K Ctrl+C on Windows/Linux.
 */
export default function Kbd(props: { combo: string }) {
  const mac = isMac();
  const seq = parseSequence(props.combo, { mac });
  return <kbd>{formatSequence(seq, mac)}</kbd>;
}
