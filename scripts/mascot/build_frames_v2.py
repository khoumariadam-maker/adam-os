#!/usr/bin/env python3
"""Build the v2 animation strips for the Pixel Spider mascot.

Reads   public/mascot/idle-01.png            (256x256 palette PNG, the hoodie/hair character)
        (the other *-01.png moods show an older all-black suit design, so they are
        not used: every animation is derived from idle to keep one consistent look)
Writes  public/mascot/v2/<anim>.png          (horizontal strip, 256x256 per frame)
        public/mascot/v2/anims.json          ({"<anim>": {"frames": n, "fps": f, "loop": bool}})

Method -- integer-only pixel operations, the art is never resampled:
  * alpha is binarised once (>=128 -> opaque) so every output pixel is 0 or 255;
  * vertical motion = deleting / duplicating whole rows (squash & stretch, feet
    stay on the baseline row), chosen in the flattest rows of the sprite;
  * leaning / swaying = per-row integer horizontal offsets (a crisp shear);
  * shoulder "rock" = per-column row deletion/duplication (tiny rotation look);
  * walking legs = deleting rows inside one leg's columns (the legs are
    separated by a transparent gap from y=214 down, so there is no seam);
  * eyes are re-shaped as masks (shift / grow / cut / squash rows) and are only
    allowed to paint over dark mask pixels;
  * raised arms (wave / celebrate / fall) and the laptop (typing) are drawn as
    crisp binary shapes in the sprite's own palette with a 2px ink outline;
  * particles (hearts, stars, notes, Z, !, anger mark, confetti) are hand-drawn
    ASCII patterns stamped in 4x4 blocks so they stay crisp at the 128px
    display size, with a 2px ink outline.
Every strip is re-indexed to an exact palette (no quantisation, no dithering).

v3 adds run, climb, sit, stretch, yawn, scratch, shoot-web, thumbs-up, laugh,
shrug, kick and sneeze: bent two-segment arms with fist / open / thumb / palm /
web-flick hands (draw_limb), an open-mouth shape, web threads and lines, and
an exact three-shear (Paeth) rotation for the kicking leg.

All 31 animations use the idle character so the mascot never changes design
when the player swaps animations; the feet bottom row (y=236) and the body
centre (x=127/128) are the same in every frame unless the motion is intended
(dangle / surprised jump / climb / sit / kick).

Usage:  python3 scripts/mascot/build_frames_v2.py [--preview contact.png] [--gifs DIR]
Deterministic; the source PNGs are never modified.
"""
from __future__ import annotations

import argparse
import json
import math
import os
from typing import Callable, Dict, List, Sequence, Tuple

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MASCOT = os.path.join(ROOT, "public", "mascot")
OUTDIR = os.path.join(MASCOT, "v2")
SIZE = 256
FEET = 236  # bottom opaque row of the feet in idle
CX = 128  # body centre column

RGBA = np.ndarray


def C(hexstr: str) -> np.ndarray:
    h = hexstr.lstrip("#")
    return np.array([int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255], dtype=np.uint8)


# palette of the idle sprite
INK = C("03020a")
MASKC = C("131218")
NAVY = C("1e1f37")
WEB = C("2730b7")
WEBD = C("1d227a")
HAIR = C("28282d")
HAIR2 = C("3f3d45")
SKIN = C("b58e78")
SKIND = C("806e66")
HOOD = C("eee7d6")
HOOD2 = C("d5ccbd")
HOOD3 = C("bcb2a3")
WHITE = C("ffffff")
# particle colours
RED = C("ff3a66")
PINK = C("ff8fb1")
YELLOW = C("ffe55c")
LAV = C("c3c6ed")
COBALT = C("212cf4")

DARK_MASK = [INK, MASKC, NAVY, WEB, WEBD]


# ------------------------------------------------------------------ loading ---

def load_bin(name: str) -> RGBA:
    a = np.array(Image.open(os.path.join(MASCOT, f"{name}-01.png")).convert("RGBA"))
    op = a[:, :, 3] >= 128
    a[op, 3] = 255
    a[~op] = 0
    return a


BASE = load_bin("idle")
_ROWDIFF = np.array([(BASE[r] != BASE[r + 1]).any(1).sum() for r in range(SIZE - 1)] + [999])


def is_color(a: RGBA, col: np.ndarray) -> np.ndarray:
    return (a == col).all(axis=2)


def pick_rows(y0: int, y1: int, n: int) -> List[int]:
    """n rows in [y0, y1): split into n windows and take the flattest row
    (fewest pixels different from the next row) of each window."""
    if n <= 0:
        return []
    edges = np.linspace(y0, y1, n + 1).round().astype(int)
    rows = []
    for i in range(n):
        lo, hi = edges[i], max(edges[i] + 1, edges[i + 1])
        rows.append(int(lo + np.argmin(_ROWDIFF[lo:hi])))
    return rows


# --------------------------------------------------------------- geometry ---

def squash(a: RGBA, rows: Sequence[int], x0: int = 0, x1: int = SIZE) -> RGBA:
    """Delete rows (inside columns [x0,x1)); everything above drops 1px each."""
    out = a.copy()
    for r in sorted(rows, reverse=True):
        col = out[:, x0:x1]
        col[1 : r + 1] = col[0:r].copy()
        col[0] = 0
    return out


def stretch(a: RGBA, rows: Sequence[int], x0: int = 0, x1: int = SIZE) -> RGBA:
    """Duplicate rows (inside columns [x0,x1)); everything above rises 1px each."""
    out = a.copy()
    for r in sorted(rows):
        col = out[:, x0:x1]
        col[0:r] = col[1 : r + 1].copy()
    return out


def lift(a: RGBA, rows: Sequence[int], x0: int, x1: int) -> RGBA:
    """Delete rows (inside columns [x0,x1)); everything BELOW rises 1px each
    (used to raise a foot)."""
    out = a.copy()
    for r in sorted(rows, reverse=True):
        col = out[:, x0:x1]
        col[r:-1] = col[r + 1 :].copy()
        col[-1] = 0
    return out


def translate(a: RGBA, dx: int, dy: int) -> RGBA:
    out = np.zeros_like(a)
    h, w = a.shape[:2]
    ys0, ys1 = max(0, -dy), min(h, h - dy)
    xs0, xs1 = max(0, -dx), min(w, w - dx)
    out[ys0 + dy : ys1 + dy, xs0 + dx : xs1 + dx] = a[ys0:ys1, xs0:xs1]
    return out


def shear(a: RGBA, offs: Callable[[int], int], y0: int = 0, y1: int = SIZE) -> RGBA:
    """Per-row integer horizontal offset (crisp lean / sway)."""
    out = a.copy()
    for y in range(y0, y1):
        dx = int(offs(y))
        if dx:
            row = np.roll(a[y], dx, axis=0)
            if dx > 0:
                row[:dx] = 0
            else:
                row[dx:] = 0
            out[y] = row
    return out


def lean(a: RGBA, top_dx: float, pivot: int = FEET, top: int = 19, y1: int = SIZE) -> RGBA:
    """Shear so that row `top` moves top_dx px and row `pivot` stays fixed."""
    span = pivot - top
    return shear(a, lambda y: round(top_dx * (pivot - y) / span), 0, min(pivot, y1))


def swing(a: RGBA, bottom_dx: float, pivot: int = 20, bottom: int = FEET) -> RGBA:
    """Shear pivoting at the top: row `pivot` fixed, row `bottom` moves bottom_dx."""
    span = bottom - pivot
    return shear(a, lambda y: round(bottom_dx * (y - pivot) / span), pivot, SIZE)


def col_squash(a: RGBA, row: int, d: Callable[[int], int], x0: int = 40, x1: int = 216) -> RGBA:
    """Per-column vertical offset of everything above `row`: d(x)>0 deletes d
    rows at `row` (that column drops), d(x)<0 duplicates rows (it rises)."""
    out = a.copy()
    for x in range(x0, x1):
        k = int(d(x))
        if k > 0:
            col = out[: row + 1, x]
            col[k:] = col[:-k].copy()
            col[:k] = 0
        elif k < 0:
            k = -k
            col = out[: row + 1, x]
            col[:-k] = col[k:].copy()
    return out


def rock(a: RGBA, amount: int, row: int = 186) -> RGBA:
    """Tiny 'rotation' of the upper body: left side drops `amount` px, right
    side rises `amount` px (negative = the other way)."""
    return col_squash(a, row, lambda x: round(amount * (CX - x) / 45.0) if abs(CX - x) <= 45 else int(math.copysign(abs(amount), amount * (CX - x))))


