'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { asset } from '@/lib/asset';

interface ScreensaverProps {
  enabled: boolean;
  idleMs?: number;
}

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'pointerdown', 'wheel', 'touchstart'] as const;
const MASCOT_SIZE = 96;
const COBALT = '33,44,244';
const LAVENDER = '195,198,237';

interface Web {
  x: number;
  y: number;
  z: number;
  radius: number;
  spokes: number;
  rings: number;
  rot: number;
  spin: number;
  color: string;
}

interface Star {
  x: number;
  y: number;
  z: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

const makeWeb = (far: number, z?: number): Web => ({
  x: rand(-1.6, 1.6),
  y: rand(-1.1, 1.1),
  z: z ?? far,
  radius: rand(0.35, 0.8),
  spokes: 6 + Math.floor(Math.random() * 5),
  rings: 3 + Math.floor(Math.random() * 3),
  rot: rand(0, Math.PI * 2),
  spin: rand(-0.15, 0.15),
  color: Math.random() < 0.6 ? COBALT : LAVENDER,
});

const makeStar = (far: number, z?: number): Star => ({ x: rand(-2, 2), y: rand(-1.4, 1.4), z: z ?? far });

const isTouchOnly = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(hover: none)').matches;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const Screensaver: React.FC<ScreensaverProps> = ({ enabled, idleMs = 90000 }) => {
  const [active, setActive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mascotRef = useRef<HTMLImageElement>(null);

  // ---- Idle detection -------------------------------------------------------
  useEffect(() => {
    if (!enabled || isTouchOnly()) {
      setActive(false);
      return;
    }
    // While showing, the dismissal handlers own input; re-arm once it closes.
    if (active) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (document.visibilityState === 'visible') setActive(true);
        else schedule();
      }, idleMs);
    };
    const onActivity = () => schedule();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') schedule();
      else if (timer) clearTimeout(timer);
    };

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibility);
    schedule();

    return () => {
      if (timer) clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity));
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, idleMs, active]);

  // ---- Dismissal (swallow the waking input) ---------------------------------
  const dismiss = useCallback(() => setActive(false), []);

  useEffect(() => {
    if (!active) return;
    let origin: { x: number; y: number } | null = null;
    let swallowTimer: ReturnType<typeof setTimeout> | null = null;

    const swallow = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };
    const removeSwallowers = () => {
      window.removeEventListener('click', swallow, true);
      window.removeEventListener('mouseup', swallow, true);
      window.removeEventListener('pointerup', swallow, true);
      window.removeEventListener('contextmenu', swallow, true);
    };

    const onPointerDown = (e: PointerEvent) => {
      swallow(e);
      // The matching up/click events land after the overlay is gone; eat them too.
      window.addEventListener('click', swallow, true);
      window.addEventListener('mouseup', swallow, true);
      window.addEventListener('pointerup', swallow, true);
      window.addEventListener('contextmenu', swallow, true);
      swallowTimer = setTimeout(removeSwallowers, 500);
      dismiss();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      swallow(e);
      dismiss();
    };
    const onWheel = (e: WheelEvent) => {
      swallow(e);
      dismiss();
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!origin) {
        origin = { x: e.clientX, y: e.clientY };
        return;
      }
      if (Math.abs(e.clientX - origin.x) + Math.abs(e.clientY - origin.y) > 4) dismiss();
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('wheel', onWheel, { capture: true, passive: false });
    window.addEventListener('mousemove', onMouseMove, true);
    window.addEventListener('touchstart', dismiss, true);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('wheel', onWheel, true);
      window.removeEventListener('mousemove', onMouseMove, true);
      window.removeEventListener('touchstart', dismiss, true);
      // Leave the click swallowers alive for their short window after dismissal.
      if (swallowTimer) {
        const t = swallowTimer;
        swallowTimer = null;
        setTimeout(() => {
          clearTimeout(t);
          removeSwallowers();
        }, 500);
      }
    };
  }, [active, dismiss]);

  // ---- Animation ------------------------------------------------------------
  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduced = prefersReducedMotion();
    const FAR = 6;
    const NEAR = 0.15;
    let w = window.innerWidth;
    let h = window.innerHeight;
    let raf = 0;

    const webs: Web[] = Array.from({ length: 14 }, () => makeWeb(FAR, rand(NEAR + 0.3, FAR)));
    const stars: Star[] = Array.from({ length: 160 }, () => makeStar(FAR, rand(NEAR, FAR)));

    const mascot = {
      x: rand(0, Math.max(1, w - MASCOT_SIZE)),
      y: rand(0, Math.max(1, h - MASCOT_SIZE)),
      vx: 70,
      vy: 55,
    };

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mascot.x = Math.min(mascot.x, Math.max(0, w - MASCOT_SIZE));
      mascot.y = Math.min(mascot.y, Math.max(0, h - MASCOT_SIZE));
      if (reduced) draw();
    };

    const project = (x: number, y: number, z: number) => {
      const f = Math.min(w, h) * 0.6;
      return { sx: w / 2 + (x / z) * f, sy: h / 2 + (y / z) * f, scale: f / z };
    };

    const depthAlpha = (z: number) => Math.max(0, Math.min(1, (FAR - z) / (FAR * 0.7))) * Math.min(1, z / 0.6);

    const drawWeb = (web: Web) => {
      const { sx, sy, scale } = project(web.x, web.y, web.z);
      const r = web.radius * scale;
      if (r < 1 || sx + r < -50 || sx - r > w + 50 || sy + r < -50 || sy - r > h + 50) return;
      const a = depthAlpha(web.z);
      if (a <= 0.01) return;
      ctx.strokeStyle = `rgba(${web.color},${(a * 0.75).toFixed(3)})`;
      ctx.lineWidth = Math.max(0.5, Math.min(2.5, scale * 0.004));
      ctx.beginPath();
      const angles: number[] = [];
      for (let s = 0; s < web.spokes; s++) {
        const ang = web.rot + (s / web.spokes) * Math.PI * 2;
        angles.push(ang);
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(ang) * r, sy + Math.sin(ang) * r);
      }
      for (let k = 1; k <= web.rings; k++) {
        const rr = (r * k) / web.rings;
        for (let s = 0; s <= web.spokes; s++) {
          const ang = angles[s % web.spokes];
          // slight sag between spokes for a hand-spun look
          const px = sx + Math.cos(ang) * rr;
          const py = sy + Math.sin(ang) * rr;
          if (s === 0) ctx.moveTo(px, py);
          else {
            const mid = (angles[(s - 1) % web.spokes] + ang + (s === web.spokes ? Math.PI * 2 : 0)) / 2;
            ctx.quadraticCurveTo(sx + Math.cos(mid) * rr * 0.86, sy + Math.sin(mid) * rr * 0.86, px, py);
          }
        }
      }
      ctx.stroke();
    };

    const draw = () => {
      ctx.fillStyle = '#0B0B10';
      ctx.fillRect(0, 0, w, h);
      const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6);
      glow.addColorStop(0, 'rgba(33,44,244,0.16)');
      glow.addColorStop(1, 'rgba(33,44,244,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      for (const s of stars) {
        const { sx, sy } = project(s.x, s.y, s.z);
        const a = depthAlpha(s.z);
        const size = Math.max(0.6, 2.2 - s.z * 0.3);
        ctx.fillStyle = `rgba(${LAVENDER},${a.toFixed(3)})`;
        ctx.fillRect(sx, sy, size, size);
      }
      // far-to-near so close webs paint on top
      [...webs].sort((a, b) => b.z - a.z).forEach(drawWeb);
    };

    const placeMascot = () => {
      if (mascotRef.current) mascotRef.current.style.transform = `translate3d(${mascot.x}px, ${mascot.y}px, 0)`;
    };

    resize();
    window.addEventListener('resize', resize);

    if (reduced) {
      mascot.x = (w - MASCOT_SIZE) / 2;
      mascot.y = (h - MASCOT_SIZE) / 2 - 30;
      placeMascot();
      draw();
      return () => window.removeEventListener('resize', resize);
    }

    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const speed = 0.9 * dt;

      for (let i = 0; i < webs.length; i++) {
        const web = webs[i];
        web.z -= speed;
        web.rot += web.spin * dt;
        if (web.z < NEAR) webs[i] = makeWeb(FAR);
      }
      for (let i = 0; i < stars.length; i++) {
        stars[i].z -= speed * 1.4;
        if (stars[i].z < NEAR) stars[i] = makeStar(FAR);
      }

      mascot.x += mascot.vx * dt;
      mascot.y += mascot.vy * dt;
      const maxX = Math.max(0, w - MASCOT_SIZE);
      const maxY = Math.max(0, h - MASCOT_SIZE);
      if (mascot.x <= 0 || mascot.x >= maxX) {
        mascot.vx = -mascot.vx;
        mascot.x = Math.max(0, Math.min(maxX, mascot.x));
      }
      if (mascot.y <= 0 || mascot.y >= maxY) {
        mascot.vy = -mascot.vy;
        mascot.y = Math.max(0, Math.min(maxY, mascot.y));
      }

      draw();
      placeMascot();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      className="fixed inset-0 bg-base overflow-hidden cursor-none"
      style={{ zIndex: 9500 }}
      role="dialog"
      aria-modal="true"
      aria-label="Screensaver. Move the mouse or press any key to wake."
    >
      <canvas ref={canvasRef} className="absolute inset-0 block" aria-hidden />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={mascotRef}
        src={asset('/mascot/swinging-01.png')}
        alt=""
        width={MASCOT_SIZE}
        height={MASCOT_SIZE}
        draggable={false}
        className="pixel-art absolute top-0 left-0 will-change-transform pointer-events-none"
        style={{ width: MASCOT_SIZE, height: MASCOT_SIZE, filter: 'drop-shadow(0 0 8px rgba(33,44,244,0.8))' }}
      />
      <div className="absolute bottom-6 left-0 right-0 text-center font-pixel text-[10px] text-lavender/80 tracking-wider pointer-events-none px-4">
        ADAM OS — move the mouse to wake
      </div>
    </div>
  );
};
