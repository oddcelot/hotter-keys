import { createSignal, onCleanup, onMount, For, Show } from "solid-js";
import { createHotkeys, isMac, formatSequence, parseSequence } from "hotter-keys";
import type { Hotkeys } from "hotter-keys";
import "../styles/demo.css";
import styles from "./ShortcutLayers.module.css";

const GAP = 60;
const ROT_Z = -35;
const SCALE_PER_DEPTH = 0.06;
const SINK_PER_DEPTH = 18;
const CMD_LABELS = ["⌘K", "F", "N", "?"];

function comboLabel(combo: string): string {
  const mac = isMac();
  return formatSequence(parseSequence(combo, { mac }), mac);
}

interface Action {
  key: string;
  label: string;
  desc: string;
  advances?: boolean;
  pos: [number, number, number, number];
  round?: boolean;
  cardLabel?: string;
}

interface LayerConfig {
  title: string;
  layer?: string;
  actions: Action[];
}

const LAYERS: LayerConfig[] = [
  {
    title: "Base — global shortcuts",
    actions: [
      { key: "mod+k", label: "", cardLabel: "⌘ K", desc: "command bar", advances: true, pos: [60, 60, 80, 44] },
      { key: "mod+s", label: "", cardLabel: "⌘ S", desc: "save", pos: [220, 60, 80, 44] },
      { key: "mod+shift+p", label: "", cardLabel: "⌘ ⇧P", desc: "palette", pos: [220, 256, 80, 44] },
      { key: "mod+z", label: "", cardLabel: "⌘ Z", desc: "undo", pos: [60, 256, 80, 44] },
      { key: "escape", label: "Esc", desc: "cancel", pos: [152, 152, 56, 56], round: true },
    ],
  },
  {
    title: "Command bar — category select",
    layer: "cmdbar",
    actions: [
      { key: "f", label: "F", desc: "file", advances: true, pos: [140, 60, 80, 72] },
      { key: "e", label: "E", desc: "edit", pos: [244, 164, 80, 72] },
      { key: "v", label: "V", desc: "view", pos: [140, 228, 80, 72] },
      { key: "g", label: "G", desc: "git", pos: [36, 164, 80, 72] },
    ],
  },
  {
    title: "File — operations",
    layer: "file",
    actions: [
      { key: "n", label: "N", desc: "new file", advances: true, pos: [140, 64, 80, 60] },
      { key: "o", label: "O", desc: "open", pos: [238, 172, 80, 60] },
      { key: "s", label: "S", desc: "save", pos: [42, 172, 80, 60] },
      { key: "shift+s", label: "", cardLabel: "⇧S", desc: "save as", pos: [140, 264, 80, 60] },
    ],
  },
  {
    title: "New file — template type",
    layer: "newfile",
    actions: [
      { key: "t", label: "T", desc: "template", pos: [78, 78, 64, 64], round: true },
      { key: "b", label: "B", desc: "blank", pos: [218, 78, 64, 64], round: true },
      { key: "v", label: "V", desc: "clipboard", pos: [78, 218, 64, 64], round: true },
      { key: "d", label: "D", desc: "duplicate", pos: [218, 218, 64, 64], round: true },
    ],
  },
];

// Unique layer names in stack order
const LAYER_NAMES = LAYERS.map((l) => l.layer).filter(Boolean) as string[];

// Build the JSON config shown in the code panel (only user-facing fields)
function layerToJson(cfg: LayerConfig): string {
  const obj: Record<string, unknown> = {};
  if (cfg.layer) obj.layer = cfg.layer;
  obj.shortcuts = cfg.actions
    .filter((a) => a.key !== "escape")
    .map((a) => ({ key: a.key, action: a.desc }));
  return JSON.stringify(obj, null, 2);
}