def widen(a: RGBA, cols: Sequence[int], y0: int = 0, y1: int = SIZE) -> RGBA:
    """Duplicate columns: columns left of the centre push the left part left,
    columns right of it push the right part right (rows [y0,y1) only)."""
    out = a.copy()
    for c in sorted([c for c in cols if c >= CX]):
        band = out[y0:y1]
        band[:, c + 1 :] = band[:, c:-1].copy()
    for c in sorted([c for c in cols if c < CX], reverse=True):
        band = out[y0:y1]
        band[:, :c] = band[:, 1 : c + 1].copy()
    return out


def lift_leg(a: RGBA, side: str, h: int, fwd: int = 0) -> RGBA:
    """Raise one foot by h px (shortening the shin) and push it fwd px."""
    if h <= 0 and fwd == 0:
        return a
    x0, x1 = (90, 128) if side == "L" else (128, 166)
    out = lift(a, pick_rows(216, 226, h), x0, x1) if h > 0 else a.copy()
    if fwd:
        for y in range(208, SIZE):
            d = int(round(fwd * min(1.0, (y - 208) / 18.0)))
            if d:
                seg = out[y, x0:x1].copy()
                out[y, x0:x1] = np.roll(seg, d, axis=0)
                if d > 0:
                    out[y, x0 : x0 + d] = 0 if y >= 214 else seg[:1]
                else:
                    out[y, x1 + d : x1] = 0 if y >= 214 else seg[-1:]
    return out


# ------------------------------------------------------------------- eyes ---

def mshift(m: np.ndarray, dx: int, dy: int) -> np.ndarray:
    out = np.zeros_like(m)
    h, w = m.shape
    out[max(0, dy) : h + min(0, dy), max(0, dx) : w + min(0, dx)] = m[
        max(0, -dy) : h + min(0, -dy), max(0, -dx) : w + min(0, -dx)
    ]
    return out


_EBOX = (80, 68, 184, 120)  # x0, y0, x1, y1


def _eye_masks() -> Tuple[np.ndarray, np.ndarray]:
    """White eye core plus its 1-3px anti-alias rim (anything that is not
    mask black, reached from the white core inside the black eye ring)."""
    x0, y0, x1, y1 = _EBOX
    box = np.zeros((SIZE, SIZE), bool)
    box[y0:y1, x0:x1] = True
    m = box & is_color(BASE, WHITE)
    rim_ok = box & (BASE[:, :, 3] == 255) & ~is_color(BASE, INK) & ~is_color(BASE, MASKC)
    for _ in range(3):
        g = m | mshift(m, 1, 0) | mshift(m, -1, 0) | mshift(m, 0, 1) | mshift(m, 0, -1)
        m = g & rim_ok
    left = m.copy()
    left[:, 133:] = False
    right = m.copy()
    right[:, :133] = False
    return left, right


EYE_L, EYE_R = _eye_masks()
EYES = EYE_L | EYE_R


def _allowed() -> np.ndarray:
    x0, y0, x1, y1 = 74, 62, 186, 124
    al = np.zeros((SIZE, SIZE), bool)
    dark = np.zeros((SIZE, SIZE), bool)
    for c in DARK_MASK:
        dark |= is_color(BASE, c)
    al[y0:y1, x0:x1] = dark[y0:y1, x0:x1]
    return al | EYES


ALLOWED = _allowed()


def mgrow(m: np.ndarray, r: int) -> np.ndarray:
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r + r:
                out |= mshift(m, dx, dy)
    return out


def bbox(m: np.ndarray) -> Tuple[int, int, int, int]:
    ys, xs = np.where(m)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def paint_eyes(a: RGBA, new: np.ndarray, color: np.ndarray = WHITE, rim: bool = True, clip: bool = True) -> RGBA:
    """Erase the original eye whites (-> ink) and paint the `new` mask."""
    out = a.copy()
    out[EYES] = INK
    if clip:
        new = new & ALLOWED
    out[new] = color
    if rim and color is WHITE:
        # 1px cream rim on the lower edge like the source art
        below = mshift(new, 0, -1)
        edge = new & ~below
        out[edge] = HOOD
    return out


def eyes_rows(m: np.ndarray, h: int, frac: float = 0.62) -> np.ndarray:
    """Squash an eye mask to h rows (row picking, no resampling) centred on
    the row at `frac` of its height."""
    x0, y0, x1, y1 = bbox(m)
    src = np.linspace(y0, y1 - 1, h).round().astype(int)
    out = np.zeros_like(m)
    cy = int(y0 + (y1 - y0) * frac) - h // 2
    for i, r in enumerate(src):
        out[cy + i] = m[r]
    return out


def eyes_closed(h: int = 5) -> np.ndarray:
    return eyes_rows(EYE_L, h) | eyes_rows(EYE_R, h)


def eye_arch(m: np.ndarray, t: int = 6, keep: float = 0.55) -> np.ndarray:
    """Happy closed eye: the top band (thickness t) of the eye shape."""
    x0, y0, x1, y1 = bbox(m)
    arch = m & ~mshift(m, 0, t)
    arch[int(y0 + (y1 - y0) * keep) :] = False
    return arch


def eye_cut(m: np.ndarray, frac: float, slope: float) -> np.ndarray:
    """Remove the top `frac` of the eye along a slanted line (angry brow)."""
    x0, y0, x1, y1 = bbox(m)
    cx = (x0 + x1) / 2
    out = m.copy()
    for x in range(x0, x1):
        cut = int(round(y0 + (y1 - y0) * frac + slope * (x - cx)))
        out[: max(0, cut), x] = False
    return out


def eye_centres() -> List[Tuple[int, int]]:
    res = []
    for m in (EYE_L, EYE_R):
        ys, xs = np.where(m)
        res.append((int(round(xs.mean())), int(round(ys.mean()))))
    return res


# -------------------------------------------------------------- particles ---

def stamp(a: RGBA, pattern: Sequence[str], x: int, y: int, colors: Dict[str, np.ndarray],
          scale: int = 4, outline: int = 2, behind: np.ndarray | None = None) -> RGBA:
    """Stamp an ASCII pixel pattern with its top-left at (x, y). Each char is a
    scale x scale block; an `outline`-px ink border is drawn around it. If
    `behind` is given (a bool mask of pixels to keep), the particle is drawn
    only where that mask is False (i.e. behind the character)."""
    out = a.copy()
    h = len(pattern) * scale
    w = max(len(r) for r in pattern) * scale
    pad = outline
    m = np.zeros((h + 2 * pad, w + 2 * pad), bool)
    col = np.zeros((h + 2 * pad, w + 2 * pad, 4), np.uint8)
    for j, line in enumerate(pattern):
        for i, ch in enumerate(line):
            if ch in colors:
                yy, xx = pad + j * scale, pad + i * scale
                m[yy : yy + scale, xx : xx + scale] = True
                col[yy : yy + scale, xx : xx + scale] = colors[ch]
    full = m.copy()
    if outline:
        g = m.copy()
        for dy in range(-outline, outline + 1):
            for dx in range(-outline, outline + 1):
                g |= mshift(m, dx, dy)
        col[g & ~m] = INK
        full = g
    X, Y = x - pad, y - pad
    for yy in range(full.shape[0]):
        ty = Y + yy
        if not 0 <= ty < SIZE:
            continue
        for xx in range(full.shape[1]):
            tx = X + xx
            if 0 <= tx < SIZE and full[yy, xx]:
                if behind is not None and behind[ty, tx]:
                    continue
                out[ty, tx] = col[yy, xx]
    return out


