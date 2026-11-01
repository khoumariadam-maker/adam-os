'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Window } from '../Window';
import { PixelIcon } from '@/components/PixelIcon';
import type { SpiderFrame } from '@/components/mascot/anims';
import { useSound } from '@/context/SoundContext';
import { useMascot } from '@/context/MascotContext';
import { useWindowManager } from '@/context/WindowManagerContext';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { readJSON, writeStorage } from '@/lib/storage';

/* ------------------------------------------------------------------ */
/* Model                                                               */
/* ------------------------------------------------------------------ */

type GridSize = 16 | 32;
type Px = (string | null)[]; // null = empty (transparent in the exported PNG)
type Tool = 'pencil' | 'eraser' | 'fill' | 'picker' | 'line';
type Cell = { x: number; y: number };

interface Snapshot {
  size: GridSize;
  px: Px;
}

interface SavedArt {
  v: 2;
  size: GridSize;
  px: Px;
  color: string;
  recent: string[];
}

interface Stroke {
  pointerId: number;
  tool: Tool;
  before: Snapshot;
  rect: DOMRect;
  start: Cell;
  last: Cell;
  changed: boolean;
  value: string | null;
}

const STORAGE_KEY = 'adam_os_paint_v2';
const SAVE_DEBOUNCE_MS = 500;
const MAX_HISTORY = 50;
const MAX_RECENT = 6;
const EXPORT_PX = 512;
const FRAME_PX = 4; // 2px border on each side
const DEFAULT_COLOR = '#212CF4';
const HEX_RE = /^#[0-9A-F]{6}$/;

// Empty cells are a dark checkerboard (WYSIWYG with the transparent PNG export).
const EMPTY_A = '#0B0B10';
const EMPTY_B = '#13131C';

const PALETTE: ReadonlyArray<{ hex: string; name: string }> = [
  { hex: '#0B0B10', name: 'Night' },
  { hex: '#171722', name: 'Panel' },
  { hex: '#1F1F2E', name: 'Panel dark' },
  { hex: '#212CF4', name: 'Spidey blue' },
  { hex: '#5E66FF', name: 'Periwinkle' },
  { hex: '#C3C6ED', name: 'Lavender' },
  { hex: '#FFFFFF', name: 'White' },
  { hex: '#E1E2E7', name: 'Mist' },
  { hex: '#B0B3BC', name: 'Slate' },
  { hex: '#72FFB4', name: 'Mint' },
  { hex: '#FFE55C', name: 'Yellow' },
  { hex: '#FF9F43', name: 'Orange' },
  { hex: '#FF3A66', name: 'Red' },
  { hex: '#FF8FB1', name: 'Pink' },
  { hex: '#8B5A2B', name: 'Brown' },
  { hex: '#000000', name: 'Black' },
];
const PALETTE_NAME = new Map(PALETTE.map((p) => [p.hex, p.name]));
const colorName = (hex: string) => PALETTE_NAME.get(hex) ?? hex;

const TOOL_LABEL: Record<Tool, string> = {
  pencil: 'Pencil',
  eraser: 'Eraser',
  fill: 'Fill bucket',
  picker: 'Eyedropper',
  line: 'Line',
};
const TOOL_KEY: Record<Tool, string> = { pencil: 'P', eraser: 'E', fill: 'F', picker: 'I', line: 'L' };
const TOOLS: Tool[] = ['pencil', 'eraser', 'fill', 'picker', 'line'];
const KEY_TOOL: Record<string, Tool> = { KeyP: 'pencil', KeyB: 'pencil', KeyE: 'eraser', KeyF: 'fill', KeyI: 'picker', KeyL: 'line' };

const blank = (n: GridSize): Px => new Array<string | null>(n * n).fill(null);
const normHex = (v: string): string | null => {
  const s = v.trim().toUpperCase();
  return HEX_RE.test(s) ? s : null;
};
const countPainted = (px: Px) => px.reduce((n, c) => (c === null ? n : n + 1), 0);
// Black or white marker that stays visible on any swatch.
const contrastOf = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#000000' : '#FFFFFF';
};

const parseSaved = (raw: unknown): SavedArt | null => {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Partial<Record<keyof SavedArt, unknown>>;
  const size = o.size === 32 ? 32 : o.size === 16 ? 16 : null;
  if (!size || !Array.isArray(o.px) || o.px.length !== size * size) return null;
  const px: Px = o.px.map((c) => (typeof c === 'string' ? normHex(c) : null));
  const color = (typeof o.color === 'string' && normHex(o.color)) || DEFAULT_COLOR;
  const recent = Array.isArray(o.recent)
    ? o.recent.flatMap((c) => {
        const h = typeof c === 'string' ? normHex(c) : null;
        return h ? [h] : [];
      }).slice(0, MAX_RECENT)
    : [];
  return { v: 2, size, px, color, recent };
};

// Integer line between two cells (inclusive), so fast strokes leave no gaps.
const bresenham = (a: Cell, b: Cell, plot: (x: number, y: number) => void) => {
  let { x, y } = a;
  const dx = Math.abs(b.x - x);
  const dy = -Math.abs(b.y - y);
  const sx = x < b.x ? 1 : -1;
  const sy = y < b.y ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 10000; guard++) {
    plot(x, y);
    if (x === b.x && y === b.y) return;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
};

// 4-connected flood fill. Returns true if anything changed.
const floodFill = (px: Px, n: number, sx: number, sy: number, value: string | null): boolean => {
  if (sx < 0 || sy < 0 || sx >= n || sy >= n) return false;
  const target = px[sy * n + sx];
  if (target === value) return false;
  const stack = [sy * n + sx];
  while (stack.length) {
    const i = stack.pop();
    if (i === undefined) break;
    if (px[i] !== target) continue;
    px[i] = value;
    const x = i % n;
    if (x > 0) stack.push(i - 1);
    if (x < n - 1) stack.push(i + 1);
    if (i >= n) stack.push(i - n);
    if (i < n * n - n) stack.push(i + n);
  }
  return true;
};

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/* ------------------------------------------------------------------ */
/* Tool glyphs (16x16, currentColor)                                   */
/* ------------------------------------------------------------------ */

