'use client';

import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface SpeechBubbleProps {
  text: string;
  onDismiss?: () => void;
  // Auto-hide after this many ms once fully typed (0 = never).
  autoHideMs?: number;
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({ text, onDismiss, autoHideMs = 9000 }) => {
  const shouldReduceMotion = useReducedMotion();
  const [visibleChars, setVisibleChars] = useState<number>(0);

  // Typewriter effect: derive the text from a counter so no characters are ever dropped or doubled.
  useEffect(() => {
    if (shouldReduceMotion) {
      setVisibleChars(text.length);
      return;
    }
    setVisibleChars(0);
    const interval = setInterval(() => {
      setVisibleChars((n) => {
        if (n >= text.length) {
          clearInterval(interval);
          return n;
        }
        return n + 1;
      });
    }, 22);
    return () => clearInterval(interval);
  }, [text, shouldReduceMotion]);

  const done = visibleChars >= text.length;

  useEffect(() => {
    if (!done || !autoHideMs || !onDismiss) return;
    const timeout = setTimeout(onDismiss, autoHideMs);
    return () => clearTimeout(timeout);
  }, [done, autoHideMs, onDismiss, text]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      role="status"
      aria-live="polite"
      className="win9x-box-raised bg-panel2 !border-spidey p-3 max-w-[16rem] md:max-w-xs relative text-text text-xs font-body origin-bottom-right"
    >
      <div className="absolute -bottom-[7px] right-8 w-3 h-3 bg-panel2 border-r-2 border-b-2 border-spidey rotate-45" />

      <div className="flex justify-between items-start gap-2">
        {/* Full text for screen readers, typed text for the eyes */}
        <p className="sr-only">{text}</p>
        <p aria-hidden="true" className="leading-relaxed text-textDim text-xs md:text-[13px] min-h-[1.5em]">
          {text.slice(0, visibleChars)}
          {!done && <span className="inline-block w-1.5 h-3 bg-lavender cursor-blink ml-0.5 align-middle" />}
        </p>
        {onDismiss && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            aria-label="Dismiss message"
            className="text-lavender hover:text-text font-pixel text-[10px] -mt-1 -mr-1 w-6 h-6 shrink-0"
          >
            ✕
          </button>
        )}
      </div>
    </motion.div>
  );
};
