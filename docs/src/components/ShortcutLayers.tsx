import { createSignal, onCleanup, onMount, For, Show } from "solid-js";
import { createHotkeys, isMac, formatSequence, parseSequence } from "hotter-keys";
import type { Hotkeys } from "hotter-keys";
import "../styles/demo.css";
import styles from "./ShortcutLayers.module.css";

const GAP = 60;
const ROT_Z = -35;
// Each step below the top shrinks by this factor and sinks by this many px
const SCALE_PER_DEPTH = 0.06;
const SINK_PER_DEPTH = 18;
const TITLES = [
  "",
  "Base — global shortcuts",
  "Command bar — category select",
  "File — operations",
  "New file — template type",
];
const CMD_LABELS = ["⌘K", "F", "N", "?"];

function comboLabel(combo: string): string {
  const mac = isMac();
  return formatSequence(parseSequence(combo, { mac }), mac);
}

// The layer names used in hotter-keys
const LAYER_NAMES = ["cmdbar", "file", "newfile"];

interface Action {
  key: string;
  label: string;
  desc: string;
  advances?: boolean;
}

// Actions for each step (step 1–4 → index 0–3)
const LAYER_ACTIONS: Action[][] = [
  [
    { key: "mod+k", label: "", desc: "command bar", advances: true },
    { key: "mod+s", label: "", desc: "save" },
    { key: "mod+z", label: "", desc: "undo" },
    { key: "mod+shift+p", label: "", desc: "palette" },
  ],
  [
    { key: "f", label: "F", desc: "file", advances: true },
    { key: "e", label: "E", desc: "edit" },
    { key: "v", label: "V", desc: "view" },
    { key: "g", label: "G", desc: "git" },
  ],
  [
    { key: "n", label: "N", desc: "new file", advances: true },
    { key: "o", label: "O", desc: "open" },
    { key: "s", label: "S", desc: "save" },
    { key: "shift+s", label: "", desc: "save as" },
  ],
  [
    { key: "t", label: "T", desc: "template" },
    { key: "b", label: "B", desc: "blank" },
    { key: "v", label: "V", desc: "clipboard" },
    { key: "d", label: "D", desc: "duplicate" },
  ],
];

// Fill in platform-aware labels for mod combos at init time
function initLabels() {
  for (const layer of LAYER_ACTIONS) {
    for (const a of layer) {
      if (!a.label) a.label = comboLabel(a.key);
    }
  }
}

