'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Window } from '../Window';
import { PixelIcon } from '@/components/PixelIcon';
import type { IconName } from '@/lib/pixel-icons';
import type { SpiderFrame } from '@/components/mascot/anims';
import { useSound } from '@/context/SoundContext';
import { useMascot } from '@/context/MascotContext';
import { useWindowManager } from '@/context/WindowManagerContext';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { readJSON, readStorage, writeStorage } from '@/lib/storage';

/* ------------------------------------------------------------------ */
/* Game model                                                          */
/* ------------------------------------------------------------------ */

type Dir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Pt = { x: number; y: number };
type Status = 'ready' | 'playing' | 'paused' | 'over' | 'won';
type DeathCause = 'wall' | 'self';

const GRID = 16;
const CELLS = GRID * GRID;
const BASE_STEP_MS = 140;
const MIN_STEP_MS = 70;
const STEP_DROP_MS = 8;
const POINTS_PER_LEVEL = 50;
const BUG_POINTS = 10;
const GOLD_POINTS = 50;
const GOLD_EVERY = 5;
const GOLD_LIFE_MS = 6000;
const MAX_QUEUE = 2;
const FLASH_MS = 380;
const SHAKE_MS = 320;
const RESTART_GUARD_MS = 450;

const SWIPE_PX = 24;
const TAP_SLOP_PX = 10;
const MIN_CELL = 16;
const MAX_CELL = 40;
const FRAME_PX = 4; // 2px board border on each side

const HIGHSCORE_KEY = 'adam_os_snake_highscore';
const SETTINGS_KEY = 'adam_os_snake_settings';

const VEC: Record<Dir, Pt> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};
const OPPOSITE: Record<Dir, Dir> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
const KEY_DIR: Record<string, Dir> = {
  ArrowUp: 'UP',
  KeyW: 'UP',
  ArrowDown: 'DOWN',
  KeyS: 'DOWN',
  ArrowLeft: 'LEFT',
  KeyA: 'LEFT',
  ArrowRight: 'RIGHT',
  KeyD: 'RIGHT',
};

type Swatch = 'green' | 'lavender' | 'yellow' | 'hilite' | 'red';

interface Golden extends Pt {
  expires: number; // game clock (ms) when it flies away
}
interface Particle {
  x: number; // in cell units
  y: number;
  vx: number; // cells per ms
  vy: number;
  life: number;
  max: number;
  size: number; // fraction of a cell
  color: Swatch;
}
interface Floater {
  x: number;
  y: number;
  text: string;
  life: number;
  max: number;
  color: Swatch;
}

interface Game {
  status: Status;
  snake: Pt[]; // head first
  from: Pt[]; // snake before the last step (for smooth interpolation)
  moved: boolean;
  grew: boolean;
  dir: Dir; // last *applied* direction
  queue: Dir[];
  food: Pt | null;
  golden: Golden | null;
  score: number;
  eaten: number;
  level: number;
  stepMs: number;
  acc: number; // fixed-step accumulator
  clock: number; // game time, only advances while playing
  particles: Particle[];
  floaters: Floater[];
  flashUntil: number;
  shakeUntil: number;
  endedAt: number;
  bestAtStart: number;
  announcedBest: boolean;
}

interface GameEvents {
  eat: (g: Game, golden: boolean, leveledUp: boolean, goldenSpawned: boolean) => void;
  die: (g: Game, cause: DeathCause) => void;
  win: (g: Game) => void;
}

const START_SNAKE: Pt[] = [
  { x: 8, y: 8 },
  { x: 8, y: 9 },
  { x: 8, y: 10 },
];

const same = (a: Pt, b: Pt) => a.x === b.x && a.y === b.y;
const levelFor = (score: number) => Math.floor(score / POINTS_PER_LEVEL) + 1;
const stepFor = (level: number) => Math.max(MIN_STEP_MS, BASE_STEP_MS - (level - 1) * STEP_DROP_MS);

// Picks a random free cell (never loops forever: null when the board is full).
const pickFree = (occupied: Pt[]): Pt | null => {
  const taken = new Uint8Array(CELLS);
  for (const p of occupied) taken[p.y * GRID + p.x] = 1;
  const free: number[] = [];
  for (let i = 0; i < CELLS; i++) if (!taken[i]) free.push(i);
  if (!free.length) return null;
  const i = free[Math.floor(Math.random() * free.length)];
  return { x: i % GRID, y: Math.floor(i / GRID) };
};

const newGame = (bestAtStart = 0): Game => {
  const snake = START_SNAKE.map((p) => ({ ...p }));
  return {
    status: 'ready',
    snake,
    from: snake,
    moved: false,
    grew: false,
    dir: 'UP',
    queue: [],
    food: pickFree(snake),
    golden: null,
    score: 0,
    eaten: 0,
    level: 1,
    stepMs: BASE_STEP_MS,
    acc: 0,
    clock: 0,
    particles: [],
    floaters: [],
    flashUntil: 0,
    shakeUntil: 0,
    endedAt: 0,
    bestAtStart,
    announcedBest: false,
  };
};

// Queue a turn, validated against the last queued (or last applied) direction so two quick
// presses inside one tick can never fold the snake back onto itself.
const enqueueDir = (g: Game, d: Dir): void => {
  const last = g.queue.length ? g.queue[g.queue.length - 1] : g.dir;
  if (d === last || d === OPPOSITE[last] || g.queue.length >= MAX_QUEUE) return;
  g.queue.push(d);
};

const burst = (g: Game, at: Pt, color: Swatch, text: string, count: number) => {
  const cx = at.x + 0.5;
  const cy = at.y + 0.5;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = 0.003 + Math.random() * 0.005;
    const max = 380 + Math.random() * 260;
    g.particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - 0.002,
      life: max,
      max,
      size: 0.12 + Math.random() * 0.1,
      color: i % 3 === 0 ? 'hilite' : color,
    });
  }
  g.floaters.push({ x: Math.min(GRID - 1, Math.max(1, cx)), y: cy - 0.2, text, life: 750, max: 750, color });
};

