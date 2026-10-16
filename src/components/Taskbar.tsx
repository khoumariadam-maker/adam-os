'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { PixelIcon } from '@/components/PixelIcon';
import { useWindowManager } from '@/context/WindowManagerContext';
import { useLanguage } from '@/context/LanguageContext';
import { useSound } from '@/context/SoundContext';
import { StartMenu } from './StartMenu';
import { APPS, WindowId } from '@/lib/apps';
import type { IconName } from '@/lib/pixel-icons';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { asset } from '@/lib/asset';

interface TaskbarProps {
  onShutdown: () => void;
  onOpenPalette: () => void;
}

const useClock = () => {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(interval);
  }, []);
  return now;
};

export const Taskbar: React.FC<TaskbarProps> = ({ onShutdown, onOpenPalette }) => {
  const { windows, activeWindowId, openWindow, focusWindow, minimizeWindow, minimizeAll } = useWindowManager();
  const { lang, toggleLanguage, t } = useLanguage();
  const { isMuted, toggleSound, playClick } = useSound();
  const isMobile = useIsMobile();
  const now = useClock();
  const [isStartOpen, setIsStartOpen] = useState<boolean>(false);
  const closeStart = useCallback(() => setIsStartOpen(false), []);

  const handleTabClick = (id: WindowId) => {
    playClick();
    const win = windows[id];
    if (!win.isOpen) openWindow(id);
    else if (win.isMinimized || activeWindowId !== id) focusWindow(id);
    else minimizeWindow(id);
  };

  if (isMobile) {
    const navItems: Array<{ id: WindowId | 'home'; label: string; glyph: IconName }> = [
      { id: 'home', label: t.taskbar.home, glyph: 'desktop' },
      { id: 'projects', label: t.taskbar.projects, glyph: 'projects' },
      { id: 'downloads', label: t.taskbar.cv, glyph: 'resume' },
      { id: 'contact', label: t.taskbar.contact, glyph: 'contact' },
    ];
    const noneVisible = !Object.values(windows).some((w) => w.isOpen && !w.isMinimized);

    return (
      <nav
        aria-label="Main"
        className="fixed bottom-0 inset-x-0 z-[600] h-14 bg-panel2 border-t-2 border-slate flex items-stretch pb-[env(safe-area-inset-bottom)]"
      >
        {navItems.map((item) => {
          const isActive =
            item.id === 'home' ? noneVisible : activeWindowId === item.id && windows[item.id].isOpen && !windows[item.id].isMinimized;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'home') {
                  playClick();
                  minimizeAll();
                } else {
                  handleTabClick(item.id);
                }
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 font-pixel text-[10px] ${
                isActive ? 'text-text bg-panel shadow-[inset_0_2px_0_rgb(var(--c-spidey))]' : 'text-lavender'
              }`}
            >
              <PixelIcon name={item.glyph} size={20} />
              <span className="truncate max-w-full px-1">{item.label}</span>
            </button>
          );
        })}
        <button
          onClick={toggleLanguage}
          aria-label="Toggle language"
          className="w-14 flex flex-col items-center justify-center gap-0.5 font-pixel text-[10px] text-yellow border-s border-slate/40"
        >
          <PixelIcon name="language" size={20} />
          {lang === 'en' ? 'AR' : 'EN'}
        </button>
      </nav>
    );
  }

  const openApps = APPS.filter((a) => windows[a.id].isOpen);

  return (
    <>
      <StartMenu isOpen={isStartOpen} onClose={closeStart} onShutdown={onShutdown} onOpenPalette={onOpenPalette} />

      <div
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
        className="fixed bottom-0 left-0 right-0 z-[600] h-10 bg-panel2 border-t-2 border-slate shadow-[inset_0_1px_0_rgb(var(--c-hilite)/0.2)] flex items-center gap-1.5 px-1.5 select-none"
      >
        <button
          onClick={() => {
            playClick();
            setIsStartOpen((prev) => !prev);
          }}
          aria-label="Open Start menu"
          aria-expanded={isStartOpen}
          className={`win9x-button flex items-center gap-2 px-2.5 h-8 font-pixel text-xs ${isStartOpen ? 'taskbar-pressed' : ''}`}
        >
          <img src={asset('/icons/ui-start.png')} alt="" className="w-4 h-4 pixel-art" />
          <span className="font-bold">{t.taskbar.start}</span>
        </button>

        <button
          onClick={onOpenPalette}
          aria-label="Search apps and actions (Ctrl+K)"
          title="Search (Ctrl+K)"
          className="win9x-box-recessed h-8 px-2.5 w-44 xl:w-56 flex items-center gap-2 bg-base text-lavender/80 hover:text-text font-mono text-[11px]"
        >
          <PixelIcon name="search" />
          <span className="flex-1 text-start truncate">{t.taskbar.search}…</span>
          <kbd className="text-[10px] text-slate/80 border border-slate/40 px-1">Ctrl K</kbd>
        </button>

        <div className="w-px h-6 bg-slate/40 mx-0.5" />

        <div className="flex-1 flex items-center gap-1 overflow-x-auto min-w-0">
          {openApps.map((app) => {
            const win = windows[app.id];
            const isActive = activeWindowId === app.id && !win.isMinimized;
            return (
              <button
                key={app.id}
                data-task-id={app.id}
                onClick={() => handleTabClick(app.id)}
                aria-label={`${win.title}${win.isMinimized ? ' (minimized)' : ''}`}
                aria-pressed={isActive}
                title={win.title}
                className={`win9x-button flex items-center gap-1.5 px-2 h-8 font-pixel text-[11px] w-40 min-w-[90px] shrink ${
                  isActive
                    ? 'taskbar-pressed text-text font-bold'
                    : win.isMinimized
                    ? 'text-lavender/60'
                    : 'text-lavender hover:text-text'
                }`}
              >
                <PixelIcon name={app.glyph} className="shrink-0" />
                <span className="truncate">{win.title}</span>
              </button>
            );
          })}
        </div>

        {/* System tray */}
        <div className="win9x-box-recessed h-8 flex items-center gap-1 px-1.5 bg-panel2">
          <button
            onClick={toggleLanguage}
            aria-label={`Language: ${lang.toUpperCase()}. Click to switch.`}
            title="Language"
            className="px-1.5 h-6 font-pixel text-[10px] text-lavender hover:text-text hover:bg-panel"
          >
            {lang.toUpperCase()}
          </button>
          <button
            onClick={toggleSound}
            aria-label={isMuted ? 'Sound off. Click to turn on.' : 'Sound on. Click to mute.'}
            title={isMuted ? 'Sound off' : 'Sound on'}
            className="px-1 h-6 text-sm hover:bg-panel"
          >
            <PixelIcon name={isMuted ? 'sound-off' : 'sound-on'} />
          </button>
          <span
            className="font-mono text-[11px] text-text px-1.5 tabular-nums"
            title={now?.toLocaleDateString(lang === 'ar' ? 'ar-DZ' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          >
            {now ? now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
          </span>
        </div>
        <button
          onClick={() => {
            playClick();
            minimizeAll();
          }}
          aria-label="Show desktop"
          title="Show desktop"
          className="w-2 h-8 border-s border-slate/60 hover:bg-spidey/40"
        />
      </div>
    </>
  );
};
