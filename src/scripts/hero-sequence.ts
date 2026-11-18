import { clamp, GROW_END } from "../lib/scroll-math";
import { rectToQuad, toCssMatrix3d, coverRect, type Point } from "../lib/homography";

/**
 * Hero rendered in Blender: an image sequence of the display (body, glass,
 * stand, shadow) with the screen cut out, scrubbed by scroll. The live HTML
 * dashboard is projected into the screen hole using the per-frame screen
 * corners exported by blender/hero_scene.py. On the last frame
 * the screen fills the frame exactly, so the hand-off to the normal fullscreen
 * card is seamless by construction.
 *
 * Only on wide, landscape viewports without reduced motion. Frames are kept
 * as compressed blobs and decoded into a small moving window around the
 * current frame, so memory stays bounded (a decoded 1080p frame is ~8 MB).
 */

interface Manifest {
  frames: number;
  width: number;
  height: number;
  pattern: string; // "/hero-seq/{n}.webp", n zero-padded to `pad`
  pad: number;
  /** Per frame: TL, TR, BR, BL screen corners, normalized, origin top-left. */
  corners: number[][];
}

const BASE = "/hero-seq/";
const WINDOW = 6; // frames decoded ahead and behind the current one
export const HERO_SEQ_QUERY =
  "(min-width: 900px) and (min-aspect-ratio: 5/4) and (prefers-reduced-motion: no-preference)";
const enabledQuery = window.matchMedia(HERO_SEQ_QUERY);

class HeroSequence {
  private manifest: Manifest | null = null;
  private loading: Promise<void> | null = null;
  private blobs: Array<Blob | undefined> = [];
  private bitmaps = new Map<number, ImageBitmap>();
  private decoding = new Set<number>();
  private posterReady = false;
  private active = false;

  private canvas: HTMLCanvasElement | null;
  private ctx: CanvasRenderingContext2D | null = null;

  private vw = 0;
  private vh = 0;
  private dpr = 1;
  private sized = false;
  private drawn = -1;
  private target = 0;
  private layoutKey = "";
  private redraw: () => void = () => {};

  constructor() {
    this.canvas = document.querySelector<HTMLCanvasElement>("[data-hero-canvas]");
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");
    this.resize();
    if (enabledQuery.matches) void this.load();
    enabledQuery.addEventListener?.("change", () => {
      if (enabledQuery.matches) void this.load();
      this.redraw();
    });
  }

  /** The scroll driver registers how to re-apply the hero when we have news. */
  onRedraw(cb: () => void) {
    this.redraw = cb;
  }

  /** Read sizes here (on resize) so the per-frame path never forces layout. */
  resize() {
    if (!this.canvas) return;
    const host = this.canvas.parentElement ?? this.canvas;
    this.vw = host.clientWidth;
    this.vh = host.clientHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.sized = false;
    this.drawn = -1;
    this.layoutKey = "";
  }

  private url(i: number) {
    const m = this.manifest!;
    return m.pattern.replace("{n}", String(i + 1).padStart(m.pad, "0"));
  }

  private load(): Promise<void> {
    if (!this.canvas) return Promise.resolve();
    this.loading ??= (async () => {
      try {
        const res = await fetch(BASE + "manifest.json");
        if (!res.ok) throw new Error("manifest " + res.status);
        const m = (await res.json()) as Manifest;
        this.manifest = m;
        // Poster first: frame 1 decides when the hero can show the display.
        await this.fetchBlob(0);
        await this.decode(0);
        this.posterReady = true;
        this.redraw();
        // Then the rest, in order, a few at a time.
        let next = 1;
        const worker = async () => {
          while (next < m.frames) {
            const i = next++;
            await this.fetchBlob(i);
            if (Math.abs(i - this.target) <= WINDOW) this.ensureWindow();
          }
        };
        await Promise.all([worker(), worker(), worker(), worker()]);
      } catch {
        this.manifest = null;
        this.posterReady = false;
        document.documentElement.classList.remove("hero-seq-pending");
        this.redraw();
      }
    })();
    return this.loading;
  }

  private async fetchBlob(i: number) {
    if (!this.manifest || this.blobs[i]) return;
    const res = await fetch(this.url(i));
    if (!res.ok) throw new Error(`frame ${i}: ${res.status}`);
    this.blobs[i] = await res.blob();
  }

  private async decode(i: number) {
    const blob = this.blobs[i];
    if (!blob || this.bitmaps.has(i) || this.decoding.has(i)) return;
    this.decoding.add(i);
    try {
      // Decode straight to the size it is drawn at (cover of the hero box).
      const r = coverRect(this.manifest!.width, this.manifest!.height, this.vw || 1, this.vh || 1);
      const w = Math.max(1, Math.round(r.w * this.dpr));
      const h = Math.max(1, Math.round(r.h * this.dpr));
      const bmp = await createImageBitmap(blob, { resizeWidth: w, resizeHeight: h, resizeQuality: "high" });
      this.bitmaps.set(i, bmp);
      if (Math.abs(i - this.target) < Math.abs(this.drawn - this.target)) this.redraw();
    } finally {
      this.decoding.delete(i);
    }
  }

