'use client';

import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { SpeechBubble } from './SpeechBubble';
import { useMascot } from '@/context/MascotContext';

export type SpiderFrame =
  | 'idle'
  | 'blink'
  | 'loading'
  | 'celebrating'
  | 'sleeping'
  | 'typing'
  | 'waving'
  | 'swinging';

interface PixelSpiderProps {
  frame?: SpiderFrame;
  speechText?: string;
  onSpeechDismiss?: () => void;
  isSwinging?: boolean;
}

export const PixelSpider: React.FC<PixelSpiderProps> = ({
  frame,
  speechText: overrideSpeech,
  onSpeechDismiss,
  isSwinging: overrideSwinging,
}) => {
  const mascot = useMascot();
  const shouldReduceMotion = useReducedMotion();

  const activeFrame = frame || mascot.frame;
  const activeSpeech = overrideSpeech !== undefined ? overrideSpeech : mascot.speechText;
  const activeSwinging = overrideSwinging !== undefined ? overrideSwinging : mascot.isSwinging;

  const [currentFrame, setCurrentFrame] = useState<SpiderFrame>(activeFrame);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (activeFrame !== 'idle') {
      setCurrentFrame(activeFrame);
      return;
    }

    // Spec requirement: Blinks every 4s (4000ms)
    const interval = setInterval(() => {
      setCurrentFrame('blink');
      setTimeout(() => {
        setCurrentFrame('idle');
      }, 200);
    }, 4000);

    return () => clearInterval(interval);
  }, [activeFrame]);

  const frameSrc = `/mascot/${currentFrame}-01.png`;

  // Disable swing on mobile or when reduced motion is preferred
  const allowSwing = activeSwinging && !isMobile && !shouldReduceMotion;

  return (
    <div className="fixed bottom-14 right-6 z-[750] pointer-events-auto flex flex-col items-end">
      {/* Speech bubble anchored above mascot */}
      {activeSpeech && (
        <div className="mb-2">
          <SpeechBubble
            text={activeSpeech}
            onDismiss={() => {
              if (onSpeechDismiss) onSpeechDismiss();
              mascot.setSpeechText(undefined);
            }}
          />
        </div>
      )}

      {/* Mascot container with Web line SVG when swinging */}
      <motion.div
        onClick={(e) => {
          e.stopPropagation();
          mascot.triggerRandomInteraction();
        }}
        animate={
          allowSwing
            ? {
                y: [0, -140, 0],
                x: [0, -80, 0],
                rotate: [0, -20, 20, 0],
              }
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
        className="relative cursor-pointer group select-none"
      >
        {/* Web line drawing during swing */}
        {allowSwing && (
          <svg className="absolute -top-44 right-1/2 w-1 h-44 overflow-visible pointer-events-none">
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="180"
              stroke="#212CF4"
              strokeWidth="2.5"
              strokeDasharray="4 2"
            />
          </svg>
        )}

        {/* Mascot Drop Shadow */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-12 md:w-16 h-3 bg-slate/30 rounded-full blur-[2px]" />

        {/* Mascot Sprite Image with Fallback Pixel Art SVG (64x64 mobile w-16 h-16, 128x128 desktop w-32 h-32) */}
        <img
          src={frameSrc}
          alt="Pixel Spider Mascot"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 32 32"><rect width="32" height="32" fill="none"/><circle cx="16" cy="14" r="10" fill="%230B0B10" stroke="%23212CF4" stroke-width="1.5"/><ellipse cx="12" cy="13" rx="3" ry="4" fill="%23FFFFFF"/><ellipse cx="20" cy="13" rx="3" ry="4" fill="%23FFFFFF"/><path d="M 12 6 Q 16 10 20 6" stroke="%23212CF4" stroke-width="1" fill="none"/><rect x="10" y="24" width="12" height="6" fill="%230B0B10" rx="2"/></svg>`;
          }}
          className="w-16 h-16 md:w-32 md:h-32 object-contain pixel-art drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)] group-hover:scale-105 transition-transform"
        />
      </motion.div>
    </div>
  );
};
