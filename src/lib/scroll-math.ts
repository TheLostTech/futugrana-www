export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Slow start, slow end: how a real object accelerates and settles. */
export function easeInOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Fast start, gentle landing: for things that enter the scene. */
export function easeOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return 1 - Math.pow(1 - x, 3);
}

/**
 * Frame-rate independent exponential follow. Moves `current` toward `target`
 * as if attached by a damper with time constant `tauMs`: gives scroll-driven
 * motion a little inertia instead of following the wheel in steps.
 * tauMs = 0 jumps straight to the target (reduced motion).
 */
export function smoothToward(current: number, target: number, dtMs: number, tauMs: number): number {
  if (tauMs <= 0) return target;
  const k = 1 - Math.exp(-Math.max(dtMs, 0) / tauMs);
  return current + (target - current) * k;
}

interface SectionProgressInput {
  rectTop: number;
  sectionHeight: number;
  viewportHeight: number;
}

export function sectionProgress({ rectTop, sectionHeight, viewportHeight }: SectionProgressInput): number {
  const total = sectionHeight - viewportHeight;
  if (total <= 0) return 0;
  const scrolled = clamp(-rectTop, 0, total);
  return scrolled / total;
}

/** Share of the section progress spent growing the card to fullscreen. */
export const GROW_END = 0.30;

export interface PatternAFrame {
  /** Raw growth progress 0..1 (linear in scroll). */
  growRaw: number;
  /** Eased growth 0..1. */
  growT: number;
  /** Uniform scale of the full-viewport card (0.5 → 1). */
  scale: number;
  /** Downward offset in vh, pushes the preview below the fold. */
  offsetY: number;
  /** Visual corner radius in px (compensate for scale when applying). */
  radius: number;
  /** Backward tilt in degrees of the content (hero dashboard). */
  tilt: number;
  titleY: number;
  titleOpacity: number;
  wordsOpacity: number;
  wordLeftX: number;
  wordRightX: number;
}

export function patternAFrame(progress: number): PatternAFrame {
  const growRaw = clamp(progress / GROW_END, 0, 1);
  const growT = easeInOutCubic(growRaw);

  const scale = lerp(0.5, 1, growT);
  const offsetY = lerp(8, 0, growT);
  const radius = lerp(24, 0, growT);
  const tilt = lerp(10, 0, growT);

  // Title stays fully visible with a small upward parallax.
  const titleY = 0 - growT * 40;
  const titleOpacity = 1;

  const wordT = easeOutCubic((progress - GROW_END) / (1 - GROW_END));
  const wordsOpacity = wordT;
  const wordLeftX = 0 - (1 - wordT) * 80;
  const wordRightX = (1 - wordT) * 80;

  return {
    growRaw, growT,
    scale, offsetY, radius, tilt,
    titleY, titleOpacity,
    wordsOpacity, wordLeftX, wordRightX,
  };
}

/**
 * Hero headline + CTA overlay, driven by the hero card growth (raw).
 * Fades and lifts away before the growing card reaches the text.
 */
export function heroOverlayFrame(growRaw: number): { opacity: number; y: number; visible: boolean } {
  const t = easeInOutCubic((growRaw - 0.05) / 0.3);
  const opacity = 1 - t;
  return { opacity, y: 0 - 32 * t, visible: opacity > 0.001 };
}

/**
 * Pattern B scenes slide over the previous one. While the scene is entering
 * (its top between the bottom and the top of the viewport) the card trails
 * slightly behind, like an object with weight. Returns the offset in vh.
 */
export function patternBEntry(rectTop: number, viewportHeight: number): number {
  if (viewportHeight <= 0) return 0;
  const entered = clamp(1 - rectTop / viewportHeight, 0, 1);
  return (1 - easeOutCubic(entered)) * 10;
}
