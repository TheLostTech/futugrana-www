# Hero in Blender

The landing hero is a slim display rendered in Blender. The camera pushes in
until the screen fills the frame. The screen is cut out of the render, and the
live HTML dashboard (`DashboardMock`) is projected into it in perspective, one
frame at a time (`src/scripts/hero-sequence.ts`). On the last frame the screen
fills the frame exactly, so the hand-off to the normal fullscreen card is
seamless.

## Rebuild the frames

```bash
# draft: half size, few samples (about 10 minutes on CPU)
/Applications/Blender.app/Contents/MacOS/Blender -b -P blender/hero_scene.py -- --device CPU --scale 50 --samples 24 --out blender/out/draft

# final
/Applications/Blender.app/Contents/MacOS/Blender -b -P blender/hero_scene.py -- --device CPU --samples 96 --out blender/out/final

# publish to the site (replaces public/hero-seq)
rm -rf public/hero-seq && cp -R blender/out/final public/hero-seq
```

- `--device GPU` (Metal) is faster but can fail with "Insufficient Memory"
  when the Mac is busy. CPU is the reliable path.
- Options for framing: `--r0` (start distance), `--az0` / `--el0` (start
  angle, degrees), `--lift0` (how low the display sits in the opening frame),
  `--count` (number of frames, default 90).
- `python3 blender/preview_composite.py <dir> 1 45 90` composites frames over
  the white page with the screen painted navy, for a quick look.

The screen corners for each frame are written to `manifest.json` next to the
frames. Never edit them by hand: they must match the render.
