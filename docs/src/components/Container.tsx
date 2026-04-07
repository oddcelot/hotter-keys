import { onCleanup, onMount } from "solid-js";
import { initPlayground } from "./state";

/**
 * Initializes the shared hotkeys instance on mount.
 * Renders an inline hint. Must appear before section components on the page.
 */
export default function Container() {
  onMount(() => {
    const cleanup = initPlayground();
    onCleanup(cleanup);
  });

  return <p class="demo-hint">Start pressing keys. Use the record buttons to rebind shortcuts.</p>;
}
