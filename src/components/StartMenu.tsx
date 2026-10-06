'use client';

import React, { useEffect, useRef } from 'react';
import { useWindowManager } from '@/context/WindowManagerContext';
import { useLanguage } from '@/context/LanguageContext';
import { useSound } from '@/context/SoundContext';
import { APPS, AppGroup, WindowId } from '@/lib/apps';
import { PROFILE } from '@/lib/profile';
import { asset } from '@/lib/asset';

interface StartMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onShutdown: () => void;
  onOpenPalette: () => void;
}

const itemClass =
  'w-full flex items-center gap-2.5 px-2.5 py-1.5 text-start hover:bg-spidey focus-visible:bg-spidey focus-visible:outline-none';

export const StartMenu: React.FC<StartMenuProps> = ({ isOpen, onClose, onShutdown, onOpenPalette }) => {
  const { openWindow } = useWindowManager();
  const { t, lang } = useLanguage();
  const { playClick, playWindowOpen, playShutdown } = useSound();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape, and focus the first item for keyboard users.
  useEffect(() => {
    if (!isOpen) return;
    menuRef.current?.querySelector<HTMLElement>('button, a')?.focus();
    const onPointer = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (!menuRef.current?.contains(target) && !target.closest('[aria-label="Open Start menu"]')) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOpen = (id: WindowId) => {
    playClick();
    playWindowOpen();
    openWindow(id);
    onClose();
  };

  const groups: Array<{ key: AppGroup; label: string }> = [
    { key: 'portfolio', label: t.startmenu.programs },
    { key: 'tools', label: t.startmenu.tools },
    { key: 'games', label: t.startmenu.games },
  ];

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Start menu"
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed bottom-10 left-1 z-[900] w-72 win9x-box-raised window-active-shadow flex"
    >
      <div className="w-8 bg-gradient-to-t from-spidey to-[#0a0f6b] flex items-end justify-center pb-3">
        <span className="font-pixel text-sm text-text tracking-widest [writing-mode:vertical-rl] rotate-180 whitespace-nowrap">
          ADAM<span className="text-lavender">OS</span> 98
        </span>
      </div>

      <div className="flex-1 py-1 font-pixel text-[11px] text-text">
        <div className="px-2.5 py-2 mb-1 border-b border-slate/40 flex items-center gap-2">
          <img src={asset('/mascot/idle-01.png')} alt="" className="w-8 h-8 pixel-art bg-panel2 border border-slate/50" />
          <div className="min-w-0">
            <p className="truncate">{lang === 'ar' ? PROFILE.nameAr : PROFILE.name}</p>
            <p className="font-body text-[10px] text-lavender truncate">{lang === 'ar' ? PROFILE.roleAr : PROFILE.role}</p>
          </div>
        </div>

        {groups.map((group) => (
          <div key={group.key} className="mb-1">
            <p className="px-2.5 pt-1 pb-0.5 text-[9px] uppercase tracking-widest text-lavender/70">{group.label}</p>
            {APPS.filter((a) => a.group === group.key).map((app) => (
              <button key={app.id} role="menuitem" onClick={() => handleOpen(app.id)} className={itemClass}>
                <img src={asset(app.icon)} alt="" className="w-4 h-4 pixel-art" />
                {app.title}
              </button>
            ))}
          </div>
        ))}

        <div className="my-1 border-t border-slate/40" />
        <a role="menuitem" href={asset('/resume/')} className={itemClass}>
          <span className="w-4 text-center">🧾</span> {t.startmenu.web_resume}
        </a>
        <button
          role="menuitem"
          onClick={() => {
            onClose();
            onOpenPalette();
          }}
          className={itemClass}
        >
          <span className="w-4 text-center">🔍</span> {t.startmenu.run}
        </button>
        <div className="my-1 border-t border-slate/40" />
        <button
          role="menuitem"
          onClick={() => {
            playClick();
            playShutdown();
            onClose();
            onShutdown();
          }}
          className={`${itemClass} text-red hover:!bg-red hover:text-text`}
        >
          <span className="w-4 text-center">⏻</span> {t.startmenu.shutdown}
        </button>
      </div>
    </div>
  );
};
