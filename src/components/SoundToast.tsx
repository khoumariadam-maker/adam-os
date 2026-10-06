'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSound } from '@/context/SoundContext';
import { readStorage, writeStorage } from '@/lib/storage';

export const SoundToast: React.FC = () => {
  const { toggleSound, isMuted } = useSound();
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    // Only show on genuine first visit — key is absent from localStorage
    if (readStorage('adam_os_muted') === null) {
      // First visit: show the toast shortly after boot completes
      const timeout = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(timeout);
    }
  }, []);

  const handleEnable = () => {
    // Enable sound: set muted=false
    if (isMuted) toggleSound();
    setVisible(false);
  };

  const handleDismiss = () => {
    // Keep muted (default), just record the preference so toast never shows again
    writeStorage('adam_os_muted', 'true');
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed bottom-[68px] inset-x-3 md:bottom-14 z-[900] flex justify-center pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          className="pointer-events-auto w-full md:w-80 win9x-box-raised bg-panel2 !border-spidey p-4 flex flex-col items-center gap-3 shadow-2xl"
          role="dialog"
          aria-label="Sound preference"
          aria-modal="false"
        >
          {/* Icon + label */}
          <div className="flex items-center gap-2">
            <span className="text-2xl select-none">🔊</span>
            <p className="font-pixel text-[10px] text-text leading-snug">
              Enable OS sounds?
            </p>
          </div>

          <p className="font-body text-xs text-textDim text-center leading-relaxed">
            Web Audio synth — click, swing, boot chime.<br />
            No audio files. No autoplay.
          </p>

          <div className="flex gap-3 w-full">
            <button
              onClick={handleEnable}
              className="win9x-button win9x-button-spidey flex-1 py-2 font-pixel text-[10px] text-text"
              aria-label="Enable sounds"
            >
              YES 🔊
            </button>
            <button
              onClick={handleDismiss}
              className="win9x-button flex-1 py-2 font-pixel text-[10px] text-lavender hover:text-text"
              aria-label="Keep sounds muted"
            >
              NO 🔇
            </button>
          </div>
        </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