def stamp_c(a: RGBA, pattern: Sequence[str], cx: int, cy: int, colors: Dict[str, np.ndarray], **kw) -> RGBA:
    scale = kw.get("scale", 4)
    w = max(len(r) for r in pattern) * scale
    h = len(pattern) * scale
    return stamp(a, pattern, cx - w // 2, cy - h // 2, colors, **kw)


HEART_L = [".xx.xx.", "xpxxxxx", "xxxxxxx", ".xxxxx.", "..xxx..", "...x..."]
HEART_M = ["xx.xx", "xxxxx", ".xxx.", "..x.."]
HEART_S = ["x.x", "xxx", ".x."]
HEART_EYE = [".xxx.xxx.", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", ".xxxxxxx.", "..xxxxx..", "...xxx...", "....x...."]
STAR = ["..x..", ".xxx.", "xxoxx", ".xxx.", "..x.."]
STAR_S = [".x.", "xxx", ".x."]
SPARK = ["..x..", "..x..", "xxoxx", "..x..", "..x.."]
NOTE = ["..xx.", "..x.x", "..x..", "xxx..", "xxx.."]
NOTE_S = [".xx", ".x.", "xx.", "xx."]
Z_L = ["xxxxx", "...x.", "..x..", ".x...", "xxxxx"]
Z_M = ["xxxx", "..x.", ".x..", "xxxx"]
Z_XL = ["xxxxxx", "....x.", "...x..", "..x...", ".x....", "xxxxxx"]
BANG = ["xx", "xx", "xx", "xx", "..", "xx"]
ANGER_L = ["..x.x..", ".xx.xx.", "xx...xx", ".......", "xx...xx", ".xx.xx.", "..x.x.."]
ANGER_S = [".x.x.", "xx.xx", ".....", "xx.xx", ".x.x."]
PUFF = [".xxx.", "xxxxx", "xxxxx", ".xxx."]
PUFF_S = [".x.", "xxx", ".x."]


SPIRAL = ["xxxxxxx", "......x", "xxxxx.x", "x...x.x", "x.xxx.x", "x.....x", "xxxxxxx"]


# ------------------------------------------------------------- shortcuts ---

def breathe(a: RGBA, k: int) -> RGBA:
    """k px of breathing: delete k torso rows (head + chest drop, feet fixed)."""
    return squash(a, pick_rows(160, 200, k), 40, 216) if k > 0 else a


def body_squash(a: RGBA, n: int, legs: int = 0) -> RGBA:
    """Squash the whole figure by n rows (head, torso, legs share it)."""
    head = n // 3
    legs_n = min(legs, n - head)
    torso = n - head - legs_n
    rows = pick_rows(84, 140, head) + pick_rows(152, 204, torso) + pick_rows(207, 226, legs_n)
    return squash(a, rows)


def body_stretch(a: RGBA, n: int, legs: int = 0) -> RGBA:
    head = n // 3
    legs_n = min(legs, n - head)
    torso = n - head - legs_n
    rows = pick_rows(84, 140, head) + pick_rows(152, 204, torso) + pick_rows(207, 226, legs_n)
    return stretch(a, rows)


def widen_body(a: RGBA, n: int) -> RGBA:
    half = n // 2
    left = [104 - i * 6 for i in range(half)]
    right = [151 + i * 6 for i in range(n - half)]
    return widen(a, left + right)


# ------------------------------------------------------------- animations ---

Frames = List[RGBA]


def anim_idle() -> Frames:
    a = BASE
    return [a, breathe(a, 1), breathe(a, 2), breathe(a, 1)]


def anim_blink() -> Frames:
    return [paint_eyes(BASE, eyes_closed(5))]


def look(dx: int) -> RGBA:
    a = paint_eyes(BASE, mshift(EYES, int(math.copysign(4, dx)), 0))
    # head + hair shift relative to the body, ramped through the neck
    def offs(y: int) -> int:
        if y < 138:
            return dx
        if y < 150:
            return round(dx * (150 - y) / 12)
        return 0
    return shear(a, offs, 0, 150)


def anim_look_left() -> Frames:
    return [look(-5)]


def anim_look_right() -> Frames:
    return [look(5)]


def anim_walk() -> Frames:
    # (lifted leg, lift px, body bob (+down), weight shift dx, rock)
    seq = [
        (None, 0, 3, 0, 0),
        ("L", 5, 1, 1, 1),
        ("L", 8, -1, 2, 2),
        ("L", 4, 1, 1, 1),
        (None, 0, 3, 0, 0),
        ("R", 5, 1, -1, -1),
        ("R", 8, -1, -2, -2),
        ("R", 4, 1, -1, -1),
    ]
    out = []
    for leg, h, bob, shift, rk in seq:
        f = BASE
        if bob > 0:
            f = squash(f, pick_rows(156, 204, bob))
        elif bob < 0:
            f = stretch(f, pick_rows(156, 204, -bob))
        if rk:
            f = rock(f, rk)
        f = shear(f, lambda y: shift if y < 206 else 0, 0, 206)
        f = lean(f, 6, pivot=206)
        if leg:
            f = lift_leg(f, leg, h, fwd=3 if h >= 8 else 1)
        out.append(f)
    return out


def anim_hop() -> Frames:
    a = BASE
    crouch = widen_body(body_squash(a, 12, legs=4), 4)
    st = body_stretch(a, 10, legs=3)
    air = body_squash(lift_leg(lift_leg(a, "L", 10), "R", 10), 0)
    apex = lift_leg(lift_leg(a, "L", 6), "R", 6)
    land = widen_body(body_squash(a, 12, legs=4), 6)
    recover = body_squash(a, 3)
    return [crouch, st, air, apex, land, recover]


def anim_dance() -> Frames:
    sway = [0, 5, 9, 5, 0, -5, -9, -5]
    bounce = [3, 0, 3, 0, 3, 0, 3, 0]
    out = []
    for i in range(8):
        f = BASE
        if bounce[i]:
            f = squash(f, pick_rows(150, 205, bounce[i] + 1))
        f = rock(f, int(math.copysign(2, sway[i])) if sway[i] else 0)
        f = lean(f, sway[i])
        # alternate foot lift on the off-beats
        if i in (1, 2):
            f = lift_leg(f, "R", 3 if i == 1 else 5)
        if i in (5, 6):
            f = lift_leg(f, "L", 3 if i == 5 else 5)
        # music notes: one rises on the left on frames 0-3, one on the right 4-7
        t = i % 4
        side = -1 if i < 4 else 1
        col = YELLOW if side < 0 else LAV
        f = stamp_c(f, NOTE if t < 3 else NOTE_S, CX + side * (76 + 3 * t), 112 - 18 * t, {"x": col})
        if t == 0:  # the previous note fades out high on the other side
            f = stamp_c(f, NOTE_S, CX - side * 88, 44, {"x": LAV if side < 0 else YELLOW})
        out.append(f)
    return out


def anim_sleep() -> Frames:
    # closed: a low curved lid (bottom band of the eye shape)
    lid = np.zeros_like(EYES)
    for m in (EYE_L, EYE_R):
        band = m & ~mshift(m, 0, -5)  # bottom band thickness 5
        x0, y0, x1, y1 = bbox(m)
        band[: int(y0 + (y1 - y0) * 0.55)] = False
        lid |= band
    a = paint_eyes(BASE, lid, color=LAV, rim=False)
    # droop the head 3px and tilt it slightly
    a = squash(a, pick_rows(140, 156, 3))
    frames = []
    br = [0, 1, 2, 1]
    zs = [
        [(Z_M, 180, 56)],
        [(Z_M, 186, 42), (Z_L, 204, 14)],
        [(Z_L, 192, 30), (Z_XL, 214, 0)],
        [(Z_M, 180, 56), (Z_XL, 202, 12)],
    ]
    for i in range(4):
        f = breathe(a, br[i])
        for pat, x, y in zs[i]:
            f = stamp(f, pat, x, y, {"x": WHITE if pat is Z_XL else LAV})
        frames.append(f)
    return frames


def anim_love() -> Frames:
    eyes_base = BASE.copy()
    eyes_base[EYES] = INK
    (lx, ly), (rx, ry) = eye_centres()
    face = stamp_c(eyes_base, HEART_EYE, lx, ly + 2, {"x": RED}, outline=0)
    face = stamp_c(face, HEART_EYE, rx, ry + 2, {"x": RED}, outline=0)
    # highlight pixel block on each heart eye
    face = stamp(face, ["x"], lx - 10, ly - 6, {"x": PINK}, scale=4, outline=0)
    face = stamp(face, ["x"], rx - 10, ry - 6, {"x": PINK}, scale=4, outline=0)
    bounce = [0, 2, 3, 2, 0, -2]
    hearts = [
        # (pattern, x centre, y centre) per frame for 3 hearts on staggered paths
        lambda t: (HEART_L if t < 2 else HEART_M if t < 4 else HEART_S, 40 - t * 2, 120 - t * 18),
        lambda t: (HEART_L if t < 2 else HEART_M if t < 4 else HEART_S, 214 + t * 2, 100 - t * 16),
        lambda t: (HEART_M if t < 3 else HEART_S, 196 - t, 40 - t * 6),
    ]
    out = []
    for i in range(6):
        f = face
        b = bounce[i]
        f = squash(f, pick_rows(150, 205, b)) if b > 0 else (stretch(f, pick_rows(150, 205, -b)) if b < 0 else f)
        for j, h in enumerate(hearts):
            t = (i + j * 2) % 6
            if j == 2 and t > 3:
                continue
            pat, x, y = h(t)
            f = stamp_c(f, pat, x, y, {"x": RED if j != 1 else PINK, "p": PINK if j != 1 else WHITE})
        out.append(f)
    return out


def anim_dizzy() -> Frames:
    sp = SPIRAL
    base = BASE.copy()
    base[EYES] = INK
    (lx, ly), (rx, ry) = eye_centres()
    wob = [0, 6, 3, -3, -6, -3]
    out = []
    for i in range(6):
        rot = np.rot90(np.array([list(r) for r in sp]), k=-i % 4)
        pat = ["".join(r) for r in rot]
        f = stamp_c(base, pat, lx, ly, {"x": WHITE}, outline=0)
        f = stamp_c(f, pat[::-1] if False else pat, rx, ry, {"x": WHITE}, outline=0)
        f = rock(f, int(math.copysign(1, wob[i])) if wob[i] else 0)
        f = lean(f, wob[i])
        # 3 stars on an ellipse above the head, rotating
        for k in range(3):
            th = 2 * math.pi * (k / 3 + i / 6)
            sx = int(round(CX + wob[i] + 60 * math.cos(th)))
            sy = int(round(16 + 8 * math.sin(th)))
            front = math.sin(th) > -0.2
            pat_s = STAR if front else STAR_S
            occl = None if front else (f[:, :, 3] == 255)
            f = stamp_c(f, pat_s, sx, sy, {"x": YELLOW, "o": WHITE}, behind=occl)
        out.append(f)
    return out


def big_eyes(a: RGBA, r: int = 3) -> RGBA:
    return paint_eyes(a, mgrow(EYE_L, r) | mgrow(EYE_R, r))


def anim_surprised() -> Frames:
    eyes = big_eyes(BASE, 3)
    f0 = translate(body_stretch(eyes, 3), 0, -6)
    f1 = body_squash(eyes, 3)
    f2 = eyes
    bang = lambda f, y: stamp_c(f, BANG, 206, y, {"x": YELLOW})
    return [bang(f0, 34), bang(f1, 40), bang(f2, 40)]


def anim_annoyed() -> Frames:
    eyes = eye_cut(EYE_L, 0.45, 0.25) | eye_cut(EYE_R, 0.45, -0.25)
    a = paint_eyes(BASE, eyes)
    out = []
    for i in range(4):
        f = a
        # foot tap with the right foot
        if i % 2 == 1:
            f = lift_leg(f, "R", 3)
        big = i % 2 == 0
        f = stamp_c(f, ANGER_L if big else ANGER_S, 200, 30, {"x": RED})
        # steam puffs rising from both sides of the head
        t = i
        f = stamp_c(f, PUFF if t < 2 else PUFF_S, 48 - t * 3, 72 - t * 12, {"x": LAV}) if t < 3 else f
        t2 = (i + 2) % 4
        f = stamp_c(f, PUFF if t2 < 2 else PUFF_S, 212 + t2 * 3, 92 - t2 * 12, {"x": WHITE}) if t2 < 3 else f
        out.append(f)
    return out


def anim_dangle() -> Frames:
    a = BASE
    sw = [12, 4, -12, -4]
    kick = [("L", 5), (None, 0), ("R", 5), (None, 0)]
    out = []
    for i in range(4):
        f = a
        if kick[i][0]:
            f = lift_leg(f, kick[i][0], kick[i][1])
        f = swing(f, sw[i], pivot=24)
        # thread from the top of the canvas to the top of the hair
        f = f.copy()
        top = int(np.where(f[:, CX - 1, 3] == 255)[0].min())
        f[0 : top + 2, CX - 1 : CX + 1] = LAV
        out.append(f)
    return out


def anim_fall() -> Frames:
    eyes = hide_hands(big_eyes(BASE, 3), True, True)
    out = []
    for i in range(2):
        s = 1 if i == 0 else -1
        f = rock(eyes, 2 * s, row=200)
        f = raise_arms(f, 36 if i == 0 else 6, 6 if i == 0 else 36, L=48, dy=2 * s)
        f = lift_leg(f, "L" if i == 0 else "R", 6)
        f = lean(f, -3 * s, pivot=206)
        # speed lines above the head
        for k, (x, y) in enumerate([(84, 6), (128, 0), (172, 6)]):
            yy = y + (4 if (k + i) % 2 else 0)
            f = stamp(f, ["x", "x", "x"], x, yy, {"x": LAV}, outline=0)
        out.append(f)
    return out


def anim_land() -> Frames:
    a = BASE
    f0 = widen_body(body_squash(a, 16, legs=5), 8)
    f1 = widen_body(body_squash(a, 8, legs=2), 4)
    f2 = body_squash(a, 2)
    return [f0, f1, f2]


def anim_celebrate() -> Frames:
    a = hide_hands(paint_eyes(BASE, eye_arch(EYE_L, 7) | eye_arch(EYE_R, 7)), True, True)
    bounce = [3, -4, 3, -4]
    arm_ang = [34, 12, 34, 12]
    conf_cols = [YELLOW, RED, LAV, PINK, COBALT, WHITE]
    rng = np.random.RandomState(7)
    pts = [(int(rng.randint(20, 236)), int(rng.randint(0, 150))) for _ in range(10)]
    out = []
    for i in range(4):
        b = bounce[i]
        f = body_squash(a, b) if b > 0 else body_stretch(a, -b)
        f = raise_arms(f, arm_ang[i], arm_ang[i], L=46, dy=b)
        for k, (x, y) in enumerate(pts):
            yy = (y + i * 12 + k * 7) % 170
            # keep confetti off the face/body
            if 50 < x < 206 and yy > 10:
                x = 18 + (x % 30) if x < CX else 208 + (x % 30)
            c = conf_cols[k % len(conf_cols)]
            shape = ["xx"] if (i + k) % 2 else ["x", "x"]
            f = stamp(f, shape, x, yy, {"x": c}, outline=0)
        sp = [(30, 30), (222, 24), (24, 120), (228, 130)]
        sx, sy = sp[i]
        f = stamp_c(f, SPARK, sx, sy, {"x": YELLOW, "o": WHITE})
        sx, sy = sp[(i + 2) % 4]
        f = stamp_c(f, STAR_S, sx, sy, {"x": WHITE})
        out.append(f)
    return out


def anim_loading() -> Frames:
    # eyes glance up-right toward the spinner
    a = paint_eyes(BASE, mshift(EYES, 3, -3))
    cx, cy, r = 222, 32, 20
    pts = [(0, -1), (0.7, -0.7), (1, 0), (0.7, 0.7), (0, 1), (-0.7, 0.7), (-1, 0), (-0.7, -0.7)]
    out = []
    for i in range(4):
        f = breathe(a, 1 if i % 2 else 0)
        for k, (px, py) in enumerate(pts):
            lead = k == (i * 2) % 8 or k == (i * 2 + 1) % 8
            trail = k == (i * 2 - 1) % 8
            col = WHITE if lead else (LAV if trail else HAIR2)
            f = stamp_c(f, ["xx", "xx"] if lead else ["x"], int(cx + px * r), int(cy + py * r), {"x": col})
        out.append(f)
    return out


def disc(cx: float, cy: float, r: float) -> np.ndarray:
    yy, xx = np.mgrid[0:SIZE, 0:SIZE]
    return (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r


def capsule(p0: Tuple[float, float], p1: Tuple[float, float], r: float) -> np.ndarray:
    yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(float)
    (x0, y0), (x1, y1) = p0, p1
    vx, vy = x1 - x0, y1 - y0
    t = np.clip(((xx - x0) * vx + (yy - y0) * vy) / (vx * vx + vy * vy), 0, 1)
    return (xx - (x0 + t * vx)) ** 2 + (yy - (y0 + t * vy)) ** 2 <= r * r


def outline_of(m: np.ndarray, w: int = 2) -> np.ndarray:
    g = m.copy()
    for dy in range(-w, w + 1):
        for dx in range(-w, w + 1):
            if abs(dx) + abs(dy) <= w + 1:
                g |= mshift(m, dx, dy)
    return g & ~m


HEAD = np.zeros((SIZE, SIZE), bool)
HEAD[:146] = BASE[:146, :, 3] == 255


def draw_arm(a: RGBA, shoulder: Tuple[int, int], hand: Tuple[int, int], keep: np.ndarray, mirror: bool = False) -> RGBA:
    """Raised hoodie arm + open mitten hand drawn as crisp binary shapes
    (2px ink outline, palette fills). Pixels in `keep` are not painted
    (the arm goes behind the head)."""
    out = a.copy()
    sx, sy = shoulder
    hx, hy = hand
    L = math.hypot(hx - sx, hy - sy)
    ux, uy = (hx - sx) / L, (hy - sy) / L
    wrist = (hx - ux * 15, hy - uy * 15)
    palm = disc(hx, hy, 11)
    thumb = disc(hx + (12 if mirror else -12), hy + 3, 4.5)
    hand_m = palm | thumb
    sleeve = capsule((sx, sy), wrist, 10.5) & ~hand_m
    cuff = capsule((wrist[0] - ux * 4, wrist[1] - uy * 4), wrist, 10.5) & sleeve
    shape = sleeve | hand_m
    ol = outline_of(shape, 2)
    # shading: right/lower side of the sleeve and hand
    shade_s = sleeve & ~mshift(sleeve, 3 if mirror else -3, 0)
    shade_h = hand_m & ~mshift(hand_m, -3, -3)
    seam = outline_of(hand_m, 1) & sleeve
    layers = [
        (ol, INK), (sleeve, HOOD), (shade_s, HOOD2), (cuff, HOOD2), (hand_m, SKIN), (shade_h, SKIND),
    ]
    # finger gaps on the palm (two short ink lines at the top of the hand)
    fing = np.zeros_like(shape)
    for fx in (hx - 4, hx + 1, hx + 6):
        fx = int(round(fx))
        fing[int(hy - 10) : int(hy - 5), fx : fx + 1] = True
    fing &= palm
    layers.append((fing, INK))
    layers.append((seam, INK))
    hand_zone = mgrow(hand_m, 2)
    for m, c in layers:
        m = m & (~keep | hand_zone)
        out[m] = c
    return out


def hide_hands(a: RGBA, right: bool = True, left: bool = False) -> RGBA:
    """Turn clasped hands into hoodie cloth (those arms are raised)."""
    out = a.copy()
    box = np.zeros((SIZE, SIZE), bool)
    if right:
        box[176:199, 130:146] = True
    if left:
        box[176:199, 112:130] = True
    skin = box & (is_color(a, SKIN) | is_color(a, SKIND))
    out[skin] = HOOD
    out[skin & mshift(skin, 0, 2) & ~mshift(skin, 0, -2)] = HOOD2
    return out


def raise_arms(f: RGBA, right: float | None, left: float | None, L: int = 52, dy: int = 0) -> RGBA:
    """Draw raised arms; angles in degrees from vertical, + = outward."""
    keep = np.zeros((SIZE, SIZE), bool)
    keep[:146] = f[:146, :, 3] == 255
    for ang, side in ((right, 1), (left, -1)):
        if ang is None:
            continue
        th = math.radians(ang)
        sh = (CX + side * 40, 166 + dy)
        hand = (sh[0] + side * (int(round(L * math.sin(th))) + 16), sh[1] - int(round(L * math.cos(th))))
        f = draw_arm(f, sh, hand, keep, mirror=side < 0)
    return f


def anim_wave() -> Frames:
    body = hide_hands(BASE)
    # hand travels on an arc around the shoulder
    angles = [8, 16, 24, 16, 8, 0]  # degrees from vertical, + = outward (right)
    tilt = [0, 1, 2, 1, 0, -1]
    out = []
    for i, ang in enumerate(angles):
        f = shear(body, lambda y, t=tilt[i]: t if y < 140 else 0, 0, 140)
        f = raise_arms(f, ang, None)
        out.append(f)
    return out


def draw_laptop(a: RGBA, lift_l: int, lift_r: int, glow: int) -> RGBA:
    """Open laptop held in front of the belly (we see the back of the lid),
    the two hands resting on its top edge."""
    out = a.copy()
    x0, x1, y0, y1 = 94, 162, 170, 210
    lid = np.zeros((SIZE, SIZE), bool)
    lid[y0:y1, x0:x1] = True
    ol = outline_of(lid, 2)
    out[ol] = INK
    out[lid] = WEBD
    out[y0 : y0 + 2, x0:x1] = WEB  # top rim highlight
    out[y0:y1, x0 : x0 + 2] = WEB
    out[y1 - 3 : y1, x0:x1] = NAVY
    # glowing logo in the middle of the lid
    logo = disc(128, 190, 5.5)
    out[logo] = LAV if glow else COBALT
    out[disc(128, 190, 2.5)] = WHITE
    for k, (hx, lift) in enumerate(((110, lift_l), (146, lift_r))):
        hy = y0 - 1 - lift
        m = np.zeros((SIZE, SIZE), bool)
        m[hy - 4 : hy + 5, hx - 8 : hx + 8] = True
        m &= ~(disc(hx - 8, hy - 4, 2) | disc(hx + 7, hy - 4, 2))
        o = outline_of(m, 2)
        out[o & ~lid] = INK
        out[m] = SKIN
        out[m & ~mshift(m, 0, 2)] = SKIND
    return out


def anim_typing() -> Frames:
    a = paint_eyes(BASE, mshift(EYES, 0, 4))  # looking down at the screen
    seq = [(3, 0, 0, 0), (0, 3, 1, 1), (2, 0, 0, 1), (0, 2, 1, 0)]
    out = []
    for i, (ll, lr, bob, glow) in enumerate(seq):
        f = breathe(a, bob)
        f = draw_laptop(f, ll, lr, glow)
        out.append(f)
    return out


# ===================================================== v3 additions (run .. sneeze) ===

QMARK = [".xxx.", "xx.xx", "...xx", "..xx.", "..x..", ".....", "..x.."]
HA = ["x.x..x.", "x.x.x.x", "xxx.xxx", "x.x.x.x", "x.x.x.x"]
SPLAT = ["x.x.x", ".xxx.", "xxoxx", ".xxx.", "x.x.x"]
DOT = ["x"]
TONGUE = C("8c2f45")


def ellipse(cx: float, cy: float, rx: float, ry: float) -> np.ndarray:
    yy, xx = np.mgrid[0:SIZE, 0:SIZE]
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1.0


def rrect(x0: int, y0: int, x1: int, y1: int, r: int = 3) -> np.ndarray:
    """Rounded rectangle [x0,x1) x [y0,y1)."""
    m = np.zeros((SIZE, SIZE), bool)
    m[y0:y1, x0 + r : x1 - r] = True
    m[y0 + r : y1 - r, x0:x1] = True
    for cx, cy in ((x0 + r, y0 + r), (x1 - r - 1, y0 + r), (x0 + r, y1 - r - 1), (x1 - r - 1, y1 - r - 1)):
        m |= disc(cx, cy, r + 0.3)
    return m


def hand_shape(kind: str, hx: float, hy: float, side: int) -> Tuple[np.ndarray, np.ndarray]:
    """(hand mask, ink detail mask) for a drawn hand centred at (hx, hy).
    side = +1 for the screen-right arm, -1 for the screen-left arm."""
    ix, iy = int(round(hx)), int(round(hy))
    det = np.zeros((SIZE, SIZE), bool)
    if kind == "fist":
        m = rrect(ix - 9, iy - 8, ix + 9, iy + 9, 4)
        for k in (-3, 2):  # two finger creases
            det[iy + k : iy + k + 1, ix - 6 : ix + 6] = True
    elif kind == "open":
        m = disc(hx, hy, 10) | disc(hx - side * 11, hy + 3, 4.5)
        for fx in (ix - 4, ix + 1, ix + 6):
            det[iy - 9 : iy - 4, fx : fx + 1] = True
    elif kind == "thumb":
        m = rrect(ix - 9, iy - 6, ix + 9, iy + 10, 4)
        m |= capsule((hx - side * 3, hy - 6), (hx - side * 3, hy - 17), 4)
        for k in (-1, 3, 7):
            det[iy + k : iy + k + 1, ix - 6 : ix + 4] = True
    elif kind == "palm":  # open palm facing up, fingers pointing outward
        m = ellipse(hx, hy, 14, 7) | disc(hx - side * 9, hy - 7, 4)
        for k in (-2, 2):
            x = ix + side * 7
            det[iy + k : iy + k + 1, min(x, x + side * 6) : max(x, x + side * 6) + 1] = True
    elif kind == "flick":  # web-shooter: index + pinky up, middle fingers folded
        m = rrect(ix - 9, iy - 6, ix + 9, iy + 9, 4)
        m |= capsule((hx - 6, hy - 4), (hx - 6, hy - 18), 3.5)
        m |= capsule((hx + 6, hy - 4), (hx + 6, hy - 16), 3.5)
        m |= capsule((hx - side * 12, hy + 2), (hx - side * 9, hy + 2), 3.5)
        det[iy - 3 : iy - 2, ix - 3 : ix + 4] = True
    elif kind == "mouth":  # back of the hand covering the mouth, fingers sideways
        m = rrect(ix - 11, iy - 8, ix + 11, iy + 8, 5)
        for k in (-3, 2):
            x = ix - side * 3
            det[iy + k : iy + k + 1, min(x, x - side * 7) : max(x, x - side * 7) + 1] = True
    else:
        raise ValueError(kind)
    return m, det & m


def draw_limb(a: RGBA, pts: Sequence[Tuple[float, float]], kind: str, side: int,
              behind: np.ndarray | None = None, hand_front: bool = True, r: float = 10.0) -> RGBA:
    """Hoodie arm along the polyline pts (shoulder [, elbow], hand centre) with
    a drawn hand; crisp binary masks, 2px ink outline, sprite palette. Pixels
    in `behind` are left alone (the arm passes behind them) except the hand
    when hand_front is set."""
    out = a.copy()
    hx, hy = pts[-1]
    px, py = pts[-2]
    L = math.hypot(hx - px, hy - py)
    ux, uy = (hx - px) / L, (hy - py) / L
    wrist = (hx - ux * 12, hy - uy * 12)
    hand_m, det = hand_shape(kind, hx, hy, side)
    sleeve = np.zeros((SIZE, SIZE), bool)
    seg = list(pts[:-1]) + [wrist]
    for p0, p1 in zip(seg, seg[1:]):
        sleeve |= capsule(p0, p1, r)
    sleeve &= ~hand_m
    cuff = capsule((wrist[0] - ux * 5, wrist[1] - uy * 5), wrist, r) & sleeve
    shape = sleeve | hand_m
    ol = outline_of(shape, 2)
    shade_s = sleeve & ~(mshift(sleeve, -3 * side, 0) & mshift(sleeve, 0, -3))
    shade_h = hand_m & ~mshift(hand_m, -3 * side, -3)
    seam = outline_of(hand_m, 1) & sleeve
    layers = [(ol, INK), (sleeve, HOOD), (shade_s, HOOD2), (cuff, HOOD2), (hand_m, SKIN),
              (shade_h, SKIND), (det, INK), (seam, INK)]
    free = np.ones((SIZE, SIZE), bool) if behind is None else ~behind
    if hand_front:
        free = free | mgrow(hand_m, 2)
    for m, c in layers:
        out[m & free] = c
    return out


def opaque(a: RGBA) -> np.ndarray:
    return a[:, :, 3] == 255


def mouth(a: RGBA, w: int, h: int, cx: int = 134, cy: int = 137) -> RGBA:
    """Open mouth: dark oval with a skin lip rim and a tongue (w,h = inner size)."""
    if w <= 0 or h <= 0:
        return a
    out = a.copy()
    inner = ellipse(cx, cy, w / 2, h / 2)
    lip = mgrow(inner, 2) & ~inner
    out[lip] = SKIND
    out[inner] = INK
    if h >= 6:
        out[inner & ellipse(cx, cy + h / 2, w / 3, h / 3)] = TONGUE
    return out


def vline(a: RGBA, x: int, y0: int, y1: int, behind: np.ndarray | None = None, w: int = 2) -> RGBA:
    """Thin lavender/white web thread (no outline, like dangle)."""
    out = a.copy()
    m = np.zeros((SIZE, SIZE), bool)
    m[max(0, y0) : y1, x : x + w] = True
    if behind is not None:
        m &= ~behind
    out[m] = LAV
    m2 = m.copy()
    m2[:, x + 1 :] = False
    out[m2] = WHITE
    return out


def web_line(a: RGBA, x0: int, x1: int, y: int) -> RGBA:
    """Horizontal web shot: 2px white over 2px lavender, 2px ink outline."""
    out = a.copy()
    m = np.zeros((SIZE, SIZE), bool)
    m[y : y + 4, x0:x1] = True
    out[outline_of(m, 2) & ~opaque(a)] = INK
    out[m] = LAV
    out[y : y + 2, x0:x1] = WHITE
    return out


def paeth_rotate(sub: RGBA, theta: float, px: float, py: float) -> RGBA:
    """Exact pixel rotation by three integer shears (no resampling: every
    source pixel lands on exactly one destination pixel)."""
    a = np.tan(-theta / 2)
    b = np.sin(theta)
    out = sub

    def xshear(img: RGBA) -> RGBA:
        o = np.zeros_like(img)
        for y in range(img.shape[0]):
            d = int(round(a * (y - py)))
            o[y] = np.roll(img[y], d, axis=0)
        return o

    def yshear(img: RGBA) -> RGBA:
        o = np.zeros_like(img)
        for x in range(img.shape[1]):
            d = int(round(b * (x - px)))
            o[:, x] = np.roll(img[:, x], d, axis=0)
        return o

    return xshear(yshear(xshear(out)))


def bounce_f(a: RGBA, b: int) -> RGBA:
    """b>0: squash the torso b rows (lower), b<0: stretch it (higher)."""
    if b > 0:
        return squash(a, pick_rows(150, 205, b))
    if b < 0:
        return stretch(a, pick_rows(150, 205, -b))
    return a


def head_tilt(a: RGBA, dx: int) -> RGBA:
    """Shift the head (+ hair) dx px relative to the body, ramped at the neck."""
    def offs(y: int) -> int:
        if y < 138:
            return dx
        if y < 150:
            return round(dx * (150 - y) / 12)
        return 0
    return shear(a, offs, 0, 150)


def lift_leg2(a: RGBA, side: str, h: int) -> RGBA:
    """Raise one foot by up to ~14px (rows deleted over the whole shin)."""
    if h <= 0:
        return a
    x0, x1 = (90, 128) if side == "L" else (128, 166)
    rows = pick_rows(215, 233, min(h, 17))
    return lift(a, rows, x0, x1)


SH_R = (CX + 38, 167)
SH_L = (CX - 38, 167)


def anim_run() -> Frames:
    # (lifted leg, lift px, bob (+down), weight shift dx, rock, arm swing s: +1 = screen-right arm up)
    seq = [
        (None, 0, 4, 0, 0, 0),
        ("L", 7, 1, 2, 2, 1),
        ("L", 12, -2, 3, 3, 1),
        ("L", 6, 1, 2, 2, 0),
        (None, 0, 4, 0, 0, 0),
        ("R", 7, 1, -1, -2, -1),
        ("R", 12, -2, -1, -3, -1),
        ("R", 6, 1, -1, -2, 0),
    ]
    body = hide_hands(BASE, True, True)
    out = []
    for i, (leg, h, bob, shift, rk, s) in enumerate(seq):
        f = body
        # pumping arms (bent, fists): s=+1 right arm forward/up, left arm back/down
        up_r = [SH_R, (CX + 56, 186), (CX + 62, 160)]
        dn_r = [SH_R, (CX + 50, 190), (CX + 58, 212)]
        mid_r = [SH_R, (CX + 54, 190), (CX + 66, 198)]
        up_l = [SH_L, (CX - 56, 186), (CX - 62, 160)]
        dn_l = [SH_L, (CX - 50, 190), (CX - 58, 212)]
        mid_l = [SH_L, (CX - 54, 190), (CX - 66, 198)]
        pr = up_r if s > 0 else dn_r if s < 0 else mid_r
        pl = dn_l if s > 0 else up_l if s < 0 else mid_l
        body_m = opaque(BASE)
        # the arm swinging back goes behind the body
        f = draw_limb(f, pl, "fist", -1, behind=body_m if s > 0 else None, hand_front=False)
        f = draw_limb(f, pr, "fist", 1, behind=body_m if s < 0 else None, hand_front=False)
        f = bounce_f(f, bob)
        if rk:
            f = rock(f, rk)
        f = shear(f, lambda y, d=shift: d if y < 206 else 0, 0, 206)
        f = lean(f, 12, pivot=206)
        if leg:
            f = lift_leg2(f, leg, h)
            f = lift_leg(f, leg, 0, fwd=4 if h >= 10 else 2)
        # dust puff behind (left) on the contact frames, drifting away
        occ = opaque(f)
        if i in (0, 4):
            f = stamp_c(f, PUFF, CX - 52, 228, {"x": LAV}, behind=occ)
        elif i in (1, 5):
            f = stamp_c(f, PUFF_S, CX - 70, 222, {"x": WHITE}, behind=occ)
        out.append(f)
    return out


def anim_climb() -> Frames:
    # (left hand y, right hand y, body dy (down), tucked leg, tuck px)
    seq = [(6, 34, 16, "L", 9), (18, 20, 12, None, 0), (34, 6, 16, "R", 9), (20, 18, 12, None, 0)]
    out = []
    tx = CX + 1
    for lh, rh, dy, leg, tuck in seq:
        f = hide_hands(paint_eyes(BASE, mshift(EYES, 0, -3)), True, True)
        if leg:
            f = lift_leg2(f, leg, tuck)
        f = translate(f, 0, dy)
        head = np.zeros((SIZE, SIZE), bool)
        head[: 150 + dy] = opaque(f)[: 150 + dy]
        f = vline(f, tx - 1, 0, 60, behind=None)
        sh_y = 167 + dy
        el, er = sh_y - 70 - (lh - 6) // 2, sh_y - 70 - (rh - 6) // 2
        f = draw_limb(f, [(CX - 36, sh_y), (CX - 76, el), (tx - 1, lh + 10)], "fist", -1, behind=head)
        f = draw_limb(f, [(CX + 36, sh_y), (CX + 76, er), (tx + 1, rh + 10)], "fist", 1, behind=head)
        # thread visible again across the fists' gap (it runs through the hands)
        top = min(lh, rh) + 10
        f = vline(f, tx - 1, 0, top - 8)
        out.append(f)
    return out


def anim_sit() -> Frames:
    a = BASE
    # legs: squash the leg region (rows 206..236) by ~40% and splay them apart
    legs_rows = pick_rows(207, 234, 12)
    f = lift(a, legs_rows, 0, SIZE)  # feet rise to the hips
    f = widen(f, [118, 117, 116, 115, 114, 113, 112, 139, 140, 141, 142, 143, 144, 145], 210, SIZE)
    f = widen(f, [104, 152], 196, 210)  # hoodie hem bunches out a little when seated
    # lower the whole figure so the seat (crotch / hoodie hem, y~212) sits at y~236
    f = translate(f, 0, 236 - 212)
    out = []
    br = [0, 1, 2, 1]
    swing_ = [(1, -1), (0, 0), (-1, 1), (0, 0)]
    for i in range(4):
        g = breathe(f, br[i])
        sl, sr = swing_[i]
        # legs splayed outward below the seat, feet dangling: the swinging
        # foot shifts 1px sideways and rises 2px (it comes forward)
        g = g.copy()
        for side, d in (("L", sl), ("R", sr)):
            x0, x1 = (30, CX) if side == "L" else (CX, 226)
            sgn = -1 if side == "L" else 1
            for y in range(236, SIZE):
                k = sgn * ((y - 236) // 2) + (d if y >= 242 else 0)
                if k:
                    g[y, x0:x1] = np.roll(g[y, x0:x1], k, axis=0)
            if d > 0:
                g = lift(g, [244, 246], x0, x1)
        out.append(g)
    return out


def big_arms(a: RGBA, spread: int, hy: int, dy: int = 0, kind: str = "open") -> RGBA:
    """Both arms raised high, hands at (CX +- spread, hy); arms pass behind the head."""
    head = np.zeros((SIZE, SIZE), bool)
    head[:150] = opaque(a)[:150]
    sy = 167 + dy
    for side in (1, -1):
        sh = (CX + side * 38, sy)
        hand = (CX + side * spread, hy)
        elbow = ((sh[0] + hand[0]) / 2 + side * 12, (sh[1] + hand[1]) / 2)
        a = draw_limb(a, [sh, elbow, hand], kind, side, behind=head)
    return a


def anim_stretch() -> Frames:
    base = hide_hands(BASE, True, True)
    happy = paint_eyes(base, eye_arch(EYE_L, 7) | eye_arch(EYE_R, 7))
    sq = eye_cut(EYE_L, 0.4, 0.0) | eye_cut(EYE_R, 0.4, 0.0)
    half = paint_eyes(base, sq)
    f0 = body_squash(BASE, 3)
    f1 = draw_limb(draw_limb(body_stretch(half, 2), [SH_R, (CX + 62, 160), (CX + 70, 128)], "open", 1),
                   [SH_L, (CX - 62, 160), (CX - 70, 128)], "open", -1)
    s2 = body_stretch(happy, 5)
    f2 = big_arms(s2, 78, 30, dy=-4)
    s3 = body_stretch(happy, 8)
    f3 = big_arms(s3, 70, 14, dy=-6)
    s4 = body_stretch(half, 3)
    f4 = draw_limb(draw_limb(s4, [SH_R, (CX + 60, 182), (CX + 64, 204)], "fist", 1),
                   [SH_L, (CX - 60, 182), (CX - 64, 204)], "fist", -1)
    return [f0, f1, f2, f3, f4, BASE]


def anim_yawn() -> Frames:
    def eyes(frac: float) -> np.ndarray:
        return eye_cut(EYE_L, frac, 0.0) | eye_cut(EYE_R, frac, 0.0)
    body = hide_hands(BASE, True, False)
    arm = [SH_R, (CX + 52, 182), (CX + 20, 140)]
    f0 = mouth(paint_eyes(BASE, eyes(0.3)), 6, 4)
    f1 = mouth(body_stretch(paint_eyes(BASE, eyes(0.55)), 2), 12, 9, cy=135)
    f2 = mouth(body_stretch(paint_eyes(body, eyes(0.75)), 3), 14, 11, cy=134)
    f2 = draw_limb(f2, [SH_R, (CX + 52, 180), (CX + 26, 138)], "mouth", 1)
    f3 = mouth(body_stretch(paint_eyes(body, eyes(0.6)), 1), 8, 5, cy=136)
    f3 = draw_limb(f3, arm, "mouth", 1)
    f3 = stamp_c(f3, PUFF_S, 196, 92, {"x": LAV})
    return [f0, f1, f2, f3, BASE]


def anim_scratch() -> Frames:
    body = hide_hands(paint_eyes(BASE, eye_cut(EYE_L, 0.2, 0.15) | mshift(EYE_R, 0, -2)), True, False)
    out = []
    for i in range(4):
        hy = 54 if i % 2 == 0 else 50
        f = head_tilt(body, -2)
        head = np.zeros((SIZE, SIZE), bool)
        head[:150] = opaque(f)[:150]
        f = draw_limb(f, [SH_R, (CX + 82, 120), (CX + 60, hy)], "open", 1, behind=head)
        if i % 2 == 0:
            f = stamp_c(f, QMARK, 62, 18 - (i // 2) * 2, {"x": YELLOW})
        out.append(f)
    return out


def anim_shoot_web() -> Frames:
    eyes = mshift(EYES, 4, 0)
    body = hide_hands(paint_eyes(BASE, eyes), True, False)
    body = head_tilt(body, 3)
    hy = 160
    out = []
    # f0: arm on its way out (bent), f1: straight + wrist flick, f2-4: web grows, f5: idle
    f0 = draw_limb(lean(body, 2, pivot=206), [SH_R, (CX + 52, 184), (CX + 66, 170)], "fist", 1)
    out.append(f0)
    arm = lambda f: draw_limb(f, [SH_R, (CX + 46, hy + 3), (CX + 70, hy)], "flick", 1)
    base1 = arm(lean(body, 3, pivot=206))
    out.append(base1)
    hand_x = CX + 80
    for k, x1 in enumerate([CX + 98, CX + 116, SIZE]):
        f = web_line(base1, hand_x, x1, hy - 2)
        if k == 2:
            f = stamp_c(f, SPLAT, 238, hy, {"x": WHITE, "o": LAV})
        else:
            f = stamp_c(f, STAR_S, x1, hy, {"x": WHITE})
        out.append(f)
    out.append(BASE)
    return out


def anim_thumbs_up() -> Frames:
    body = hide_hands(BASE, True, False)
    wink = paint_eyes(body, EYE_L | eye_arch(EYE_R, 7))
    f0 = draw_limb(body, [SH_R, (CX + 56, 188), (CX + 62, 194)], "fist", 1)
    f1 = draw_limb(body_squash(body, 1), [SH_R, (CX + 62, 186), (CX + 70, 160)], "fist", 1)
    up = [SH_R, (CX + 66, 184), (CX + 72, 128)]
    f2 = draw_limb(body_stretch(wink, 1), up, "thumb", 1)
    f3 = stamp_c(f2, SPARK, CX + 92, 98, {"x": YELLOW, "o": WHITE})
    return [f0, f1, f2, f3]


def anim_laugh() -> Frames:
    happy = paint_eyes(BASE, eye_arch(EYE_L, 7) | eye_arch(EYE_R, 7))
    bounce = [3, 0, 3, 0]
    tilt = [-1, 1, 1, -1]
    out = []
    for i in range(4):
        f = mouth(happy, 12 if i % 2 == 0 else 10, 7 if i % 2 == 0 else 5)
        f = bounce_f(f, bounce[i])
        f = lean(f, tilt[i] * 2)
        left = i < 2
        y = 52 - (i % 2) * 8
        f = stamp_c(f, HA, 34 if left else 222, y, {"x": YELLOW if left else WHITE})
        out.append(f)
    return out


def anim_shrug() -> Frames:
    body = hide_hands(BASE, True, True)
    sq = eye_cut(EYE_L, 0.3, -0.12) | eye_cut(EYE_R, 0.3, 0.12)
    body_sq = paint_eyes(body, sq)

    def arms(f: RGBA, t: float, kind: str) -> RGBA:
        for side in (1, -1):
            elbow = (CX + side * (52 + 6 * t), 184 + 2 * t)
            hand = (CX + side * (60 + 22 * t), 190 - 30 * t)
            f = draw_limb(f, [(CX + side * 38, 167), elbow, hand], kind, side)
        return f

    f0 = arms(body, 0.2, "fist")
    f1 = arms(head_tilt(body_sq, 1), 0.6, "palm")
    # shoulders up: the head sinks 3px into the hood
    sunk = squash(body_sq, pick_rows(140, 156, 3))
    f2 = arms(head_tilt(sunk, 3), 1.0, "palm")
    f3 = arms(head_tilt(squash(body_sq, pick_rows(140, 156, 2)), 3), 1.0, "palm")
    return [f0, f1, f2, f3]


def kick_leg(a: RGBA, deg: float, ext: int = 0) -> RGBA:
    """Swing the right leg (screen-right) out about the hip by `deg` (exact
    three-shear rotation, no resampling); `ext` rows are duplicated in the
    shin first so the extended leg reaches further. The hip stub and the
    hoodie hem stay in front."""
    x0, x1, y0 = CX + 1, 176, 207
    leg = a.copy()
    if ext:
        leg = stretch(leg, pick_rows(216, 230, ext), x0, x1)
        leg = translate(leg, 0, ext)  # stretch grew it upward; push it back down
    sub = np.zeros_like(a)
    sub[y0:, x0:x1] = leg[y0:, x0:x1]
    rest = a.copy()
    rest[y0 + 6 :, x0:x1] = 0
    rot = paeth_rotate(sub, -math.radians(deg), 148, y0)
    out = rest.copy()
    m = opaque(rot) & ~opaque(rest)
    out[m] = rot[m]
    return out


def foot_tip(a: RGBA) -> Tuple[int, int]:
    m = opaque(a)
    m[:196] = False
    m[:, :CX] = False
    ys, xs = np.where(m)
    k = int(np.argmax(xs))
    return int(xs[k]), int(ys[k])


def anim_kick() -> Frames:
    det = paint_eyes(BASE, eye_cut(EYE_L, 0.35, 0.2) | eye_cut(EYE_R, 0.35, -0.2))
    f0 = lean(lift_leg2(body_squash(det, 2), "R", 6), -3, pivot=206)
    f1 = lean(kick_leg(det, 30, 4), -5, pivot=206)
    f2 = lean(kick_leg(det, 72, 10), -8, pivot=206)
    tx, ty = foot_tip(f2)
    f2 = stamp_c(f2, STAR, tx + 14, ty - 4, {"x": YELLOW, "o": WHITE})
    f2 = stamp_c(f2, STAR_S, tx + 30, ty - 22, {"x": WHITE})
    f3 = lean(kick_leg(BASE, 24, 2), -2, pivot=206)
    return [f0, f1, f2, f3, BASE]


def anim_sneeze() -> Frames:
    sq1 = eye_cut(EYE_L, 0.45, 0.0) | eye_cut(EYE_R, 0.45, 0.0)
    shut = eyes_closed(4)
    f0 = lean(body_stretch(paint_eyes(BASE, sq1), 1), -4)
    f1 = mouth(lean(body_stretch(paint_eyes(BASE, shut), 3), -8), 6, 4, cy=136)
    burst = lean(body_squash(paint_eyes(BASE, shut), 4), 10)
    spray = [(198, 130, PUFF), (226, 112, PUFF_S), (232, 146, PUFF_S), (246, 128, DOT)]
    f2 = burst
    for x, y, p in spray:
        f2 = stamp_c(f2, p, x, y, {"x": WHITE})
    f2 = stamp_c(f2, BANG, 212, 56, {"x": YELLOW})
    f3 = lean(body_squash(paint_eyes(BASE, eyes_closed(5)), 2), 5)
    for x, y, p in [(234, 116, PUFF_S), (242, 144, PUFF_S)]:
        f3 = stamp_c(f3, p, x, y, {"x": LAV})
    f3 = stamp_c(f3, BANG, 214, 50, {"x": YELLOW})
    f4 = lean(paint_eyes(BASE, sq1), 1)
    return [f0, f1, f2, f3, f4, BASE]


ANIMS: Dict[str, Tuple[Callable[[], Frames], int, bool]] = {
    "idle": (anim_idle, 4, True),
    "blink": (anim_blink, 1, False),
    "look-left": (anim_look_left, 1, False),
    "look-right": (anim_look_right, 1, False),
    "walk": (anim_walk, 10, True),
    "hop": (anim_hop, 14, False),
    "dance": (anim_dance, 8, True),
    "wave": (anim_wave, 8, True),
    "typing": (anim_typing, 10, True),
    "sleep": (anim_sleep, 3, True),
    "love": (anim_love, 8, True),
    "dizzy": (anim_dizzy, 10, True),
    "surprised": (anim_surprised, 12, False),
    "annoyed": (anim_annoyed, 6, True),
    "dangle": (anim_dangle, 6, True),
    "fall": (anim_fall, 10, True),
    "land": (anim_land, 14, False),
    "celebrate": (anim_celebrate, 8, True),
    "loading": (anim_loading, 8, True),
    "run": (anim_run, 14, True),
    "climb": (anim_climb, 8, True),
    "sit": (anim_sit, 3, True),
    "stretch": (anim_stretch, 8, False),
    "yawn": (anim_yawn, 6, False),
    "scratch": (anim_scratch, 8, True),
    "shoot-web": (anim_shoot_web, 14, False),
    "thumbs-up": (anim_thumbs_up, 10, False),
    "laugh": (anim_laugh, 10, True),
    "shrug": (anim_shrug, 10, False),
    "kick": (anim_kick, 14, False),
    "sneeze": (anim_sneeze, 12, False),
}


# ----------------------------------------------------------------- output ---

def to_palette(strip: RGBA) -> Image.Image:
    """Exact RGBA -> P conversion (no dithering, no quantisation)."""
    h, w, _ = strip.shape
    flat = strip.reshape(-1, 4).copy()
    flat[flat[:, 3] == 0] = 0
    cols, inv = np.unique(flat, axis=0, return_inverse=True)
    if len(cols) > 256:
        raise SystemExit(f"too many colours ({len(cols)})")
    order = np.argsort([0 if c[3] == 0 else 1 for c in cols], kind="stable")
    remap = np.empty_like(order)
    remap[order] = np.arange(len(order))
    cols = cols[order]
    img = Image.fromarray(remap[inv.reshape(-1)].reshape(h, w).astype(np.uint8), "P")
    pal = cols[:, :3].astype(np.uint8).flatten().tolist()
    img.putpalette(pal + [0] * (768 - len(pal)))
    img.info["transparency"] = bytes(cols[:, 3].astype(np.uint8).tolist())
    return img


def check(name: str, frames: Frames) -> None:
    for i, f in enumerate(frames):
        assert f.shape == (SIZE, SIZE, 4) and f.dtype == np.uint8, name
        al = np.unique(f[:, :, 3])
        assert set(al.tolist()) <= {0, 255}, (name, i, al)


def contact_sheet(strips: List[Tuple[str, Frames]], path: str) -> None:
    maxf = max(len(f) for _, f in strips)
    W = maxf * SIZE
    rowh = SIZE + 128 + 8
    sheet = Image.new("RGBA", (W, rowh * len(strips)), (40, 40, 48, 255))
    for r, (name, frames) in enumerate(strips):
        y = r * rowh
        for i, f in enumerate(frames):
            tile = Image.new("RGBA", (SIZE, SIZE), (150, 150, 165, 255))
            tile.alpha_composite(Image.fromarray(f, "RGBA"))
            sheet.paste(tile, (i * SIZE, y))
            small = Image.fromarray(f, "RGBA").resize((128, 128), Image.LANCZOS)
            for j, bg in enumerate([(11, 11, 16, 255), (0, 128, 128, 255)]):
                t = Image.new("RGBA", (128, 128), bg)
                t.alpha_composite(small)
                sheet.paste(t, (i * 256 + j * 128, y + SIZE + 4))
    sheet.save(path)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", help="write a contact sheet (256px frames + 128px on dark/teal)")
    ap.add_argument("--gifs", help="directory for 128px GIF previews of every animation")
    ap.add_argument("--only", help="comma-separated animation names to build (debug)")
    args = ap.parse_args()

    os.makedirs(OUTDIR, exist_ok=True)
    manifest: Dict[str, dict] = {}
    built: List[Tuple[str, Frames]] = []
    total = 0
    names = list(ANIMS)
    if args.only:
        names = [n for n in names if n in args.only.split(",")]
    for name in names:
        fn, fps, loop = ANIMS[name]
        frames = fn()
        check(name, frames)
        strip = np.concatenate(frames, axis=1)
        img = to_palette(strip)
        path = os.path.join(OUTDIR, f"{name}.png")
        img.save(path, optimize=True, transparency=img.info["transparency"])
        size = os.path.getsize(path)
        total += size
        manifest[name] = {"frames": len(frames), "fps": fps, "loop": loop}
        built.append((name, frames))
        print(f"{name:11s} {len(frames)} fr {fps:2d} fps  {size / 1024:5.1f} KB")

    if not args.only:
        with open(os.path.join(OUTDIR, "anims.json"), "w") as fh:
            json.dump(manifest, fh, indent=2)
            fh.write("\n")
    print(f"total: {total / 1024:.1f} KB")

    if args.preview:
        contact_sheet(built, args.preview)
    if args.gifs:
        os.makedirs(args.gifs, exist_ok=True)
        for name, frames in built:
            fps = ANIMS[name][1]
            ims = []
            for f in frames:
                t = Image.new("RGBA", (128, 128), (0, 128, 128, 255))
                t.alpha_composite(Image.fromarray(f, "RGBA").resize((128, 128), Image.LANCZOS))
                ims.append(t.convert("RGB"))
            ims[0].save(os.path.join(args.gifs, f"{name}.gif"), save_all=True, append_images=ims[1:],
                        duration=int(1000 / fps), loop=0)


if __name__ == "__main__":
    main()
