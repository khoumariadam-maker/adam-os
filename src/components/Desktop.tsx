'use client';

import React, { useCallback, useRef, useState } from 'react';
import { DesktopIcon } from './DesktopIcon';
import { Taskbar } from './Taskbar';
import { PixelSpider } from './PixelSpider';
import { ContextMenu } from './ContextMenu';
import { CommandPalette } from './CommandPalette';
import { HireCard } from './HireCard';
import { AboutWindow } from './windows/AboutWindow';
import { ProjectsWindow } from './windows/ProjectsWindow';
import { SkillsWindow } from './windows/SkillsWindow';
import { LabWindow } from './windows/LabWindow';
import { TerminalWindow } from './windows/TerminalWindow';
import { JukeboxWindow } from './windows/JukeboxWindow';
import { DownloadsWindow } from './windows/DownloadsWindow';
import { ContactWindow } from './windows/ContactWindow';
import { SpiderSnakeWindow } from './windows/SpiderSnakeWindow';
import { MinesweeperWindow } from './windows/MinesweeperWindow';
import { ControlPanelWindow } from './windows/ControlPanelWindow';
import { ExplorerWindow } from './windows/ExplorerWindow';
import { PaintWindow } from './windows/PaintWindow';
import { useWindowManager } from '@/context/WindowManagerContext';
import { useLanguage } from '@/context/LanguageContext';
import { useSound } from '@/context/SoundContext';
import { useMascot } from '@/context/MascotContext';
import { useSettings } from '@/context/SettingsContext';
import { APPS, APP_BY_ID, WindowId } from '@/lib/apps';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { asset } from '@/lib/asset';

interface DesktopProps {
  onReboot?: () => void;
}

type Rect = { x: number; y: number; w: number; h: number };

