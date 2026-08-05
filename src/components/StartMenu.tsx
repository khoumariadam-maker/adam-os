'use client';

import React from 'react';
import { useWindowManager, WindowId } from '@/context/WindowManagerContext';
import { useLanguage } from '@/context/LanguageContext';
import { useSound } from '@/context/SoundContext';

interface StartMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onShutdown: () => void;
}

export const StartMenu: React.FC<StartMenuProps> = ({ isOpen, onClose, onShutdown }) => {
  const { openWindow, focusWindow } = useWindowManager();
  const { t } = useLanguage();
  const { playClick, playWindowOpen, playShutdown } = useSound();

  if (!isOpen) return null;

  const handleOpen = (id: WindowId) => {
    playClick();
    playWindowOpen();
    openWindow(id);
    focusWindow(id);
    onClose();
  };

  const handleShutdownClick = () => {
    playClick();
    playShutdown();
    onShutdown();
    onClose();
  };

  return (
    <div
      className="fixed bottom-11 left-1 z-[900] w-64 win9x-box-raised bg-panel flex flex-col p-1 shadow-2xl border-2 border-slate"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex gap-2">
        {/* Win98 Blue Gradient Side Banner */}
        <div className="w-8 bg-spidey flex items-end justify-center py-4 writing-mode-vertical border-r border-slate">
          <span className="font-pixel text-xs text-text tracking-widest rotate-180 select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            ADAM OS 98
          </span>
        </div>

        {/* Menu Items */}
        <div className="flex-1 flex flex-col gap-1 py-1 pr-1 font-pixel text-xs text-text">
          <button
            onClick={() => handleOpen('about')}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-spidey hover:text-text text-left transition-colors"
          >
            <span className="text-yellow">▶</span> {t.startmenu.about}
          </button>

          <button
            onClick={() => handleOpen('projects')}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-spidey hover:text-text text-left transition-colors"
          >
            <span className="text-yellow">▶</span> {t.startmenu.projects}
          </button>

          <button
            onClick={() => handleOpen('skills')}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-spidey hover:text-text text-left transition-colors"
          >
            <span className="text-green">▶</span> Skills.exe
          </button>

          <button
            onClick={() => handleOpen('terminal')}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-spidey hover:text-text text-left transition-colors"
          >
            <span className="text-green">▶</span> {t.startmenu.terminal}
          </button>

          <button
            onClick={() => handleOpen('jukebox')}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-spidey hover:text-text text-left transition-colors"
          >
            <span className="text-yellow">♫</span> Jukebox.exe (8-Bit)
          </button>

          <button
            onClick={() => handleOpen('snake')}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-spidey hover:text-text text-left transition-colors"
          >
            <span className="text-[#72FFB4]">🐍</span> SpiderSnake.exe
          </button>

          <button
            onClick={() => handleOpen('explorer')}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-spidey hover:text-text text-left transition-colors"
          >
            <span className="text-[#FFE55C]">📁</span> Explorer.exe
          </button>

          <button
            onClick={() => handleOpen('paint')}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-spidey hover:text-text text-left transition-colors"
          >
            <span className="text-[#FF3A66]">🎨</span> Paint.exe
          </button>

          <button
            onClick={() => handleOpen('controlpanel')}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-spidey hover:text-text text-left transition-colors"
          >
            <span className="text-[#C3C6ED]">⚙</span> ControlPanel.exe
          </button>

          <button
            onClick={() => handleOpen('downloads')}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-spidey hover:text-text text-left transition-colors"
          >
            <span className="text-yellow">▶</span> {t.startmenu.cv}
          </button>

          <button
            onClick={() => handleOpen('contact')}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-spidey hover:text-text text-left transition-colors"
          >
            <span className="text-yellow">▶</span> {t.startmenu.contact}
          </button>

          <div className="my-1 border-b border-slate" />

          <button
            onClick={handleShutdownClick}
            className="flex items-center gap-2 px-3 py-1.5 text-red hover:bg-red hover:text-text text-left transition-colors"
          >
            <span>⏻</span> {t.startmenu.shutdown}
          </button>
        </div>
      </div>
    </div>
  );
};
