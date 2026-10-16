#!/usr/bin/env python3
"""Build crisp animation strips for the Pixel Spider mascot.

Reads   public/mascot/<mood>-01.png   (256x256 palette PNGs, transparent bg)
Writes  public/mascot/<mood>-strip.png (frames side by side, 256px each)
        public/mascot/frames.json      ({"<mood>": {"frames": n, "fps": f, ...}})

Method (adapted from the pixel-mascot-animator approach): the sprite pixels are
never resampled. Every extra frame is produced with integer-only operations on
the original RGBA grid -- deleting/inserting whole rows (torso "breathing"
squash), shifting rectangular regions by whole pixels, recolouring pixels to
colours already present in that sprite's palette, and stamping tiny hand-drawn
pixel particles. The strip is then re-indexed to an exact palette (no
quantisation), so every colour in the output already existed in the source.

Usage:  python3 scripts/mascot/build_frames.py [--preview out.png]
Re-running is idempotent; the *-01.png sources are never modified.

NOTE: do not run scripts/compress-assets.mjs on public/mascot after this -- it
resizes every PNG there to 256x256 and would squash the strips.
"""
from __future__ import annotations

import argparse
import json
import os
from typing import Callable, Dict, List, Sequence, Tuple

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MASCOT = os.path.join(ROOT, "public", "mascot")
SIZE = 256

RGBA = np.ndarray  # (256, 256, 4) uint8


# ---------------------------------------------------------------- helpers ---

def load(mood: str) -> RGBA:
    return np.array(Image.open(os.path.join(MASCOT, f"{mood}-01.png")).convert("RGBA"))


def opaque_colors(a: RGBA) -> np.ndarray:
    px = a[a[:, :, 3] == 255][:, :3]
    return np.unique(px, axis=0)


def nearest(a: RGBA, rgb: Tuple[int, int, int]) -> np.ndarray:
    """Closest colour that already exists (fully opaque) in this sprite."""
    cols = opaque_colors(a).astype(int)
    d = ((cols - np.array(rgb)) ** 2).sum(1)
    c = cols[int(d.argmin())]
    return np.array([c[0], c[1], c[2], 255], dtype=np.uint8)


def squash(a: RGBA, rows: Sequence[int], x0: int = 0, x1: int = SIZE) -> RGBA:
    """Delete the given rows inside columns [x0, x1) and let everything above
    them drop down by one pixel per deleted row (feet stay planted)."""
    out = a.copy()
    for r in sorted(rows, reverse=True):
        col = out[:, x0:x1]
        col[1 : r + 1] = col[0:r].copy()
        col[0] = 0
    return out


def shift_rect(a: RGBA, x0: int, y0: int, x1: int, y1: int, dx: int, dy: int) -> RGBA:
    """Move the opaque content of a rectangle by (dx, dy) whole pixels.
    Vacated pixels are filled from the pixel they came from's neighbour
    (edge replicate) so no holes appear inside the body."""
    out = a.copy()
    region = a[y0:y1, x0:x1].copy()
    # fill vacated area by replicating edge rows/cols (keeps outline closed)
    filled = np.roll(region, (dy, dx), axis=(0, 1))
    if dy > 0:
        filled[:dy] = region[:1]
    elif dy < 0:
        filled[dy:] = region[-1:]
    if dx > 0:
        filled[:, :dx] = region[:, :1]
    elif dx < 0:
        filled[:, dx:] = region[:, -1:]
    out[y0:y1, x0:x1] = filled
    return out


def shift_rows_x(a: RGBA, y0: int, y1: int, dx: int) -> RGBA:
    """Horizontal whole-pixel shift of a band of rows (head tilt / sway)."""
    out = a.copy()
    band = np.roll(a[y0:y1], dx, axis=1)
    if dx > 0:
        band[:, :dx] = 0
    elif dx < 0:
        band[:, dx:] = 0
    out[y0:y1] = band
    return out


def stamp(a: RGBA, pattern: Sequence[str], x: int, y: int, colors: Dict[str, np.ndarray], scale: int = 2) -> RGBA:
    """Draw a tiny ASCII pixel pattern at (x, y); each char = scale x scale block."""
    out = a.copy()
    for j, line in enumerate(pattern):
        for i, ch in enumerate(line):
            if ch in colors:
                yy, xx = y + j * scale, x + i * scale
                if 0 <= yy and yy + scale <= SIZE and 0 <= xx and xx + scale <= SIZE:
                    out[yy : yy + scale, xx : xx + scale] = colors[ch]
    return out


