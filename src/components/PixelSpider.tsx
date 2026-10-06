'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { SpeechBubble } from './SpeechBubble';
import { useMascot } from '@/context/MascotContext';
import { useWindowManager } from '@/context/WindowManagerContext';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { asset } from '@/lib/asset';

export type SpiderFrame =
  | 'idle'
  | 'blink'
  | 'loading'
  | 'celebrating'
  | 'sleeping'
  | 'typing'
  | 'waving'
  | 'swinging';

const FRAMES: SpiderFrame[] = ['idle', 'blink', 'loading', 'celebrating', 'sleeping', 'typing', 'waving', 'swinging'];

export const PixelSpider: React.FC = () => {
  const mascot = useMascot();
  const { windows } = useWindowManager();
  const shouldReduceMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const [isBlinking, setIsBlinking] = useState(false);

  // Preload every frame so swapping sprites never flashes.
  useEffect(() => {
    FRAMES.forEach((f) => {
      const img = new Image();
      img.src = asset(`/mascot/${f}-01.png`);
    });
  }, []);

  // Blink every 4s while idle.
  useEffect(() => {
    if (mascot.frame !== 'idle') return;
    let blinkTimeout: ReturnType<typeof setTimeout>;
    const interval = setInterval(() => {
      setIsBlinking(true);
      blinkTimeout = setTimeout(() => setIsBlinking(false), 180);
    }, 4000);
    return () => {
      clearInterval(interval);
      clearTimeout(blinkTimeout);
      setIsBlinking(false);
    };
  }, [mascot.frame]);

  const { setSpeechText } = mascot;
  const dismissSpeech = useCallback(() => setSpeechText(undefined), [setSpeechText]);

  // On phones the app sheets cover the screen, so the mascot steps aside while one is open.
  const anyWindowVisible = Object.values(windows).some((w) => w.isOpen && !w.isMinimized);
  if (isMobile && anyWindowVisible) return null;

  const currentFrame: SpiderFrame = mascot.frame === 'idle' && isBlinking ? 'blink' : mascot.frame;
  const allowSwing = mascot.isSwinging && !isMobile && !shouldReduceMotion;

  return (
    <div className="fixed bottom-16 md:bottom-12 right-3 md:right-6 z-[750] flex flex-col items-end pointer-events-none">
      {mascot.speechText && (
        <div className="mb-2 pointer-events-auto">
          <SpeechBubble text={mascot.speechText} onDismiss={dismissSpeech} />
        </div>
      )}

      <motion.button
        type="button"
        aria-label="Pixel Spider mascot — click for a tip"
        onClick={(e) => {
          e.stopPropagation();
          mascot.triggerRandomInteraction();
        }}
        animate={
          allowSwing
            ? { y: [0, -140, 0], x: [0, -80, 0], rotate: [0, -20, 20, 0] }
            : shouldReduceMotion
            ? { y: 0 }
            : { y: [0, -6, 0] }
        }
        transition={
          allowSwing
            ? { duration: 1.2, ease: [0.22, 1, 0.36, 1] }
            : shouldReduceMotion
            ? { duration: 0 }
            : { duration: 3, repeat: Infinity, ease: 'easeInOut' }
        }
        className="relative group select-none pointer-events-auto"
      >
        {allowSwing && (
          <svg className="absolute -top-44 right-1/2 w-1 h-44 overflow-visible pointer-events-none" aria-hidden="true">
            <line x1="0" y1="0" x2="0" y2="180" stroke="#212CF4" strokeWidth="2.5" strokeDasharray="4 2" />
          </svg>
        )}

        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-12 md:w-16 h-3 bg-black/40 rounded-full blur-[2px]" />

        <img
          src={asset(`/mascot/${currentFrame}-01.png`)}
          alt=""
          draggable={false}
          className="w-16 h-16 md:w-28 md:h-28 object-contain pixel-art drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)] group-hover:scale-105 transition-transform"
        />
      </motion.button>
    </div>
  );
};
