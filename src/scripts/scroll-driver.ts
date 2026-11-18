import {
  patternAFrame, sectionProgress, clamp, smoothToward,
  heroOverlayFrame, patternBEntry, easeOutCubic,
} from "../lib/scroll-math";
import { heroSequence } from "./hero-sequence";

/**
 * One loop drives every scroll-linked scene. Each scene has a target value
 * read from the scroll position and a current value that follows it through
 * a damper (smoothToward), so motion has a little weight instead of jumping
 * with the wheel. The loop sleeps when everything has settled.
 *
 * Per frame: all layout reads first, then all writes (no forced layouts).
 */

const TAU_MS = 110;
const EPS = 0.0004;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

type Kind = "a" | "b" | "flow";
interface Els {
  card: HTMLElement | null;
  inner: HTMLElement | null;
  title: HTMLElement | null;
  wL: HTMLElement | null;
  wR: HTMLElement | null;
  hedgeTL: HTMLElement | null;
  hedgeBR: HTMLElement | null;
  cardB: HTMLElement | null;
  flowTitles: HTMLElement[];
  flowDescs: HTMLElement[];
  flowSlides: HTMLElement[];
}
interface Tracked {
  el: HTMLElement;
  kind: Kind;
  hero: boolean;
  els: Els;
  current: number;
  target: number;
  lastStep: number;
}

const heroFades = Array.from(document.querySelectorAll<HTMLElement>("[data-hero-fade]"));

function readTarget(t: Tracked): number {
  const rect = t.el.getBoundingClientRect();
  const vh = window.innerHeight;
  if (t.kind === "b") return patternBEntry(rect.top, vh);
  return sectionProgress({ rectTop: rect.top, sectionHeight: t.el.offsetHeight, viewportHeight: vh });
}

function applyPatternA(t: Tracked) {
  const f = patternAFrame(t.current);
  const { card, inner, title, wL, wR, hedgeTL, hedgeBR } = t.els;

  const sequenceOwnsCard = t.hero && card && inner ? heroSequence.render(card, inner, t.current) : false;
  if (card && !sequenceOwnsCard) {
    card.style.transform = `translate3d(0, ${f.offsetY.toFixed(3)}vh, 0) scale(${f.scale.toFixed(4)})`;
    // The radius is drawn before the scale: compensate so the visible corner
    // goes 24px → 0 regardless of the current size.
    card.style.borderRadius = (f.radius / f.scale).toFixed(2) + "px";
    card.style.setProperty("--tilt", f.tilt.toFixed(3) + "deg");
  }
  if (title) {
    title.style.transform = `translate(-50%, calc(-50% + ${f.titleY.toFixed(2)}px))`;
    title.style.opacity = String(f.titleOpacity);
  }
  if (wL) {
    wL.style.opacity = f.wordsOpacity.toFixed(3);
    wL.style.transform = `translate3d(${f.wordLeftX.toFixed(2)}px, 0, 0)`;
  }
  if (wR) {
    wR.style.opacity = f.wordsOpacity.toFixed(3);
    wR.style.transform = `translate3d(${f.wordRightX.toFixed(2)}px, 0, 0)`;
  }

  // Coverage titles inside a growing card (EN home): they arrive while the
  // card is still about half grown, from opposite sides.
  if (hedgeTL || hedgeBR) {
    const tt = easeOutCubic(Math.min(f.growRaw * 2.2, 1));
    if (hedgeTL) {
      hedgeTL.style.transform = `translateX(${(0 - (1 - tt) * 60).toFixed(3)}vw)`;
      hedgeTL.style.opacity = tt.toFixed(3);
    }
    if (hedgeBR) {
      hedgeBR.style.transform = `translateX(${((1 - tt) * 60).toFixed(3)}vw)`;
      hedgeBR.style.opacity = tt.toFixed(3);
    }
  }

  if (t.hero) {
    const o = heroOverlayFrame(f.growRaw);
    for (const el of heroFades) {
      el.style.opacity = o.opacity.toFixed(3);
      el.style.transform = `translate3d(0, ${o.y.toFixed(2)}px, 0)`;
      el.style.visibility = o.visible ? "visible" : "hidden";
    }
  }
}