def close_eyes(a: RGBA, box: Tuple[int, int, int, int]) -> RGBA:
    """Blink: paint the bright eye pixels inside `box` with the mask colour,
    leaving a 2px lid line across the middle of each eye."""
    out = a.copy()
    x0, y0, x1, y1 = box
    sub = out[y0:y1, x0:x1]
    core = (sub[:, :, :3].min(axis=2) > 200) & (sub[:, :, 3] > 0)
    if not core.any():
        return out
    # grow the white core by 2px and swallow its light/cream anti-alias rim
    grown = core.copy()
    for _ in range(2):
        g = grown.copy()
        g[1:] |= grown[:-1]
        g[:-1] |= grown[1:]
        g[:, 1:] |= grown[:, :-1]
        g[:, :-1] |= grown[:, 1:]
        grown = g
    lum = sub[:, :, :3].astype(int).sum(axis=2)
    bright = core | (grown & (lum > 240) & (sub[:, :, 2] < sub[:, :, 0] + 40))
    dark = nearest(a, (12, 12, 18))
    lid = nearest(a, (39, 48, 183))
    # handle each eye separately (split by column gaps)
    cols = np.where(bright.any(axis=0))[0]
    groups: List[List[int]] = [[cols[0]]]
    for c in cols[1:]:
        if c - groups[-1][-1] > 3:
            groups.append([c])
        else:
            groups[-1].append(c)
    for g in groups:
        gx0, gx1 = g[0], g[-1] + 1
        m = np.zeros_like(bright)
        m[:, gx0:gx1] = bright[:, gx0:gx1]
        rows = np.where(m.any(axis=1))[0]
        mid = int(rows[0] + (rows[-1] - rows[0]) * 0.6)
        sub[m] = dark
        for r in (mid, mid + 1):
            line = np.where(m[r])[0]
            if len(line) > 4:
                sub[r, line[0] + 2 : line[-1] - 1] = lid
    out[y0:y1, x0:x1] = sub
    return out


# -------------------------------------------------------- particle shapes ---

# Particle colours that are not in every source palette (the strip palette is
# rebuilt exactly, so adding a couple of solid colours is safe).
WHITE = np.array([255, 255, 255, 255], dtype=np.uint8)
LAVENDER = np.array([195, 198, 237, 255], dtype=np.uint8)

Z_BIG = ["xxxxx", "   x ", "  x  ", " x   ", "xxxxx"]
Z_SMALL = ["xxxx", "  x ", " x  ", "xxxx"]
SPARKLE = ["  x  ", "  x  ", "xxoxx", "  x  ", "  x  "]
SPARKLE_SMALL = [" x ", "xox", " x "]


# ----------------------------------------------------------------- moods ---

def build_idle() -> Tuple[List[RGBA], dict]:
    a = load("idle")
    body = (40, 215)  # columns of the character (no stray pixels outside)
    f1 = squash(a, [168], *body)
    f2 = squash(a, [160, 176], *body)
    blink = close_eyes(a, (70, 70, 190, 118))
    # loop frames 0..3 breathe; frame 4 is a blink cut-in shown by the component
    return [a, f1, f2, f1, blink], {"frames": 4, "fps": 4, "blinkFrame": 4}


def build_blink() -> Tuple[List[RGBA], dict]:
    a = load("blink")
    f1 = squash(a, [165], 40, 215)
    f2 = squash(a, [158, 172], 40, 215)
    return [a, f1, f2, f1], {"frames": 4, "fps": 4}


def build_loading() -> Tuple[List[RGBA], dict]:
    a = load("loading")
    hi = LAVENDER
    lo = nearest(a, (42, 54, 202))
    # 8-dot spinner orbit to the upper right of the head, a bright 2-dot "head"
    cx, cy, r = 220, 40, 16
    pts = [(0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1)]
    frames = []
    for i in range(4):
        f = a if i % 2 == 0 else squash(a, [170], 40, 215)
        for k, (px, py) in enumerate(pts):
            x = cx + px * r - 3
            y = cy + py * r - 3
            lead = (k == (i * 2) % 8) or (k == (i * 2 + 1) % 8)
            f = stamp(f, ["x"], x, y, {"x": hi if lead else lo}, scale=6)
        frames.append(f)
    return frames, {"frames": 4, "fps": 8}


def build_celebrating() -> Tuple[List[RGBA], dict]:
    a = load("celebrating")
    green = nearest(a, (121, 254, 175))
    white = WHITE
    c = {"x": green, "o": white}
    c2 = {"x": white, "o": green}
    body = (40, 200)  # keep the web line on the right untouched
    up = a
    down = squash(a, [150, 165], *body)
    f0 = stamp(stamp(up, SPARKLE, 6, 36, c, 4), SPARKLE_SMALL, 218, 118, c2, 4)
    f1 = stamp(stamp(down, SPARKLE_SMALL, 14, 44, c2, 4), SPARKLE, 212, 110, c, 4)
    f2 = stamp(stamp(up, SPARKLE, 4, 118, c, 4), SPARKLE_SMALL, 220, 40, c2, 4)
    f3 = stamp(stamp(down, SPARKLE_SMALL, 12, 126, c2, 4), SPARKLE, 214, 32, c, 4)
    return [f0, f1, f2, f3], {"frames": 4, "fps": 6}


