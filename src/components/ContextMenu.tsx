'use client';

import React, { useState } from 'react';
import { useWindowManager, WindowId } from '@/context/WindowManagerContext';
import { useMascot } from '@/context/MascotContext';
import { useLanguage } from '@/context/LanguageContext';
import { useSound } from '@/context/SoundContext';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose }) => {
  const { openWindow, focusWindow } = useWindowManager();
  const { changeWallpaper } = useMascot();
  const { lang, toggleLanguage } = useLanguage();
  const { isMuted, toggleSound, playClick } = useSound();

  const [activeSubmenu, setActiveSubmenu] = useState<'programs' | 'wallpapers' | null>(null);

  const handleOpenProgram = (id: WindowId) => {
    playClick();
    openWindow(id);
    focusWindow(id);
    onClose();
  };

  const handleWallpaperChange = (name: 'night-city' | 'cyber-forest' | 'pixel-mountains' | 'y2k-pattern') => {
    changeWallpaper(name);
    onClose();
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ left: Math.min(x, window.innerWidth - 220), top: Math.min(y, window.innerHeight - 240) }}
      className="fixed z-[950] w-56 win9x-box-raised bg-panel border-2 border-slate p-1 shadow-2xl font-pixel text-xs text-text select-none"
    >
      {/* Submenu Header */}
      <div className="bg-panel2 px-2 py-1 border-b border-slate mb-1 text-[10px] text-lavender flex justify-between items-center">
        <span>DESKTOP_MENU</span>
        <span className="text-yellow">WIN9X</span>
      </div>

      {/* Open Program Dropdown */}
      <div
        onMouseEnter={() => setActiveSubmenu('programs')}
        className="relative group flex items-center justify-between px-3 py-1.5 hover:bg-spidey hover:text-text cursor-pointer"
      >
        <span>Open Program</span>
        <span>▶</span>

        {activeSubmenu === 'programs' && (
          <div className="absolute left-full top-0 ml-1 w-44 win9x-box-raised bg-panel border-2 border-slate p-1 shadow-2xl space-y-1">
            <button
              onClick={() => handleOpenProgram('about')}
              className="w-full text-left px-2 py-1 hover:bg-spidey hover:text-text"
            >
              ▶ About.exe
            </button>
            <button
              onClick={() => handleOpenProgram('projects')}
              className="w-full text-left px-2 py-1 hover:bg-spidey hover:text-text"
            >
              ▶ Projects.exe
            </button>
            <button
              onClick={() => handleOpenProgram('terminal')}
              className="w-full text-left px-2 py-1 hover:bg-spidey hover:text-text"
            >
              ▶ Terminal.exe
            </button>
            <button
              onClick={() => handleOpenProgram('downloads')}
              className="w-full text-left px-2 py-1 hover:bg-spidey hover:text-text"
            >
              ▶ Downloads.exe
            </button>
            <button
              onClick={() => handleOpenProgram('contact')}
              className="w-full text-left px-2 py-1 hover:bg-spidey hover:text-text"
            >
              ▶ Contact.exe
            </button>
          </div>
        )}
      </div>

      {/* Wallpaper Submenu */}
      <div
        onMouseEnter={() => setActiveSubmenu('wallpapers')}
        className="relative group flex items-center justify-between px-3 py-1.5 hover:bg-spidey hover:text-text cursor-pointer"
      >
        <span>Wallpapers</span>
        <span>▶</span>

        {activeSubmenu === 'wallpapers' && (
          <div className="absolute left-full top-0 ml-1 w-48 win9x-box-raised bg-panel border-2 border-slate p-1 shadow-2xl space-y-1">
            <button
              onClick={() => handleWallpaperChange('night-city')}
              className="w-full text-left px-2 py-1 hover:bg-spidey hover:text-text"
            >
              🏙 Night Cityscape
            </button>
            <button
              onClick={() => handleWallpaperChange('cyber-forest')}
              className="w-full text-left px-2 py-1 hover:bg-spidey hover:text-text"
            >
              🌲 Cyber Forest
            </button>
            <button
              onClick={() => handleWallpaperChange('pixel-mountains')}
              className="w-full text-left px-2 py-1 hover:bg-spidey hover:text-text"
            >
              🏔 Pixel Mountains
            </button>
            <button
              onClick={() => handleWallpaperChange('y2k-pattern')}
              className="w-full text-left px-2 py-1 hover:bg-spidey hover:text-text"
            >
              ✨ Y2K Grid Pattern
            </button>
          </div>
        )}
      </div>

      <div className="my-1 border-b border-slate" />

      {/* Sound Toggle */}
      <button
        onClick={() => {
          toggleSound();
          onClose();
        }}
        className="w-full text-left px-3 py-1.5 hover:bg-spidey hover:text-text flex justify-between"
      >
        <span>Toggle Audio</span>
        <span className="text-yellow">{isMuted ? 'OFF' : 'ON'}</span>
      </button>

      {/* CRT Bloom Effect Toggle */}
      <button
        onClick={() => {
          if (typeof window !== 'undefined') {
            const el = document.getElementById('crt-bloom-overlay');
            if (el) el.classList.toggle('hidden');
          }
          onClose();
        }}
        className="w-full text-left px-3 py-1.5 hover:bg-spidey hover:text-text flex justify-between"
      >
        <span>CRT Bloom Shader</span>
        <span className="text-[#72FFB4]">TOGGLE</span>
      </button>

      {/* Language Toggle */}
      <button
        onClick={() => {
          toggleLanguage();
          onClose();
        }}
        className="w-full text-left px-3 py-1.5 hover:bg-spidey hover:text-text flex justify-between"
      >
        <span>Switch Language</span>
        <span className="text-lavender">[{lang.toUpperCase()}]</span>
      </button>

      <div className="my-1 border-b border-slate" />

      {/* System Properties */}
      <button
        onClick={() => handleOpenProgram('about')}
        className="w-full text-left px-3 py-1.5 hover:bg-spidey hover:text-text text-green"
      >
        💻 System Properties
      </button>
    </div>
  );
};
