'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import type { AnimationPlaybackControls } from 'framer-motion';
import { SpeechBubble } from './SpeechBubble';
import { SpiderSprite, spriteKeyframes } from './mascot/SpiderSprite';
import { ANIM_NAMES, DEFAULT_ANIMS, isAnimMeta, MOOD_TO_ANIM, SPRITE_GEOMETRY, type AnimMeta, type AnimName } from './mascot/anims';
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
const WALK_SPEED = 75; // px/s
const DRAG_THREAD = 34; // px of web between the cursor and the spider's head while carried
const SLEEP_AFTER_MS = 45_000;
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
    nextActionAt: Date.now() + rand(14_000, 22_000),
    clicks: [] as number[],
    pet: { dir: 0, x: 0, changes: [] as number[], cooldownUntil: 0 },
    konami: [] as string[],
    drag: null as null | { id: number; startX: number; startY: number; active: boolean; samples: Array<{ x: number; y: number; t: number }> },
    sleeping: false,
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
      setMode('stand');
      rotTarget.set(0);
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
        if (E.current.mode === 'land') stand(s);
      }, 260);
      e.nextActionAt = Date.now() + rand(8_000, 14_000);
    },
    [later, playThud, rotTarget, setMode, stand, stopMotion]
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
        e.vy += GRAVITY * dt;
        e.vx *= 1 - 0.6 * dt; // air drag
        let x = mx.get() + e.vx * dt;
        let y = my.get() + e.vy * dt;
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

  const walkTo = useCallback(
    (targetX: number, then?: () => void) => {
      const e = E.current;
      if (reduceMotion || e.surface.kind !== 'floor') return;
      stopMotion();
      const x0 = mx.get();
      const dist = Math.abs(targetX - x0);
      if (dist < 4) return;
      setFlip(targetX < x0);
      setMode('walk');
      e.atHome = false;
      const c = animate(mx, targetX, { duration: dist / WALK_SPEED, ease: 'linear' });
      e.controls = [c];
      c.then(() => {
        if (E.current.mode !== 'walk') return;
        E.current.atHome = Math.abs(targetX - metrics().homeX) < 2;
        stand({ kind: 'floor' });
        then?.();
      });
    },
    [metrics, mx, reduceMotion, setMode, stand, stopMotion]
  );

  // Swing on a web line (from the top of the screen) to a point, then land there.
  const travelTo = useCallback(
    (x1: number, y1: number, surface: Surface, opts: { arc?: number; duration?: number } = {}) => {
      const e = E.current;
      if (reduceMotion) return;
      stopMotion();
      e.atHome = false;
      const x0 = mx.get();
      const y0 = my.get();
      const peak = Math.max(-geo.current.head + 12, Math.min(y0, y1) - (opts.arc ?? 140));
      setMode('travel');
      playSwing();
      const duration = opts.duration ?? clamp(Math.hypot(x1 - x0, y1 - y0) / 700, 0.9, 1.6);
      const t = { duration, times: [0, 0.5, 1], ease: 'easeInOut' as const };
      rotTarget.set(clamp((x1 - x0) * -0.03, -20, 20));
      const cx1 = animate(mx, [x0, (x0 + x1) / 2, x1], t);
      const cy1 = animate(my, [y0, peak, y1], t);
      e.controls = [cx1, cy1];
      cy1.then(() => {
        if (E.current.mode !== 'travel') return;
        mx.set(x1);
        my.set(y1);
        land(surface);
      });
    },
    [land, mx, my, playSwing, reduceMotion, rotTarget, setMode, stopMotion]
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
    setMood('love', 3200);
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
    if (e.surface.kind !== 'window' || (e.mode !== 'stand' && e.mode !== 'land')) return;
    const w = windows[e.surface.id];
    if (!w || !w.isOpen || w.isMinimized || w.isMaximized) {
      setMood('surprised', 700);
      startFall(0, -200);
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

  // The "brain": every few seconds decide whether to wander, perch, nap or head home.
  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => {
      const e = E.current;
      const m = mascotRef.current;
      if (document.hidden || e.mode !== 'stand' || moodRef.current || m.frame !== 'idle' || m.isSwinging || e.drag) return;
      const now = Date.now();
      if (!e.sleeping && now - e.lastInput > SLEEP_AFTER_MS) {
        e.sleeping = true;
        setSleeping(true);
        return;
      }
      if (e.sleeping || now < e.nextActionAt) return;
      e.nextActionAt = now + rand(18_000, 34_000);
      const { vw, homeX } = metrics();
      const g = geo.current;
      if (e.surface.kind === 'window') {
        if (Math.random() < 0.35) {
          setMood('surprised', 500);
          startFall(rand(-260, 260), -420); // hop off the window
        } else goHome();
        return;
      }
      if (!e.atHome && Math.random() < 0.6) {
        walkTo(homeX);
        return;
      }
      const r = Math.random();
      const active = activeRef.current ? windowsRef.current[activeRef.current] : null;
      if (r < 0.35 && !g.isMobile && active && active.isOpen && !active.isMinimized && !active.isMaximized) {
        const t = perchTarget(active);
        if (t) {
          travelTo(t.x, t.y, t.surface);
          return;
        }
      }
      if (r < 0.75) {
        walkTo(clamp(rand(60, vw - g.size - 60), 0, vw - g.size));
        return;
      }
      setMood(pick<AnimName>(['wave', 'look-left', 'look-right', 'dance']), 2400);
    }, 3000);
    return () => clearInterval(id);
  }, [goHome, metrics, perchTarget, reduceMotion, setMood, startFall, travelTo, walkTo]);

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
      case 'hide':
        updateSettings({ mascot: false });
        break;
      case 'show':
        updateSettings({ mascot: true });
        break;
    }
  }, [goHome, hop, mascot.command, metrics, pet, say, setMood, travelTo, updateSettings, wake]);

  // Keep the bubble side in sync with where the spider ends up.
  useEffect(() => {
    if (mode === 'stand' || mode === 'land') forceRender((n) => n + 1);
  }, [mode]);

  // ---------------------------------------------------------------- render
  const anyWindowVisible = Object.values(windows).some((w) => w.isOpen && !w.isMinimized);
  if (!settings.mascot || (isMobile && anyWindowVisible)) return null;

  const contextAnim = mascot.frame !== 'idle' && mascot.frame !== 'swinging' ? MOOD_TO_ANIM[mascot.frame] : null;
  const physical: Partial<Record<Mode, AnimName>> = { drag: 'dangle', fall: 'fall', land: 'land', hop: 'hop', walk: 'walk', travel: 'dangle' };
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
            flip={mode === 'walk' && flip}
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
  onPick: (cmd: 'pet' | 'dance' | 'nap' | 'hop' | 'wave' | 'home' | 'swing' | 'hide') => void;
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
    { cmd: 'nap', label: 'Nap', icon: 'clock' },
    { cmd: 'home', label: 'Go home', icon: 'desktop' },
    { cmd: 'hide', label: 'Hide Pixel Spider', icon: 'close' },
  ];
  const left = Math.min(x, (typeof window === 'undefined' ? 1280 : window.innerWidth) - 190);
  const top = Math.min(y, (typeof window === 'undefined' ? 800 : window.innerHeight) - 290);

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
