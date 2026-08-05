'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SpeechBubbleProps {
  text: string;
  onDismiss?: () => void;
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({ text, onDismiss }) => {
  const [displayedText, setDisplayedText] = useState<string>('');

  useEffect(() => {
    setDisplayedText('');
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayedText((prev) => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 25);

    return () => clearInterval(interval);
  }, [text]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 10 }}
        className="win9x-box-raised bg-panel2 border-2 border-spidey p-3 max-w-xs shadow-xl relative text-text text-xs font-body z-[760]"
      >
        {/* Tail point pointing to mascot */}
        <div className="absolute -bottom-2 right-6 w-3 h-3 bg-panel2 border-r-2 border-b-2 border-spidey rotate-45" />

        <div className="flex justify-between items-start gap-2">
          <p className="leading-relaxed font-body text-textDim text-xs md:text-sm">
            {displayedText}
          </p>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-lavender hover:text-white font-pixel text-[10px] ml-1"
            >
              ✕
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
