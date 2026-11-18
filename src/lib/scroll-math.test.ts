import { describe, it, expect } from "vitest";
import {
  clamp, lerp, sectionProgress, patternAFrame,
  easeInOutCubic, easeOutCubic, smoothToward, heroOverlayFrame, patternBEntry,
} from "./scroll-math";

describe("clamp", () => {
  it("returns value within bounds unchanged", () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
  it("clamps below min", () => {
    expect(clamp(-0.2, 0, 1)).toBe(0);
  });
  it("clamps above max", () => {
    expect(clamp(1.5, 0, 1)).toBe(1);
  });
});

describe("lerp", () => {
  it("linear interpolation t=0 returns a", () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });
  it("linear interpolation t=1 returns b", () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });
  it("linear interpolation t=0.5 returns midpoint", () => {
    expect(lerp(10, 20, 0.5)).toBe(15);
  });
});

describe("sectionProgress", () => {
  it("returns 0 when section is below viewport", () => {
    expect(sectionProgress({ rectTop: 1000, sectionHeight: 3500, viewportHeight: 1000 })).toBe(0);
  });
  it("returns 1 when section is fully scrolled past pin range", () => {
    expect(sectionProgress({ rectTop: -2500, sectionHeight: 3500, viewportHeight: 1000 })).toBe(1);
  });
  it("returns 0.5 at midpoint", () => {
    expect(sectionProgress({ rectTop: -1250, sectionHeight: 3500, viewportHeight: 1000 })).toBeCloseTo(0.5);
  });
});

describe("easing", () => {
  it("easeInOutCubic fixes the endpoints and the midpoint", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
  });
  it("easeInOutCubic starts slow and ends slow", () => {
    expect(easeInOutCubic(0.1)).toBeLessThan(0.1);
    expect(easeInOutCubic(0.9)).toBeGreaterThan(0.9);
  });
  it("easeOutCubic starts fast", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.2)).toBeGreaterThan(0.4);
  });
});

describe("smoothToward", () => {
  it("moves part of the way, never overshoots", () => {
    const v = smoothToward(0, 1, 16, 110);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
  });
  it("after a long pause reaches the target", () => {
    expect(smoothToward(0, 1, 5000, 110)).toBeCloseTo(1, 5);
  });
  it("with tau 0 jumps to the target (reduced motion)", () => {
    expect(smoothToward(0.2, 0.8, 16, 0)).toBe(0.8);
  });
});

describe("patternAFrame", () => {
  it("at progress 0 → card is a half-size preview pushed below the fold", () => {
    const f = patternAFrame(0);
    expect(f.growT).toBe(0);
    expect(f.scale).toBe(0.5);
    expect(f.offsetY).toBe(8);
    expect(f.radius).toBe(24);
    expect(f.tilt).toBe(10);
    expect(f.titleOpacity).toBe(1);
    expect(f.wordsOpacity).toBe(0);
  });

  it("grows with ease-in-out, not linearly", () => {
    const early = patternAFrame(0.03); // 10% of the growth window
    expect(early.scale - 0.5).toBeLessThan(0.05 * 0.5);
  });

  it("at progress 0.30 → fully expanded, flat, square corners", () => {
    const f = patternAFrame(0.30);
    expect(f.growT).toBe(1);
    expect(f.scale).toBe(1);
    expect(f.offsetY).toBe(0);
    expect(f.radius).toBe(0);
    expect(f.tilt).toBe(0);
    expect(f.titleOpacity).toBe(1);
  });

  it("words arrive with ease-out in the second part", () => {
    expect(patternAFrame(0.30).wordsOpacity).toBe(0);
    expect(patternAFrame(0.65).wordsOpacity).toBeGreaterThan(0.6);
    expect(patternAFrame(1).wordsOpacity).toBe(1);
  });

  it("at progress 1 → stable fullscreen", () => {
    const f = patternAFrame(1);
    expect(f.scale).toBe(1);
    expect(f.wordLeftX).toBe(0);
    expect(f.wordRightX).toBe(0);
  });
});

describe("heroOverlayFrame", () => {
  it("fully visible at the top", () => {
    const f = heroOverlayFrame(0);
    expect(f.opacity).toBe(1);
    expect(f.y).toBe(0);
    expect(f.visible).toBe(true);
  });
  it("gone before the card reaches the text (growth 40%)", () => {
    const f = heroOverlayFrame(0.4);
    expect(f.opacity).toBe(0);
    expect(f.visible).toBe(false);
    expect(f.y).toBeLessThan(0);
  });
  it("fades progressively in between", () => {
    const f = heroOverlayFrame(0.2);
    expect(f.opacity).toBeGreaterThan(0);
    expect(f.opacity).toBeLessThan(1);
  });
});

describe("patternBEntry", () => {
  it("card sits lower while the scene is still entering", () => {
    expect(patternBEntry(1000, 1000)).toBe(10);
  });
  it("card at rest once the scene covers the viewport", () => {
    expect(patternBEntry(0, 1000)).toBe(0);
    expect(patternBEntry(-500, 1000)).toBe(0);
  });
});