  /** Decode around the target, drop what is far away (frame 0 stays). */
  private ensureWindow() {
    const m = this.manifest;
    if (!m) return;
    for (const [i, bmp] of this.bitmaps) {
      if (i !== 0 && Math.abs(i - this.target) > WINDOW + 2) {
        bmp.close();
        this.bitmaps.delete(i);
      }
    }
    for (let d = 0; d <= WINDOW; d++) {
      for (const i of [this.target + d, this.target - d]) {
        if (i >= 0 && i < m.frames) void this.decode(i);
      }
    }
  }

  private nearestDecoded(): number {
    const have = this.bitmaps;
    if (have.has(this.target)) return this.target;
    let best = 0;
    for (const i of have.keys()) if (Math.abs(i - this.target) < Math.abs(best - this.target)) best = i;
    return best;
  }

  /**
   * Called by the scroll driver for the hero. Returns true when the sequence
   * owns the card geometry this frame (the driver must not write it).
   */
  render(card: HTMLElement, inner: HTMLElement, progress: number): boolean {
    if (!this.canvas || !this.ctx) return false;
    const growRaw = clamp(progress / GROW_END, 0, 1);
    const usable = this.posterReady && !!this.manifest && enabledQuery.matches;
    const pending = document.documentElement.classList.contains("hero-seq-pending");

    // Switch modes only where it cannot be seen: hero hidden while loading,
    // at the very top, or already fullscreen.
    if (usable && !this.active && (pending || growRaw <= 0.001 || growRaw >= 1)) this.active = true;
    if (!usable && this.active) this.active = false;
    if (pending && (this.active || !enabledQuery.matches)) {
      document.documentElement.classList.remove("hero-seq-pending");
    }

    if (!(this.active && growRaw < 1)) {
      this.exitSequenceMode(card, inner);
      return false;
    }

    const m = this.manifest!;
    this.target = Math.round(growRaw * (m.frames - 1));
    this.ensureWindow();
    const frame = this.nearestDecoded();

    const { vw, vh, dpr } = this;
    if (!this.sized) {
      this.canvas.width = Math.round(vw * dpr);
      this.canvas.height = Math.round(vh * dpr);
      this.sized = true;
      this.drawn = -1;
    }
    const r = coverRect(m.width, m.height, vw, vh);

    if (frame !== this.drawn) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.clearRect(0, 0, vw, vh);
      this.ctx.drawImage(this.bitmaps.get(frame)!, r.x, r.y, r.w, r.h);
      this.drawn = frame;
    }
    this.canvas.style.visibility = "visible";

    // Project the live dashboard into this frame's screen hole. The card is
    // laid out as the cover rect of the frame (the screen's own aspect); the
    // hero-sized content sits centred in it, exactly where it will be when
    // the card is fullscreen.
    const c = m.corners[frame];
    const quad: Point[] = [0, 1, 2, 3].map((i) => [r.x + c[i * 2] * r.w, r.y + c[i * 2 + 1] * r.h]);
    // Grow the quad by ~1.5px so its edge tucks under the bezel. Not on the
    // last frame: there the screen is the whole frame and must match the
    // fullscreen card pixel for pixel.
    const cx = quad.reduce((s, p) => s + p[0], 0) / 4;
    const cy = quad.reduce((s, p) => s + p[1], 0) / 4;
    const last = frame === m.frames - 1;
    const fat = quad.map(([x, y]) => {
      const dx = x - cx, dy = y - cy;
      const k = last ? 1 : 1 + 1.5 / (Math.hypot(dx, dy) || 1);
      return [cx + dx * k, cy + dy * k] as Point;
    });

    const key = `${vw}x${vh}`;
    if (card.dataset.sequence !== "true" || key !== this.layoutKey) {
      card.dataset.sequence = "true";
      card.style.left = "0px";
      card.style.top = "0px";
      card.style.bottom = "auto";
      card.style.right = "auto";
      card.style.width = r.w + "px";
      card.style.height = r.h + "px";
      card.style.transformOrigin = "0 0";
      card.style.borderRadius = "0px";
      card.style.setProperty("--tilt", "0deg");
      inner.style.width = vw + "px";
      inner.style.height = vh + "px";
      inner.style.marginLeft = (r.w - vw) / 2 + "px";
      inner.style.marginTop = (r.h - vh) / 2 + "px";
      this.layoutKey = key;
    }
    card.style.transform = toCssMatrix3d(rectToQuad(r.w, r.h, fat));
    return true;
  }

  private exitSequenceMode(card: HTMLElement, inner: HTMLElement) {
    if (this.canvas) this.canvas.style.visibility = "hidden";
    this.drawn = -1;
    if (card.dataset.sequence !== "true") return;
    delete card.dataset.sequence;
    this.layoutKey = "";
    for (const p of ["left", "top", "bottom", "right", "width", "height", "transformOrigin"] as const) {
      card.style[p] = "";
    }
    for (const p of ["width", "height", "marginLeft", "marginTop"] as const) inner.style[p] = "";
  }
}

export const heroSequence = new HeroSequence();
