'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PixelIcon } from '@/components/PixelIcon';
import { useWindowManager } from '@/context/WindowManagerContext';
import { useMascot, WALLPAPERS } from '@/context/MascotContext';
import { useLanguage } from '@/context/LanguageContext';
import { useSound } from '@/context/SoundContext';
import { APPS, WindowId } from '@/lib/apps';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onOpenPalette: () => void;
}

const row = 'w-full flex items-center justify-between gap-3 px-3 py-1.5 text-start hover:bg-spidey hover:text-onAccent focus-visible:bg-spidey focus-visible:text-onAccent focus-visible:outline-none';

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, onOpenPalette }) => {
  const { openWindow, minimizeAll } = useWindowManager();
  const { changeWallpaper, activeWallpaper } = useMascot();
  const { lang, toggleLanguage } = useLanguage();
  const { isMuted, toggleSound, playClick } = useSound();
  const [submenu, setSubmenu] = useState<'programs' | 'wallpapers' | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Keep the menu fully on screen.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({ left: Math.min(x, window.innerWidth - width - 4), top: Math.min(y, window.innerHeight - height - 44) });
  }, [x, y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const act = (fn: () => void) => () => {
    playClick();
    fn();
    onClose();
  };
  const openApp = (id: WindowId) => act(() => openWindow(id));
  // Submenus flip to the left when there is no room on the right.
  const flip = pos.left + 224 + 200 > window.innerWidth;
  const subClass = `absolute top-0 ${flip ? 'right-full mr-0.5' : 'left-full ml-0.5'} w-48 win9x-box-raised window-active-shadow p-1`;

  return (
    <div
      ref={ref}
      role="menu"
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={pos}
      className="fixed z-[950] w-56 win9x-box-raised window-active-shadow p-1 font-pixel text-[11px] text-text select-none"
    >
      <div className={`relative ${row} cursor-default`} onPointerEnter={() => setSubmenu('programs')}>
        <span>Open program</span>
        <span aria-hidden="true">▸</span>
        {submenu === 'programs' && (
          <div className={subClass}>
            {APPS.map((app) => (
              <button key={app.id} role="menuitem" onClick={openApp(app.id)} className={row}>
                {app.title}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={`relative ${row} cursor-default`} onPointerEnter={() => setSubmenu('wallpapers')}>
        <span>Wallpaper</span>
        <span aria-hidden="true">▸</span>
        {submenu === 'wallpapers' && (
          <div className={subClass}>
            {WALLPAPERS.map((w) => (
              <button key={w} role="menuitem" onClick={act(() => changeWallpaper(w))} className={row}>
                <span className="capitalize">{w.replace('-', ' ')}</span>
                {activeWallpaper === w && <PixelIcon name="check" />}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="my-1 border-t border-slate/40" onPointerEnter={() => setSubmenu(null)} />
      <div onPointerEnter={() => setSubmenu(null)}>
        <button role="menuitem" onClick={act(onOpenPalette)} className={row}>
          <span>Search…</span>
          <span className="text-lavender text-[9px]">Ctrl+K</span>
        </button>
        <button role="menuitem" onClick={act(minimizeAll)} className={row}>
          Show desktop
        </button>
        <button role="menuitem" onClick={act(toggleLanguage)} className={row}>
          <span>Language</span>
          <span className="text-lavender">{lang === 'en' ? 'EN → AR' : 'AR → EN'}</span>
        </button>
        <button role="menuitem" onClick={act(toggleSound)} className={row}>
          <span>Sound</span>
          <span className="text-lavender">{isMuted ? 'off' : 'on'}</span>
        </button>
        <div className="my-1 border-t border-slate/40" />
        <button role="menuitem" onClick={openApp('controlpanel')} className={row}>
          Properties…
        </button>
      </div>
    </div>
  );
};
