'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useWindowManager, WindowId } from '@/context/WindowManagerContext';
import { useSound } from '@/context/SoundContext';

interface DesktopIconProps {
  id: WindowId;
  label: string;
  iconSrc: string;
  isSelected: boolean;
  onSelect: (id: WindowId) => void;
}

export const DesktopIcon: React.FC<DesktopIconProps> = ({
  id,
  label,
  iconSrc,
  isSelected,
  onSelect,
}) => {
  const { openWindow, focusWindow } = useWindowManager();
  const { playClick, playWindowOpen } = useSound();

  const handleDoubleClick = () => {
    playClick();
    playWindowOpen();
    openWindow(id);
    focusWindow(id);
  };

  const handleClick = () => {
    playClick();
    onSelect(id);
  };

  return (
    <motion.button
      type="button"
      aria-label={`Open ${label}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      whileHover={{ scale: 1.08 }}
      transition={{ duration: 0.1 }}
      className={`group flex flex-col items-center justify-center p-2 rounded cursor-pointer w-24 select-none ${
        isSelected ? 'bg-spidey/30 border border-spidey' : 'hover:bg-panel2/40'
      }`}
    >
      <div className="w-12 h-12 md:w-16 md:h-16 relative flex items-center justify-center mb-1">
        {/* Placeholder SVG if image asset missing, otherwise 64x64 image */}
        <img
          src={iconSrc}
          alt={label}
          onError={(e) => {
            // Fallback 64x64 pixel icon SVG
            (e.target as HTMLImageElement).src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="%23171722" rx="4"/><rect x="8" y="8" width="48" height="48" fill="%23212CF4" opacity="0.3"/><text x="32" y="38" font-family="monospace" font-size="24" fill="%23FFFFFF" text-anchor="middle">.EXE</text></svg>`;
          }}
          className="w-12 h-12 md:w-16 md:h-16 object-contain pixel-art drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
        />
      </div>
      <span
        className={`font-pixel text-[14px] text-center leading-tight break-words max-w-full px-1 py-0.5 tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] ${
          isSelected ? 'bg-spidey text-text font-bold' : 'text-text group-hover:text-yellow'
        }`}
      >
        {label}
      </span>
    </motion.button>
  );
};
