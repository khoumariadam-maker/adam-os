'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { useSound } from '@/context/SoundContext';

interface BootSequenceProps {
  onComplete: () => void;
}

export const BootSequence: React.FC<BootSequenceProps> = ({ onComplete }) => {
  const { t } = useLanguage();
  const { playBootChime, playSwing } = useSound();
  const shouldReduceMotion = useReducedMotion();

  const [lineIndex, setLineIndex] = useState<number>(0);
  const [showSpiderEntrance, setShowSpiderEntrance] = useState<boolean>(false);

  const lines = [
    t?.boot?.title || 'ADAM OS v1.0 — © 2026 KHOUMARI ADAM',
    t?.boot?.bios || 'BIOS PhoenixSpider ROM v2.4',
    t?.boot?.memCheck || 'Memory check........... 128MB OK',
    t?.boot?.hardware || 'Detecting hardware..... ESP32 / RPi / GPT-ON',
    t?.boot?.kernel || 'Loading kernel......... OK',
    t?.boot?.mount || 'Mounting /home/adam.... OK',
    t?.boot?.mascot || 'Starting Pixel Spider.. OK',
    t?.boot?.booting || '> booting GUI_',
  ];

  // Immediate completion if user prefers reduced motion
  useEffect(() => {
    if (shouldReduceMotion) {
      onComplete();
    }
  }, [shouldReduceMotion, onComplete]);

  useEffect(() => {
    if (shouldReduceMotion) return;

    // Attempt audio chime safely
    try {
      playBootChime();
    } catch {
      // Ignore autoplay audio restriction
    }

    // Line reveal timer (160ms per line -> ~1.28s total text reveal)
    const interval = setInterval(() => {
      setLineIndex((prev) => {
        if (prev >= lines.length - 1) {
          clearInterval(interval);
          // Trigger Pixel Spider swing-in entrance at 2.4s mark per spec
          setTimeout(() => {
            setShowSpiderEntrance(true);
            try {
              playSwing();
            } catch {}
          }, 800);

          // Complete boot sequence at 3.2s total per spec
          setTimeout(() => {
            onComplete();
          }, 1600);

          return prev;
        }
        return prev + 1;
      });
    }, 160);

    // Hard fallback safety cap (3.5s max per performance budget)
    const safetyTimeout = setTimeout(() => {
      onComplete();
    }, 3500);

    return () => {
      clearInterval(interval);
      clearTimeout(safetyTimeout);
    };
  }, [shouldReduceMotion]);

  // Escape key or Click to skip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        onComplete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onComplete]);

  if (shouldReduceMotion) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] bg-[#0B0B10] text-[#72FFB4] flex flex-col justify-between p-4 md:p-8 font-mono crt-scanlines select-none cursor-pointer"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.2 } }}
        onClick={onComplete}
      >
        {/* Top bar with Skip button */}
        <div className="flex justify-between items-center border-b border-[#72FFB4]/30 pb-2">
          <span className="font-pixel text-[10px] md:text-xs text-[#C3C6ED] tracking-wider">
            ADAM_OS // SYSTEM_BOOT
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onComplete();
            }}
            aria-label="Skip boot sequence"
            className="win9x-button text-[#FFE55C] px-3 py-1 font-pixel text-[10px] hover:bg-[#FFE55C]/20 active:translate-y-px cursor-pointer"
          >
            {t?.boot?.skip || 'TAP TO SKIP'} [ESC]
          </button>
        </div>

        {/* Terminal Text Lines */}
        <div className="flex-1 my-4 overflow-hidden font-mono text-xs md:text-sm leading-relaxed space-y-1 relative">
          {lines.slice(0, lineIndex + 1).map((line, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.08 }}
              className="py-0.5 text-[#72FFB4]"
            >
              {line}
            </motion.div>
          ))}
          {lineIndex < lines.length && (
            <span className="inline-block w-2 h-4 bg-[#72FFB4] cursor-blink ml-1 align-middle" />
          )}

          {/* Spec requirement: Pixel Spider swing-in theatrical entrance at 2.4s */}
          <AnimatePresence>
            {showSpiderEntrance && (
              <motion.div
                initial={{ y: -200, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none"
              >
                {/* Web line */}
                <div className="w-0.5 h-16 bg-[#212CF4] animate-pulse" />
                {/* Mascot image */}
                <img
                  src="/mascot/swinging-01.png"
                  alt="Pixel Spider Boot Entrance"
                  className="w-20 h-20 pixel-art drop-shadow-[0_0_12px_rgba(33,44,244,0.8)]"
                />
                {/* Spec speech bubble */}
                <div className="win9x-box-raised bg-[#171722] border-2 border-[#212CF4] p-2 text-center text-xs font-body text-[#FFFFFF] max-w-xs shadow-2xl">
                  {t?.boot?.welcome || "Hey! Welcome to Adam OS. I'm Pixel Spider. Click around — don't be shy."}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Progress Bar */}
        <div className="border border-[#72FFB4]/40 p-1 bg-[#1f1f2e]">
          <div className="h-3 bg-[#72FFB4]/20 relative overflow-hidden">
            <motion.div
              className="h-full bg-[#72FFB4]"
              initial={{ width: '0%' }}
              animate={{ width: `${((lineIndex + 1) / lines.length) * 100}%` }}
              transition={{ duration: 0.15 }}
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