const endGame = (g: Game, status: 'over' | 'won', now: number) => {
  g.status = status;
  g.from = g.snake;
  g.moved = false;
  g.grew = false;
  g.queue = [];
  g.acc = 0;
  g.endedAt = now;
};

// One fixed simulation step. Pure game logic: all side effects go through `ev`.
const advance = (g: Game, ev: GameEvents, now: number, reduced: boolean): void => {
  const next = g.queue.shift();
  if (next && next !== OPPOSITE[g.dir]) g.dir = next;

  const v = VEC[g.dir];
  const head = { x: g.snake[0].x + v.x, y: g.snake[0].y + v.y };

  if (head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID) {
    endGame(g, 'over', now);
    ev.die(g, 'wall');
    return;
  }

  const eatsBug = !!g.food && same(head, g.food);
  const eatsGold = !!g.golden && same(head, g.golden);
  const grows = eatsBug || eatsGold;
  // The tail moves out of the way this step unless we grow, so it is a legal target.
  const body = grows ? g.snake : g.snake.slice(0, -1);
  if (body.some((p) => same(p, head))) {
    endGame(g, 'over', now);
    ev.die(g, 'self');
    return;
  }

  g.from = g.snake;
  g.snake = [head, ...body];
  g.moved = true;
  g.grew = grows;
  if (!grows) return;

  const sparks = reduced ? 5 : 12;
  let goldenSpawned = false;
  if (eatsBug) {
    g.score += BUG_POINTS;
    g.eaten += 1;
    burst(g, head, 'green', `+${BUG_POINTS}`, sparks);
    g.food = pickFree(g.golden ? [...g.snake, g.golden] : g.snake);
    if (g.eaten % GOLD_EVERY === 0 && !g.golden) {
      const spot = pickFree(g.food ? [...g.snake, g.food] : g.snake);
      if (spot) {
        g.golden = { ...spot, expires: g.clock + GOLD_LIFE_MS };
        goldenSpawned = true;
      }
    }
  }
  if (eatsGold) {
    g.score += GOLD_POINTS;
    burst(g, head, 'yellow', `+${GOLD_POINTS}`, sparks + 6);
    g.golden = null;
    if (!g.food) g.food = pickFree(g.snake);
  }

  const lvl = levelFor(g.score);
  const leveledUp = lvl > g.level;
  if (leveledUp) {
    g.level = lvl;
    g.stepMs = stepFor(lvl);
  }

  if (g.snake.length >= CELLS) {
    g.food = null;
    g.golden = null;
    endGame(g, 'won', now);
    ev.win(g);
    return;
  }
  ev.eat(g, eatsGold, leveledUp, goldenSpawned);
};

/* ------------------------------------------------------------------ */
/* Canvas rendering                                                    */
/* ------------------------------------------------------------------ */

type PaletteKey = 'base' | 'panel2' | 'spidey' | 'lavender' | 'green' | 'red' | 'yellow' | 'hilite' | 'shade' | 'slate';
type Palette = (key: PaletteKey, alpha?: number) => string;

const PALETTE_VARS: Record<PaletteKey, string> = {
  base: '--c-base',
  panel2: '--c-panel2',
  spidey: '--c-spidey',
  lavender: '--c-lavender',
  green: '--c-green',
  red: '--c-red',
  yellow: '--c-yellow',
  hilite: '--c-hilite',
  shade: '--c-shade',
  slate: '--c-slate',
};
// Dark-theme channels, only used if a variable cannot be read.
const PALETTE_FALLBACK: Record<PaletteKey, string> = {
  base: '11 11 16',
  panel2: '31 31 46',
  spidey: '33 44 244',
  lavender: '195 198 237',
  green: '114 255 180',
  red: '255 58 102',
  yellow: '255 229 92',
  hilite: '255 255 255',
  shade: '11 11 16',
  slate: '176 179 188',
};
const PALETTE_KEYS = Object.keys(PALETTE_VARS) as PaletteKey[];

const readPalette = (style: CSSStyleDeclaration): Palette => {
  const channels = new Map<PaletteKey, string>();
  for (const k of PALETTE_KEYS) channels.set(k, style.getPropertyValue(PALETTE_VARS[k]).trim() || PALETTE_FALLBACK[k]);
  return (k, a = 1) => {
    const ch = channels.get(k) ?? PALETTE_FALLBACK[k];
    return a >= 1 ? `rgb(${ch})` : `rgb(${ch} / ${Math.max(0, a)})`;
  };
};

interface BgCache {
  key: string;
  canvas: HTMLCanvasElement | null;
}

// Dark board, faint grid and a spider web radiating from the centre. Cached per size.
const buildBackground = (px: number, scale: number, pal: Palette): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = Math.round(px * scale);
  c.height = c.width;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const cell = px / GRID;
  const hair = 1 / scale;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  ctx.fillStyle = pal('base');
  ctx.fillRect(0, 0, px, px);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if ((x + y) % 2 === 0) {
        ctx.fillStyle = pal('panel2', 0.35);
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  }
  const mid = px / 2;
  const glow = ctx.createRadialGradient(mid, mid, 0, mid, mid, px * 0.72);
  glow.addColorStop(0, pal('spidey', 0.18));
  glow.addColorStop(1, pal('spidey', 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, px, px);

  // Grid
  ctx.strokeStyle = pal('lavender', 0.06);
  ctx.lineWidth = hair;
  ctx.beginPath();
  for (let i = 1; i < GRID; i++) {
    const p = i * cell + hair / 2;
    ctx.moveTo(p, 0);
    ctx.lineTo(p, px);
    ctx.moveTo(0, p);
    ctx.lineTo(px, p);
  }
  ctx.stroke();

  // Web: spokes + sagging rings
  const spokes = 8;
  const angles = Array.from({ length: spokes }, (_, i) => (i / spokes) * Math.PI * 2 + Math.PI / 8);
  ctx.strokeStyle = pal('lavender', 0.1);
  ctx.beginPath();
  for (const a of angles) {
    ctx.moveTo(mid, mid);
    ctx.lineTo(mid + Math.cos(a) * px, mid + Math.sin(a) * px);
  }
  for (let k = 1; k <= 7; k++) {
    const r = (k * px) / 10;
    const pts = angles.map((a) => ({ x: mid + Math.cos(a) * r, y: mid + Math.sin(a) * r }));
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i <= spokes; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i % spokes];
      const cx = (p0.x + p1.x) / 2;
      const cy = (p0.y + p1.y) / 2;
      // Pull the midpoint toward the centre so each thread sags like silk.
      ctx.quadraticCurveTo(cx + (mid - cx) * 0.16, cy + (mid - cy) * 0.16, p1.x, p1.y);
    }
  }
  ctx.stroke();
  return c;
};

