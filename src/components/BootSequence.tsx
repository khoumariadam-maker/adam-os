'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { useSound } from '@/context/SoundContext';
import { asset } from '@/lib/asset';

interface BootSequenceProps {
  onComplete: () => void;
}

const LINE_MS = 150;
const SPLASH_MS = 1700;

// Two acts, like a real 90s PC: a BIOS text screen, then the "Adam OS 98" splash.
export const BootSequence: React.FC<BootSequenceProps> = ({ onComplete }) => {
  const { t } = useLanguage();
  const { playBootChime, playSwing } = useSound();
  const shouldReduceMotion = useReducedMotion();
  const [lineIndex, setLineIndex] = useState<number>(0);
  const [phase, setPhase] = useState<'bios' | 'splash'>('bios');
  const done = useRef(false);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onComplete();
  }, [onComplete]);

  const lines = [
    t.boot.title,
    t.boot.bios,
    t.boot.memCheck,
    t.boot.hardware,
    t.boot.kernel,
    t.boot.mount,
    t.boot.mascot,
    t.boot.booting,
  ];

  useEffect(() => {
    if (shouldReduceMotion) {
      finish();
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    lines.forEach((_, i) => timers.push(setTimeout(() => setLineIndex(i), i * LINE_MS)));
    const splashAt = lines.length * LINE_MS + 250;
    timers.push(
      setTimeout(() => {
        setPhase('splash');
        playBootChime();
      }, splashAt)
    );
    timers.push(setTimeout(playSwing, splashAt + 500));
    timers.push(setTimeout(finish, splashAt + SPLASH_MS));
    return () => timers.forEach(clearTimeout);
    // Runs once per boot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldReduceMotion]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [finish]);

  if (shouldReduceMotion) return null;

  return (
    <div
      className="theme-dark fixed inset-0 z-[9999] bg-black select-none cursor-pointer"
      onClick={finish}
      role="dialog"
      aria-label="Adam OS is starting. Press Escape to skip."
    >
      <AnimatePresence mode="wait">
        {phase === 'bios' ? (
          <motion.div
            key="bios"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 crt-scanlines flex flex-col p-4 md:p-8 font-mono text-green"
          >
            <div className="flex justify-between items-center border-b border-green/30 pb-2 gap-3">
              <span className="font-pixel text-[10px] md:text-xs text-lavender tracking-wider">ADAM_OS // SYSTEM_BOOT</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  finish();
                }}
                className="win9x-button text-yellow px-3 py-1 font-pixel text-[10px]"
              >
                {t.boot.skip} [ESC]
              </button>
            </div>
            <div className="flex-1 my-4 text-xs md:text-sm leading-relaxed space-y-1">
              {lines.slice(0, lineIndex + 1).map((line, idx) => (
                <p key={idx} className="py-0.5">
                  {line}
                </p>
              ))}
              <span className="inline-block w-2 h-4 bg-green cursor-blink align-middle" />
            </div>
            <a
              href={asset('/resume/')}
              onClick={(e) => e.stopPropagation()}
              className="self-start font-pixel text-[10px] md:text-xs text-yellow underline underline-offset-4 hover:text-text"
            >
              Recruiter in a hurry? → Plain résumé
            </a>
          </motion.div>
        ) : (
          <motion.div
            key="splash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
            style={{ background: 'radial-gradient(ellipse at 50% 45%, #1a2a8c 0%, #0a0f4a 45%, #02031a 100%)' }}
          >
            {/* Clouds band, a nod to the Windows 98 splash */}
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-[18%] h-[40%] opacity-25 bg-halftone-animate"
              style={{
                backgroundImage: 'radial-gradient(rgb(var(--c-lavender)) 1.5px, transparent 1.5px)',
                backgroundSize: '14px 14px',
                maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
                WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
              }}
            />

            <div className="relative flex items-center gap-4 md:gap-6">
              {/* Spider drops in on a web thread */}
              <motion.div
                initial={{ y: -260 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.35, duration: 0.7, ease: [0.22, 1.4, 0.36, 1] }}
                className="relative"
              >
                <div className="absolute left-1/2 -translate-x-1/2 bottom-[85%] w-px h-[100vh] bg-lavender/70" />
                <img src={asset('/mascot/swinging-01.png')} alt="" className="w-20 h-20 md:w-28 md:h-28 pixel-art drop-shadow-[0_0_18px_rgba(94,102,255,0.7)]" />
              </motion.div>
              <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15, duration: 0.4 }}>
                <p className="font-body text-white/80 text-sm md:text-base tracking-[0.3em] uppercase">Khoumari</p>
                <p className="font-pixel text-white text-4xl md:text-6xl leading-none drop-shadow-[3px_3px_0_#000]">
                  Adam<span className="text-[#8a90ff]">OS</span>
                  <sup className="font-pixel text-[#FFE55C] text-xl md:text-3xl ms-1 align-top">98</sup>
                </p>
                <p className="font-mono text-[10px] md:text-xs text-white/60 mt-2">Embedded Systems · Builds with AI</p>
              </motion.div>
            </div>

            {/* Marching gradient bar */}
            <div className="absolute bottom-0 inset-x-0 h-2 md:h-3 overflow-hidden" aria-hidden="true">
              <motion.div
                className="h-full w-[200%]"
                style={{ background: 'linear-gradient(90deg,#000080,#5e66ff,#72FFB4,#5e66ff,#000080,#5e66ff,#72FFB4,#5e66ff,#000080)' }}
                animate={{ x: ['-50%', '0%'] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              />
            </div>
            <p className="absolute bottom-6 font-pixel text-[10px] text-white/50">{t.boot.skip}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
