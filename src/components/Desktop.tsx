'use client';

import React, { useState, useEffect } from 'react';
import { DesktopIcon } from './DesktopIcon';
import { Taskbar } from './Taskbar';
import { PixelSpider } from './PixelSpider';
import { ContextMenu } from './ContextMenu';
import { AboutWindow } from './windows/AboutWindow';
import { ProjectsWindow } from './windows/ProjectsWindow';
import { SkillsWindow } from './windows/SkillsWindow';
import { TerminalWindow } from './windows/TerminalWindow';
import { JukeboxWindow } from './windows/JukeboxWindow';
import { DownloadsWindow } from './windows/DownloadsWindow';
import { ContactWindow } from './windows/ContactWindow';
import { SpiderSnakeWindow } from './windows/SpiderSnakeWindow';
import { ControlPanelWindow } from './windows/ControlPanelWindow';
import { ExplorerWindow } from './windows/ExplorerWindow';
import { PaintWindow } from './windows/PaintWindow';
import { useWindowManager, WindowId } from '@/context/WindowManagerContext';
import { useLanguage } from '@/context/LanguageContext';
import { useSound } from '@/context/SoundContext';
import { useMascot } from '@/context/MascotContext';

interface DesktopProps {
  onReboot?: () => void;
}

export const Desktop: React.FC<DesktopProps> = ({ onReboot }) => {
  const { windows } = useWindowManager();
  const { t, lang, toggleLanguage } = useLanguage();
  const { isMuted, toggleSound } = useSound();
  const mascot = useMascot();

  const [selectedIcon, setSelectedIcon] = useState<WindowId | 'sound' | 'lang' | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [isShutdown, setIsShutdown] = useState<boolean>(false);

  const desktopIcons: Array<{ id: WindowId; label: string; icon: string }> = [
    { id: 'about', label: t.desktop.about, icon: '/icons/nav-about.png' },
    { id: 'projects', label: t.desktop.projects, icon: '/icons/nav-projects.png' },
    { id: 'skills', label: t.desktop.skills || 'Skills.exe', icon: '/icons/nav-skills.png' },
    { id: 'terminal', label: t.desktop.terminal, icon: '/icons/ui-terminal.png' },
    { id: 'jukebox', label: 'Jukebox.exe', icon: '/icons/ui-ai-spark.png' },
    { id: 'snake', label: 'SpiderSnake', icon: '/icons/file-zip.png' },
    { id: 'controlpanel', label: 'ControlPanel', icon: '/icons/nav-skills.png' },
    { id: 'explorer', label: 'Explorer.exe', icon: '/icons/ui-folder-open.png' },
    { id: 'paint', label: 'Paint.exe', icon: '/icons/ui-ai-spark.png' },
    { id: 'downloads', label: t.desktop.downloads, icon: '/icons/nav-downloads.png' },
    { id: 'contact', label: t.desktop.contact, icon: '/icons/nav-contact.png' },
  ];

  // Periodic Spider Swing Interaction
  useEffect(() => {
    const interval = setInterval(() => {
      mascot.triggerRandomInteraction();
    }, 25000);
    return () => clearInterval(interval);
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const handleIconSelect = (id: WindowId) => {
    setSelectedIcon(id);
    mascot.notifyWindowEvent('open', windows[id]?.title || id);
  };

  // CV Download Theater Sequence
  const handleTriggerTheater = (file: 'en' | 'ar') => {
    mascot.setFrame('loading');
    mascot.setSpeechText(file === 'en' ? 'Fetching Resume_EN.pdf!' : 'Fetching Resume_AR.pdf!');

    setTimeout(() => {
      mascot.triggerRandomInteraction();
    }, 400);
  };

  if (isShutdown) {
    return (
      <div className="fixed inset-0 z-[9999] bg-base flex flex-col items-center justify-center p-8 text-center font-pixel text-text crt-scanlines">
        <div className="win9x-box-raised p-8 bg-panel max-w-md space-y-4 border-2 border-red">
          <h1 className="text-red text-lg">SYSTEM SHUTDOWN</h1>
          <p className="font-body text-textDim text-sm">{t.shutdown.message}</p>
          <button
            onClick={() => setIsShutdown(false)}
            aria-label="Reboot system"
            className="win9x-button win9x-button-spidey px-4 py-2 font-pixel text-xs text-text"
          >
            {t.shutdown.reboot}
          </button>
        </div>
      </div>
    );
  }

  const wallpaperPath = `/wallpapers/${mascot.activeWallpaper}-16x9.jpg`;

  return (
    <div
      onClick={() => {
        setSelectedIcon(null);
        setContextMenuPos(null);
      }}
      onContextMenu={handleContextMenu}
      className="relative w-screen h-screen overflow-hidden bg-base bg-halftone bg-cobalt-glow select-none"
    >
      {/* Real Desktop Wallpaper Image */}
      <img
        src={wallpaperPath}
        alt="Desktop Wallpaper"
        className="absolute inset-0 w-full h-full object-cover opacity-25 pixel-art pointer-events-none transition-opacity duration-300"
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/wallpapers/night-city-16x9.jpg';
        }}
      />

      {/* Background Halftone Overlay with 60s linear drift */}
      <div className="absolute inset-0 bg-halftone-overlay bg-halftone-animate pointer-events-none" />

      {/* CRT Bloom Shader Overlay */}
      <div id="crt-bloom-overlay" className="crt-bloom-overlay hidden pointer-events-none" />

      {/* Right-Click Desktop Context Menu */}
      {contextMenuPos && (
        <ContextMenu
          x={contextMenuPos.x}
          y={contextMenuPos.y}
          onClose={() => setContextMenuPos(null)}
        />
      )}

      {/* Desktop Icons Grid (3-column on mobile <768px, flex-column wrap on desktop) */}
      <div className="absolute top-4 left-4 z-[10] grid grid-cols-3 md:flex md:flex-col md:flex-wrap max-h-[calc(100vh-60px)] gap-x-6 gap-y-2 content-start pointer-events-auto">
        {desktopIcons.map((icon) => (
          <DesktopIcon
            key={icon.id}
            id={icon.id}
            label={icon.label}
            iconSrc={icon.icon}
            isSelected={selectedIcon === icon.id}
            onSelect={handleIconSelect}
          />
        ))}

        {/* Sound Toggle Desktop Icon */}
        <button
          type="button"
          aria-label="Toggle sound"
          onClick={(e) => {
            e.stopPropagation();
            toggleSound();
            setSelectedIcon('sound');
          }}
          className={`flex flex-col items-center justify-center p-2 rounded cursor-pointer w-24 ${
            selectedIcon === 'sound' ? 'bg-spidey/30 border border-spidey' : 'hover:bg-panel2/40'
          }`}
        >
          <div className="w-12 h-12 flex items-center justify-center font-pixel text-xl text-yellow">
            {isMuted ? '🔇' : '🔊'}
          </div>
          <span className="font-pixel text-[14px] text-text text-center mt-1 font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            {isMuted ? t.desktop.soundOff : t.desktop.soundOn}
          </span>
        </button>

        {/* Language Toggle Desktop Icon */}
        <button
          type="button"
          aria-label="Toggle language"
          onClick={(e) => {
            e.stopPropagation();
            toggleLanguage();
            setSelectedIcon('lang');
          }}
          className={`flex flex-col items-center justify-center p-2 rounded cursor-pointer w-24 ${
            selectedIcon === 'lang' ? 'bg-spidey/30 border border-spidey' : 'hover:bg-panel2/40'
          }`}
        >
          <div className="w-12 h-12 flex items-center justify-center font-pixel text-xl text-lavender">
            🌐
          </div>
          <span className="font-pixel text-[14px] text-text text-center mt-1 font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            [{lang.toUpperCase()}]
          </span>
        </button>
      </div>

      {/* Render Application Windows (z-index 100-200) */}
      <AboutWindow />
      <ProjectsWindow />
      <SkillsWindow />
      <TerminalWindow onTriggerTheater={handleTriggerTheater} onReboot={onReboot} />
      <JukeboxWindow />
      <SpiderSnakeWindow />
      <ControlPanelWindow />
      <ExplorerWindow />
      <PaintWindow />
      <DownloadsWindow onTriggerTheater={handleTriggerTheater} />
      <ContactWindow />

      {/* Mascot Pixel Spider (z-index 750) */}
      <PixelSpider />

      {/* Bottom Taskbar (z-index 500) */}
      <Taskbar onShutdown={() => setIsShutdown(true)} />
    </div>
  );
};