export const Desktop: React.FC<DesktopProps> = ({ onReboot }) => {
  const { openWindow } = useWindowManager();
  const { t } = useLanguage();
  const { playClick, playWindowOpen } = useSound();
  const mascot = useMascot();
  const { settings } = useSettings();
  const isMobile = useIsMobile();

  const [selected, setSelected] = useState<Set<WindowId>>(new Set());
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [isShutdown, setIsShutdown] = useState<boolean>(false);
  const [paletteOpen, setPaletteOpen] = useState<boolean>(false);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const iconsRef = useRef<HTMLDivElement>(null);

  const labels: Partial<Record<WindowId, string>> = {
    about: t.desktop.about,
    projects: t.desktop.projects,
    skills: t.desktop.skills,
    terminal: t.desktop.terminal,
    downloads: t.desktop.downloads,
    contact: t.desktop.contact,
  };
  // Phones get every app on the home screen; the desktop keeps the clutter down.
  const desktopApps = APPS.filter((a) => isMobile || a.onDesktop);

  const handleOpen = useCallback(
    (id: WindowId) => {
      playClick();
      playWindowOpen();
      openWindow(id);
      mascot.notifyWindowEvent('open', APP_BY_ID[id].title);
      setSelected(new Set([id]));
    },
    [openWindow, playClick, playWindowOpen, mascot]
  );

  const handleSelect = (id: WindowId, additive: boolean) => {
    playClick();
    setSelected((prev) => {
      if (!additive) return new Set([id]);
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Rubber-band selection on empty desktop space.
  const handleDesktopPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setContextMenuPos(null);
    if (e.button !== 0 || e.target !== e.currentTarget || e.pointerType === 'touch') return;
    setSelected(new Set());
    const sx = e.clientX;
    const sy = e.clientY;
    const onMove = (mv: PointerEvent) => {
      const rect = {
        x: Math.min(sx, mv.clientX),
        y: Math.min(sy, mv.clientY),
        w: Math.abs(mv.clientX - sx),
        h: Math.abs(mv.clientY - sy),
      };
      setMarquee(rect);
      const hits = new Set<WindowId>();
      iconsRef.current?.querySelectorAll<HTMLElement>('[data-icon-id]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.left < rect.x + rect.w && r.right > rect.x && r.top < rect.y + rect.h && r.bottom > rect.y) {
          hits.add(el.dataset.iconId as WindowId);
        }
      });
      setSelected(hits);
    };
    const onUp = () => {
      setMarquee(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleTriggerTheater = (file: 'en' | 'ar') => {
    mascot.react('loading', file === 'en' ? 'Fetching Resume_EN.pdf!' : 'Fetching Resume_AR.pdf!', 1200);
  };

  if (isShutdown) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center p-8 text-center font-pixel text-text crt-scanlines">
        <div className="space-y-6 max-w-md">
          <p className="text-[#FF9F43] text-base md:text-lg leading-relaxed">{t.shutdown.message}</p>
          <button
            onClick={() => {
              setIsShutdown(false);
              onReboot?.();
            }}
            aria-label="Reboot system"
            className="win9x-button win9x-button-spidey px-4 py-2 font-pixel text-xs text-text"
          >
            {t.shutdown.reboot}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onPointerDown={handleDesktopPointerDown}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenuPos({ x: e.clientX, y: e.clientY });
      }}
      className="relative w-full h-full overflow-hidden bg-base"
    >
      {/* Wallpaper + readability layers (all non-interactive) */}
      <img
        src={asset(`/wallpapers/${mascot.activeWallpaper}-16x9.jpg`)}
        alt=""
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover pixel-art pointer-events-none opacity-60"
      />
      <div className="absolute inset-0 desktop-vignette pointer-events-none" />
      <div className="absolute inset-0 bg-halftone bg-halftone-overlay bg-halftone-animate pointer-events-none" />
      {settings.crtBloom && <div className="crt-bloom-overlay" />}

      {contextMenuPos && (
        <ContextMenu
          x={contextMenuPos.x}
          y={contextMenuPos.y}
          onClose={() => setContextMenuPos(null)}
          onOpenPalette={() => setPaletteOpen(true)}
        />
      )}

      {/* Phone home screen: profile card + app grid, scrollable above the tab bar */}
      <div className={isMobile ? 'absolute inset-x-0 top-0 bottom-14 overflow-y-auto z-[10]' : 'contents'}>
      {isMobile && <HireCard variant="mobile" />}

      {/* Icons: column-major grid that wraps into a new column when it runs out of height */}
      <div
        ref={iconsRef}
        onPointerDown={handleDesktopPointerDown}
        className={
          isMobile
            ? 'grid grid-cols-4 gap-y-2 justify-items-center px-2 pt-2 pb-28'
            : 'absolute top-3 left-3 bottom-12 z-[10] grid grid-flow-col auto-cols-max gap-x-1 gap-y-1 content-start [grid-template-rows:repeat(auto-fill,92px)]'
        }
      >
        {desktopApps.map((app) => (
          <DesktopIcon
            key={app.id}
            id={app.id}
            label={(labels[app.id] ?? app.title).replace(/\.exe$/, '')}
            iconSrc={app.icon}
            isSelected={selected.has(app.id)}
            onSelect={handleSelect}
            onOpen={handleOpen}
          />
        ))}
      </div>
      </div>

      {!isMobile && <HireCard variant="desktop" />}

      {marquee && (
        <div
          className="marquee fixed pointer-events-none z-[20]"
          style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
        />
      )}

      <AboutWindow />
      <ProjectsWindow />
      <SkillsWindow />
      <LabWindow />
      <TerminalWindow onTriggerTheater={handleTriggerTheater} onReboot={onReboot} />
      <JukeboxWindow />
      <SpiderSnakeWindow />
      <MinesweeperWindow />
      <ControlPanelWindow />
      <ExplorerWindow />
      <PaintWindow />
      <DownloadsWindow onTriggerTheater={handleTriggerTheater} />
      <ContactWindow />

      <PixelSpider />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onReboot={onReboot}
        onShutdown={() => setIsShutdown(true)}
      />

      <Taskbar onShutdown={() => setIsShutdown(true)} onOpenPalette={() => setPaletteOpen(true)} />
    </div>
  );
};
