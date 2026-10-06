#!/usr/bin/env python3
"""Bake desktop-size PNGs from the pixel icon source of truth.

Parses the 16x16 role maps in src/lib/pixel-icons.ts and renders selected icons at
4x (64x64, nearest-neighbour) with the fixed dark-theme palette into
public/icons/app-<name>.png as palette-quantized PNG-8 with 1-bit transparency.

Usage:
  python3 scripts/icons/render_icons.py                 # write app-*.png
  python3 scripts/icons/render_icons.py --sheet out.png # also write a preview sheet
                                                        # (dark + classic themes)
  python3 scripts/icons/render_icons.py --force         # overwrite existing PNGs
"""
import argparse
import os
import re
import sys

from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'src', 'lib', 'pixel-icons.ts')
OUT_DIR = os.path.join(ROOT, 'public', 'icons')

APP_ICONS = ['about', 'github', 'projects', 'skills', 'lab', 'resume', 'contact', 'terminal', 'explorer',
             'jukebox', 'paint', 'settings', 'snake', 'minesweeper']

DARK = {
    'k': '#0B0B10', 'w': '#FFFFFF', 'a': '#212CF4', 'l': '#C3C6ED', 'g': '#72FFB4',
    'r': '#FF3A66', 'y': '#FFE55C', 's': '#B0B3BC', 'd': '#4a4a5a', 'c': '#FFFFFF',
}
CLASSIC = {
    'k': '#404040', 'w': '#FFFFFF', 'a': '#000080', 'l': '#404060', 'g': '#007030',
    'r': '#B00020', 'y': '#805000', 's': '#808080', 'd': '#4a4a5a', 'c': '#000000',
}


def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def parse_icons(path=SRC):
    text = open(path, encoding='utf-8').read()
    body = text[text.index('PIXEL_ICONS'):]
    icons = {}
    for m in re.finditer(r"'([a-z0-9-]+)':\s*\{\s*size:\s*16,\s*rows:\s*\[(.*?)\]", body, re.S):
        rows = re.findall(r"'([^']*)'", m.group(2))
        if len(rows) != 16 or any(len(r) != 16 for r in rows):
            sys.exit(f'icon {m.group(1)!r} is not 16x16')
        icons[m.group(1)] = rows
    if not icons:
        sys.exit('no icons parsed from ' + path)
    return icons


def render(rows, palette, scale=4, bg=None):
    img = Image.new('RGBA', (16 * scale, 16 * scale), bg + (255,) if bg else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == '.':
                continue
            if ch not in palette:
                sys.exit(f'unknown role {ch!r}')
            c = hex_rgb(palette[ch])
            d.rectangle([x * scale, y * scale, (x + 1) * scale - 1, (y + 1) * scale - 1], fill=c + (255,))
    return img


def to_png8(img):
    """Exact palette quantization (icons use <16 colours) with index 0 transparent."""
    rgba = img.convert('RGBA')
    raw = rgba.tobytes()
    px = [tuple(raw[i:i + 4]) for i in range(0, len(raw), 4)]
    colours = sorted({p[:3] for p in px if p[3]})
    pal = [(255, 0, 255)] + colours
    lut = {c: i + 1 for i, c in enumerate(colours)}
    out = Image.new('P', rgba.size, 0)
    out.putdata([lut[p[:3]] if p[3] else 0 for p in px])
    flat = [v for c in pal for v in c]
    out.putpalette(flat + [0] * (768 - len(flat)))
    out.info['transparency'] = 0
    return out


def sheet(icons, path):
    names = list(icons)
    cols, cell, scale = 8, 80, 4
    rows_n = (len(names) + cols - 1) // cols
    W = cols * cell
    img = Image.new('RGB', (W * 2 + 20, rows_n * (cell + 14) + 10), (60, 60, 60))
    d = ImageDraw.Draw(img)
    for half, (pal, bg) in enumerate([(DARK, (23, 23, 34)), (CLASSIC, (192, 192, 192))]):
        ox = half * (W + 20)
        d.rectangle([ox, 0, ox + W - 1, img.height], fill=bg)
        for i, n in enumerate(names):
            x = ox + (i % cols) * cell + 8
            y = (i // cols) * (cell + 14) + 6
            ic = render(icons[n], pal, scale)
            img.paste(ic, (x, y), ic)
            small = render(icons[n], pal, 1)
            img.paste(small, (x + 66, y + 4), small)
            d.text((x, y + 66), n, fill=(255, 255, 255) if half == 0 else (0, 0, 0))
    img.save(path)
    print('sheet ->', path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sheet')
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--no-png', action='store_true')
    a = ap.parse_args()
    icons = parse_icons()
    if a.sheet:
        sheet(icons, a.sheet)
    if a.no_png:
        return
    for n in APP_ICONS:
        dst = os.path.join(OUT_DIR, f'app-{n}.png')
        if os.path.exists(dst) and not a.force:
            print('skip (exists, use --force):', dst)
            continue
        to_png8(render(icons[n], DARK, 4)).save(dst, optimize=True)
        print('wrote', os.path.relpath(dst, ROOT))


if __name__ == '__main__':
    main()