export default function ShortcutLayers() {
  const [step, setStep] = createSignal(1);
  const [lastAction, setLastAction] = createSignal("");
  const [firedKey, setFiredKey] = createSignal("");

  let hk: Hotkeys;
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  function flash(key: string) {
    setFiredKey(key);
    setTimeout(() => setFiredKey(""), 500);
  }

  // Sync the hotter-keys layer stack whenever step changes
  function goTo(target: number) {
    const clamped = Math.max(0, Math.min(4, target));
    const cur = step();
    if (clamped === cur) return;

    if (clamped > cur) {
      for (let i = cur; i < clamped; i++) {
        if (i > 0 && i - 1 < LAYER_NAMES.length) {
          hk.pushLayer(LAYER_NAMES[i - 1]);
        }
      }
    } else {
      for (let i = cur; i > clamped; i--) {
        if (i - 2 >= 0 && i - 2 < LAYER_NAMES.length) {
          hk.popLayer(LAYER_NAMES[i - 2]);
        }
      }
    }

    setStep(clamped);
  }

  function reset() {
    for (let i = LAYER_NAMES.length - 1; i >= 0; i--) {
      hk.popLayer(LAYER_NAMES[i]);
    }
    setStep(1);
    setLastAction("");
  }

  function completeAction(label: string, desc: string) {
    setLastAction(`${label} → ${desc}`);
    flash(label);
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => reset(), 1200);
  }

  // Derived helpers
  const topIndex = () => step() - 1;

  const currentActions = () => LAYER_ACTIONS[step() - 1] ?? [];

  const layerTransform = (i: number) => {
    const on = i < step();
    const isTop = i === topIndex();
    const tz = i * GAP;
    if (!on) return `scale(0.85) translateZ(${tz}px)`;
    if (isTop) return `scale(1) translateZ(${tz}px)`;
    // depth = how many layers below the top (1 = directly below, 2 = two below, …)
    const depth = topIndex() - i;
    const s = 1 - depth * SCALE_PER_DEPTH;
    const ty = depth * SINK_PER_DEPTH;
    return `scale(${s}) translateY(${ty}px) translateZ(${tz}px)`;
  };

  const layerClasses = (i: number) => {
    const on = i < step();
    const isTop = i === topIndex();
    return [
      styles.layer,
      (styles as Record<string, string>)[`l${i}`],
      on ? styles.visible : "",
      on ? (isTop ? styles.active : styles.dimmed) : "",
    ]
      .filter(Boolean)
      .join(" ");
  };

  const ringLit = (i: number) => step() > i + 1;

  const dotClasses = (i: number) => {
    const on = i < step();
    const isTop = i === topIndex();
    const colour = (styles as Record<string, string>)[`dot${i}`];
    if (!on) return `${styles.stepDot} ${styles.dotOff}`;
    if (isTop) return `${styles.stepDot} ${styles.dotOn} ${colour}`;
    return `${styles.stepDot} ${styles.dotDim} ${colour}`;
  };

  const cmdShow = (i: number) => step() > i + 1;

  const lineClasses = (i: number) => {
    const on = step() > i + 1;
    const colour = (styles as Record<string, string>)[`line${i}`];
    return on
      ? `${styles.stepLine} ${styles.lineOn} ${colour}`
      : `${styles.stepLine} ${styles.lineOff}`;
  };

  onMount(() => {
    initLabels();
    hk = createHotkeys({ target: document });

    // --- Global layer (step 1) ---
    hk.add("mod+k", () => {
      if (step() === 1) {
        clearTimeout(resetTimer);
        goTo(2);
        const lbl = comboLabel("mod+k");
        setLastAction(`${lbl} → command bar`);
        flash(lbl);
      }
    });
    hk.add("mod+s", () => {
      if (step() === 1) {
        const lbl = comboLabel("mod+s");
        setLastAction(`${lbl} → save`);
        flash(lbl);
      }
    });
    hk.add("mod+z", () => {
      if (step() === 1) {
        const lbl = comboLabel("mod+z");
        setLastAction(`${lbl} → undo`);
        flash(lbl);
      }
    });
    hk.add("mod+shift+p", () => {
      if (step() === 1) {
        const lbl = comboLabel("mod+shift+p");
        setLastAction(`${lbl} → palette`);
        flash(lbl);
      }
    });

    // --- Command bar layer (step 2): F advances, E/V/G complete ---
    hk.add("f", () => {
      clearTimeout(resetTimer);
      goTo(3);
      setLastAction("F → file");
      flash("F");
    }, { layer: "cmdbar", preventDefault: false });

    for (const a of [
      { key: "e", label: "E", desc: "edit" },
      { key: "v", label: "V", desc: "view" },
      { key: "g", label: "G", desc: "git" },
    ]) {
      hk.add(a.key, () => completeAction(a.label, a.desc), {
        layer: "cmdbar",
        preventDefault: false,
      });
    }

    // --- File layer (step 3): N advances, O/S/⇧S complete ---
    hk.add("n", () => {
      clearTimeout(resetTimer);
      goTo(4);
      setLastAction("N → new file");
      flash("N");
    }, { layer: "file", preventDefault: false });

    hk.add("o", () => completeAction("O", "open"), {
      layer: "file",
      preventDefault: false,
    });
    hk.add("s", () => completeAction("S", "save"), {
      layer: "file",
      preventDefault: false,
    });
    hk.add("shift+s", () => completeAction(comboLabel("shift+s"), "save as"), {
      layer: "file",
      preventDefault: false,
    });

    // --- New file layer (step 4): all complete ---
    for (const a of [
      { key: "t", label: "T", desc: "template" },
      { key: "b", label: "B", desc: "blank" },
      { key: "v", label: "V", desc: "clipboard" },
      { key: "d", label: "D", desc: "duplicate" },
    ]) {
      hk.add(a.key, () => completeAction(a.label, a.desc), {
        layer: "newfile",
        preventDefault: false,
      });
    }

    // Escape goes back one step
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && step() > 1) {
        e.preventDefault();
        clearTimeout(resetTimer);
        goTo(step() - 1);
        setLastAction("Esc → back");
        flash("Esc");
      }
    };
    document.addEventListener("keydown", onEscape);

    // Suppress browser defaults for our shortcuts
    const suppress = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && ["k", "s", "z"].includes(k)) {
        e.preventDefault();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && k === "p") {
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", suppress, { capture: true });

    onCleanup(() => {
      clearTimeout(resetTimer);
      hk.destroy();
      document.removeEventListener("keydown", onEscape);
      document.removeEventListener("keydown", suppress, { capture: true });
    });
  });

  return (
    <>
      {/* 3D stage */}
      <div class={styles.stage}>
        <div
          class={styles.rig}
          style={{ transform: `rotateX(55deg) rotateZ(${ROT_Z}deg)` }}
        >
          {/* Layer 0 — Base */}
          <div
            class={layerClasses(0)}
            style={{ "--tz": `${0 * GAP}px`, transform: layerTransform(0) }}
          >
            <svg viewBox="0 0 360 360" xmlns="http://www.w3.org/2000/svg">
              <g stroke="#AFA9EC" stroke-width="0.4" fill="none" opacity="0.35">
                <rect x="30" y="30" width="300" height="300" rx="4" />
                <rect x="70" y="70" width="220" height="220" rx="4" />
                <line x1="30" y1="30" x2="70" y2="70" />
                <line x1="330" y1="30" x2="290" y2="70" />
                <line x1="30" y1="330" x2="70" y2="290" />
                <line x1="330" y1="330" x2="290" y2="290" />
                <circle cx="180" cy="180" r="100" />
                <circle cx="180" cy="180" r="140" />
              </g>
              <g>
                <rect
                  x="56" y="56" width="88" height="52" rx="8"
                  fill="#AFA9EC"
                  fill-opacity={ringLit(0) ? "0.18" : "0"}
                  stroke="#7F77DD"
                  stroke-width={ringLit(0) ? "2.5" : "0"}
                  opacity={ringLit(0) ? "1" : "0"}
                  style="transition:all .4s"
                />
                <rect x="60" y="60" width="80" height="44" rx="6" fill="#AFA9EC" fill-opacity="0.15" stroke="#AFA9EC" stroke-width="0.8" />
                <text x="100" y="78" text-anchor="middle" font-family="var(--sl-font-mono)" font-size="13" font-weight="500" fill="#7F77DD">⌘ K</text>
                <text x="100" y="94" text-anchor="middle" font-size="9" fill="#7F77DD" opacity="0.7">command bar</text>
              </g>
              <g>
                <rect x="220" y="60" width="80" height="44" rx="6" fill="#AFA9EC" fill-opacity="0.15" stroke="#AFA9EC" stroke-width="0.8" />
                <text x="260" y="78" text-anchor="middle" font-family="var(--sl-font-mono)" font-size="13" font-weight="500" fill="#7F77DD">⌘ S</text>
                <text x="260" y="94" text-anchor="middle" font-size="9" fill="#7F77DD" opacity="0.7">save</text>
              </g>
              <g>
                <rect x="60" y="256" width="80" height="44" rx="6" fill="#AFA9EC" fill-opacity="0.15" stroke="#AFA9EC" stroke-width="0.8" />
                <text x="100" y="274" text-anchor="middle" font-family="var(--sl-font-mono)" font-size="13" font-weight="500" fill="#7F77DD">⌘ Z</text>
                <text x="100" y="290" text-anchor="middle" font-size="9" fill="#7F77DD" opacity="0.7">undo</text>
              </g>
              <g>
                <rect x="220" y="256" width="80" height="44" rx="6" fill="#AFA9EC" fill-opacity="0.15" stroke="#AFA9EC" stroke-width="0.8" />
                <text x="260" y="274" text-anchor="middle" font-family="var(--sl-font-mono)" font-size="13" font-weight="500" fill="#7F77DD">⌘ ⇧P</text>
                <text x="260" y="290" text-anchor="middle" font-size="9" fill="#7F77DD" opacity="0.7">palette</text>
              </g>
              <g>
                <circle cx="180" cy="180" r="28" fill="#AFA9EC" fill-opacity="0.1" stroke="#AFA9EC" stroke-width="0.8" />
                <text x="180" y="176" text-anchor="middle" font-family="var(--sl-font-mono)" font-size="11" font-weight="500" fill="#7F77DD">Esc</text>
                <text x="180" y="190" text-anchor="middle" font-size="9" fill="#7F77DD" opacity="0.7">cancel</text>
              </g>
            </svg>
          </div>

          {/* Layer 1 — Command bar categories */}
          <div
            class={layerClasses(1)}
            style={{ "--tz": `${1 * GAP}px`, transform: layerTransform(1) }}
          >
            <svg viewBox="0 0 360 360" xmlns="http://www.w3.org/2000/svg">
              <g stroke="#5DCAA5" stroke-width="0.4" fill="none" opacity="0.3">
                <path d="M180 20L180 340" />
                <path d="M20 180L340 180" />
                <path d="M180 20L340 180L180 340L20 180Z" />
                <circle cx="180" cy="180" r="80" />
              </g>
              <g>
                <polygon
                  points="180,48 228,76 228,134 180,160 132,134 132,76"
                  fill="#5DCAA5"
                  fill-opacity={ringLit(1) ? "0.18" : "0"}
                  stroke="#0F6E56"
                  stroke-width={ringLit(1) ? "2.5" : "0"}
                  opacity={ringLit(1) ? "1" : "0"}
                  style="transition:all .4s"
                />
                <polygon points="180,52 224,78 224,130 180,156 136,130 136,78" fill="#5DCAA5" fill-opacity="0.12" stroke="#5DCAA5" stroke-width="0.8" />
                <text x="180" y="108" text-anchor="middle" font-family="var(--sl-font-mono)" font-size="15" font-weight="500" fill="#0F6E56">F</text>
                <text x="180" y="124" text-anchor="middle" font-size="9" fill="#0F6E56" opacity="0.8">file</text>
              </g>
              <g>
                <polygon points="284,156 328,182 328,234 284,260 240,234 240,182" fill="#5DCAA5" fill-opacity="0.12" stroke="#5DCAA5" stroke-width="0.8" />
                <text x="284" y="212" text-anchor="middle" font-family="var(--sl-font-mono)" font-size="15" font-weight="500" fill="#0F6E56">E</text>
                <text x="284" y="228" text-anchor="middle" font-size="9" fill="#0F6E56" opacity="0.8">edit</text>
              </g>
              <g>
                <polygon points="180,204 224,230 224,282 180,308 136,282 136,230" fill="#5DCAA5" fill-opacity="0.12" stroke="#5DCAA5" stroke-width="0.8" />
                <text x="180" y="262" text-anchor="middle" font-family="var(--sl-font-mono)" font-size="15" font-weight="500" fill="#0F6E56">V</text>
                <text x="180" y="278" text-anchor="middle" font-size="9" fill="#0F6E56" opacity="0.8">view</text>
              </g>
              <g>
                <polygon points="76,156 120,182 120,234 76,260 32,234 32,182" fill="#5DCAA5" fill-opacity="0.12" stroke="#5DCAA5" stroke-width="0.8" />
                <text x="76" y="212" text-anchor="middle" font-family="var(--sl-font-mono)" font-size="15" font-weight="500" fill="#0F6E56">G</text>
                <text x="76" y="228" text-anchor="middle" font-size="9" fill="#0F6E56" opacity="0.8">git</text>
              </g>
              <g stroke="#5DCAA5" stroke-width="0.5" opacity="0.4" fill="none">
                <line x1="180" y1="156" x2="180" y2="204" />
                <line x1="224" y1="130" x2="240" y2="182" />
                <line x1="136" y1="130" x2="120" y2="182" />
              </g>
            </svg>
          </div>

          {/* Layer 2 — File operations */}
          <div
            class={layerClasses(2)}
            style={{ "--tz": `${2 * GAP}px`, transform: layerTransform(2) }}
          >
            <svg viewBox="0 0 360 360" xmlns="http://www.w3.org/2000/svg">
              <g stroke="#F0997B" stroke-width="0.4" fill="none" opacity="0.25">
                <polygon points="180,30 310,255 50,255" />
                <polygon points="180,330 50,105 310,105" />
                <circle cx="180" cy="180" r="70" />
              </g>
              <g>
                <polygon
                  points="180,62 214,120 146,120"
                  fill="#F0997B"
                  fill-opacity={ringLit(2) ? "0.18" : "0"}
                  stroke="#993C1D"
                  stroke-width={ringLit(2) ? "2.5" : "0"}
                  opacity={ringLit(2) ? "1" : "0"}
                  style="transition:all .4s"
                />
                <polygon points="180,68 208,116 152,116" fill="#F0997B" fill-opacity="0.15" stroke="#F0997B" stroke-width="0.8" />
                <text x="180" y="104" text-anchor="middle" font-family="var(--sl-font-mono)" font-size="13" font-weight="500" fill="#993C1D">N</text>
                <text x="180" y="130" text-anchor="middle" font-size="9" fill="#993C1D" opacity="0.8">new file</text>
              </g>
              <g>
                <polygon points="278,180 306,228 250,228" fill="#F0997B" fill-opacity="0.15" stroke="#F0997B" stroke-width="0.8" />
                <text x="278" y="216" text-anchor="middle" font-family="var(--sl-font-mono)" font-size="13" font-weight="500" fill="#993C1D">O</text>
                <text x="278" y="242" text-anchor="middle" font-size="9" fill="#993C1D" opacity="0.8">open</text>
              </g>
              <g>
                <polygon points="82,180 110,228 54,228" fill="#F0997B" fill-opacity="0.15" stroke="#F0997B" stroke-width="0.8" />
                <text x="82" y="216" text-anchor="middle" font-family="var(--sl-font-mono)" font-size="13" font-weight="500" fill="#993C1D">S</text>
                <text x="82" y="242" text-anchor="middle" font-size="9" fill="#993C1D" opacity="0.8">save</text>
              </g>
              <g>
                <polygon points="180,260 208,308 152,308" fill="#F0997B" fill-opacity="0.15" stroke="#F0997B" stroke-width="0.8" />
                <text x="180" y="296" text-anchor="middle" font-family="var(--sl-font-mono)" font-size="13" font-weight="500" fill="#993C1D">⇧S</text>
                <text x="180" y="322" text-anchor="middle" font-size="9" fill="#993C1D" opacity="0.8">save as</text>
              </g>
            </svg>
          </div>

          {/* Layer 3 — Template type */}
          <div
            class={layerClasses(3)}
            style={{ "--tz": `${3 * GAP}px`, transform: layerTransform(3) }}
          >
            <svg viewBox="0 0 360 360" xmlns="http://www.w3.org/2000/svg">
              <g stroke="#85B7EB" stroke-width="0.4" fill="none" opacity="0.25">
                <path d="M40 180Q90 80 140 180Q190 280 240 180Q290 80 340 180" />
                <path d="M40 130Q90 30 140 130Q190 230 240 130Q290 30 340 130" />
                <path d="M40 230Q90 130 140 230Q190 330 240 230Q290 130 340 230" />
                <path d="M180 40Q80 90 180 140Q280 190 180 240Q80 290 180 340" />
              </g>
              <g>
                <circle cx="110" cy="110" r="32" fill="#85B7EB" fill-opacity="0.12" stroke="#85B7EB" stroke-width="0.8" />
                <text x="110" y="107" text-anchor="middle" font-family="var(--sl-font-mono)" font-size="14" font-weight="500" fill="#185FA5">T</text>
                <text x="110" y="122" text-anchor="middle" font-size="9" fill="#185FA5" opacity="0.8">template</text>
                <circle cx="250" cy="110" r="32" fill="#85B7EB" fill-opacity="0.12" stroke="#85B7EB" stroke-width="0.8" />
                <text x="250" y="107" text-anchor="middle" font-family="var(--sl-font-mono)" font-size="14" font-weight="500" fill="#185FA5">B</text>
                <text x="250" y="122" text-anchor="middle" font-size="9" fill="#185FA5" opacity="0.8">blank</text>
                <circle cx="110" cy="250" r="32" fill="#85B7EB" fill-opacity="0.12" stroke="#85B7EB" stroke-width="0.8" />
                <text x="110" y="247" text-anchor="middle" font-family="var(--sl-font-mono)" font-size="14" font-weight="500" fill="#185FA5">V</text>
                <text x="110" y="262" text-anchor="middle" font-size="9" fill="#185FA5" opacity="0.8">clipboard</text>
                <circle cx="250" cy="250" r="32" fill="#85B7EB" fill-opacity="0.12" stroke="#85B7EB" stroke-width="0.8" />
                <text x="250" y="247" text-anchor="middle" font-family="var(--sl-font-mono)" font-size="14" font-weight="500" fill="#185FA5">D</text>
                <text x="250" y="262" text-anchor="middle" font-size="9" fill="#185FA5" opacity="0.8">duplicate</text>
                <g stroke="#85B7EB" stroke-width="0.5" opacity="0.35" fill="none">
                  <line x1="142" y1="110" x2="218" y2="110" />
                  <line x1="110" y1="142" x2="110" y2="218" />
                  <line x1="250" y1="142" x2="250" y2="218" />
                  <line x1="142" y1="250" x2="218" y2="250" />
                </g>
              </g>
            </svg>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div class={styles.ctrls}>
        <div
          class={styles.layerTitle}
          style={{ opacity: step() > 0 ? 1 : 0 }}
        >
          {TITLES[step()] ?? ""}
        </div>

        {/* Step track */}
        <div class={styles.stepTrack}>
          <For each={[0, 1, 2, 3]}>
            {(i) => (
              <>
                <Show when={i > 0}>
                  <div class={lineClasses(i - 1)} />
                </Show>
                <div class={styles.stepSlot}>
                  <div
                    class={`${styles.stepCmd} ${(styles as Record<string, string>)[`cmd${i}`]} ${cmdShow(i) ? styles.stepCmdShow : ""}`}
                  >
                    {CMD_LABELS[i]}
                  </div>
                  <div class={dotClasses(i)} />
                </div>
              </>
            )}
          </For>
        </div>

        {/* Available shortcuts for current layer */}
        <div class={styles.shortcuts}>
          <For each={currentActions()}>
            {(a) => (
              <span
                class={`${styles.shortcutPill} ${(styles as Record<string, string>)[`pill${step() - 1}`]} ${a.advances ? styles.pillAdvances : ""} ${firedKey() === a.label ? styles.pillFired : ""}`}
              >
                <span class={styles.pillKey}>{a.label}</span>
                <span class={styles.pillDesc}>{a.desc}</span>
              </span>
            )}
          </For>
          <Show when={step() > 1}>
            <span
              class={`${styles.shortcutPill} ${styles.pillEsc} ${firedKey() === "Esc" ? styles.pillFired : ""}`}
            >
              <span class={styles.pillKey}>Esc</span>
              <span class={styles.pillDesc}>back</span>
            </span>
          </Show>
        </div>

        {/* Last action feedback */}
        <div class={styles.actionFeedback} style={{ opacity: lastAction() ? 1 : 0 }}>
          {lastAction() || "\u00A0"}
        </div>

        {/* Reset button */}
        <div class={styles.btnRow}>
          <button class="btn btn-sm" onClick={() => reset()}>
            Reset
          </button>
        </div>
      </div>
    </>
  );
}