function applyPatternB(t: Tracked) {
  if (t.els.cardB) t.els.cardB.style.transform = `translate3d(0, ${t.current.toFixed(3)}vh, 0)`;
}

function applyFlow(t: Tracked) {
  const { flowTitles, flowDescs, flowSlides } = t.els;
  const N = flowTitles.length;
  if (N === 0) return;
  const step = clamp(Math.floor(t.current * N), 0, N - 1);
  if (step === t.lastStep) return;
  t.lastStep = step;
  flowTitles.forEach((el, i) => { el.dataset.active = i === step ? "true" : "false"; });
  flowDescs.forEach((el, i) => { el.style.display = i === step ? "block" : "none"; });
  flowSlides.forEach((el, i) => {
    el.dataset.position = i === step ? "active" : i < step ? "prev" : "next";
  });
}

function apply(t: Tracked) {
  if (t.kind === "a") applyPatternA(t);
  else if (t.kind === "b") applyPatternB(t);
  else applyFlow(t);
}

function els(el: HTMLElement): Els {
  const q = (s: string) => el.querySelector<HTMLElement>(s);
  const qa = (s: string) => Array.from(el.querySelectorAll<HTMLElement>(s));
  return {
    card: q("[data-card]"),
    inner: q("[data-card-inner]"),
    title: q("[data-title]"),
    wL: q("[data-word-left]"),
    wR: q("[data-word-right]"),
    hedgeTL: q("[data-hedge-tl]"),
    hedgeBR: q("[data-hedge-br]"),
    cardB: q("[data-card-b]"),
    flowTitles: qa("[data-flow-title]"),
    flowDescs: qa("[data-flow-desc]"),
    flowSlides: qa("[data-flow-slide]"),
  };
}

const tracked: Tracked[] = [];
function collect() {
  const add = (sel: string, kind: Kind) =>
    document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
      if (tracked.some((t) => t.el === el)) return;
      tracked.push({
        el, kind, hero: kind === "a" && el.hasAttribute("data-hero"),
        els: els(el), current: 0, target: 0, lastStep: -1,
      });
    });
  add("[data-pattern-a]", "a");
  add("[data-pattern-b]", "b");
  add("[data-flow]", "flow");
}

/** Jump every scene to where the scroll is (load, back/forward, resize). */
function snapAll() {
  for (const t of tracked) t.target = readTarget(t);
  for (const t of tracked) {
    t.current = t.target;
    apply(t);
  }
}

let running = false;
let last = 0;

function frame(now: number) {
  const dt = Math.min(now - last, 64);
  last = now;
  const tau = reduceMotion.matches ? 0 : TAU_MS;

  // Reads.
  for (const t of tracked) t.target = readTarget(t);

  // Writes.
  let moving = false;
  for (const t of tracked) {
    // The flow section switches discrete steps with its own CSS transition.
    const next = t.kind === "flow" ? t.target : smoothToward(t.current, t.target, dt, tau);
    const settled = Math.abs(next - t.target) < EPS;
    const value = settled ? t.target : next;
    if (value !== t.current) {
      t.current = value;
      apply(t);
    }
    if (!settled) moving = true;
  }
  if (moving) requestAnimationFrame(frame);
  else running = false;
}

function kick() {
  if (running) return;
  running = true;
  last = performance.now();
  requestAnimationFrame(frame);
}

collect();
snapAll();
document.addEventListener("scroll", kick, { passive: true });
window.addEventListener("resize", () => {
  heroSequence.resize();
  snapAll();
});
window.addEventListener("pageshow", snapAll);
// Moving the window to a screen with another pixel ratio fires no resize.
(function watchPixelRatio() {
  window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener(
    "change",
    () => { heroSequence.resize(); snapAll(); watchPixelRatio(); },
    { once: true },
  );
})();
window.addEventListener("load", snapAll);
reduceMotion.addEventListener?.("change", snapAll);
heroSequence.onRedraw(() => {
  for (const t of tracked) if (t.hero) apply(t);
});
