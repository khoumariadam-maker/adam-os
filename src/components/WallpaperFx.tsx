'use client';

import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { WallpaperName } from '@/context/MascotContext';

// Subtle living wallpaper: a low-resolution canvas (1 canvas px = PIXEL screen px) drawn at ~12fps,
// so the motion stays pixel-crisp and cheap. Each wallpaper gets its own effect.
const PIXEL = 4;
const FPS = 12;

type Particle = { x: number; y: number; vx: number; vy: number; phase: number; speed: number; size: number };

const rand = (min: number, max: number) => min + Math.random() * (max - min);

const EFFECTS: Record<WallpaperName, { count: (w: number, h: number) => number; spawn: (w: number, h: number) => Particle; color: string }> = {
  // Twinkling stars in the sky + a few blinking window lights lower down
  'night-city': {
    count: (w, h) => Math.round((w * h) / 900),
    spawn: (w, h) => ({ x: rand(0, w), y: rand(0, h * 0.55), vx: 0, vy: 0, phase: rand(0, Math.PI * 2), speed: rand(0.6, 2), size: 1 }),
    color: '255, 240, 200',
  },
  // Fireflies drifting between the trees
  'cyber-forest': {
    count: (w, h) => Math.round((w * h) / 2600),
    spawn: (w, h) => ({ x: rand(0, w), y: rand(h * 0.3, h), vx: rand(-0.15, 0.15), vy: rand(-0.12, 0.05), phase: rand(0, Math.PI * 2), speed: rand(0.8, 1.6), size: 1 }),
    color: '170, 255, 140',
  },
  // Slow clouds (wide soft blocks) + faint stars
  'pixel-mountains': {
    count: (w) => Math.max(4, Math.round(w / 45)),
    spawn: (w, h) => ({ x: rand(-20, w), y: rand(2, h * 0.35), vx: rand(0.03, 0.09), vy: 0, phase: rand(0, Math.PI * 2), speed: rand(0.2, 0.5), size: Math.round(rand(6, 16)) }),
    color: '235, 240, 255',
  },
  // Floating sparkles
  'y2k-pattern': {
    count: (w, h) => Math.round((w * h) / 1800),
    spawn: (w, h) => ({ x: rand(0, w), y: rand(0, h), vx: 0, vy: rand(-0.08, -0.02), phase: rand(0, Math.PI * 2), speed: rand(1, 2.5), size: 1 }),
    color: '255, 200, 255',
  },
};

export const WallpaperFx: React.FC<{ wallpaper: WallpaperName; enabled: boolean }> = ({ wallpaper, enabled }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled || shouldReduceMotion) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const effect = EFFECTS[wallpaper];
    let particles: Particle[] = [];
    let w = 0;
    let h = 0;

    const resize = () => {
      w = Math.ceil(window.innerWidth / PIXEL);
      h = Math.ceil(window.innerHeight / PIXEL);
      canvas.width = w;
      canvas.height = h;
      particles = Array.from({ length: effect.count(w, h) }, () => effect.spawn(w, h));
    };
    resize();

    let raf = 0;
    let last = 0;
    let t = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (document.hidden || now - last < 1000 / FPS) return;
      last = now;
      t += 1 / FPS;
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x > w + p.size) p.x = -p.size;
        if (p.x < -p.size) p.x = w;
        if (p.y < -2) p.y = h;
        const glow = (Math.sin(t * p.speed + p.phase) + 1) / 2;
        if (wallpaper === 'pixel-mountains' && p.size > 1) {
          ctx.fillStyle = `rgba(${effect.color}, 0.08)`;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, 2);
          ctx.fillRect(Math.round(p.x) + 2, Math.round(p.y) - 1, p.size - 4, 1);
          continue;
        }
        const alpha = wallpaper === 'cyber-forest' ? 0.25 + glow * 0.75 : glow * glow * 0.85;
        ctx.fillStyle = `rgba(${effect.color}, ${alpha.toFixed(2)})`;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
        // Bright moments get a tiny plus-shaped glint
        if (glow > 0.93) {
          ctx.fillStyle = `rgba(${effect.color}, 0.35)`;
          ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y), 3, 1);
          ctx.fillRect(Math.round(p.x), Math.round(p.y) - 1, 1, 3);
        }
      }
    };
    raf = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      ctx.clearRect(0, 0, w, h);
    };
  }, [wallpaper, enabled, shouldReduceMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none pixel-art"
      style={{ imageRendering: 'pixelated' }}
    />
  );
};