type GlyphName = Tool | 'mirror' | 'grid' | 'undo' | 'redo' | 'trash' | 'brush1' | 'brush2';

const UNDO_ROWS = [
  '................',
  '................',
  '....#...........',
  '...##...........',
  '..##########....',
  '.############...',
  '..##.......###..',
  '...#........###.',
  '.............##.',
  '.............##.',
  '.............##.',
  '............###.',
  '....##########..',
  '....#########...',
  '................',
  '................',
];

const GLYPH_ROWS: Record<GlyphName, string[]> = {
  pencil: [
    '.............#..',
    '............###.',
    '...........#####',
    '..........#.###.',
    '.........#####..',
    '........#####...',
    '.......#####....',
    '......#####.....',
    '.....#####......',
    '....#####.......',
    '...#####........',
    '...####.........',
    '..###...........',
    '..##............',
    '.#..............',
    '................',
  ],
  eraser: [
    '................',
    '................',
    '................',
    '........#######.',
    '.......#.....##.',
    '......#.....#.#.',
    '.....#.....####.',
    '....#######.###.',
    '...#######.###..',
    '..#######.###...',
    '..#######.##....',
    '..#######.#.....',
    '..#########.....',
    '................',
    '.############...',
    '................',
  ],
  fill: [
    '................',
    '....##..........',
    '...#..#.........',
    '...#..##........',
    '...#.####.......',
    '...######.#.....',
    '..########.#....',
    '.##########.#...',
    '..##########.#..',
    '...#########.#..',
    '....#######..##.',
    '.....#####...##.',
    '......###....##.',
    '.......#......#.',
    '................',
    '................',
  ],
  picker: [
    '............###.',
    '...........#####',
    '...........#####',
    '..........######',
    '.........####...',
    '........#.##....',
    '.......#.#......',
    '......#.#.......',
    '.....#.#........',
    '....#.#.........',
    '...#.#..........',
    '..#.#...........',
    '..##............',
    '.#..............',
    '................',
    '................',
  ],
  line: Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => (y >= 1 && y <= 14 && (x === 15 - y || x === 14 - y) ? '#' : '.')).join('')
  ),
  mirror: [
    '................',
    '.......##.......',
    '................',
    '.....#.##.#.....',
    '....##....##....',
    '...###.##.###...',
    '..####....####..',
    '.#####.##.#####.',
    '..####....####..',
    '...###.##.###...',
    '....##....##....',
    '.....#.##.#.....',
    '................',
    '.......##.......',
    '................',
    '................',
  ],
  grid: Array.from({ length: 16 }, (_, y) => {
    if (y < 1 || y > 13) return '................';
    if (y % 4 === 1) return '.#############..';
    return '.#...#...#...#..';
  }),
  undo: UNDO_ROWS,
  redo: UNDO_ROWS.map((r) => r.split('').reverse().join('')),
  trash: [
    '................',
    '......####......',
    '..############..',
    '..############..',
    '................',
    '...##########...',
    '...#.#.##.#.#...',
    '...#.#.##.#.#...',
    '...#.#.##.#.#...',
    '...#.#.##.#.#...',
    '...#.#.##.#.#...',
    '...#.#.##.#.#...',
    '...##########...',
    '....########....',
    '................',
    '................',
  ],
  brush1: Array.from({ length: 16 }, (_, y) => (y >= 6 && y <= 9 ? '......####......' : '................')),
  brush2: Array.from({ length: 16 }, (_, y) => (y >= 4 && y <= 11 ? '....########....' : '................')),
};

const glyphRuns = (rows: string[]) => {
  const runs: Array<[number, number, number]> = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== '#') {
        x++;
        continue;
      }
      let end = x + 1;
      while (end < row.length && row[end] === '#') end++;
      runs.push([x, y, end - x]);
      x = end;
    }
  });
  return runs;
};
const GLYPH_RUNS = Object.fromEntries(
  (Object.keys(GLYPH_ROWS) as GlyphName[]).map((k) => [k, glyphRuns(GLYPH_ROWS[k])])
) as Record<GlyphName, Array<[number, number, number]>>;

const Glyph: React.FC<{ name: GlyphName; size?: number }> = ({ name, size = 16 }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden focusable="false" style={{ flexShrink: 0 }}>
    {GLYPH_RUNS[name].map(([x, y, w], i) => (
      <rect key={i} x={x} y={y} width={w} height={1} fill="currentColor" />
    ))}
  </svg>
);

const Sep: React.FC = () => <span aria-hidden className="w-px self-stretch my-1 mx-0.5 shrink-0 bg-slate/40" />;

/* ------------------------------------------------------------------ */
/* Window                                                              */
/* ------------------------------------------------------------------ */