const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const centre = (p: Pt): Pt => ({ x: p.x + 0.5, y: p.y + 0.5 });

// Points (in cell units) of the silk thread, interpolated between the last two steps.
const snakePath = (g: Game, t: number): Pt[] => {
  const s = g.snake;
  if (!g.moved || s.length < 2) return s.map(centre);
  const pts: Pt[] = [lerpPt(centre(s[1]), centre(s[0]), t)];
  for (let i = 1; i < s.length; i++) pts.push(centre(s[i]));
  if (!g.grew && g.from.length) pts.push(lerpPt(centre(g.from[g.from.length - 1]), centre(s[s.length - 1]), t));
  return pts;
};

const drawSnake = (ctx: CanvasRenderingContext2D, g: Game, cell: number, t: number, now: number, pal: Palette, reduced: boolean) => {
  const pts = snakePath(g, t).map((p) => ({ x: p.x * cell, y: p.y * cell }));
  const links = pts.length - 1;
  const widthAt = (j: number) => cell * (0.68 - 0.4 * (links <= 1 ? 0 : j / (links - 1)));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const strokeLinks = (color: string, width: (j: number) => number) => {
    ctx.strokeStyle = color;
    for (let j = 0; j < links; j++) {
      ctx.lineWidth = width(j);
      ctx.beginPath();
      ctx.moveTo(pts[j].x, pts[j].y);
      ctx.lineTo(pts[j + 1].x, pts[j + 1].y);
      ctx.stroke();
    }
  };
  strokeLinks(pal('spidey'), widthAt);
  strokeLinks(pal('lavender'), (j) => Math.max(1, widthAt(j) * 0.26));

  // A loose strand of silk trailing from the tail.
  if (pts.length >= 2) {
    const tail = pts[pts.length - 1];
    let k = pts.length - 2;
    while (k > 0 && pts[k].x === tail.x && pts[k].y === tail.y) k--;
    const dx = tail.x - pts[k].x;
    const dy = tail.y - pts[k].y;
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      ctx.strokeStyle = pal('hilite', 0.45);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(tail.x + (dx / len) * cell * 0.5, tail.y + (dy / len) * cell * 0.5);
      ctx.stroke();
    }
  }

  // Head: a tiny pixel spider face.
  const h = pts[0];
  const d = VEC[g.dir];
  const px = -d.y;
  const py = d.x;
  const r = cell * 0.44;
  const dead = g.status === 'over';
  const wiggle = reduced || g.status !== 'playing' ? 0 : Math.sin(now / 70) * r * 0.18;
  ctx.strokeStyle = pal('slate');
  ctx.lineWidth = Math.max(1, cell * 0.07);
  ctx.lineCap = 'square';
  for (const side of [-1, 1]) {
    for (const k of [-1, 0, 1]) {
      const bx = h.x + px * side * r * 0.6 + d.x * k * r * 0.45;
      const by = h.y + py * side * r * 0.6 + d.y * k * r * 0.45;
      const sway = (k === 0 ? -wiggle : wiggle) * side;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + px * side * r * 0.75 + d.x * (k * r * 0.35 + sway), by + py * side * r * 0.75 + d.y * (k * r * 0.35 + sway));
      ctx.stroke();
    }
  }
  ctx.fillStyle = pal('panel2');
  ctx.beginPath();
  ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = pal(dead ? 'red' : 'spidey');
  ctx.lineWidth = Math.max(1.5, cell * 0.09);
  ctx.stroke();

  const eye = Math.max(2, Math.round(cell * 0.2));
  const pupil = Math.max(1, Math.round(cell * 0.09));
  for (const side of [-1, 1]) {
    const ex = h.x + d.x * r * 0.2 + px * side * r * 0.42;
    const ey = h.y + d.y * r * 0.2 + py * side * r * 0.42;
    if (dead) {
      ctx.strokeStyle = pal('red');
      ctx.lineWidth = Math.max(1, cell * 0.07);
      ctx.beginPath();
      ctx.moveTo(ex - eye / 2, ey - eye / 2);
      ctx.lineTo(ex + eye / 2, ey + eye / 2);
      ctx.moveTo(ex + eye / 2, ey - eye / 2);
      ctx.lineTo(ex - eye / 2, ey + eye / 2);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = pal('hilite');
    ctx.fillRect(Math.round(ex - eye / 2), Math.round(ey - eye / 2), eye, eye);
    ctx.fillStyle = pal('shade');
    const lx = ex + d.x * eye * 0.3;
    const ly = ey + d.y * eye * 0.3;
    ctx.fillRect(Math.round(lx - pupil / 2), Math.round(ly - pupil / 2), pupil, pupil);
  }
};

