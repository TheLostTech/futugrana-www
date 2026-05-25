import { describe, it, expect } from "vitest";
import { clamp, lerp, sectionProgress, patternAFrame } from "./scroll-math";

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

describe("patternAFrame", () => {
  it("at progress 0 → card preview small, bottom -8%, title visible", () => {
    const f = patternAFrame(0);
    expect(f.cardWidth).toBe(50);
    expect(f.cardHeight).toBe(55);
    expect(f.cardBottom).toBe(-8);
    expect(f.cardRadius).toBe(24);
    expect(f.titleOpacity).toBe(1);
    expect(f.wordsOpacity).toBe(0);
  });

  it("at progress 0.35 → card fully expanded, title gone", () => {
    const f = patternAFrame(0.35);
    expect(f.cardWidth).toBe(100);
    expect(f.cardHeight).toBe(100);
    expect(f.cardBottom).toBe(0);
    expect(f.cardRadius).toBe(0);
    expect(f.titleOpacity).toBe(0);
  });

  it("at progress 0.6 → words at full opacity", () => {
    const f = patternAFrame(0.6);
    expect(f.wordsOpacity).toBe(1);
  });

  it("at progress 1 → stable fullscreen + words visible", () => {
    const f = patternAFrame(1);
    expect(f.cardWidth).toBe(100);
    expect(f.wordsOpacity).toBe(1);
  });
});
