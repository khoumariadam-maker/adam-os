'use client';

import React, { useState, useEffect } from 'react';
import { useWindowManager, WindowId } from '@/context/WindowManagerContext';
import { useLanguage } from '@/context/LanguageContext';
import { useSound } from '@/context/SoundContext';
import { StartMenu } from './StartMenu';
import { useMascot } from '@/context/MascotContext';
import type { SpiderFrame } from '@/components/PixelSpider';

interface TaskbarProps {
  onShutdown: () => void;
}

export const Taskbar: React.FC<TaskbarProps> = ({ onShutdown }) => {
  const { windows, activeWindowId, openWindow, focusWindow, minimizeWindow } = useWindowManager();
  const { lang, toggleLanguage, t } = useLanguage();
  const { isMuted, toggleSound, playClick } = useSound();
  const mascot = useMascot();

  const [isStartOpen, setIsStartOpen] = useState<boolean>(false);
  const [timeStr, setTimeStr] = useState<string>('');
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleStartToggle = () => {
    playClick();
    setIsStartOpen((prev) => !prev);
  };

  const handleTabClick = (id: WindowId) => {
    playClick();
    const win = windows[id];
    if (!win.isOpen) {
      openWindow(id);
      focusWindow(id);
    } else if (win.isMinimized) {
      focusWindow(id);
    } else if (activeWindowId === id) {
      minimizeWindow(id);
    } else {
      focusWindow(id);
    }

    // Pixel Spider reacts to mobile navigation per spec
    const frameMap: Partial<Record<WindowId, SpiderFrame>> = {
      about: 'idle',
      projects: 'typing',
      downloads: 'loading',
      contact: 'waving',
      skills: 'celebrating',
      terminal: 'typing',
    };
    const speechMap: Partial<Record<WindowId, string>> = {
      about: 'Yo! Swipe around — this OS is my portfolio.',
      projects: 'Check the builds. Real circuits, real code.',
      downloads: 'Need the CV? I got you.',
      contact: 'Hit me up. I actually reply.',
      skills: 'Here\'s what I\'m running under the hood.',
      terminal: 'Type \'help\' to see what this thing can do.',
    };
    const nextFrame = frameMap[id];
    const nextSpeech = speechMap[id];
    if (nextFrame) mascot.setFrame(nextFrame);
    if (nextSpeech) mascot.setSpeechText(nextSpeech);
  };

  // Mobile Bottom Tab Bar layout
  if (isMobile) {
    const navItems: Array<{ id: WindowId; label: string }> = [
      { id: 'about', label: t.taskbar.home },
      { id: 'projects', label: t.taskbar.projects },
      { id: 'downloads', label: t.taskbar.cv },
      { id: 'contact', label: t.taskbar.contact },
    ];

    return (
      <>
        {/* Floating Language Toggle — spec: "floating language toggle" separate from tab bar */}
        <button
          onClick={toggleLanguage}
          aria-label="Toggle language"
          className="fixed bottom-20 right-4 z-[510] win9x-button min-w-11 min-h-11 flex items-center justify-center font-pixel text-[10px] text-yellow"
        >
          {lang.toUpperCase()}
        </button>

        <div className="fixed bottom-0 left-0 right-0 z-[500] bg-panel2 border-t-2 border-slate flex items-center justify-around h-14 px-2">
          {navItems.map((item) => {
            const isActive = activeWindowId === item.id && windows[item.id].isOpen && !windows[item.id].isMinimized;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                aria-label={`Open ${item.label}`}
                className={`flex flex-col items-center justify-center flex-1 h-full py-1 font-pixel text-[10px] min-h-11 ${
                  isActive ? 'text-text border-t-2 border-spidey bg-panel' : 'text-lavender'
                }`}
              >
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </>
    );
  }

  // Desktop Taskbar Layout
  return (
    <>
      <StartMenu
        isOpen={isStartOpen}
        onClose={() => setIsStartOpen(false)}
        onShutdown={onShutdown}
      />

      <div className="fixed bottom-0 left-0 right-0 z-[500] h-10 bg-panel2 border-t-2 border-slate flex items-center justify-between px-2 select-none">
        {/* Left: Start Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleStartToggle}
            aria-label="Open Start Menu"
            className={`win9x-button flex items-center gap-2 px-3 py-1 font-pixel text-xs ${
              isStartOpen ? 'shadow-inner bg-panel border-slate' : ''
            }`}
          >
            <span className="text-spidey font-bold">🕸</span>
            <span>{t.taskbar.start}</span>
          </button>

          {/* Center: Open Window Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto max-w-[50vw]">
            {(Object.keys(windows) as WindowId[]).map((id) => {
              const win = windows[id];
              if (!win.isOpen) return null;
              const isActive = activeWindowId === id && !win.isMinimized;

              return (
                <button
                  key={id}
                  onClick={() => handleTabClick(id)}
                  aria-label={`Switch to ${win.title}`}
                  className={`win9x-button flex items-center gap-1.5 px-2 py-1 font-pixel text-[11px] max-w-[140px] truncate ${
                    isActive ? 'bg-panel border-spidey text-text font-bold' : 'text-lavender hover:text-text'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green' : 'bg-slate'}`} />
                  <span className="truncate">{win.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Clock & Toggles */}
        <div className="flex items-center gap-2">
          {/* Language Toggle */}
          <button
            onClick={toggleLanguage}
            aria-label="Toggle language"
            className="win9x-button px-2 py-1 font-pixel text-[11px] text-lavender hover:text-text"
            title="Toggle Language"
          >
            [{lang.toUpperCase()}]
          </button>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            aria-label="Toggle sound"
            className="win9x-button px-2 py-1 font-pixel text-[11px] text-yellow hover:text-text"
            title="Toggle Sound"
          >
            {isMuted ? '🔇 OFF' : '🔊 ON'}
          </button>

          {/* System Clock */}
          <div className="win9x-box-recessed px-3 py-1 font-mono text-xs text-green bg-base min-w-[70px] text-center">
            {timeStr || '12:00'}
          </div>
        </div>
      </div>
    </>
  );
};