// A pixel fly with flapping wings. Golden bugs are worth more.
const drawBug = (ctx: CanvasRenderingContext2D, cx: number, cy: number, cell: number, now: number, pal: Palette, golden: boolean, reduced: boolean) => {
  const u = cell / 10;
  const tone: PaletteKey = golden ? 'yellow' : 'green';
  const y = cy + (reduced ? 0 : Math.sin(now / 200 + cx) * u * 0.6);
  const flap = Math.floor(now / (golden ? 70 : 100)) % 2 === 0;

  const glow = ctx.createRadialGradient(cx, y, 0, cx, y, cell * 0.62);
  glow.addColorStop(0, pal(tone, golden ? 0.4 : 0.26));
  glow.addColorStop(1, pal(tone, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, y, cell * 0.62, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = pal('hilite', 0.55);
  ctx.strokeStyle = pal('lavender', 0.9);
  ctx.lineWidth = Math.max(1, u * 0.4);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    if (flap) ctx.ellipse(cx + s * u * 2.4, y - u * 0.9, u * 2.4, u * 1.3, s * -0.35, 0, Math.PI * 2);
    else ctx.ellipse(cx + s * u * 1.3, y - u * 2.3, u * 1.1, u * 2.3, s * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = pal(tone);
  ctx.beginPath();
  ctx.ellipse(cx, y + u * 0.8, u * 1.8, u * 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal('shade', 0.55);
  ctx.fillRect(cx - u * 1.6, y + u * 0.4, u * 3.2, u * 0.6);
  ctx.fillRect(cx - u * 1.4, y + u * 1.8, u * 2.8, u * 0.6);

  ctx.fillStyle = pal('shade');
  ctx.beginPath();
  ctx.arc(cx, y - u * 2, u * 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal('red');
  ctx.fillRect(cx - u * 1.3, y - u * 2.6, u * 0.9, u * 0.9);
  ctx.fillRect(cx + u * 0.4, y - u * 2.6, u * 0.9, u * 0.9);

  if (golden && !reduced) {
    // Little twinkle orbiting the golden bug.
    const a = now / 260;
    const sx = cx + Math.cos(a) * cell * 0.38;
    const sy = y + Math.sin(a) * cell * 0.38;
    ctx.fillStyle = pal('hilite');
    ctx.fillRect(sx - u * 0.4, sy - u * 1.2, u * 0.8, u * 2.4);
    ctx.fillRect(sx - u * 1.2, sy - u * 0.4, u * 2.4, u * 0.8);
  }
};

interface RenderOpts {
  boardPx: number;
  now: number;
  pal: Palette;
  font: string;
  reduced: boolean;
  bg: BgCache;
}

const render = (canvas: HTMLCanvasElement, g: Game, o: RenderOpts) => {
  const ctx = canvas.getContext('2d');
  if (!ctx || o.boardPx <= 0) return;
  const scale = canvas.width / o.boardPx;
  const cell = o.boardPx / GRID;
  const key = `${canvas.width}:${o.boardPx}`;
  if (o.bg.key !== key || !o.bg.canvas) {
    o.bg.canvas = buildBackground(o.boardPx, scale, o.pal);
    o.bg.key = key;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(o.bg.canvas, 0, 0);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  if (g.food) drawBug(ctx, (g.food.x + 0.5) * cell, (g.food.y + 0.5) * cell, cell, o.now, o.pal, false, o.reduced);

  if (g.golden) {
    const cx = (g.golden.x + 0.5) * cell;
    const cy = (g.golden.y + 0.5) * cell;
    const left = Math.max(0, Math.min(1, (g.golden.expires - g.clock) / GOLD_LIFE_MS));
    ctx.lineCap = 'butt';
    ctx.lineWidth = Math.max(1.5, cell * 0.09);
    ctx.strokeStyle = o.pal('yellow', 0.22);
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = o.pal('yellow');
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
    ctx.stroke();
    const blinkOff = left < 0.25 && Math.floor(o.now / 130) % 2 === 0;
    if (!blinkOff) drawBug(ctx, cx, cy, cell, o.now, o.pal, true, o.reduced);
  }

  const t = g.moved ? Math.min(1, g.acc / g.stepMs) : 1;
  drawSnake(ctx, g, cell, t, o.now, o.pal, o.reduced);

  for (const p of g.particles) {
    const sz = p.size * cell;
    ctx.fillStyle = o.pal(p.color, p.life / p.max);
    ctx.fillRect(p.x * cell - sz / 2, p.y * cell - sz / 2, sz, sz);
  }

  if (g.floaters.length) {
    ctx.font = `${Math.max(8, Math.round(cell * 0.5))}px ${o.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of g.floaters) {
      const a = Math.min(1, (f.life / f.max) * 1.6);
      const x = f.x * cell;
      const y = f.y * cell;
      ctx.fillStyle = o.pal('shade', a);
      ctx.fillText(f.text, x + 1, y + 1);
      ctx.fillStyle = o.pal(f.color, a);
      ctx.fillText(f.text, x, y);
    }
  }

  if (o.now < g.flashUntil) {
    ctx.fillStyle = o.pal('red', 0.45 * ((g.flashUntil - o.now) / FLASH_MS));
    ctx.fillRect(0, 0, o.boardPx, o.boardPx);
  }
};

const tickEffects = (g: Game, dt: number) => {
  if (g.particles.length) {
    for (const p of g.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.000012 * dt;
    }
    g.particles = g.particles.filter((p) => p.life > 0);
  }
  if (g.floaters.length) {
    for (const f of g.floaters) {
      f.life -= dt;
      f.y -= 0.0012 * dt;
    }
    g.floaters = g.floaters.filter((f) => f.life > 0);
  }
};

/* ------------------------------------------------------------------ */
/* Small UI pieces                                                     */
/* ------------------------------------------------------------------ */

type GlyphName = 'arrow' | 'pause' | 'play' | 'vibrate' | 'dpad';

const GLYPH_RECTS: Record<GlyphName, Array<[number, number, number, number]>> = {
  arrow: Array.from({ length: 6 }, (_, i): [number, number, number, number] => [7 - i, 4 + i, 2 + 2 * i, 1]).concat([[6, 10, 4, 3]]),
  pause: [
    [4, 3, 3, 10],
    [9, 3, 3, 10],
  ],
  play: Array.from({ length: 10 }, (_, i): [number, number, number, number] => [5, 3 + i, Math.round((i < 5 ? i + 1 : 10 - i) * 1.4), 1]),
  vibrate: [
    [5, 2, 6, 1],
    [5, 13, 6, 1],
    [5, 2, 1, 12],
    [10, 2, 1, 12],
    [7, 11, 2, 1],
    [3, 5, 1, 2],
    [2, 7, 1, 2],
    [3, 9, 1, 2],
    [12, 5, 1, 2],
    [13, 7, 1, 2],
    [12, 9, 1, 2],
  ],
  dpad: [
    [6, 2, 4, 12],
    [2, 6, 12, 4],
  ],
};

const Glyph: React.FC<{ name: GlyphName; size?: number; rotate?: number }> = ({ name, size = 16, rotate = 0 }) => (
  <svg
    viewBox="0 0 16 16"
    width={size}
    height={size}
    shapeRendering="crispEdges"
    aria-hidden
    focusable="false"
    style={{ transform: rotate ? `rotate(${rotate}deg)` : undefined, flexShrink: 0 }}
  >
    {GLYPH_RECTS[name].map(([x, y, w, h], i) => (
      <rect key={i} x={x} y={y} width={w} height={h} fill="currentColor" />
    ))}
  </svg>
);

const Stat: React.FC<{ label: string; value: number; tone: string; icon?: IconName }> = ({ label, value, tone, icon }) => (
  <div className="flex items-center gap-1 min-w-0">
    {icon && <PixelIcon name={icon} size={16} />}
    <div className="flex flex-col gap-0.5 leading-none min-w-0">
      <span className="text-[8px] text-textDim">{label}</span>
      <span className={`text-xs tabular-nums ${tone}`}>{value}</span>
    </div>
  </div>
);

const DIR_ROTATION: Record<Dir, number> = { UP: 0, RIGHT: 90, DOWN: 180, LEFT: 270 };
const DIR_LABEL: Record<Dir, string> = { UP: 'Move up', DOWN: 'Move down', LEFT: 'Move left', RIGHT: 'Move right' };

interface Settings {
  vibrate: boolean;
  swipeOnly: boolean;
}

/* ------------------------------------------------------------------ */
/* Window                                                              */
/* ------------------------------------------------------------------ */

export const SpiderSnakeWindow: React.FC = () => {
  const { isMuted, toggleSound, playClick, playError, playDownloadFanfare, playPop, playBoing } = useSound();
  const { react } = useMascot();
  const { windows, activeWindowId } = useWindowManager();
  const isMobile = useIsMobile();
  const reducedMotion = useReducedMotion();

  const win = windows.snake;
  const isOpen = win.isOpen;
  const visible = win.isOpen && !win.isMinimized;
  const isActive = activeWindowId === 'snake';

  const [status, setStatus] = useState<Status>('ready');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [best, setBest] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [settings, setSettings] = useState<Settings>({ vibrate: true, swipeOnly: false });
  const [coarse, setCoarse] = useState(false);
  const [canVibrate, setCanVibrate] = useState(false);
  const [cell, setCell] = useState(MIN_CELL);
  // Short phones (iPhone SE and friends) get a slightly smaller D-pad so board + pad fit without scrolling.
  const [compactPad, setCompactPad] = useState<0 | 1 | 2>(0);
  const [dpr, setDpr] = useState(1);
  const [pressed, setPressed] = useState<Dir | null>(null);

  const gameRef = useRef<Game | null>(null);
  if (!gameRef.current) gameRef.current = newGame();
  const bestRef = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const swipeRef = useRef<{ id: number; x: number; y: number; ox: number; oy: number; swiped: boolean } | null>(null);

  const showTouch = isMobile || coarse;
  const showDpad = showTouch && !settings.swipeOnly;
  const boardPx = cell * GRID;

  // Latest values for the animation loop and global listeners (they never re-subscribe).
  const liveRef = useRef({ visible, isActive, reduced: false, vibrate: true, boardPx });
  liveRef.current = { visible, isActive, reduced: !!reducedMotion, vibrate: settings.vibrate && canVibrate, boardPx };

  const buzz = (pattern: number | number[]) => {
    if (!liveRef.current.vibrate) return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* unsupported */
    }
  };

  const say = (frame: SpiderFrame, text: string, ms: number) => react(frame, text, ms);

  const finish = (g: Game, outcome: DeathCause | 'won') => {
    const record = g.score > bestRef.current;
    if (record) {
      bestRef.current = g.score;
      setBest(g.score);
      writeStorage(HIGHSCORE_KEY, String(g.score));
    }
    setNewBest(record);
    setScore(g.score);
    setLevel(g.level);
    setStatus(g.status);
    if (outcome === 'won') {
      playDownloadFanfare();
      say('celebrating', 'You filled the whole web! Legendary!', 3200);
      setAnnouncement(`You win! Final score ${g.score}.`);
      return;
    }
    if (record) {
      playDownloadFanfare();
      say('celebrating', `NEW HIGH SCORE: ${g.score}! Legend status!`, 2800);
    } else if (outcome === 'wall') {
      say('dizzy', 'Ouch! Hit the wall. Tap Retry!', 2600);
    } else {
      say('annoyed', 'Caught in your own web! Game over.', 2600);
    }
    setAnnouncement(`Game over. Score ${g.score}.${record ? ' New best!' : ''}`);
  };

  const events: GameEvents = {
    eat: (g, golden, leveledUp, goldenSpawned) => {
      setScore(g.score);
      setLevel(g.level);
      if (golden) playBoing();
      else playPop();
      buzz(golden ? [15, 30, 15] : 12);
      if (!g.announcedBest && g.bestAtStart > 0 && g.score > g.bestAtStart) {
        g.announcedBest = true;
        playDownloadFanfare();
        say('celebrating', 'New high score! Keep going!', 2000);
      } else if (leveledUp) {
        say('dance', `Level ${g.level}! The web spins faster.`, 1600);
      } else if (goldenSpawned) {
        say('surprised', 'A golden bug! +50 if you catch it in 6s!', 1800);
      } else if (golden) {
        say('love', 'Golden bug! +50!', 1400);
      }
    },
    die: (g, cause) => {
      const now = performance.now();
      if (!liveRef.current.reduced) {
        g.flashUntil = now + FLASH_MS;
        g.shakeUntil = now + SHAKE_MS;
      }
      playError();
      buzz([70, 40, 160]);
      finish(g, cause);
    },
    win: (g) => finish(g, 'won'),
  };
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const start = () => {
    const g = newGame(bestRef.current);
    g.status = 'playing';
    gameRef.current = g;
    setStatus('playing');
    setScore(0);
    setLevel(1);
    setNewBest(false);
    setAnnouncement('Game started.');
    playClick();
    say('typing', 'Guide Pixel Spider! Catch the web bugs!', 2200);
  };

  const pause = () => {
    const g = gameRef.current;
    if (!g || g.status !== 'playing') return;
    g.status = 'paused';
    swipeRef.current = null;
    setStatus('paused');
    setAnnouncement('Paused.');
  };

  const resume = () => {
    const g = gameRef.current;
    if (!g || g.status !== 'paused') return;
    g.status = 'playing';
    setStatus('playing');
    setAnnouncement('Resumed.');
  };

  const canRestart = (g: Game) => performance.now() - g.endedAt > RESTART_GUARD_MS;

  // Ignores taps that land on Retry in the instant after dying (mid-swipe on phones).
  const retry = () => {
    const g = gameRef.current;
    if (g && !canRestart(g)) return;
    start();
  };

  const steer = (d: Dir) => {
    const g = gameRef.current;
    if (!g) return;
    if (g.status === 'ready') {
      start();
      const fresh = gameRef.current;
      if (fresh) enqueueDir(fresh, d);
      return;
    }
    if (g.status === 'paused') resume();
    if (g.status === 'playing') enqueueDir(g, d);
  };

  // Space / tap: start, pause, resume (and retry from the keyboard).
  const primary = (allowRestart: boolean) => {
    const g = gameRef.current;
    if (!g) return;
    if (g.status === 'ready') start();
    else if (g.status === 'playing') pause();
    else if (g.status === 'paused') resume();
    else if (allowRestart && canRestart(g)) start();
  };

  const actionsRef = useRef({ steer, primary, pause, start });
  actionsRef.current = { steer, primary, pause, start };

  // Saved best + settings, input capabilities.
  useEffect(() => {
    const saved = Number.parseInt(readStorage(HIGHSCORE_KEY) ?? '', 10);
    if (Number.isFinite(saved) && saved > 0) {
      bestRef.current = saved;
      setBest(saved);
    }
    const s = readJSON<Partial<Settings> | null>(SETTINGS_KEY, null);
    if (s && typeof s === 'object') setSettings({ vibrate: s.vibrate !== false, swipeOnly: s.swipeOnly === true });
    setCanVibrate(typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function');
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(pointer: coarse)');
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  const updateSettings = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    writeStorage(SETTINGS_KEY, JSON.stringify(next));
    playClick();
  };

  // Auto-pause when the window is hidden/minimized/unfocused or the tab goes to the background.
  useEffect(() => {
    if (!visible || !isActive) actionsRef.current.pause();
  }, [visible, isActive]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) actionsRef.current.pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Closing the window throws the run away.
  useEffect(() => {
    if (isOpen) return;
    gameRef.current = newGame(bestRef.current);
    setStatus('ready');
    setScore(0);
    setLevel(1);
    setNewBest(false);
  }, [isOpen]);

  // Keyboard: arrows / WASD steer, Space or P pause (Escape is reserved for closing windows).
  useEffect(() => {
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const onKeyDown = (e: KeyboardEvent) => {
      const live = liveRef.current;
      if (!live.visible || !live.isActive || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const d = KEY_DIR[e.code];
      if (d) {
        e.preventDefault();
        actionsRef.current.steer(d);
        return;
      }
      const onButton = e.target instanceof HTMLButtonElement;
      if (e.code === 'Space' || e.code === 'KeyP') {
        e.preventDefault();
        if (!e.repeat) actionsRef.current.primary(e.code === 'Space');
      } else if (e.code === 'Enter' && !onButton) {
        e.preventDefault();
        if (!e.repeat) actionsRef.current.primary(true);
      }
    };
    // Stop Space from also "clicking" a focused toolbar button.
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && liveRef.current.visible && liveRef.current.isActive && e.target instanceof HTMLButtonElement) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Responsive sizing: the largest integer cell that fits the window's content area.
  const measure = useCallback(() => {
    const root = rootRef.current;
    const area = root?.parentElement;
    if (!root || !area) return;
    const cs = window.getComputedStyle(area);
    const availW = area.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const availH = area.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const gap = parseFloat(window.getComputedStyle(root).rowGap) || 0;
    const kids = Array.from(root.children) as HTMLElement[];
    let used = gap * Math.max(0, kids.length - 1);
    for (const k of kids) if (k !== frameRef.current) used += k.offsetHeight;
    const byW = Math.floor((availW - FRAME_PX) / GRID);
    const byH = Math.floor((availH - used - FRAME_PX) / GRID);
    // Width always wins (no horizontal overflow). Height may push the cell down to MIN_CELL
    // (12px on very short phones) before the sheet has to scroll.
    const minCell = window.innerHeight < 640 ? 12 : MIN_CELL;
    const next = Math.max(8, Math.min(MAX_CELL, byW, Math.max(minCell, byH)));
    setCell(next);
    setCompactPad(window.innerHeight < 640 ? 2 : window.innerHeight < 760 ? 1 : 0);
    setDpr(Math.min(3, Math.max(1, window.devicePixelRatio || 1)));
  }, []);

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
  }, [visible, measure, showTouch, showDpad, canVibrate]);

  // One stable loop: requestAnimationFrame + fixed-step accumulator, state read from refs.
  useEffect(() => {
    if (!visible) return;
    let raf = 0;
    let last = performance.now();
    let shaking = false;
    const bg: BgCache = { key: '', canvas: null };
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(100, Math.max(0, now - last));
      last = now;
      const g = gameRef.current;
      if (!g) return;
      const live = liveRef.current;
      if (g.status === 'playing') {
        g.clock += dt;
        g.acc += dt;
        let steps = 0;
        while (g.status === 'playing' && g.acc >= g.stepMs && steps++ < 4) {
          g.acc -= g.stepMs;
          advance(g, eventsRef.current, now, live.reduced);
        }
        if (g.golden && g.clock >= g.golden.expires) g.golden = null;
      }
      tickEffects(g, dt);

      const canvas = canvasRef.current;
      const frame = frameRef.current;
      if (!canvas || !frame) return;
      const style = window.getComputedStyle(frame);
      render(canvas, g, {
        boardPx: live.boardPx,
        now,
        pal: readPalette(style),
        font: style.fontFamily || 'monospace',
        reduced: live.reduced,
        bg,
      });
      if (now < g.shakeUntil) {
        const amp = (live.boardPx / GRID) * 0.3 * ((g.shakeUntil - now) / SHAKE_MS);
        canvas.style.transform = `translate(${((Math.random() - 0.5) * 2 * amp).toFixed(1)}px, ${((Math.random() - 0.5) * 2 * amp).toFixed(1)}px)`;
        shaking = true;
      } else if (shaking) {
        canvas.style.transform = '';
        shaking = false;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (canvasRef.current) canvasRef.current.style.transform = '';
    };
  }, [visible]);

  /* ---------------- pointer input ---------------- */

  const onBoardPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target instanceof Element && e.target.closest('button')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    swipeRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY, swiped: false };
  };

  const onBoardPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = swipeRef.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
    const d: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'RIGHT' : 'LEFT') : dy > 0 ? 'DOWN' : 'UP';
    // Re-anchor so one long drag can chain several turns.
    s.x = e.clientX;
    s.y = e.clientY;
    s.swiped = true;
    const g = gameRef.current;
    if (g && (g.status === 'over' || g.status === 'won')) return;
    steer(d);
  };

  const onBoardPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = swipeRef.current;
    swipeRef.current = null;
    if (!s || s.id !== e.pointerId || s.swiped) return;
    if (Math.hypot(e.clientX - s.ox, e.clientY - s.oy) < TAP_SLOP_PX) primary(false);
  };

  const pressDir = (d: Dir) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setPressed(d);
    steer(d);
  };
  const release = () => setPressed(null);

  /* ---------------- render ---------------- */

  const shownBest = Math.max(best, score);
  const over = status === 'over' || status === 'won';
  const statusLabel =
    status === 'ready' ? 'ready to start' : status === 'playing' ? 'playing' : status === 'paused' ? 'paused' : status === 'won' ? 'you win' : 'game over';
  const fade = reducedMotion ? { duration: 0 } : { duration: 0.15 };

  const pauseButton = (big: boolean) => (
    <button
      onClick={() => primary(false)}
      disabled={over}
      aria-label={status === 'playing' ? 'Pause game' : status === 'paused' ? 'Resume game' : 'Start game'}
      title={status === 'playing' ? 'Pause (Space / P)' : 'Play (Space)'}
      className={`win9x-button flex items-center justify-center disabled:opacity-50 ${
        big ? 'w-14 h-12 flex-col gap-1 text-[7px]' : 'w-8 h-8'
      }`}
    >
      <Glyph name={status === 'playing' ? 'pause' : 'play'} />
      {big && <span>{status === 'playing' ? 'PAUSE' : 'PLAY'}</span>}
    </button>
  );

  const padSize = compactPad === 2 ? "w-11 h-11" : compactPad === 1 ? "w-[52px] h-[52px]" : "w-16 h-16";

  return (
    <Window id="snake">
      <div ref={rootRef} className="w-full min-w-0 flex flex-col items-center gap-2 font-pixel select-none text-text">
        {/* Header: score / level / best + toggles */}
        <div
          className="win9x-box-recessed flex items-center gap-3 px-2 py-1.5 max-w-full"
          style={{ width: boardPx + FRAME_PX }}
        >
          <Stat label="SCORE" value={score} tone="text-green" />
          <Stat label="LEVEL" value={level} tone="text-lavender" />
          <Stat label="BEST" value={shownBest} tone="text-yellow" icon="trophy" />
          <div className="ml-auto flex items-center gap-1 shrink-0">
            {!showTouch && pauseButton(false)}
            <button
              onClick={toggleSound}
              aria-label={isMuted ? 'Turn sound on' : 'Turn sound off'}
              aria-pressed={!isMuted}
              title={isMuted ? 'Sound off' : 'Sound on'}
              className="win9x-button w-8 h-8 flex items-center justify-center"
            >
              <PixelIcon name={isMuted ? 'sound-off' : 'sound-on'} />
            </button>
            {showTouch && canVibrate && (
              <button
                onClick={() => updateSettings({ vibrate: !settings.vibrate })}
                aria-label="Vibration"
                aria-pressed={settings.vibrate}
                title={settings.vibrate ? 'Vibration on' : 'Vibration off'}
                className={`win9x-button w-8 h-8 flex items-center justify-center ${settings.vibrate ? '' : 'opacity-50'}`}
              >
                <Glyph name="vibrate" />
              </button>
            )}
          </div>
        </div>

        {/* Board (always dark) */}
        <div
          ref={frameRef}
          className={`theme-dark relative shrink-0 overflow-hidden border-2 border-spidey bg-base ${
            status === 'playing' ? '' : 'cursor-pointer'
          }`}
          style={{ width: boardPx + FRAME_PX, height: boardPx + FRAME_PX, touchAction: 'none', WebkitTouchCallout: 'none' }}
          onPointerDown={onBoardPointerDown}
          onPointerMove={onBoardPointerMove}
          onPointerUp={onBoardPointerUp}
          onPointerCancel={() => {
            swipeRef.current = null;
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <canvas
            ref={canvasRef}
            width={Math.round(boardPx * dpr)}
            height={Math.round(boardPx * dpr)}
            role="img"
            aria-label={`SpiderSnake board, ${statusLabel}. Score ${score}, level ${level}, best ${shownBest}.`}
            style={{ width: boardPx, height: boardPx, display: 'block', imageRendering: 'pixelated' }}
          />

          {status === 'ready' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={fade}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center bg-base/70"
            >
              <PixelIcon name="spider" size={32} />
              <h3 className="text-sm text-yellow tracking-wide">SPIDERSNAKE</h3>
              <p className="font-mono text-[11px] text-lavender leading-snug max-w-[16rem]">
                {showTouch ? 'Swipe or use the arrows.' : 'Swipe or use the arrows / WASD.'} Eat bugs, avoid walls and your
                own silk.
              </p>
              <p className="flex items-center gap-1 text-[10px] text-yellow">
                <PixelIcon name="trophy" /> BEST {best}
              </p>
              <button
                onClick={start}
                className="win9x-button win9x-button-spidey px-6 min-h-[48px] text-xs flex items-center gap-2"
              >
                <Glyph name="play" /> START
              </button>
              {cell >= 16 && <p className="font-mono text-[10px] text-textDim">{showTouch ? 'or tap the board' : 'or press Space'}</p>}
            </motion.div>
          )}

          {status === 'paused' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={fade}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-3 text-center bg-base/75"
            >
              <h3 className="text-sm text-yellow">PAUSED</h3>
              <p className="font-mono text-[11px] text-lavender">
                {showTouch ? 'Tap to resume' : 'Click, Space or P to resume'}
              </p>
              <button
                onClick={resume}
                className="win9x-button win9x-button-spidey px-6 min-h-[48px] text-xs flex items-center gap-2"
              >
                <Glyph name="play" /> RESUME
              </button>
            </motion.div>
          )}

          {over && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={reducedMotion ? { duration: 0 } : { duration: 0.2, delay: 0.25 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center bg-base/80"
            >
              <h3 className={`text-[16px] ${status === 'won' ? 'text-green' : 'text-red'}`}>
                {status === 'won' ? 'WEB COMPLETE!' : 'GAME OVER'}
              </h3>
              <p className="text-xs text-text">SCORE {score}</p>
              <p className="flex items-center gap-1 text-[10px] text-yellow">
                <PixelIcon name="trophy" /> BEST {best}
              </p>
              {newBest && (
                <span className="flex items-center gap-1 bg-yellow text-shade px-2 py-1 text-[10px]">
                  <PixelIcon name="star" /> NEW BEST!
                </span>
              )}
              <button
                onClick={retry}
                aria-label="Retry"
                className="win9x-button win9x-button-spidey px-8 min-h-[52px] text-sm flex items-center gap-2 mt-1"
              >
                <PixelIcon name="restart" /> RETRY
              </button>
              {!showTouch && <p className="font-mono text-[10px] text-textDim">or press Enter</p>}
            </motion.div>
          )}

          <p className="sr-only" aria-live="polite">
            {announcement}
          </p>
        </div>

        {/* Controls (52px pads on short screens, 64px otherwise; both above the 44px touch minimum) */}
        <div className="w-full flex flex-col items-center gap-2" style={{ touchAction: 'manipulation' }}>
          {showDpad ? (
            <div className="flex items-end justify-center gap-3">
              {pauseButton(true)}
              <div className="grid grid-cols-3 gap-1" role="group" aria-label="Direction pad">
                {(['corner', 'UP', 'corner', 'LEFT', 'centre', 'RIGHT', 'corner', 'DOWN', 'corner'] as const).map((slot, i) => {
                  if (slot === 'corner') return <div key={i} className={padSize} aria-hidden />;
                  if (slot === 'centre')
                    return (
                      <div key={i} className={`${padSize} win9x-box-recessed flex items-center justify-center`} aria-hidden>
                        <PixelIcon name="spider" size={32} />
                      </div>
                    );
                  const d = slot;
                  return (
                    <button
                      key={i}
                      aria-label={DIR_LABEL[d]}
                      onPointerDown={pressDir(d)}
                      onPointerUp={release}
                      onPointerLeave={release}
                      onPointerCancel={release}
                      onContextMenu={(e) => e.preventDefault()}
                      onClick={(e) => {
                        if (e.detail === 0) steer(d); // keyboard activation
                      }}
                      className={`${padSize} flex items-center justify-center ${
                        pressed === d ? 'win9x-box-recessed text-lavender translate-x-px translate-y-px' : 'win9x-button'
                      }`}
                    >
                      <Glyph name="arrow" size={32} rotate={DIR_ROTATION[d]} />
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => updateSettings({ swipeOnly: true })}
                aria-label="Swipe only: hide the D-pad"
                aria-pressed={false}
                className="win9x-button w-14 h-12 flex flex-col items-center justify-center gap-1 text-[7px] leading-none"
              >
                <Glyph name="dpad" />
                <span>SWIPE</span>
              </button>
            </div>
          ) : showTouch ? (
            <div className="w-full flex items-center justify-center gap-2 flex-wrap">
              {pauseButton(true)}
              <p className="font-mono text-[10px] text-lavender text-center min-w-0 flex-1">
                Swipe on the board to steer · tap it to pause
              </p>
              <button
                onClick={() => updateSettings({ swipeOnly: false })}
                aria-label="Swipe only is on: show the D-pad"
                aria-pressed={true}
                className="win9x-button w-14 h-12 flex flex-col items-center justify-center gap-1 text-[7px] leading-none"
              >
                <Glyph name="dpad" />
                <span>D-PAD</span>
              </button>
            </div>
          ) : (
            <p className="font-mono text-[10px] text-lavender text-center">
              ARROWS / WASD move · SPACE / P pause · click board to pause
            </p>
          )}
        </div>
      </div>
    </Window>
  );
};
