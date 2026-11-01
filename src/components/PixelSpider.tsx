'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import type { AnimationPlaybackControls } from 'framer-motion';
import { SpeechBubble } from './SpeechBubble';
import { SpiderSprite, spriteKeyframes } from './mascot/SpiderSprite';
import { ANIM_NAMES, DEFAULT_ANIMS, DIRECTIONAL_ANIMS, isAnimMeta, MOOD_TO_ANIM, SPRITE_GEOMETRY, type AnimMeta, type AnimName } from './mascot/anims';
import { useMascot } from '@/context/MascotContext';
import { useSound } from '@/context/SoundContext';
import { useSettings } from '@/context/SettingsContext';
import { useWindowManager, type WindowId, type WindowState } from '@/context/WindowManagerContext';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { asset } from '@/lib/asset';
import { PixelIcon } from './PixelIcon';

export type { SpiderFrame } from './mascot/anims';

// ------------------------------------------------------------------ tuning
const GRAVITY = 2600; // px/s²
const MAX_THROW = 1900; // px/s
const WALK_SPEED = 80; // px/s
const RUN_SPEED = 230; // px/s
const CLIMB_SPEED = 120; // px/s
const DRAG_THREAD = 34; // px of web between the cursor and the spider's head while carried
const SLEEP_AFTER_MS = 90_000; // 45s late at night (he gets sleepy)
const TITLEBAR_BUTTONS_PX = 100; // keep clear of _ □ ✕ when perching
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

const PET_LINES = ['Hehe, that tickles!', 'Purr… in 8-bit.', 'Best. User. Ever.', 'Okay okay, I like you too.'];
const ANNOYED_LINES = ['Hey! Easy on the mouse.', 'I bruise easily, you know.', 'Click me one more time…'];
const DIZZY_LINES = ['Too… many… clicks…', 'The room is spinning.', 'Who turned on the washing machine?'];
const WAKE_LINES = ['Huh?! I was just resting my eyes.', "I'm up! I'm up!", 'Zz— oh, hi!'];
const THROW_LINES = ['Wheee!', 'THWIP!', 'Again! Again!', 'I meant to do that.'];

type Mode = 'stand' | 'walk' | 'hop' | 'travel' | 'drag' | 'fall' | 'land';
type Surface = { kind: 'floor' } | { kind: 'window'; id: WindowId; offsetX: number };

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const isTypingTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