export const PaintWindow: React.FC = () => {
  const { playClick, playPop, playDownloadFanfare } = useSound();
  const { react } = useMascot();
  const { windows, activeWindowId } = useWindowManager();
  const isMobile = useIsMobile();
  const reducedMotion = useReducedMotion();

  const win = windows.paint;
  const visible = win.isOpen && !win.isMinimized;
  const isActive = activeWindowId === 'paint';

  const [size, setSize] = useState<GridSize>(16);
  const [tool, setTool] = useState<Tool>('pencil');
  const [brush, setBrush] = useState<1 | 2>(1);
  const [mirror, setMirror] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [recent, setRecent] = useState<string[]>([]);
  const [hist, setHist] = useState({ undo: 0, redo: 0 });
  const [painted, setPainted] = useState(0);
  const [rev, setRev] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [confirmSize, setConfirmSize] = useState<GridSize | null>(null);
  const [cell, setCell] = useState(16);
  const [dpr, setDpr] = useState(1);
  const [kbdCursor, setKbdCursor] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [mod, setMod] = useState<'Ctrl' | 'Cmd'>('Ctrl');

  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const sizeRef = useRef<GridSize>(16);
  const pixelsRef = useRef<Px>(blank(16));
  const undoRef = useRef<Snapshot[]>([]);
  const redoRef = useRef<Snapshot[]>([]);
  const strokeRef = useRef<Stroke | null>(null);
  const pointersRef = useRef<Set<number>>(new Set());
  const blockedRef = useRef(false); // a second finger cancelled the stroke: ignore until all fingers lift
  const hoverRef = useRef<Cell | null>(null);
  const cursorRef = useRef<Cell>({ x: 8, y: 8 });
  const anchorRef = useRef<Cell | null>(null); // keyboard line start
  const rafRef = useRef(0);

  const boardPx = cell * size;

  // Latest view state for the (stable) draw function and global listeners.
  const viewRef = useRef({ showGrid, mirror, brush, tool, color, kbdCursor, visible, isActive, isMobile });
  viewRef.current = { showGrid, mirror, brush, tool, color, kbdCursor, visible, isActive, isMobile };

  /* ---------------- rendering ---------------- */

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const n = sizeRef.current;
    const px = pixelsRef.current;
    const v = viewRef.current;
    const W = canvas.width;
    const H = canvas.height;
    const ex = (i: number) => Math.round((i * W) / n);
    const ey = (i: number) => Math.round((i * H) / n);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;

    for (let y = 0; y < n; y++) {
      const y0 = ey(y);
      const h = ey(y + 1) - y0;
      for (let x = 0; x < n; x++) {
        const x0 = ex(x);
        ctx.fillStyle = px[y * n + x] ?? ((x + y) % 2 ? EMPTY_B : EMPTY_A);
        ctx.fillRect(x0, y0, ex(x + 1) - x0, h);
      }
    }

    const lw = Math.max(1, Math.round(W / Math.max(1, canvas.clientWidth || W)));
    if (v.showGrid && W / n >= 4) {
      const major = n === 32 ? 8 : 4;
      for (let i = 1; i < n; i++) {
        ctx.fillStyle = i % major === 0 ? 'rgba(195,198,237,0.32)' : 'rgba(195,198,237,0.13)';
        ctx.fillRect(ex(i), 0, lw, H);
        ctx.fillRect(0, ey(i), W, lw);
      }
    }
    if (v.mirror) {
      ctx.fillStyle = 'rgba(94,102,255,0.9)';
      const dash = Math.max(2, Math.round(H / n / 2));
      for (let y = 0; y < H; y += dash * 2) ctx.fillRect(Math.round(W / 2) - lw, y, lw * 2, dash);
    }

    const box = (c: Cell, span: number, stroke: string, width: number) => {
      const x0 = ex(Math.max(0, c.x));
      const y0 = ey(Math.max(0, c.y));
      const x1 = ex(Math.min(n, c.x + span));
      const y1 = ey(Math.min(n, c.y + span));
      if (x1 <= x0 || y1 <= y0) return;
      ctx.strokeStyle = 'rgba(11,11,16,0.85)';
      ctx.lineWidth = width + 2 * lw;
      ctx.strokeRect(x0 + width / 2, y0 + width / 2, x1 - x0 - width, y1 - y0 - width);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.strokeRect(x0 + width / 2, y0 + width / 2, x1 - x0 - width, y1 - y0 - width);
    };
    const span = v.tool === 'pencil' || v.tool === 'eraser' ? v.brush : 1;
    if (anchorRef.current) box(anchorRef.current, 1, '#72FFB4', 2 * lw);
    if (hoverRef.current && !strokeRef.current) box(hoverRef.current, span, 'rgba(255,255,255,0.9)', lw);
    if (v.kbdCursor) box(cursorRef.current, span, '#FFE55C', 2 * lw);
  }, []);

  const requestDraw = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      draw();
    });
  }, [draw]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  useIsoLayoutEffect(() => {
    if (visible) draw();
  }, [visible, draw, size, cell, dpr, showGrid, mirror, brush, tool, kbdCursor, loaded, rev]);

  /* ---------------- history + persistence ---------------- */

  const syncHist = () => setHist({ undo: undoRef.current.length, redo: redoRef.current.length });

  // Called after every committed change (stroke, fill, undo...).
  const markDirty = () => {
    setPainted(countPainted(pixelsRef.current));
    setRev((r) => r + 1);
  };

  const pushUndo = (snap: Snapshot) => {
    undoRef.current.push(snap);
    if (undoRef.current.length > MAX_HISTORY) undoRef.current.shift();
    redoRef.current = [];
    syncHist();
  };

  const snapshot = (): Snapshot => ({ size: sizeRef.current, px: pixelsRef.current.slice() });

  const applySnapshot = (s: Snapshot) => {
    pixelsRef.current = s.px.slice();
    if (s.size !== sizeRef.current) {
      sizeRef.current = s.size;
      setSize(s.size);
      anchorRef.current = null;
      cursorRef.current = { x: Math.min(cursorRef.current.x, s.size - 1), y: Math.min(cursorRef.current.y, s.size - 1) };
    }
    markDirty();
    requestDraw();
  };

  const addRecent = (c: string) => setRecent((prev) => [c, ...prev.filter((p) => p !== c)].slice(0, MAX_RECENT));

  const undo = () => {
    if (strokeRef.current) return;
    const s = undoRef.current.pop();
    if (!s) return;
    redoRef.current.push(snapshot());
    applySnapshot(s);
    syncHist();
    playClick();
    setAnnouncement('Undone.');
  };

  const redo = () => {
    if (strokeRef.current) return;
    const s = redoRef.current.pop();
    if (!s) return;
    undoRef.current.push(snapshot());
    applySnapshot(s);
    syncHist();
    playClick();
    setAnnouncement('Redone.');
  };

  // Restore the saved drawing on first mount.
  useEffect(() => {
    const saved = parseSaved(readJSON<unknown>(STORAGE_KEY, null));
    if (saved) {
      sizeRef.current = saved.size;
      pixelsRef.current = saved.px;
      setSize(saved.size);
      setColor(saved.color);
      setRecent(saved.recent);
      setPainted(countPainted(saved.px));
    }
    setLoaded(true);
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setMod('Cmd');
  }, []);

  const recentRef = useRef<string[]>(recent);
  recentRef.current = recent;
  const pendingSaveRef = useRef(false);

  const saveNow = useCallback(() => {
    const data: SavedArt = {
      v: 2,
      size: sizeRef.current,
      px: pixelsRef.current,
      color: viewRef.current.color,
      recent: recentRef.current,
    };
    writeStorage(STORAGE_KEY, JSON.stringify(data));
  }, []);

  // Debounced autosave.
  useEffect(() => {
    if (!loaded) return;
    pendingSaveRef.current = true;
    const t = window.setTimeout(() => {
      pendingSaveRef.current = false;
      saveNow();
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [loaded, rev, color, recent, saveNow]);

  // Flush a pending save when the page goes away or the component unmounts.
  useEffect(() => {
    const flush = () => {
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        saveNow();
      }
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [saveNow]);

  /* ---------------- drawing ops ---------------- */

  // Paint one brush stamp (plus its mirror image). Returns true if a pixel changed.
  const stamp = (px: Px, x: number, y: number, value: string | null, span: number): boolean => {
    const n = sizeRef.current;
    const mir = viewRef.current.mirror;
    let changed = false;
    const set = (cx: number, cy: number) => {
      if (cx < 0 || cy < 0 || cx >= n || cy >= n) return;
      const i = cy * n + cx;
      if (px[i] !== value) {
        px[i] = value;
        changed = true;
      }
    };
    for (let dy = 0; dy < span; dy++) {
      for (let dx = 0; dx < span; dx++) {
        set(x + dx, y + dy);
        if (mir) set(n - 1 - (x + dx), y + dy);
      }
    }
    return changed;
  };

  const fillAt = (px: Px, c: Cell, value: string | null): boolean => {
    const n = sizeRef.current;
    let changed = floodFill(px, n, c.x, c.y, value);
    if (viewRef.current.mirror) changed = floodFill(px, n, n - 1 - c.x, c.y, value) || changed;
    return changed;
  };

  const drawLine = (px: Px, a: Cell, b: Cell, value: string | null, span: number): boolean => {
    let changed = false;
    bresenham(a, b, (x, y) => {
      if (stamp(px, x, y, value, span)) changed = true;
    });
    return changed;
  };

  const pickAt = (c: Cell): string | null => {
    const n = sizeRef.current;
    if (c.x < 0 || c.y < 0 || c.x >= n || c.y >= n) return null;
    return pixelsRef.current[c.y * n + c.x];
  };

  const commit = (before: Snapshot, changed: boolean, used: string | null) => {
    if (!changed) return;
    pushUndo(before);
    markDirty();
    if (used) addRecent(used);
  };

  const selectTool = (t: Tool) => {
    playClick();
    setTool(t);
    anchorRef.current = null;
  };

  const chooseColor = (hex: string, sound = true) => {
    if (sound) playClick();
    setColor(hex);
    if (viewRef.current.tool === 'eraser' || viewRef.current.tool === 'picker') setTool('pencil');
  };

  const finishPick = (c: string | null) => {
    if (c) {
      setColor(c);
      playPop();
      setAnnouncement(`Picked ${colorName(c)}.`);
    }
    setTool('pencil');
  };

  /* ---------------- pointer input ---------------- */

  const cellFrom = (clientX: number, clientY: number, rect: DOMRect): Cell => {
    const n = sizeRef.current;
    return {
      x: Math.floor(((clientX - rect.left) / Math.max(1, rect.width)) * n),
      y: Math.floor(((clientY - rect.top) / Math.max(1, rect.height)) * n),
    };
  };
  const clampCell = (c: Cell): Cell => {
    const m = sizeRef.current - 1;
    return { x: Math.max(0, Math.min(m, c.x)), y: Math.max(0, Math.min(m, c.y)) };
  };

  const cancelStroke = () => {
    const s = strokeRef.current;
    if (!s) return;
    strokeRef.current = null;
    pixelsRef.current = s.before.px.slice();
    requestDraw();
  };

  const finishStroke = () => {
    const s = strokeRef.current;
    if (!s) return;
    strokeRef.current = null;
    if (s.tool === 'picker') finishPick(pickAt(s.last));
    else commit(s.before, s.changed, s.value);
    requestDraw();
  };

  const extendStroke = (s: Stroke, c: Cell) => {
    if (c.x === s.last.x && c.y === s.last.y && s.tool !== 'line') return;
    const v = viewRef.current;
    if (s.tool === 'pencil' || s.tool === 'eraser') {
      if (drawLine(pixelsRef.current, s.last, c, s.value, v.brush)) s.changed = true;
      s.last = c;
    } else if (s.tool === 'line') {
      const end = clampCell(c);
      if (end.x === s.last.x && end.y === s.last.y) return;
      s.last = end;
      const px = s.before.px.slice();
      s.changed = drawLine(px, s.start, end, s.value, 1);
      pixelsRef.current = px;
    } else if (s.tool === 'picker') {
      s.last = clampCell(c);
      const picked = pickAt(s.last);
      if (picked) setColor(picked);
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    if (e.isPrimary) {
      // A fresh gesture: forget any pointer we never saw lift.
      pointersRef.current.clear();
      blockedRef.current = false;
    }
    pointersRef.current.add(e.pointerId);
    if (pointersRef.current.size > 1) {
      // Second finger: treat it as a gesture and throw the stroke away.
      if (strokeRef.current) cancelStroke();
      blockedRef.current = true;
      return;
    }
    if (blockedRef.current) return;
    const rightClick = e.pointerType === 'mouse' && e.button === 2;
    if (e.pointerType === 'mouse' && e.button !== 0 && !rightClick) return;
    e.preventDefault();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    canvas.focus({ preventScroll: true });
    if (viewRef.current.kbdCursor) setKbdCursor(false);
    anchorRef.current = null;

    const rect = canvas.getBoundingClientRect();
    const start = cellFrom(e.clientX, e.clientY, rect);
    if (start.x < 0 || start.y < 0 || start.x >= sizeRef.current || start.y >= sizeRef.current) return;
    hoverRef.current = null;

    const v = viewRef.current;
    // Right mouse button or a pen's eraser end erases (pencil -> eraser, line/fill draw "empty").
    const erase = rightClick || (e.pointerType === 'pen' && (e.buttons & 32) !== 0);
    const t: Tool = erase && v.tool === 'pencil' ? 'eraser' : v.tool;
    const value = t === 'eraser' || erase ? null : v.color;
    const before = snapshot();

    if (t === 'fill') {
      const changed = fillAt(pixelsRef.current, start, value);
      commit(before, changed, value);
      if (changed) playPop();
      requestDraw();
      return;
    }

    const s: Stroke = { pointerId: e.pointerId, tool: t, before, rect, start, last: start, changed: false, value };
    strokeRef.current = s;
    if (t === 'pencil' || t === 'eraser') s.changed = stamp(pixelsRef.current, start.x, start.y, value, v.brush);
    else if (t === 'line') s.changed = stamp(pixelsRef.current, start.x, start.y, value, 1);
    else if (t === 'picker') {
      const picked = pickAt(start);
      if (picked) setColor(picked);
    }
    requestDraw();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = strokeRef.current;
    if (!s) {
      if (e.pointerType === 'mouse' && !blockedRef.current) {
        const c = cellFrom(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
        const n = sizeRef.current;
        const inside = c.x >= 0 && c.y >= 0 && c.x < n && c.y < n;
        const h = hoverRef.current;
        if (!inside) {
          if (h) {
            hoverRef.current = null;
            requestDraw();
          }
        } else if (!h || h.x !== c.x || h.y !== c.y) {
          hoverRef.current = c;
          requestDraw();
        }
      }
      return;
    }
    if (s.pointerId !== e.pointerId) return;
    const native = e.nativeEvent;
    const samples = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [];
    const list = samples.length ? samples : [native];
    for (const ev of list) extendStroke(s, cellFrom(ev.clientX, ev.clientY, s.rect));
    requestDraw();
  };

  const releasePointer = (id: number) => {
    pointersRef.current.delete(id);
    if (pointersRef.current.size === 0) blockedRef.current = false;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = strokeRef.current;
    if (s && s.pointerId === e.pointerId) finishStroke();
    releasePointer(e.pointerId);
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = strokeRef.current;
    if (s && s.pointerId === e.pointerId) cancelStroke();
    releasePointer(e.pointerId);
  };

  const onLostCapture = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = strokeRef.current;
    if (s && s.pointerId === e.pointerId) finishStroke();
  };

  const onPointerLeave = () => {
    if (hoverRef.current) {
      hoverRef.current = null;
      requestDraw();
    }
  };

  /* ---------------- keyboard (canvas) ---------------- */

  const actAtCursor = () => {
    const c = cursorRef.current;
    const v = viewRef.current;
    const before = snapshot();
    if (v.tool === 'picker') {
      finishPick(pickAt(c));
    } else if (v.tool === 'fill') {
      const changed = fillAt(pixelsRef.current, c, v.color);
      commit(before, changed, v.color);
      if (changed) playPop();
    } else if (v.tool === 'line') {
      const a = anchorRef.current;
      if (!a) {
        anchorRef.current = { ...c };
        setAnnouncement('Line start set. Move and press Space again to draw.');
      } else {
        anchorRef.current = null;
        commit(before, drawLine(pixelsRef.current, a, c, v.color, 1), v.color);
        setAnnouncement('Line drawn.');
      }
    } else {
      const value = v.tool === 'eraser' ? null : v.color;
      commit(before, stamp(pixelsRef.current, c.x, c.y, value, v.brush), value);
    }
    requestDraw();
  };

  const onCanvasKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const n = sizeRef.current;
    const step = e.shiftKey ? 4 : 1;
    const move: Record<string, [number, number]> = {
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
    };
    const d = move[e.key];
    if (d) {
      e.preventDefault();
      const c = cursorRef.current;
      const next = { x: Math.max(0, Math.min(n - 1, c.x + d[0])), y: Math.max(0, Math.min(n - 1, c.y + d[1])) };
      cursorRef.current = next;
      if (!kbdCursor) setKbdCursor(true);
      const here = pickAt(next);
      setAnnouncement(`Column ${next.x + 1}, row ${next.y + 1}: ${here ? colorName(here) : 'empty'}.`);
      requestDraw();
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!kbdCursor) setKbdCursor(true);
      actAtCursor();
      return;
    }
    if (e.key === 'Escape' && anchorRef.current) {
      e.preventDefault(); // keep the window open, just drop the line start
      anchorRef.current = null;
      setAnnouncement('Line cancelled.');
      requestDraw();
    }
  };

  /* ---------------- actions ---------------- */

  const switchSize = (n: GridSize) => {
    setConfirmSize(null);
    if (n === sizeRef.current) return;
    playClick();
    if (countPainted(pixelsRef.current) > 0) pushUndo(snapshot());
    sizeRef.current = n;
    pixelsRef.current = blank(n);
    anchorRef.current = null;
    cursorRef.current = { x: n / 2, y: n / 2 };
    setSize(n);
    markDirty();
    setAnnouncement(`New ${n} by ${n} canvas.`);
  };

  const requestSize = (n: GridSize) => {
    if (n === sizeRef.current) return;
    if (countPainted(pixelsRef.current) > 0) {
      playClick();
      setConfirmSize(n);
    } else switchSize(n);
  };

  const clearCanvas = () => {
    playClick();
    if (countPainted(pixelsRef.current) === 0) return;
    pushUndo(snapshot());
    pixelsRef.current = blank(sizeRef.current);
    anchorRef.current = null;
    markDirty();
    requestDraw();
    react('idle', 'Canvas cleared! Fresh start!', 1600);
    setAnnouncement('Canvas cleared. Undo to bring it back.');
  };

  const exportPng = () => {
    const n = sizeRef.current;
    const px = pixelsRef.current;
    if (countPainted(px) === 0) {
      playClick();
      react('surprised', 'Draw something first, then I can frame it!', 2000);
      return;
    }
    const scale = Math.max(1, Math.floor(EXPORT_PX / n));
    const c = document.createElement('canvas');
    c.width = n * scale;
    c.height = n * scale;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = px[y * n + x];
        if (!v) continue;
        ctx.fillStyle = v;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    const download = (href: string, revoke: boolean) => {
      const a = document.createElement('a');
      a.href = href;
      a.download = 'adam-os-pixel-art.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (revoke) window.setTimeout(() => URL.revokeObjectURL(href), 2000);
    };
    if (typeof c.toBlob === 'function') {
      c.toBlob((blob) => {
        if (blob) download(URL.createObjectURL(blob), true);
        else download(c.toDataURL('image/png'), false);
      }, 'image/png');
    } else download(c.toDataURL('image/png'), false);
    playDownloadFanfare();
    react('celebrating', `Saved ${n * scale}x${n * scale} PNG! Frame it on the fridge!`, 2400);
    setAnnouncement('PNG saved.');
  };

  const showSpider = () => {
    const count = countPainted(pixelsRef.current);
    if (count === 0) {
      playPop();
      react('surprised', 'A blank canvas? Bold. Very minimalist.', 2200);
      return;
    }
    playDownloadFanfare();
    const lines: Array<[SpiderFrame, string]> = [
      ['celebrating', 'Woah! That pixel artwork belongs in a museum! Spidey approved! 🎨'],
      ['love', 'I love it! Can I use it as my new profile picture?'],
      ['celebrating', `${count} pixels of pure genius!`],
      ['dance', 'This masterpiece makes me want to dance!'],
    ];
    const [frame, text] = lines[Math.floor(Math.random() * lines.length)];
    react(frame, text, 2600);
  };

  const toggleMirror = () => {
    playClick();
    setMirror((m) => !m);
  };
  const toggleGrid = () => {
    playClick();
    setShowGrid((g) => !g);
  };
  const pickBrush = (b: 1 | 2) => {
    playClick();
    setBrush(b);
  };

  const actionsRef = useRef({ undo, redo, selectTool, toggleMirror, toggleGrid, pickBrush });
  actionsRef.current = { undo, redo, selectTool, toggleMirror, toggleGrid, pickBrush };

  // Desktop shortcuts, only while Paint is the active window and nobody is typing.
  useEffect(() => {
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const onKeyDown = (e: KeyboardEvent) => {
      const v = viewRef.current;
      if (!v.visible || !v.isActive || v.isMobile || e.defaultPrevented || isTyping(e.target)) return;
      const a = actionsRef.current;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'z') {
          e.preventDefault();
          if (e.shiftKey) a.redo();
          else a.undo();
        } else if (k === 'y') {
          e.preventDefault();
          a.redo();
        }
        return;
      }
      if (e.altKey || e.shiftKey || e.repeat) return;
      const t = KEY_TOOL[e.code];
      if (t) a.selectTool(t);
      else if (e.code === 'KeyM') a.toggleMirror();
      else if (e.code === 'KeyG') a.toggleGrid();
      else if (e.code === 'Digit1') a.pickBrush(1);
      else if (e.code === 'Digit2') a.pickBrush(2);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Drop an in-flight stroke if the window is hidden mid-drag.
  useEffect(() => {
    if (visible) return;
    if (strokeRef.current) finishStroke();
    pointersRef.current.clear();
    blockedRef.current = false;
    hoverRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  /* ---------------- responsive sizing ---------------- */

  // Largest integer cell that fits the content area (width always; height too on desktop).
  const measure = useCallback(() => {
    const root = rootRef.current;
    const area = root?.parentElement;
    if (!root || !area) return;
    const cs = window.getComputedStyle(area);
    const availW = area.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const availH = area.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const gap = parseFloat(window.getComputedStyle(root).rowGap) || 0;
    const kids = Array.from(root.children) as HTMLElement[];
    let used = 0;
    let count = 0;
    for (const k of kids) {
      if (k === frameRef.current || k.offsetParent === null) continue;
      used += k.offsetHeight;
      count++;
    }
    used += gap * count;
    const n = size;
    const byW = Math.floor((availW - FRAME_PX) / n);
    const byH = Math.floor((availH - used - FRAME_PX) / n);
    const maxCell = n === 16 ? 40 : 20;
    const minCell = n === 16 ? 10 : 5;
    const fit = isMobile ? maxCell : Math.max(minCell, byH);
    setCell(Math.max(2, Math.min(byW, maxCell, fit)));
    setDpr(Math.min(3, Math.max(1, window.devicePixelRatio || 1)));
  }, [size, isMobile]);

  useEffect(() => {
    if (!visible) return;
    measure();
    const root = rootRef.current;
    const area = root?.parentElement;
    window.addEventListener('resize', measure);
    let ro: ResizeObserver | null = null;
    if (root && area && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure());
      ro.observe(area);
      for (const k of Array.from(root.children)) if (k !== frameRef.current) ro.observe(k);
    }
    return () => {
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [visible, measure]);

  /* ---------------- render ---------------- */

  const btn = isMobile ? 'w-11 h-11' : 'w-8 h-8';
  const pressedCls = (on: boolean) => (on ? 'win9x-box-recessed text-yellow' : 'win9x-button');

  const toolButton = (t: Tool) => (
    <button
      key={t}
      type="button"
      onClick={() => selectTool(t)}
      aria-label={TOOL_LABEL[t]}
      aria-pressed={tool === t}
      title={isMobile ? TOOL_LABEL[t] : `${TOOL_LABEL[t]} (${TOOL_KEY[t]})`}
      className={`${pressedCls(tool === t)} ${btn} shrink-0 flex items-center justify-center`}
    >
      <Glyph name={t} />
    </button>
  );

  const iconButton = (
    glyph: GlyphName,
    label: string,
    onClick: () => void,
    opts: { pressed?: boolean; disabled?: boolean; title?: string; tone?: string } = {}
  ) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={opts.pressed}
      disabled={opts.disabled}
      title={opts.title ?? label}
      className={`${opts.pressed === undefined ? 'win9x-button' : pressedCls(opts.pressed)} ${btn} shrink-0 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {/* Tone sits on a child: win9x-button would override a colour class on the button itself. */}
      <span className={`flex ${opts.tone ?? ''}`}>
        <Glyph name={glyph} />
      </span>
    </button>
  );

  const swatch = isMobile ? 'w-full aspect-square min-w-9' : 'w-[22px] h-[22px]';
  const recentTile = isMobile ? 'flex-1 min-w-9 h-9' : 'w-5 h-5';
  const canvasLabel = `Pixel art canvas, ${size} by ${size}, ${painted} ${painted === 1 ? 'pixel' : 'pixels'} painted. Tool: ${
    TOOL_LABEL[tool]
  }, colour ${colorName(color)}. Arrow keys move the cursor, Space paints.`;

  const currentColor = (
    <label
      className="win9x-box-recessed relative shrink-0 w-11 h-11 flex items-center justify-center cursor-pointer p-1"
      title="Current colour (click for a custom colour)"
    >
      <motion.span
        key={color}
        initial={reducedMotion ? false : { scale: 0.7 }}
        animate={{ scale: 1 }}
        transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 22 }}
        className="block w-full h-full border border-shade"
        style={{ backgroundColor: color }}
      />
      <span
        aria-hidden
        className="absolute bottom-0 right-0 w-3 h-3 flex items-center justify-center bg-panel2 border border-slate font-pixel text-[8px] leading-none text-text"
      >
        +
      </span>
      <input
        type="color"
        value={color.toLowerCase()}
        onChange={(e) => {
          const h = normHex(e.target.value);
          if (h) chooseColor(h, false);
        }}
        aria-label={`Current colour ${colorName(color)}. Choose a custom colour`}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </label>
  );

  const paletteGrid = (
    <div
      role="group"
      aria-label="Palette"
      className={isMobile ? 'grid grid-cols-8 w-full' : 'grid grid-cols-8 gap-0.5 shrink-0'}
    >
      {PALETTE.map((p) => {
        const on = color === p.hex;
        return (
          <button
            key={p.hex}
            type="button"
            onClick={() => chooseColor(p.hex)}
            aria-label={p.name}
            aria-pressed={on}
            title={`${p.name} ${p.hex}`}
            className={`${swatch} relative border border-shade/70 flex items-center justify-center ${on ? 'ring-2 ring-inset ring-yellow' : ''}`}
            style={{ backgroundColor: p.hex }}
          >
            {on && <span aria-hidden className="block w-1.5 h-1.5" style={{ backgroundColor: contrastOf(p.hex) }} />}
          </button>
        );
      })}
    </div>
  );

  const recentRow = (
    <div role="group" aria-label="Recent colours" className={isMobile ? 'flex gap-1 flex-1 min-w-0' : 'grid grid-cols-3 gap-0.5 shrink-0'}>
      {Array.from({ length: MAX_RECENT }, (_, i) => {
        const hex = recent[i];
        if (!hex) return <span key={`empty-${i}`} aria-hidden className={`${recentTile} win9x-box-recessed`} />;
        return (
          <button
            key={hex}
            type="button"
            onClick={() => chooseColor(hex)}
            aria-label={`Recent colour ${colorName(hex)}`}
            aria-pressed={color === hex}
            title={hex}
            className={`${recentTile} relative border border-shade/70 flex items-center justify-center`}
            style={{ backgroundColor: hex }}
          >
            {color === hex && <span aria-hidden className="block w-1.5 h-1.5" style={{ backgroundColor: contrastOf(hex) }} />}
          </button>
        );
      })}
    </div>
  );

  return (
    <Window id="paint">
      <div ref={rootRef} className="w-full min-w-0 flex flex-col items-center gap-2 font-pixel text-text select-none">
        {/* Header: grid size + export + spider */}
        <div className={`w-full win9x-box-recessed flex items-center min-w-0 py-1 ${isMobile ? 'gap-1 px-1' : 'gap-1.5 px-1.5'}`}>
          {!isMobile && <span className="text-[9px] text-lavender mr-0.5">GRID</span>}
          <div role="group" aria-label="Grid size" className="flex gap-1 shrink-0">
            {([16, 32] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => requestSize(n)}
                aria-pressed={size === n}
                aria-label={`${n} by ${n} grid`}
                title={`${n}x${n}`}
                className={`${pressedCls(size === n)} ${isMobile ? 'h-11 w-11' : 'h-7 px-2'} text-[10px]`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1 min-w-0">
            <button
              type="button"
              onClick={exportPng}
              aria-label="Save PNG"
              title="Save PNG (512x512)"
              className={`win9x-button ${isMobile ? 'h-11 px-1.5 gap-1' : 'h-7 px-2 gap-1.5'} shrink-0 flex items-center text-[10px]`}
            >
              <PixelIcon name="download" />
              <span>{isMobile ? 'PNG' : 'SAVE PNG'}</span>
            </button>
            <button
              type="button"
              onClick={showSpider}
              aria-label="Show Pixel Spider"
              className={`win9x-button win9x-button-spidey ${isMobile ? 'h-11 px-1.5 gap-1' : 'h-7 px-2 gap-1.5'} shrink-0 flex items-center text-[10px]`}
            >
              <PixelIcon name="spider" />
              <span>{isMobile ? 'SPIDER' : 'SHOW PIXEL SPIDER'}</span>
            </button>
          </div>
        </div>

        {/* Toolbar (scrolls sideways on narrow screens) */}
        <div
          role="toolbar"
          aria-label="Paint tools"
          className="w-full min-w-0 overflow-x-auto overscroll-x-contain"
          style={{ touchAction: 'manipulation', scrollbarWidth: 'thin' }}
        >
          <div className={`flex items-stretch gap-1 w-max mx-auto ${isMobile ? 'pb-1' : ''}`}>
            {iconButton('undo', 'Undo', undo, { disabled: hist.undo === 0, title: isMobile ? 'Undo' : `Undo (${mod}+Z)` })}
            {iconButton('redo', 'Redo', redo, {
              disabled: hist.redo === 0,
              title: isMobile ? 'Redo' : `Redo (${mod}+Shift+Z)`,
            })}
            <Sep />
            {TOOLS.map(toolButton)}
            <Sep />
            {iconButton('brush1', 'Brush size 1', () => pickBrush(1), {
              pressed: brush === 1,
              title: isMobile ? 'Brush size 1' : 'Brush size 1 (1)',
              tone: tool === 'pencil' || tool === 'eraser' ? '' : 'opacity-60',
            })}
            {iconButton('brush2', 'Brush size 2', () => pickBrush(2), {
              pressed: brush === 2,
              title: isMobile ? 'Brush size 2' : 'Brush size 2 (2)',
              tone: tool === 'pencil' || tool === 'eraser' ? '' : 'opacity-60',
            })}
            <Sep />
            {iconButton('mirror', 'Mirror drawing', toggleMirror, { pressed: mirror, title: isMobile ? 'Mirror' : 'Mirror (M)' })}
            {iconButton('grid', 'Grid lines', toggleGrid, { pressed: showGrid, title: isMobile ? 'Grid lines' : 'Grid lines (G)' })}
            <Sep />
            {iconButton('trash', 'Clear canvas', clearCanvas, { disabled: painted === 0, title: 'Clear canvas', tone: 'text-red' })}
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={frameRef}
          className="relative shrink-0 border-2 border-slate bg-base"
          style={{ width: boardPx + FRAME_PX, height: boardPx + FRAME_PX }}
        >
          <canvas
            ref={canvasRef}
            width={Math.round(boardPx * dpr)}
            height={Math.round(boardPx * dpr)}
            role="img"
            tabIndex={0}
            aria-label={canvasLabel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onLostPointerCapture={onLostCapture}
            onPointerLeave={onPointerLeave}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={onCanvasKeyDown}
            onBlur={() => {
              if (kbdCursor) setKbdCursor(false);
            }}
            className={`block outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow ${
              tool === 'picker' || tool === 'fill' ? 'cursor-pointer' : 'cursor-crosshair'
            }`}
            style={{
              width: boardPx,
              height: boardPx,
              imageRendering: 'pixelated',
              touchAction: 'none',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none',
            }}
          />

          {confirmSize && (
            <div
              role="alertdialog"
              aria-labelledby="paint-confirm-title"
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-3 text-center bg-base/85"
            >
              <p id="paint-confirm-title" className="text-[10px] leading-relaxed text-yellow">
                SWITCH TO {confirmSize}x{confirmSize}?
              </p>
              <p className="font-mono text-[11px] text-lavender leading-snug max-w-[15rem]">
                This starts a fresh canvas. You can undo it.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  autoFocus
                  onClick={() => switchSize(confirmSize)}
                  className="win9x-button win9x-button-spidey px-4 min-h-[40px] text-[10px]"
                >
                  SWITCH
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setConfirmSize(null);
                  }}
                  className="win9x-button px-4 min-h-[40px] text-[10px]"
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}

          <p className="sr-only" aria-live="polite">
            {announcement}
          </p>
        </div>

        {/* Colours */}
        {isMobile ? (
          <div className="w-full min-w-0 flex flex-col gap-2">
            <div className="flex items-center gap-1 w-full min-w-0">
              {currentColor}
              {recentRow}
            </div>
            {paletteGrid}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 max-w-full">
            {currentColor}
            {paletteGrid}
            <Sep />
            <div className="flex flex-col items-center gap-0.5 shrink-0">
              <span className="text-[7px] text-lavender leading-none">RECENT</span>
              {recentRow}
            </div>
          </div>
        )}
      </div>
    </Window>
  );
};
