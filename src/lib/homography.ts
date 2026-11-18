/**
 * Projective mapping of a w×h rectangle onto an arbitrary quad (Heckbert,
 * "Fundamentals of Texture Mapping and Image Warping", square-to-quad).
 * Used to project the live HTML dashboard into the screen of the rendered
 * display, frame by frame.
 */
export type Point = [number, number];

/** 3×3 matrix, row-major: [a, b, c, d, e, f, g, h, 1]. */
export type Homography = [number, number, number, number, number, number, number, number, number];

/** Quad order: top-left, top-right, bottom-right, bottom-left. */
export function rectToQuad(w: number, h: number, quad: Point[]): Homography {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;

  let a: number, b: number, c: number, d: number, e: number, f: number, g: number, hh: number;
  if (Math.abs(dx3) < 1e-12 && Math.abs(dy3) < 1e-12) {
    a = x1 - x0; b = x2 - x1; c = x0;
    d = y1 - y0; e = y2 - y1; f = y0;
    g = 0; hh = 0;
  } else {
    const den = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / den;
    hh = (dx1 * dy3 - dx3 * dy1) / den;
    a = x1 - x0 + g * x1; b = x3 - x0 + hh * x3; c = x0;
    d = y1 - y0 + g * y1; e = y3 - y0 + hh * y3; f = y0;
  }
  // Unit square → quad; scale the input so the rectangle maps instead.
  return [a / w, b / h, c, d / w, e / h, f, g / w, hh / h, 1];
}

export function applyHomography(H: Homography, x: number, y: number): Point {
  const [a, b, c, d, e, f, g, h] = H;
  const z = g * x + h * y + 1;
  return [(a * x + b * y + c) / z, (d * x + e * y + f) / z];
}

/** CSS matrix3d (column-major), to use with transform-origin: 0 0. */
export function toCssMatrix3d(H: Homography): string {
  const [a, b, c, d, e, f, g, h] = H;
  // String(Number(...)) keeps exponent notation intact ("1.2e-10"), which CSS
  // accepts; trimming zeros by regex would eat the exponent's digits.
  const r = (n: number) => (n === 0 ? "0" : String(Number(n.toPrecision(12))));
  return `matrix3d(${[a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, 1].map(r).join(",")})`;
}

/** Where an iw×ih image lands when drawn "object-fit: cover" into vw×vh. */
export function coverRect(iw: number, ih: number, vw: number, vh: number) {
  const s = Math.max(vw / iw, vh / ih);
  const w = iw * s, h = ih * s;
  return { x: (vw - w) / 2, y: (vh - h) / 2, w, h };
}