def build_sleeping() -> Tuple[List[RGBA], dict]:
    a = load("sleeping")
    blue = nearest(a, (37, 47, 203))
    pale = LAVENDER
    breathe = [a, squash(a, [150], 40, 215), squash(a, [144, 158], 40, 215), squash(a, [150], 40, 215)]
    frames = []
    # z drifts up and to the right, a second smaller z trails it
    path = [(186, 50), (196, 36), (206, 22), (216, 8)]
    for i, f in enumerate(breathe):
        x, y = path[i]
        f = stamp(f, Z_BIG, x, y, {"x": pale if i < 3 else blue}, 3)
        sx, sy = path[(i + 2) % 4]
        f = stamp(f, Z_SMALL, sx + 22, sy + 6, {"x": blue}, 2)
        frames.append(f)
    return frames, {"frames": 4, "fps": 3}


def build_typing() -> Tuple[List[RGBA], dict]:
    a = load("typing")
    # hands over the keyboard: tap down 1px alternately
    hands = (110, 176, 152, 206)
    tap = shift_rect(a, *hands, dx=0, dy=1)
    tap2 = shift_rect(a, 112, 176, 134, 206, dx=0, dy=1)
    bob = squash(a, [150], 60, 175)
    return [a, tap, bob, tap2], {"frames": 4, "fps": 8}


def build_waving() -> Tuple[List[RGBA], dict]:
    a = load("waving")
    # friendly head tilt: shift the head band left/right by 1px
    head = (30, 146)
    return [
        a,
        shift_rows_x(a, *head, dx=-1),
        shift_rows_x(a, *head, dx=-2),
        shift_rows_x(a, *head, dx=-1),
        a,
        shift_rows_x(a, *head, dx=1),
    ], {"frames": 6, "fps": 6}


def build_swinging() -> Tuple[List[RGBA], dict]:
    a = load("swinging")
    # body (left of the web line) bobs 1px; the line itself stays fixed
    return [a, squash(a, [150], 30, 160), squash(a, [140, 156], 30, 160), squash(a, [150], 30, 160)], {
        "frames": 4,
        "fps": 8,
    }


BUILDERS: Dict[str, Callable[[], Tuple[List[RGBA], dict]]] = {
    "idle": build_idle,
    "blink": build_blink,
    "loading": build_loading,
    "celebrating": build_celebrating,
    "sleeping": build_sleeping,
    "typing": build_typing,
    "waving": build_waving,
    "swinging": build_swinging,
}


# ----------------------------------------------------------------- output ---

def to_palette(strip: RGBA) -> Image.Image:
    """Exact RGBA -> P conversion (no dithering, no quantisation)."""
    h, w, _ = strip.shape
    flat = strip.reshape(-1, 4).copy()
    flat[flat[:, 3] == 0] = 0  # canonical fully-transparent colour
    cols, inv = np.unique(flat, axis=0, return_inverse=True)
    if len(cols) > 256:
        raise SystemExit(f"too many colours ({len(cols)})")
    # put transparent first so index 0 is transparent
    order = np.argsort([0 if c[3] == 0 else 1 for c in cols], kind="stable")
    remap = np.empty_like(order)
    remap[order] = np.arange(len(order))
    cols = cols[order]
    img = Image.fromarray(remap[inv.reshape(-1)].reshape(h, w).astype(np.uint8), "P")
    pal = cols[:, :3].astype(np.uint8).flatten().tolist()
    img.putpalette(pal + [0] * (768 - len(pal)))
    img.info["transparency"] = bytes(cols[:, 3].astype(np.uint8).tolist())
    return img


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", help="optional path for a contact sheet on a grey background")
    args = ap.parse_args()

    manifest: Dict[str, dict] = {}
    strips: List[Tuple[str, RGBA]] = []
    total = 0
    for mood, build in BUILDERS.items():
        frames, meta = build()
        for f in frames:
            assert f.shape == (SIZE, SIZE, 4) and f.dtype == np.uint8
        strip = np.concatenate(frames, axis=1)
        img = to_palette(strip)
        path = os.path.join(MASCOT, f"{mood}-strip.png")
        img.save(path, optimize=True, transparency=img.info["transparency"])
        size = os.path.getsize(path)
        total += size
        meta = {**meta, "stripFrames": len(frames)} if len(frames) != meta["frames"] else meta
        manifest[mood] = meta
        strips.append((mood, strip))
        print(f"{mood:12s} {len(frames)} frames  {size / 1024:6.1f} KB")

    with open(os.path.join(MASCOT, "frames.json"), "w") as fh:
        json.dump(manifest, fh, indent=2)
        fh.write("\n")
    print(f"total strips: {total / 1024:.1f} KB")

    if args.preview:
        wmax = max(s.shape[1] for _, s in strips)
        sheet = Image.new("RGBA", (wmax, SIZE * len(strips)), (150, 150, 165, 255))
        for i, (_, s) in enumerate(strips):
            sheet.alpha_composite(Image.fromarray(s, "RGBA"), (0, i * SIZE))
        sheet.save(args.preview)


if __name__ == "__main__":
    main()
