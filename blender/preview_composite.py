"""Composite rendered frames as the site does: white page, navy screen (stand-in
for the dashboard), body pass on top.
Usage: python3 blender/preview_composite.py <dir> <frame numbers...>"""
import json, sys
from PIL import Image, ImageDraw
d = sys.argv[1]
m = json.load(open(f"{d}/manifest.json"))
for n in sys.argv[2:]:
    n = int(n)
    fr = Image.open(f"{d}/{n:04d}.webp").convert("RGBA")
    w, h = fr.size
    bg = Image.new("RGB", (w, h), (255, 255, 255))
    c = m["corners"][n - 1]
    ImageDraw.Draw(bg).polygon([(c[i] * w, c[i + 1] * h) for i in range(0, 8, 2)], fill=(13, 27, 42))
    Image.alpha_composite(bg.convert("RGBA"), fr).convert("RGB").save(f"{d}/view-{n:04d}.jpg", quality=88)
