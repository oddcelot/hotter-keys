import {
  createSignal,
  createMemo,
  onCleanup,
  onMount,
  For,
  Show,
} from "solid-js";
import { createSwitchTransition } from "@solid-primitives/transition-group";
import {
  createHotkeys,
  isMac,
  formatSequence,
  parseSequence,
} from "hotter-keys";
import type { Hotkeys } from "hotter-keys";
import "../styles/demo.css";
import styles from "./ShortcutLayers.module.css";

const s = styles as Record<string, string>;

// ── Types ──────────────────────────────────────────────────────────────────

interface Shortcut {
  key: string;
  desc: string;
  advances?: true;
}

interface ShapeLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  round?: true;
}

interface LayerDef {
  id: string;
  title: string;
  hkLayer?: string;
  trackLabel: string;
  shortcuts: Shortcut[];
  layout: ShapeLayout[];
}

// ── Escape (defined once, injected into every layer) ───────────────────────

const ESC: Shortcut = { key: "escape", desc: "back" };
const ESC_LAYOUT: ShapeLayout = { x: 152, y: 152, w: 56, h: 56, round: true };

// ── Layer definitions ──────────────────────────────────────────────────────

const LAYERS: LayerDef[] = [
  {
    id: "base",
    title: "Base \u2014 global shortcuts",
    trackLabel: "\u2318K",
    shortcuts: [
      { key: "mod+k", desc: "command bar", advances: true },
      { key: "mod+s", desc: "save" },
      { key: "mod+shift+p", desc: "palette" },
      { key: "mod+z", desc: "undo" },
    ],
    layout: [
      { x: 60, y: 60, w: 80, h: 44 },
      { x: 220, y: 60, w: 80, h: 44 },
      { x: 220, y: 256, w: 80, h: 44 },
      { x: 60, y: 256, w: 80, h: 44 },
    ],
  },
  {
    id: "cmdbar",
    title: "Command bar \u2014 category select",
    hkLayer: "cmdbar",
    trackLabel: "F",
    shortcuts: [
      { key: "f", desc: "file", advances: true },
      { key: "e", desc: "edit" },
      { key: "v", desc: "view" },
      { key: "g", desc: "git" },
    ],
    layout: [
      { x: 140, y: 60, w: 80, h: 72 },
      { x: 244, y: 164, w: 80, h: 72 },
      { x: 140, y: 228, w: 80, h: 72 },
      { x: 36, y: 164, w: 80, h: 72 },
    ],
  },
  {
    id: "file",
    title: "File \u2014 operations",
    hkLayer: "file",
    trackLabel: "N",
    shortcuts: [
      { key: "n", desc: "new file", advances: true },
      { key: "o", desc: "open" },
      { key: "s", desc: "save" },
      { key: "shift+s", desc: "save as" },
    ],
    layout: [
      { x: 140, y: 64, w: 80, h: 60 },
      { x: 238, y: 172, w: 80, h: 60 },
      { x: 42, y: 172, w: 80, h: 60 },
      { x: 140, y: 264, w: 80, h: 60 },
    ],
  },
  {
    id: "newfile",
    title: "New file \u2014 template type",
    hkLayer: "newfile",
    trackLabel: "",
    shortcuts: [
      { key: "t", desc: "template" },
      { key: "b", desc: "blank" },
      { key: "v", desc: "clipboard" },
      { key: "d", desc: "duplicate" },
    ],
    layout: [
      { x: 78, y: 78, w: 64, h: 64, round: true },
      { x: 218, y: 78, w: 64, h: 64, round: true },
      { x: 78, y: 218, w: 64, h: 64, round: true },
      { x: 218, y: 218, w: 64, h: 64, round: true },
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

const GAP = 60;
const ROT_Z = -35;
const SCALE_PER_DEPTH = 0.06;
const SINK_PER_DEPTH = 18;

const labelCache = new Map<string, string>();
function displayLabel(key: string): string {
  let l = labelCache.get(key);
  if (!l) {
    const mac = isMac();
    l = formatSequence(parseSequence(key, { mac }), mac);
    labelCache.set(key, l);
  }
  return l;
}

function allShortcuts(layer: LayerDef): Shortcut[] {
  return [...layer.shortcuts, ESC];
}

function allLayouts(layer: LayerDef): ShapeLayout[] {
  return [...layer.layout, ESC_LAYOUT];
}

function layerToJson(layer: LayerDef): string {
  const obj: Record<string, unknown> = {};
  if (layer.hkLayer) obj.layer = layer.hkLayer;
  obj.shortcuts = layer.shortcuts.map((sc) => ({
    key: sc.key,
    action: sc.desc,
  }));
  return JSON.stringify(obj, null, 2);
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ShortcutLayers() {
  const [depth, setDepth] = createSignal(0);
  const [fired, setFired] = createSignal<{
    label: string;
    desc: string;
  } | null>(null);
  const [trackOverride, setTrackOverride] = createSignal<{
    label: string;
    desc: string;
  } | null>(null);

  let hk: Hotkeys;
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  function flash(label: string, desc: string) {
    setFired({ label, desc });
    setTimeout(() => setFired(null), 500);
  }

  function goTo(target: number) {
    const to = Math.max(0, Math.min(LAYERS.length - 1, target));
    if (to === depth()) return;

    if (to > depth()) {
      for (let i = depth() + 1; i <= to; i++) {
        const name = LAYERS[i].hkLayer;
        if (name) hk.pushLayer(name);
      }
    } else {
      for (let i = depth(); i > to; i--) {
        const name = LAYERS[i].hkLayer;
        if (name) hk.popLayer(name);
      }
    }

    setDepth(to);
  }

  function reset() {
    for (let i = LAYERS.length - 1; i >= 0; i--) {
      const name = LAYERS[i].hkLayer;
      if (name) hk.popLayer(name);
    }
    setDepth(0);
    setFired(null);
    setTrackOverride(null);
  }

  function fireAction(sc: Shortcut, layerIdx: number) {
    if (sc.key === "escape") {
      if (depth() > 0) {
        clearTimeout(resetTimer);
        setTrackOverride(null);
        goTo(depth() - 1);
        flash("Esc", "back");
      }
      return;
    }

    const label = displayLabel(sc.key);
    flash(label, sc.desc);

    if (sc.advances) {
      clearTimeout(resetTimer);
      goTo(layerIdx + 1);
    } else if (layerIdx === LAYERS.length - 1) {
      setTrackOverride({ label, desc: sc.desc });
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────

  const currentLayer = () => LAYERS[depth()];
  const currentJson = () => layerToJson(currentLayer());
  const ringLit = (i: number) => depth() > i;

  const layerTransform = (i: number) => {
    const on = i <= depth();
    const isTop = i === depth();
    const tz = i * GAP;
    if (!on) return `scale(0.85) translateZ(${tz}px)`;
    if (isTop) return `scale(1) translateZ(${tz}px)`;
    const behind = depth() - i;
    const sc = 1 - behind * SCALE_PER_DEPTH;
    const ty = behind * SINK_PER_DEPTH;
    return `scale(${sc}) translateY(${ty}px) translateZ(${tz}px)`;
  };

  // ── Keyboard setup ─────────────────────────────────────────────────────

  onMount(() => {
    hk = createHotkeys({ target: document });

    LAYERS.forEach((layer, layerIdx) => {
      for (const sc of layer.shortcuts) {
        const opts = layer.hkLayer
          ? { layer: layer.hkLayer, preventDefault: false }
          : undefined;
        hk.add(sc.key, () => fireAction(sc, layerIdx), opts);
      }
    });

    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && depth() > 0) {
        e.preventDefault();
        fireAction(ESC, depth());
      }
    };
    document.addEventListener("keydown", onEscape);

    const suppress = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && ["k", "s", "z"].includes(k))
        e.preventDefault();
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && k === "p")
        e.preventDefault();
    };
    document.addEventListener("keydown", suppress, { capture: true });

    onCleanup(() => {
      clearTimeout(resetTimer);
      hk.destroy();
      document.removeEventListener("keydown", onEscape);
      document.removeEventListener("keydown", suppress, { capture: true });
    });
  });

  // ── SVG layer renderer ─────────────────────────────────────────────────

  function renderLayer(layer: LayerDef, layerIdx: number) {
    const shortcuts = allShortcuts(layer);
    const layouts = allLayouts(layer);

    return (
      <svg
        viewBox="0 0 360 360"
        xmlns="http://www.w3.org/2000/svg"
        class={s.layerSvg}
        role="img"
        aria-label={layer.title}
      >
        <For each={layouts}>
          {(shape, j) => {
            const sc = shortcuts[j()];
            const cx = shape.x + shape.w / 2;
            const cy = shape.y + shape.h / 2;
            const lit = () => j() === 0 && ringLit(layerIdx);
            return (
              <g>
                {shape.round ? (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={shape.w / 2}
                    classList={{
                      [s.shape]: true,
                      [s.shapeLit]: lit(),
                    }}
                  />
                ) : (
                  <rect
                    x={shape.x}
                    y={shape.y}
                    width={shape.w}
                    height={shape.h}
                    rx="6"
                    classList={{
                      [s.shape]: true,
                      [s.shapeLit]: lit(),
                    }}
                  />
                )}
                {sc.key === "escape" ? (
                  <text
                    x={cx}
                    y={cy}
                    text-anchor="middle"
                    dominant-baseline="central"
                    class={s.shapeKey}
                  >
                    Esc
                  </text>
                ) : (
                  <>
                    <text
                      x={cx}
                      y={cy - 4}
                      text-anchor="middle"
                      dominant-baseline="central"
                      class={s.shapeKey}
                    >
                      {displayLabel(sc.key)}
                    </text>
                    <text
                      x={cx}
                      y={cy + 12}
                      text-anchor="middle"
                      dominant-baseline="central"
                      class={s.shapeDesc}
                    >
                      {sc.desc}
                    </text>
                  </>
                )}
              </g>
            );
          }}
        </For>
      </svg>
    );
  }

  // ── Pill group transition (swap entire group on depth change) ─────────

  const pillGroup = createMemo(() => {
    const d = depth();
    const layer = LAYERS[d];
    const pills: Shortcut[] = layer.hkLayer
      ? [...layer.shortcuts, ESC]
      : layer.shortcuts;

    return (
      <div class={`not-content ${s.shortcuts}`}>
        <For each={pills}>
          {(sc) => {
            const label = sc.key === "escape" ? "Esc" : displayLabel(sc.key);
            const isEsc = sc.key === "escape";
            return (
              <button
                type="button"
                classList={{
                  [s.shortcutPill]: true,
                  [s[`pill${d}`]]: !isEsc,
                  [s.pillAdvances]: !!sc.advances,
                  [s.pillFired]: fired()?.label === label,
                  [s.pillEsc]: isEsc,
                }}
                onClick={() => fireAction(sc, d)}
              >
                <span class={s.pillKey}>{label}</span>
                <span class={s.pillDesc}>{sc.desc}</span>
              </button>
            );
          }}
        </For>
      </div>
    ) as HTMLElement;
  });

  const pillTransition = createSwitchTransition(pillGroup, {
    onEnter(el, done) {
      el.classList.add(s.pillEnter);
      requestAnimationFrame(() => {
        // force the browser to paint the initial state before transitioning
        void el.offsetHeight;
        el.classList.remove(s.pillEnter);
        el.classList.add(s.pillEnterActive);
        el.addEventListener("transitionend", done, { once: true });
      });
    },
    onExit(el, done) {
      el.classList.add(s.pillExitActive);
      el.addEventListener("transitionend", done, { once: true });
    },
    mode: "out-in",
  });

  // ── JSX ────────────────────────────────────────────────────────────────

  return (
    <>
      <div class={s.split}>
        {/* 3D stage */}
        <div class={s.stage}>
          <div
            class={s.rig}
            style={{ transform: `rotateX(55deg) rotateZ(${ROT_Z}deg)` }}
          >
            <For each={LAYERS}>
              {(layer, i) => (
                <div
                  classList={{
                    [s.layer]: true,
                    [s[`l${i()}`]]: true,
                    [s.visible]: i() <= depth(),
                    [s.active]: i() === depth(),
                    [s.dimmed]: i() < depth(),
                  }}
                  style={{ transform: layerTransform(i()) }}
                >
                  {renderLayer(layer, i())}
                </div>
              )}
            </For>
          </div>
        </div>

        {/* Config code panel */}
        <div class={s.codePanel}>
          <div class={s.codePanelHeader}>
            <span
              classList={{
                [s.codePanelDot]: true,
                [s[`dot${depth()}`]]: true,
              }}
            />
            {currentLayer().title}
          </div>
          <pre class={s.codePre}>
            <code>{currentJson()}</code>
          </pre>
        </div>
      </div>

      <div class={s.ctrls}>
        {/* Step track */}
        <div class={s.stepTrack}>
          <For each={LAYERS}>
            {(layer, i) => {
              const isLast = i() === LAYERS.length - 1;
              let stickyLabel = layer.trackLabel;
              const label = () => {
                if (!isLast) return layer.trackLabel;
                const override = trackOverride()?.label;
                if (override) stickyLabel = override;
                return stickyLabel;
              };
              const showCmd = () =>
                isLast
                  ? !!(trackOverride() && depth() === LAYERS.length - 1)
                  : depth() > i();
              return (
                <>
                  <Show when={i() > 0}>
                    <div
                      classList={{
                        [s.stepLine]: true,
                        [s.lineOn]: depth() > i() - 1,
                        [s.lineOff]: depth() <= i() - 1,
                        [s[`line${i() - 1}`]]: depth() > i() - 1,
                      }}
                    />
                  </Show>
                  <div class={s.stepSlot}>
                    <div
                      classList={{
                        [s.stepCmd]: true,
                        [s[`cmd${i()}`]]: true,
                        [s.stepCmdShow]: showCmd(),
                      }}
                    >
                      {label()}
                    </div>
                    <div
                      classList={{
                        [s.stepDot]: true,
                        [s.dotOff]: i() > depth(),
                        [s.dotOn]: i() === depth(),
                        [s.dotDim]: i() < depth(),
                        [s[`dot${i()}`]]: i() <= depth(),
                      }}
                    />
                  </div>
                </>
              );
            }}
          </For>
        </div>

        {/* Shortcut pills */}
        <For each={pillTransition()}>{(el) => el}</For>

        {() => {
          const f = fired() ?? trackOverride();
          return (
            <div
              class={s.actionFeedback}
              style={{ opacity: f ? 1 : 0 }}
            >
              {f ? `${f.label} \u2192 ${f.desc}` : "\u00A0"}
            </div>
          );
        }}

        <div class={s.btnRow}>
          <button type="button" class="btn btn-sm" onClick={() => reset()}>
            Reset
          </button>
        </div>
      </div>
    </>
  );
}