export const PixelSpider: React.FC = () => {
  const mascot = useMascot();
  const { playBoing, playThud, playPop, playSwing, playSpidermanTheme } = useSound();
  const { settings, updateSettings } = useSettings();
  const { windows, activeWindowId } = useWindowManager();
  const reduceMotion = !!useReducedMotion();
  const isMobile = useIsMobile();

  // ---------------------------------------------------------------- geometry
  const size = isMobile ? 64 : 128;
  const feet = Math.round(size * SPRITE_GEOMETRY.feet);
  const head = Math.round(size * SPRITE_GEOMETRY.headTop);
  const cx = Math.round(size * SPRITE_GEOMETRY.centerX);
  const geo = useRef({ size, feet, head, cx, isMobile });
  geo.current = { size, feet, head, cx, isMobile };

  const metrics = useCallback(() => {
    const g = geo.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const floorTop = vh - (g.isMobile ? 56 : 40) - 2; // top edge of the taskbar / tab bar
    return { vw, vh, floorY: floorTop - g.feet, homeX: vw - g.size - (g.isMobile ? 8 : 20) };
  }, []);

  // ---------------------------------------------------------------- assets
  const [anims, setAnims] = useState<Record<AnimName, AnimMeta>>(DEFAULT_ANIMS);
  const [missing, setMissing] = useState<Partial<Record<AnimName, boolean>>>({});
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(asset('/mascot/v2/anims.json'), { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: unknown) => {
        if (!json || typeof json !== 'object') return;
        const data = json as Record<string, unknown>;
        setAnims((prev) => {
          const next = { ...prev };
          ANIM_NAMES.forEach((n) => {
            if (isAnimMeta(data[n])) next[n] = data[n] as AnimMeta;
          });
          return next;
        });
      })
      .catch(() => undefined);
    const imgs = ANIM_NAMES.map((n) => {
      const img = new Image();
      img.onerror = () => setMissing((m) => ({ ...m, [n]: true }));
      img.src = asset(`/mascot/v2/${n}.png`);
      return img;
    });
    return () => {
      ctrl.abort();
      imgs.forEach((i) => (i.onerror = null));
    };
  }, []);
  const keyframes = useMemo(() => spriteKeyframes(Object.values(anims), size), [anims, size]);

  // ---------------------------------------------------------------- state
  const mx = useMotionValue(-999);
  const my = useMotionValue(-999);
  const rotTarget = useMotionValue(0);
  const rot = useSpring(rotTarget, { stiffness: 180, damping: 14 });
  const threadLeft = useTransform(mx, (v) => v + geo.current.cx - 1);
  const threadHeight = useTransform(my, (v) => Math.max(0, v + geo.current.head + 4));

  const [mode, setModeState] = useState<Mode>('stand');
  const [mood, setMoodState] = useState<{ anim: AnimName; id: number } | null>(null);
  const [sleeping, setSleeping] = useState(false);
  const [look, setLook] = useState<'left' | 'right' | null>(null);
  const [blink, setBlink] = useState(false);
  const [flip, setFlip] = useState(false);
  const [running, setRunning] = useState(false);
  const [travelAnim, setTravelAnim] = useState<AnimName>('dangle');
  const [webShot, setWebShot] = useState<{ id: number; x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [playId, setPlayId] = useState(0);
  const [puffId, setPuffId] = useState(0);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [, forceRender] = useState(0);

  const E = useRef({
    mode: 'stand' as Mode,
    surface: { kind: 'floor' } as Surface,
    atHome: true,
    vx: 0,
    vy: 0,
    bounced: false,
    raf: 0,
    controls: [] as AnimationPlaybackControls[],
    timers: [] as ReturnType<typeof setTimeout>[],
    moodTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    lastInput: Date.now(),
    nextActionAt: Date.now() + rand(2_500, 4_000),
    clicks: [] as number[],
    pet: { dir: 0, x: 0, changes: [] as number[], cooldownUntil: 0 },
    konami: [] as string[],
    drag: null as null | { id: number; startX: number; startY: number; active: boolean; samples: Array<{ x: number; y: number; t: number }> },
    sleeping: false,
    pointer: null as null | { x: number; y: number; t: number },
    hoverCooldownUntil: 0,
    waveCooldownUntil: 0,
    rideFrom: null as null | { x: number; y: number },
    petToggle: false,
  });
  const windowsRef = useRef(windows);
  windowsRef.current = windows;
  const activeRef = useRef(activeWindowId);
  activeRef.current = activeWindowId;
  const mascotRef = useRef(mascot);
  mascotRef.current = mascot;

  const setMode = useCallback((m: Mode) => {
    E.current.mode = m;
    setModeState(m);
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    E.current.timers.push(t);
  }, []);

  const stopMotion = useCallback(() => {
    const e = E.current;
    e.controls.forEach((c) => c.stop());
    e.controls = [];
    if (e.raf) cancelAnimationFrame(e.raf);
    e.raf = 0;
  }, []);

  useEffect(
    () => () => {
      stopMotion();
      E.current.timers.forEach(clearTimeout);
      if (E.current.moodTimer) clearTimeout(E.current.moodTimer);
    },
    [stopMotion]
  );

  const setMood = useCallback((anim: AnimName | null, ms = 2000) => {
    const e = E.current;
    if (e.moodTimer) clearTimeout(e.moodTimer);
    if (!anim) {
      setMoodState(null);
      return;
    }
    setMoodState({ anim, id: Date.now() });
    e.moodTimer = setTimeout(() => setMoodState(null), ms);
  }, []);

  const say = useCallback((text: string) => mascotRef.current.setSpeechText(text), []);

  const stand = useCallback(
    (s: Surface) => {
      const e = E.current;
      e.surface = s;
      e.rideFrom = null;
      setMode('stand');
      setRunning(false);
      rotTarget.set(0);
      e.nextActionAt = Math.max(e.nextActionAt, Date.now() + rand(2_200, 5_000));
    },
    [setMode, rotTarget]
  );

  // ---------------------------------------------------------------- placement
  const goHomeInstant = useCallback(() => {
    stopMotion();
    const { homeX, floorY } = metrics();
    mx.set(homeX);
    my.set(floorY);
    E.current.atHome = true;
    stand({ kind: 'floor' });
  }, [metrics, mx, my, stand, stopMotion]);

  useLayoutEffect(() => {
    goHomeInstant();
    // Re-home when the layout switches between phone and desktop sizes.
  }, [size, goHomeInstant]);

  useEffect(() => {
    const onResize = () => {
      const e = E.current;
      if (e.mode === 'drag') return;
      if (e.atHome || e.surface.kind !== 'floor' || e.mode !== 'stand') {
        if (e.surface.kind === 'window' && e.mode === 'stand') return; // rides its window
        goHomeInstant();
        return;
      }
      const { vw, floorY } = metrics();
      mx.set(clamp(mx.get(), 0, vw - geo.current.size));
      my.set(floorY);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [goHomeInstant, metrics, mx, my]);

  // ---------------------------------------------------------------- landing & falling
  const land = useCallback(
    (s: Surface) => {
      const e = E.current;
      const impact = Math.hypot(e.vx, e.vy);
      stopMotion();
      e.surface = s;
      e.vx = 0;
      e.vy = 0;
      rotTarget.set(0);
      setMode('land');
      setPlayId((n) => n + 1);
      setPuffId((n) => n + 1);
      playThud();
      later(() => {
        if (E.current.mode !== 'land') return;
        stand(s);
        if (impact > 1500) {
          setMood('dizzy', 1800);
          if (Math.random() < 0.5) mascotRef.current.setSpeechText('Ow. Stars everywhere.');
        }
      }, 260);
      e.nextActionAt = Date.now() + rand(2_500, 5_000);
    },
    [later, playThud, rotTarget, setMode, setMood, stand, stopMotion]
  );

  const startFall = useCallback(
    (vx: number, vy: number) => {
      const e = E.current;
      stopMotion();
      e.atHome = false;
      e.vx = clamp(vx, -MAX_THROW, MAX_THROW);
      e.vy = clamp(vy, -MAX_THROW, MAX_THROW);
      e.bounced = false;
      setMode('fall');
      let last = performance.now();
      const step = (now: number) => {
        const dt = Math.min(0.032, (now - last) / 1000);
        last = now;
        const g = geo.current;
        const { vw, floorY } = metrics();
        const prevFeet = my.get() + g.feet;
        // Exact under constant gravity (velocity Verlet), so aimed jumps land where they were aimed.
        let x = mx.get() + e.vx * dt;
        let y = my.get() + e.vy * dt + 0.5 * GRAVITY * dt * dt;
        e.vy += GRAVITY * dt;
        e.vx *= 1 - 0.6 * dt; // air drag
        if (x < 0 || x > vw - g.size) {
          x = clamp(x, 0, vw - g.size);
          e.vx = -e.vx * 0.5;
        }
        if (y < -g.size) {
          y = -g.size;
          e.vy = Math.max(0, e.vy);
        }
        rotTarget.set(clamp(e.vx * 0.02, -25, 25));
        const feetY = y + g.feet;
        // Land on the title bar of a visible window (topmost first)...
        if (e.vy > 0) {
          const centre = x + g.cx;
          const hits = Object.values(windowsRef.current)
            .filter((w: WindowState) => w.isOpen && !w.isMinimized && !w.isMaximized)
            .filter((w) => centre > w.position.x + 12 && centre < w.position.x + w.size.width - 12)
            .filter((w) => prevFeet <= w.position.y + 1 && feetY >= w.position.y)
            .sort((a, b) => b.zIndex - a.zIndex);
          if (hits[0] && !g.isMobile) {
            const w = hits[0];
            mx.set(x);
            my.set(w.position.y - g.feet);
            land({ kind: 'window', id: w.id, offsetX: x - w.position.x });
            return;
          }
        }
        // ...or on the floor, with one bounce if it hit hard.
        if (y >= floorY) {
          if (e.vy > 1100 && !e.bounced) {
            e.bounced = true;
            e.vy = -e.vy * 0.32;
            y = floorY;
            playThud();
          } else {
            mx.set(x);
            my.set(floorY);
            land({ kind: 'floor' });
            return;
          }
        }
        mx.set(x);
        my.set(y);
        e.raf = requestAnimationFrame(step);
      };
      e.raf = requestAnimationFrame(step);
    },
    [land, metrics, mx, my, rotTarget, setMode, stopMotion]
  );

  // ---------------------------------------------------------------- moves
  const hop = useCallback(
    (height = 38) => {
      const e = E.current;
      if (e.mode !== 'stand' || reduceMotion) return;
      setMode('hop');
      setPlayId((n) => n + 1);
      playBoing();
      const y0 = my.get();
      const dur = anims.hop.frames / anims.hop.fps;
      const c = animate(my, [y0, y0, y0 - height, y0 - height * 0.9, y0], { duration: dur, times: [0, 0.18, 0.48, 0.62, 1], ease: 'easeOut' });
      e.controls = [c];
      c.then(() => {
        if (E.current.mode === 'hop') stand(E.current.surface);
      });
    },
    [anims.hop, my, playBoing, reduceMotion, setMode, stand]
  );

  // Walk (or run) along whatever he's standing on: the taskbar or a window's title bar.
  const walkTo = useCallback(
    (targetX: number, opts: { run?: boolean; then?: () => void } = {}) => {
      const e = E.current;
      if (reduceMotion || (e.mode !== 'stand' && e.mode !== 'walk')) return;
      const g = geo.current;
      const s0 = e.surface;
      let lo = 0;
      let hi = metrics().vw - g.size;
      if (s0.kind === 'window') {
        const w = windowsRef.current[s0.id];
        if (!w) return;
        lo = w.position.x - g.size * 0.25;
        hi = w.position.x + w.size.width - TITLEBAR_BUTTONS_PX - g.size * 0.75;
        if (hi <= lo) return;
      }
      const x1 = clamp(targetX, lo, hi);
      stopMotion();
      const x0 = mx.get();
      const dist = Math.abs(x1 - x0);
      if (dist < 4) {
        opts.then?.();
        return;
      }
      const run = !!opts.run;
      setFlip(x1 < x0);
      setRunning(run);
      setMode('walk');
      e.atHome = false;
      const c = animate(mx, x1, { duration: dist / (run ? RUN_SPEED : WALK_SPEED), ease: dist > 140 ? 'easeInOut' : 'linear' });
      e.controls = [c];
      c.then(() => {
        const cur = E.current;
        if (cur.mode !== 'walk') return;
        if (cur.surface.kind === 'window') {
          const w = windowsRef.current[cur.surface.id];
          if (w) cur.surface = { ...cur.surface, offsetX: mx.get() - w.position.x };
        } else {
          cur.atHome = Math.abs(x1 - metrics().homeX) < 2;
        }
        stand(cur.surface);
        opts.then?.();
      });
    },
    [metrics, mx, reduceMotion, setMode, stand, stopMotion]
  );

  // Swing on a web line (from the top of the screen) to a point, then land there.
  const travelTo = useCallback(
    (x1: number, y1: number, surface: Surface, opts: { arc?: number; duration?: number; anim?: AnimName; straight?: boolean } = {}) => {
      const e = E.current;
      if (reduceMotion) return;
      stopMotion();
      e.atHome = false;
      const x0 = mx.get();
      const y0 = my.get();
      const peak = opts.straight ? (y0 + y1) / 2 : Math.max(-geo.current.head + 12, Math.min(y0, y1) - (opts.arc ?? 140));
      setTravelAnim(opts.anim ?? 'dangle');
      setMode('travel');
      if (!opts.straight) playSwing();
      const duration = opts.duration ?? clamp(Math.hypot(x1 - x0, y1 - y0) / 700, 0.9, 1.6);
      const t = { duration, times: [0, 0.5, 1], ease: opts.straight ? ('linear' as const) : ('easeInOut' as const) };
      rotTarget.set(opts.straight ? 0 : clamp((x1 - x0) * -0.03, -20, 20));
      const cx1 = animate(mx, [x0, (x0 + x1) / 2, x1], t);
      const cy1 = animate(my, [y0, peak, y1], t);
      e.controls = [cx1, cy1];
      cy1.then(() => {
        if (E.current.mode !== 'travel') return;
        mx.set(x1);
        my.set(y1);
        if (opts.straight) stand(surface);
        else land(surface);
      });
    },
    [land, mx, my, playSwing, reduceMotion, rotTarget, setMode, stand, stopMotion]
  );

  // Jump with a real physics arc toward (x1, y1): crouch, then launch into the fall integrator,
  // which lands on title bars and the taskbar by itself.
  const jumpTo = useCallback(
    (x1: number, y1: number) => {
      const e = E.current;
      if (reduceMotion || e.mode !== 'stand') return false;
      const g = geo.current;
      const x0 = mx.get();
      const y0 = my.get();
      let apexY = Math.max(-g.head + 10, Math.min(y0, y1) - rand(45, 80));
      // Respect the integrator's speed limit, then aim with the apex that limit really gives.
      const vy = -Math.min(MAX_THROW, Math.sqrt(2 * GRAVITY * (y0 - apexY)));
      apexY = y0 - (vy * vy) / (2 * GRAVITY);
      if (apexY > y1 - 24) return false; // too high to reach in one jump: the brain climbs instead
      const T = -vy / GRAVITY + Math.sqrt((2 * (y1 - apexY)) / GRAVITY);
      const vx = ((x1 - x0) * 0.6) / (1 - Math.exp(-0.6 * T)); // undo the air drag in the integrator
      setFlip(x1 < x0);
      setMode('hop');
      setPlayId((n) => n + 1);
      playBoing();
      later(() => {
        if (E.current.mode === 'hop') startFall(vx, vy);
      }, 130);
      return true;
    },
    [later, mx, my, playBoing, reduceMotion, setMode, startFall]
  );

  // Climb straight up a thread onto a title bar, or rappel down to the taskbar.
  const climbTo = useCallback(
    (y1: number, surface: Surface) => {
      const dist = Math.abs(my.get() - y1);
      travelTo(mx.get(), y1, surface, { straight: true, anim: y1 < my.get() ? 'climb' : 'dangle', duration: Math.max(0.5, dist / CLIMB_SPEED) });
    },
    [mx, my, travelTo]
  );

  const goHome = useCallback(() => {
    const e = E.current;
    const { homeX, floorY } = metrics();
    if (e.surface.kind === 'floor' && e.mode === 'stand') walkTo(homeX);
    else if (e.mode === 'stand' || e.mode === 'walk') {
      travelTo(homeX, floorY, { kind: 'floor' });
      e.atHome = true;
    }
  }, [metrics, travelTo, walkTo]);

  const perchTarget = useCallback((w: WindowState) => {
    const g = geo.current;
    const x = w.position.x + w.size.width - TITLEBAR_BUTTONS_PX - g.size;
    const y = w.position.y - g.feet;
    if (x < w.position.x + 8 || x < 4 || y + g.head < 6 || x + g.size > window.innerWidth - 4) return null;
    return { x, y, surface: { kind: 'window' as const, id: w.id, offsetX: x - w.position.x } };
  }, []);

  // ---------------------------------------------------------------- interactions
  const pet = useCallback(() => {
    const e = E.current;
    if (Date.now() < e.pet.cooldownUntil) return;
    e.pet.cooldownUntil = Date.now() + 4000;
    setSleeping(false);
    e.sleeping = false;
    e.petToggle = !e.petToggle;
    setMood(e.petToggle ? 'love' : 'laugh', 3200);
    playPop();
    say(pick(PET_LINES));
  }, [playPop, say, setMood]);

  const wake = useCallback(() => {
    const e = E.current;
    if (!e.sleeping) return;
    e.sleeping = false;
    setSleeping(false);
    setMood('surprised', 900);
    if (Math.random() < 0.4) say(pick(WAKE_LINES));
  }, [say, setMood]);

  const handleClick = useCallback(() => {
    const e = E.current;
    const now = Date.now();
    e.clicks = [...e.clicks.filter((t) => now - t < 2500), now];
    wake();
    if (e.clicks.length >= 7) {
      e.clicks = [];
      setMood('dizzy', 3200);
      say(pick(DIZZY_LINES));
      return;
    }
    if (e.clicks.length >= 4) {
      setMood('annoyed', 2200);
      say(pick(ANNOYED_LINES));
      return;
    }
    mascotRef.current.triggerRandomInteraction();
    hop();
  }, [hop, say, setMood, wake]);

  // Pointer: click, or pick up / carry / throw.
  const onPointerDown = (ev: React.PointerEvent<HTMLButtonElement>) => {
    ev.stopPropagation();
    if (ev.button !== 0) return;
    setMenu(null);
    E.current.drag = { id: ev.pointerId, startX: ev.clientX, startY: ev.clientY, active: false, samples: [] };
    ev.currentTarget.setPointerCapture(ev.pointerId);
  };

  const onPointerMove = (ev: React.PointerEvent<HTMLButtonElement>) => {
    const e = E.current;
    const d = e.drag;
    if (!d || d.id !== ev.pointerId) return;
    if (!d.active) {
      if (reduceMotion || Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY) < 6) return;
      d.active = true;
      stopMotion();
      e.atHome = false;
      e.sleeping = false;
      setSleeping(false);
      setMood(null);
      setMode('drag');
    }
    const g = geo.current;
    const x = ev.clientX - g.cx;
    const y = ev.clientY + DRAG_THREAD - g.head;
    const now = performance.now();
    d.samples = [...d.samples.filter((s) => now - s.t < 90), { x: ev.clientX, y: ev.clientY, t: now }];
    const prevX = mx.get();
    mx.set(x);
    my.set(y);
    rotTarget.set(clamp((prevX - x) * 1.6, -32, 32));
  };

  const onPointerUp = (ev: React.PointerEvent<HTMLButtonElement>) => {
    const e = E.current;
    const d = e.drag;
    e.drag = null;
    if (!d || d.id !== ev.pointerId) return;
    if (!d.active) {
      handleClick();
      return;
    }
    const first = d.samples[0];
    const lastS = d.samples[d.samples.length - 1];
    const dt = first && lastS ? Math.max(0.016, (lastS.t - first.t) / 1000) : 1;
    const vx = first && lastS ? (lastS.x - first.x) / dt : 0;
    const vy = first && lastS ? (lastS.y - first.y) / dt : 0;
    if (Math.hypot(vx, vy) > 900) say(pick(THROW_LINES));
    startFall(vx, vy);
  };

  // Window riding: stand on a title bar and move with it; fall if it goes away.
  useEffect(() => {
    const e = E.current;
    if (e.surface.kind !== 'window' || (e.mode !== 'stand' && e.mode !== 'land' && e.mode !== 'walk')) return;
    const w = windows[e.surface.id];
    if (!w || !w.isOpen || w.isMinimized || w.isMaximized) {
      setMood('surprised', 700);
      startFall(0, -200);
      return;
    }
    const prev = e.rideFrom;
    e.rideFrom = { x: w.position.x, y: w.position.y };
    if (prev && Math.hypot(w.position.x - prev.x, w.position.y - prev.y) > 48) {
      // Window yanked hard: he loses his balance and tumbles off.
      mascotRef.current.setSpeechText(pick(['Whoa! Easy!', 'Not so fast!', 'AAAH!']));
      startFall((w.position.x - prev.x) * 9, Math.min(-250, (w.position.y - prev.y) * 9));
      return;
    }
    if (e.mode === 'walk') {
      // Keep walking relative to the moving window.
      if (prev) {
        mx.set(mx.get() + (w.position.x - prev.x));
        my.set(w.position.y - geo.current.feet);
      }
      return;
    }
    mx.set(w.position.x + e.surface.offsetX);
    my.set(w.position.y - geo.current.feet);
  }, [windows, mx, my, setMood, startFall]);

  // Global input: cursor tracking, petting, sleep/wake, typing, Konami code.
  useEffect(() => {
    const onMove = (ev: PointerEvent) => {
      const e = E.current;
      e.lastInput = Date.now();
      if (ev.pointerType !== 'touch') e.pointer = { x: ev.clientX, y: ev.clientY, t: Date.now() };
      if (e.sleeping) wake();
      if (e.mode !== 'stand' || ev.pointerType === 'touch') return;
      const g = geo.current;
      const sx = mx.get();
      const sy = my.get();
      const dx = ev.clientX - (sx + g.cx);
      const dy = ev.clientY - (sy + g.size / 2);
      const near = Math.hypot(dx, dy) < 520;
      setLook(!near || Math.abs(dx) < 46 ? null : dx < 0 ? 'left' : 'right');
      // Petting = wiggling the cursor over the spider.
      const inside = ev.clientX > sx + g.size * 0.2 && ev.clientX < sx + g.size * 0.8 && ev.clientY > sy + g.head && ev.clientY < sy + g.feet;
      if (!inside) return;
      const step = ev.clientX - e.pet.x;
      e.pet.x = ev.clientX;
      if (Math.abs(step) < 3) return;
      const dir = Math.sign(step);
      if (dir !== e.pet.dir) {
        e.pet.dir = dir;
        const now = Date.now();
        e.pet.changes = [...e.pet.changes.filter((t) => now - t < 1600), now];
        if (e.pet.changes.length >= 5) {
          e.pet.changes = [];
          pet();
        }
      }
    };
    const onKey = (ev: KeyboardEvent) => {
      const e = E.current;
      e.lastInput = Date.now();
      if (e.sleeping) wake();
      e.konami = [...e.konami, ev.key.length === 1 ? ev.key.toLowerCase() : ev.key].slice(-KONAMI.length);
      if (e.konami.join(',') === KONAMI.join(',')) {
        e.konami = [];
        setMood('dance', 9000);
        say('Konami code accepted. Dance break!');
        playSpidermanTheme();
        return;
      }
      if (isTypingTarget(ev.target) && e.mode === 'stand') setMoodRef.current('typing', 1100);
    };
    const onAny = () => {
      E.current.lastInput = Date.now();
      if (E.current.sleeping) wake();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onAny);
    window.addEventListener('wheel', onAny, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onAny);
      window.removeEventListener('wheel', onAny);
    };
  }, [mx, my, pet, playSpidermanTheme, say, setMood, wake]);

  // Typing shouldn't override a bigger mood that's already playing.
  const moodRef = useRef(mood);
  moodRef.current = mood;
  const setMoodRef = useRef((anim: AnimName, ms: number) => {
    if (!moodRef.current || moodRef.current.anim === 'typing') setMood(anim, ms);
  });

  // Blink every few seconds while idle.
  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 150);
    }, 4200);
    return () => clearInterval(id);
  }, [reduceMotion]);

  const animMs = useCallback((a: AnimName) => (anims[a].frames / anims[a].fps) * 1000 + 250, [anims]);

  // Shoot a web line at a point (usually the cursor): plays the shoot-web animation facing it.
  const shootWebAt = useCallback(
    (tx: number, ty: number) => {
      const g = geo.current;
      const sx = mx.get();
      const sy = my.get();
      const left = tx < sx + g.cx;
      setFlip(left);
      setMood('shoot-web', animMs('shoot-web'));
      playSwing();
      const hx = sx + (left ? g.size * 0.18 : g.size * 0.82);
      const hy = sy + g.size * 0.52;
      later(() => setWebShot({ id: Date.now(), x1: hx, y1: hy, x2: tx, y2: ty }), 140);
      later(() => setWebShot(null), 1100);
    },
    [animMs, later, mx, my, playSwing, setMood]
  );

  const fidget = useCallback(() => {
    const night = new Date().getHours() < 6;
    const options: AnimName[] = night
      ? ['yawn', 'yawn', 'stretch', 'scratch', 'sit']
      : ['stretch', 'yawn', 'scratch', 'sneeze', 'kick', 'thumbs-up', 'laugh', 'look-left', 'look-right', 'wave', 'shrug'];
    const a = pick(options);
    if (DIRECTIONAL_ANIMS.has(a)) setFlip(Math.random() < 0.5);
    const ms = a === 'scratch' || a === 'laugh' ? 2200 : a === 'look-left' || a === 'look-right' ? 1100 : a === 'wave' ? 2000 : a === 'sit' ? rand(5000, 8000) : animMs(a);
    setMood(a, ms);
  }, [animMs, setMood]);

  // Windows he could jump or climb onto from where he is.
  const reachableWindows = useCallback(() => {
    const g = geo.current;
    const sx = mx.get() + g.cx;
    const feetY = my.get() + g.feet;
    const cur = E.current.surface;
    return Object.values(windowsRef.current).filter((w) => {
      if (!w.isOpen || w.isMinimized || w.isMaximized) return false;
      if (cur.kind === 'window' && cur.id === w.id) return false;
      const usable = w.size.width - TITLEBAR_BUTTONS_PX - g.size * 0.5;
      if (usable < 40 || w.position.y - g.feet + g.head < 8) return false;
      const dy = feetY - w.position.y;
      const nearestX = clamp(sx, w.position.x + 20, w.position.x + usable);
      return dy > -260 && dy < 780 && Math.abs(nearestX - sx) < 640;
    });
  }, [mx, my]);

  // The "brain": every second or so pick the next activity, so he's always up to something.
  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => {
      const e = E.current;
      const m = mascotRef.current;
      if (document.hidden || e.mode !== 'stand' || moodRef.current || m.frame !== 'idle' || m.isSwinging || e.drag) return;
      const now = Date.now();
      const sleepAfter = new Date().getHours() < 6 ? 45_000 : SLEEP_AFTER_MS;
      if (!e.sleeping && now - e.lastInput > sleepAfter) {
        e.sleeping = true;
        setSleeping(true);
        return;
      }
      if (e.sleeping) return;

      // Cursor parked near him for a while → he waves at you.
      const p = e.pointer;
      const g = geo.current;
      if (p && now - p.t > 2500 && now > e.waveCooldownUntil) {
        const d = Math.hypot(p.x - (mx.get() + g.cx), p.y - (my.get() + g.size / 2));
        if (d < 240) {
          e.waveCooldownUntil = now + 25_000;
          setMood('wave', 2200);
          return;
        }
      }
      if (now < e.nextActionAt) return;
      e.nextActionAt = now + rand(2_000, 4_500);

      const { vw, floorY, homeX } = metrics();
      const sx = mx.get();
      const r = Math.random();
      const targets = g.isMobile ? [] : reachableWindows();

      if (e.surface.kind === 'window') {
        const w = windowsRef.current[e.surface.id];
        if (!w) return;
        if (r < 0.3) walkTo(rand(w.position.x, w.position.x + w.size.width), { run: Math.random() < 0.2 });
        else if (r < 0.48) setMood('sit', rand(4000, 7000));
        else if (r < 0.6 && targets.length) {
          const t = pick(targets);
          jumpTo(clamp(rand(t.position.x + 10, t.position.x + t.size.width - TITLEBAR_BUTTONS_PX - g.size), 0, vw - g.size), t.position.y - g.feet);
        } else if (r < 0.74) climbTo(floorY, { kind: 'floor' }); // rappel down on a thread
        else if (r < 0.84) {
          setMood('surprised', 400);
          later(() => startFall(rand(-320, 320), -480), 300); // jump off
        } else fidget();
        return;
      }

      // On the taskbar
      if (r < 0.24) {
        const far = Math.random() < 0.35;
        const tx = clamp(far ? rand(40, vw - g.size - 40) : sx + rand(-260, 260), 0, vw - g.size);
        walkTo(tx, { run: Math.abs(tx - sx) > 380 && Math.random() < 0.6 });
      } else if (r < 0.4) fidget();
      else if (r < 0.5) fidget(); // (sitting is saved for window ledges, where his legs can dangle)
      else if (r < 0.66 && targets.length) {
        const t = pick(targets);
        const tx = clamp(rand(t.position.x + 10, t.position.x + t.size.width - TITLEBAR_BUTTONS_PX - g.size), 0, vw - g.size);
        if (Math.random() < 0.5 && floorY - t.position.y > 140) {
          // Walk under it, then climb a thread up onto it.
          walkTo(tx, { then: () => climbTo(t.position.y - g.feet, { kind: 'window', id: t.id, offsetX: tx - t.position.x }) });
        } else if (!jumpTo(tx, t.position.y - g.feet)) {
          walkTo(tx, { then: () => climbTo(t.position.y - g.feet, { kind: 'window', id: t.id, offsetX: tx - t.position.x }) });
        }
      } else if (r < 0.72 && p && now - p.t < 4000 && Math.abs(p.x - sx) < 700) {
        // Chase the cursor along the taskbar, then shoot a web at it.
        walkTo(clamp(p.x - g.cx + (p.x > sx ? -60 : 60), 0, vw - g.size), {
          run: true,
          then: () => {
            const q = E.current.pointer;
            if (q) shootWebAt(q.x, q.y);
          },
        });
      } else if (r < 0.8 && p) shootWebAt(p.x, p.y);
      else if (r < 0.88) {
        const x1 = clamp(rand(40, vw - g.size - 40), 0, vw - g.size);
        travelTo(x1, floorY, { kind: 'floor' }, { arc: rand(160, 260) });
      } else if (!e.atHome && r < 0.95) walkTo(homeX);
      else setMood(pick<AnimName>(['dance', 'laugh', 'kick']), 2400);
    }, 1000);
    return () => clearInterval(id);
  }, [climbTo, fidget, jumpTo, later, metrics, mx, my, reachableWindows, reduceMotion, setMood, shootWebAt, startFall, travelTo, walkTo]);

  // He looks toward a window when it opens, and shrugs at "show desktop".
  const prevActive = useRef(activeWindowId);
  const prevVisible = useRef(0);
  useEffect(() => {
    const e = E.current;
    const visible = Object.values(windows).filter((w) => w.isOpen && !w.isMinimized).length;
    const opened = activeWindowId && activeWindowId !== prevActive.current;
    const hidAll = prevVisible.current > 1 && visible === 0;
    prevActive.current = activeWindowId;
    prevVisible.current = visible;
    if (e.mode !== 'stand' || moodRef.current || e.sleeping) return;
    if (hidAll) {
      setMood('shrug', animMs('shrug') + 400);
      return;
    }
    if (opened && activeWindowId) {
      const w = windows[activeWindowId];
      const g = geo.current;
      if (w) setMood(w.position.x + w.size.width / 2 < mx.get() + g.cx ? 'look-left' : 'look-right', 900);
    }
  }, [activeWindowId, animMs, mx, setMood, windows]);

  // Tip with a "swing": thwip across the floor, then wander back later.
  const wasSwinging = useRef(false);
  useEffect(() => {
    const rising = mascot.isSwinging && !wasSwinging.current;
    wasSwinging.current = mascot.isSwinging;
    if (!rising || reduceMotion) return;
    const e = E.current;
    if (e.mode !== 'stand' && e.mode !== 'hop') return;
    const { vw, floorY } = metrics();
    const x0 = mx.get();
    let x1 = clamp(rand(40, vw - geo.current.size - 40), 0, vw - geo.current.size);
    if (Math.abs(x1 - x0) < 220) x1 = clamp(x0 > vw / 2 ? x0 - 360 : x0 + 360, 0, vw - geo.current.size);
    travelTo(x1, floorY, { kind: 'floor' }, { arc: 220 });
  }, [mascot.isSwinging, metrics, mx, reduceMotion, travelTo]);

  // Commands from the rest of the OS (terminal, palette, jukebox, context menus).
  const lastCommand = useRef<number | null>(null);
  useEffect(() => {
    const c = mascot.command;
    if (!c || c.id === lastCommand.current) return;
    lastCommand.current = c.id;
    switch (c.type) {
      case 'pet':
        pet();
        break;
      case 'dance':
        wake();
        setMood('dance', 8000);
        break;
      case 'nap':
        E.current.sleeping = true;
        setSleeping(true);
        say('Zzz… wake me with a click.');
        break;
      case 'hop':
        wake();
        hop(60);
        break;
      case 'wave':
        wake();
        setMood('wave', 2600);
        break;
      case 'home':
        wake();
        goHome();
        break;
      case 'swing': {
        const { vw, floorY } = metrics();
        travelTo(clamp(rand(40, vw - geo.current.size - 40), 0, vw - geo.current.size), floorY, { kind: 'floor' }, { arc: 220 });
        break;
      }
      case 'sit':
        wake();
        setMood('sit', 9000);
        break;
      case 'web': {
        wake();
        const pt = E.current.pointer;
        const { vw } = metrics();
        shootWebAt(pt ? pt.x : mx.get() < vw / 2 ? vw - 40 : 40, pt ? pt.y : my.get() - 120);
        break;
      }
      case 'thumbs':
        wake();
        setMood('thumbs-up', animMs('thumbs-up') + 600);
        break;
      case 'laugh':
        wake();
        setMood('laugh', 2600);
        break;
      case 'trick': {
        wake();
        const t = pick<AnimName>(['kick', 'stretch', 'sneeze', 'shrug', 'thumbs-up', 'yawn']);
        if (DIRECTIONAL_ANIMS.has(t)) setFlip(Math.random() < 0.5);
        setMood(t, animMs(t) + 300);
        break;
      }
      case 'hide':
        updateSettings({ mascot: false });
        break;
      case 'show':
        updateSettings({ mascot: true });
        break;
    }
  }, [animMs, goHome, hop, mascot.command, metrics, mx, my, pet, say, setMood, shootWebAt, travelTo, updateSettings, wake]);

  // Keep the bubble side in sync with where the spider ends up.
  useEffect(() => {
    if (mode === 'stand' || mode === 'land') forceRender((n) => n + 1);
  }, [mode]);

  // ---------------------------------------------------------------- render
  const anyWindowVisible = Object.values(windows).some((w) => w.isOpen && !w.isMinimized);
  if (!settings.mascot || (isMobile && anyWindowVisible)) return null;

  const contextAnim = mascot.frame !== 'idle' && mascot.frame !== 'swinging' ? MOOD_TO_ANIM[mascot.frame] : null;
  const physical: Partial<Record<Mode, AnimName>> = { drag: 'dangle', fall: 'fall', land: 'land', hop: 'hop', walk: running ? 'run' : 'walk', travel: travelAnim };
  const anim: AnimName =
    physical[mode] ??
    mood?.anim ??
    contextAnim ??
    (sleeping ? 'sleep' : look ? (look === 'left' ? 'look-left' : 'look-right') : blink ? 'blink' : 'idle');
  const meta = anims[anim];
  const oneShotKey = mode === 'hop' || mode === 'land' ? playId : mood?.id ?? 0;

  const sx = mx.get();
  const sy = my.get();
  const vw = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const bubbleLeft = sx + cx < vw / 2;
  const bubbleBelow = sy + head < 150;
  const standing = mode === 'stand' || mode === 'walk' || mode === 'hop' || mode === 'land';

  return (
    <>
      <style>{keyframes}</style>

      {/* Web shot at the cursor */}
      <AnimatePresence>
        {webShot && (
          <motion.svg
            key={webShot.id}
            aria-hidden="true"
            className="fixed inset-0 w-screen h-screen pointer-events-none z-[748]"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <motion.line
              x1={webShot.x1}
              y1={webShot.y1}
              x2={webShot.x2}
              y2={webShot.y2}
              stroke="rgb(var(--c-lavender))"
              strokeWidth={2}
              strokeDasharray="1 0"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            />
            <motion.g initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.16, duration: 0.15 }} style={{ originX: `${webShot.x2}px`, originY: `${webShot.y2}px` }}>
              {[0, 45, 90, 135].map((deg) => (
                <line
                  key={deg}
                  x1={webShot.x2 - 9 * Math.cos((deg * Math.PI) / 180)}
                  y1={webShot.y2 - 9 * Math.sin((deg * Math.PI) / 180)}
                  x2={webShot.x2 + 9 * Math.cos((deg * Math.PI) / 180)}
                  y2={webShot.y2 + 9 * Math.sin((deg * Math.PI) / 180)}
                  stroke="rgb(var(--c-lavender))"
                  strokeWidth={1.5}
                />
              ))}
              <circle cx={webShot.x2} cy={webShot.y2} r={5} fill="none" stroke="rgb(var(--c-lavender))" strokeWidth={1.5} />
            </motion.g>
          </motion.svg>
        )}
      </AnimatePresence>

      {/* Web line from the top of the screen while swinging */}
      {mode === 'travel' && (
        <motion.div
          aria-hidden="true"
          className="fixed top-0 w-[2px] bg-lavender/70 z-[749] pointer-events-none"
          style={{ left: threadLeft, height: threadHeight }}
        />
      )}

      <motion.div
        className="fixed left-0 top-0 z-[750] pointer-events-none"
        style={{ x: mx, y: my, width: size, height: size }}
      >
        {/* Web line from the cursor while carried */}
        {mode === 'drag' && (
          <div aria-hidden="true" className="absolute w-[2px] bg-lavender/80" style={{ left: cx - 1, top: head - DRAG_THREAD, height: DRAG_THREAD + 6 }} />
        )}

        {mascot.speechText && standing && (
          <div
            className={`absolute flex w-[min(16rem,calc(100vw-24px))] md:w-[240px] ${bubbleLeft ? 'left-0 justify-start' : 'right-0 justify-end'}`}
            style={bubbleBelow ? { top: feet + 6 } : { bottom: size - head + 4 }}
          >
            <div className="pointer-events-auto max-w-full">
              <SpeechBubble text={mascot.speechText} onDismiss={() => mascot.setSpeechText(undefined)} />
            </div>
          </div>
        )}

        {standing && (
          <div
            aria-hidden="true"
            className="absolute bg-black/35 rounded-[50%] blur-[1px]"
            style={{ left: cx - size * 0.22, width: size * 0.44, top: feet - 4, height: Math.max(4, size * 0.06) }}
          />
        )}

        {/* Landing dust */}
        <AnimatePresence>
          {puffId > 0 && mode === 'land' && (
            <motion.div key={puffId} aria-hidden="true" className="absolute pointer-events-none" style={{ left: cx, top: feet - 6 }}>
              {[-1, 1].map((side) =>
                [0, 1].map((i) => (
                  <motion.span
                    key={`${side}-${i}`}
                    className="absolute w-[6px] h-[6px] bg-slate/80"
                    initial={{ x: 0, y: 0, opacity: 1 }}
                    animate={{ x: side * (16 + i * 14), y: -4 - i * 6, opacity: 0 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                  />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          type="button"
          aria-label="Pixel Spider. Click for a tip, drag to throw, right-click for more."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (E.current.drag = null)}
          onPointerEnter={(ev) => {
            // Mouse hovers over him: a little reaction (not on touch, not while busy).
            const e = E.current;
            if (ev.pointerType === 'touch' || e.mode !== 'stand' || moodRef.current || e.sleeping || Date.now() < e.hoverCooldownUntil) return;
            e.hoverCooldownUntil = Date.now() + 9000;
            const a = pick<AnimName>(['thumbs-up', 'laugh', 'wave']);
            setMood(a, a === 'thumbs-up' ? animMs(a) + 500 : 1800);
          }}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') {
              ev.preventDefault();
              handleClick();
            }
          }}
          onContextMenu={(ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            setMenu({ x: ev.clientX, y: ev.clientY });
          }}
          style={{ rotate: rot, transformOrigin: `${cx}px ${head}px`, touchAction: 'none' }}
          className={`relative block pointer-events-auto select-none outline-none focus-visible:outline-dotted focus-visible:outline-2 focus-visible:outline-lavender ${
            mode === 'drag' ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          <SpiderSprite
            anim={missing[anim] ? 'idle' : anim}
            meta={missing[anim] ? anims.idle : meta}
            size={size}
            flip={DIRECTIONAL_ANIMS.has(anim) && flip}
            paused={reduceMotion}
            playId={oneShotKey}
            fallbackSrc={missing[anim] && missing.idle ? asset('/mascot/idle-01.png') : undefined}
          />
        </motion.button>
      </motion.div>

      {menu && (
        <SpiderMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onPick={(cmd) => {
            setMenu(null);
            mascot.sendCommand(cmd);
          }}
        />
      )}
    </>
  );
};

// Right-click menu on the spider itself.
const SpiderMenu: React.FC<{
  x: number;
  y: number;
  onClose: () => void;
  onPick: (cmd: 'pet' | 'dance' | 'nap' | 'hop' | 'wave' | 'home' | 'swing' | 'hide' | 'sit' | 'web' | 'thumbs' | 'trick') => void;
}> = ({ x, y, onClose, onPick }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const items: Array<{ cmd: Parameters<typeof onPick>[0]; label: string; icon: React.ComponentProps<typeof PixelIcon>['name'] }> = [
    { cmd: 'pet', label: 'Pet', icon: 'star' },
    { cmd: 'dance', label: 'Dance', icon: 'jukebox' },
    { cmd: 'hop', label: 'Jump', icon: 'restore' },
    { cmd: 'wave', label: 'Wave', icon: 'spider' },
    { cmd: 'swing', label: 'Web-swing', icon: 'link' },
    { cmd: 'web', label: 'Shoot web', icon: 'send' },
    { cmd: 'trick', label: 'Do a trick', icon: 'trophy' },
    { cmd: 'thumbs', label: 'Thumbs up', icon: 'check' },
    { cmd: 'sit', label: 'Sit down', icon: 'pin' },
    { cmd: 'nap', label: 'Nap', icon: 'clock' },
    { cmd: 'home', label: 'Go home', icon: 'desktop' },
    { cmd: 'hide', label: 'Hide Pixel Spider', icon: 'close' },
  ];
  const left = Math.min(x, (typeof window === 'undefined' ? 1280 : window.innerWidth) - 190);
  const top = Math.min(y, (typeof window === 'undefined' ? 800 : window.innerHeight) - 410);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Pixel Spider"
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-[960] w-44 win9x-box-raised window-active-shadow p-1 font-pixel text-[11px] text-text"
      style={{ left, top }}
    >
      <p className="title-bar-active px-2 py-0.5 mb-1 text-[10px]">Pixel Spider</p>
      {items.map((it, i) => (
        <React.Fragment key={it.cmd}>
          {i === items.length - 1 && <div className="my-1 border-t border-slate/40" />}
          <button
            role="menuitem"
            onClick={() => onPick(it.cmd)}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-start hover:bg-spidey hover:text-onAccent focus-visible:bg-spidey focus-visible:text-onAccent focus-visible:outline-none"
          >
            <PixelIcon name={it.icon} /> {it.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};
