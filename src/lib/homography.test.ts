import { describe, it, expect } from "vitest";
import { rectToQuad, applyHomography, toCssMatrix3d, coverRect } from "./homography";

type P = [number, number];
const close = (a: P, b: P) => {
  expect(a[0]).toBeCloseTo(b[0], 6);
  expect(a[1]).toBeCloseTo(b[1], 6);
};

describe("rectToQuad", () => {
  it("maps the rectangle corners onto an affine quad", () => {
    const q: P[] = [[10, 20], [110, 20], [110, 70], [10, 70]];
    const H = rectToQuad(200, 100, q);
    close(applyHomography(H, 0, 0), q[0]);
    close(applyHomography(H, 200, 0), q[1]);
    close(applyHomography(H, 200, 100), q[2]);
    close(applyHomography(H, 0, 100), q[3]);
  });

  it("maps the rectangle corners onto a perspective quad", () => {
    const q: P[] = [[100, 50], [700, 80], [650, 420], [140, 460]];
    const H = rectToQuad(1600, 900, q);
    close(applyHomography(H, 0, 0), q[0]);
    close(applyHomography(H, 1600, 0), q[1]);
    close(applyHomography(H, 1600, 900), q[2]);
    close(applyHomography(H, 0, 900), q[3]);
  });

  it("identity quad gives the identity css matrix", () => {
    const H = rectToQuad(300, 200, [[0, 0], [300, 0], [300, 200], [0, 200]]);
    expect(toCssMatrix3d(H)).toBe("matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)");
  });
});

describe("toCssMatrix3d", () => {
  it("keeps tiny perspective terms tiny (no exponent mangling)", () => {
    const H = [1, 0, 0, 0, 1, 0, -9.26e-10, 1.2e-10, 1] as const;
    const parts = toCssMatrix3d([...H] as never).slice(9, -1).split(",").map(Number);
    // column-major: g is the 4th entry, h the 8th
    expect(parts[3]).toBeCloseTo(-9.26e-10, 15);
    expect(parts[7]).toBeCloseTo(1.2e-10, 15);
  });
  it("round-trips a perspective matrix through the CSS string", () => {
    const H = rectToQuad(1600, 900, [[100, 50], [700, 80], [650, 420], [140, 460]]);
    const parts = toCssMatrix3d(H).slice(9, -1).split(",").map(Number);
    expect(parts[3]).toBeCloseTo(H[6], 14);
    expect(parts[7]).toBeCloseTo(H[7], 14);
    expect(parts[12]).toBeCloseTo(H[2], 6);
  });
});

describe("coverRect", () => {
  it("wider image on a taller viewport: crops the sides, centered", () => {
    const r = coverRect(1920, 1080, 1440, 900);
    expect(r.h).toBeCloseTo(900);
    expect(r.w).toBeCloseTo(1600);
    expect(r.x).toBeCloseTo(-80);
    expect(r.y).toBeCloseTo(0);
  });
  it("same aspect: fills exactly", () => {
    const r = coverRect(1920, 1080, 1280, 720);
    expect(r).toEqual({ x: 0, y: 0, w: 1280, h: 720 });
  });
});
