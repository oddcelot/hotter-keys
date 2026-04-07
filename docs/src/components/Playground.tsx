import Container from "./Container";
import HeldKeys from "./HeldKeys";
import Shortcuts from "./Shortcuts";
import Sequences from "./Sequences";
import KeyRecorder from "./KeyRecorder";
import RecordLog from "./RecordLog";

/**
 * Convenience wrapper that renders the full playground.
 * For split layouts, use the individual section components directly.
 */
export default function Playground() {
  return (
    <>
      <Container />
      <HeldKeys />
      <Shortcuts />
      <Sequences />
      <KeyRecorder />
      <RecordLog />
    </>
  );
}