// Fill in platform-aware labels at init time
function initLabels() {
  for (const cfg of LAYERS) {
    for (const a of cfg.actions) {
      if (!a.label) a.label = comboLabel(a.key);
      if (!a.cardLabel) a.cardLabel = a.label;
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

  function goTo(target: number) {
    const clamped = Math.max(0, Math.min(LAYERS.length, target));
    const cur = step();
    if (clamped === cur) return;

    if (clamped > cur) {
      for (let i = cur; i < clamped; i++) {
        if (i > 0 && i - 1 < LAYER_NAMES.length) hk.pushLayer(LAYER_NAMES[i - 1]);
      }
    } else {
      for (let i = cur; i > clamped; i--) {
        if (i - 2 >= 0 && i - 2 < LAYER_NAMES.length) hk.popLayer(LAYER_NAMES[i - 2]);
      }
    }

    setStep(clamped);
  }

  function reset() {
    for (let i = LAYER_NAMES.length - 1; i >= 0; i--) hk.popLayer(LAYER_NAMES[i]);
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
  const currentLayer = () => LAYERS[step() - 1];
  const currentActions = () => currentLayer()?.actions ?? [];
  const currentJson = () => {
    const cfg = currentLayer();
    return cfg ? layerToJson(cfg) : "";
  };

  const layerTransform = (i: number) => {
    const on = i < step();
    const isTop = i === topIndex();
    const tz = i * GAP;
    if (!on) return `scale(0.85) translateZ(${tz}px)`;
    if (isTop) return `scale(1) translateZ(${tz}px)`;
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

    LAYERS.forEach((cfg, layerIdx) => {
      for (const a of cfg.actions) {
        if (a.key === "escape") continue;

        const opts = cfg.layer
          ? { layer: cfg.layer, preventDefault: false }
          : undefined;

        if (a.advances) {
          hk.add(a.key, () => {
            if (!cfg.layer && step() !== 1) return;
            clearTimeout(resetTimer);
            goTo(layerIdx + 2);
            setLastAction(`${a.label} → ${a.desc}`);
            flash(a.label);
          }, opts);
        } else if (!cfg.layer) {
          hk.add(a.key, () => {
            if (step() !== 1) return;
            setLastAction(`${a.label} → ${a.desc}`);
            flash(a.label);
          });
        } else {
          hk.add(a.key, () => completeAction(a.label, a.desc), opts);
        }
      }
    });

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

    const suppress = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && ["k", "s", "z"].includes(k)) e.preventDefault();
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && k === "p") e.preventDefault();
    };
    document.addEventListener("keydown", suppress, { capture: true });

    onCleanup(() => {
      clearTimeout(resetTimer);
      hk.destroy();
      document.removeEventListener("keydown", onEscape);
      document.removeEventListener("keydown", suppress, { capture: true });
    });
  });

  function renderCards(layerIdx: number) {
    return (
      <For each={LAYERS[layerIdx].actions}>
        {(a, j) => {
          const [x, y, w, h] = a.pos;
          const lit = () => j() === 0 && ringLit(layerIdx);
          return (
            <div
              class={`${styles.card} ${a.round ? styles.cardRound : ""} ${lit() ? styles.cardLit : ""}`}
              style={{ left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` }}
            >
              <span class={styles.cardKey}>{a.cardLabel}</span>
              <span class={styles.cardDesc}>{a.desc}</span>
            </div>
          );
        }}
      </For>
    );
  }

  return (
    <>
      <div class={styles.split}>
        {/* 3D stage */}
        <div class={styles.stage}>
          <div
            class={styles.rig}
            style={{ transform: `rotateX(55deg) rotateZ(${ROT_Z}deg)` }}
          >
            <For each={LAYERS}>
              {(_, i) => (
                <div
                  class={layerClasses(i())}
                  style={{ transform: layerTransform(i()) }}
                >
                  {renderCards(i())}
                </div>
              )}
            </For>
          </div>
        </div>

        {/* Config code panel */}
        <div class={styles.codePanel}>
          <div class={styles.codePanelHeader}>
            <span class={`${styles.codePanelDot} ${(styles as Record<string, string>)[`dot${step() - 1}`]}`} />
            {currentLayer()?.title ?? ""}
          </div>
          <pre class={styles.codePre}><code>{currentJson()}</code></pre>
        </div>
      </div>

      <div class={styles.ctrls}>
        <div class={styles.stepTrack}>
          <For each={LAYERS}>
            {(_, i) => (
              <>
                <Show when={i() > 0}>
                  <div class={lineClasses(i() - 1)} />
                </Show>
                <div class={styles.stepSlot}>
                  <div
                    class={`${styles.stepCmd} ${(styles as Record<string, string>)[`cmd${i()}`]} ${cmdShow(i()) ? styles.stepCmdShow : ""}`}
                  >
                    {CMD_LABELS[i()]}
                  </div>
                  <div class={dotClasses(i())} />
                </div>
              </>
            )}
          </For>
        </div>

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

        <div class={styles.actionFeedback} style={{ opacity: lastAction() ? 1 : 0 }}>
          {lastAction() || "\u00A0"}
        </div>

        <div class={styles.btnRow}>
          <button class="btn btn-sm" onClick={() => reset()}>
            Reset
          </button>
        </div>
      </div>
    </>
  );
}
