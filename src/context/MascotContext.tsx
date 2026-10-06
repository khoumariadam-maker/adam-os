'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { SpiderFrame } from '@/components/PixelSpider';
import { useSound } from './SoundContext';
import { readStorage, writeStorage } from '@/lib/storage';
import { MOBILE_BREAKPOINT } from '@/lib/hooks/useIsMobile';

export const WALLPAPERS = ['night-city', 'cyber-forest', 'pixel-mountains', 'y2k-pattern'] as const;
export type WallpaperName = (typeof WALLPAPERS)[number];

interface MascotContextType {
  frame: SpiderFrame;
  speechText: string | undefined;
  isSwinging: boolean;
  activeWallpaper: WallpaperName;
  setFrame: (frame: SpiderFrame) => void;
  setSpeechText: (text: string | undefined) => void;
  // Shows a frame + line, then returns to idle after `ms`.
  react: (frame: SpiderFrame, text?: string, ms?: number) => void;
  triggerRandomInteraction: () => void;
  notifyWindowEvent: (type: 'open' | 'close' | 'minimize', windowTitle?: string) => void;
  changeWallpaper: (name: WallpaperName) => void;
}

const WALLPAPER_KEY = 'adam_os_wallpaper';

const TIPS: Array<{ frame: SpiderFrame; text: string; sound: 'swing' | 'fanfare' | 'click' }> = [
  { frame: 'swinging', text: 'Thwip! Press Ctrl+K to jump to any app.', sound: 'swing' },
  { frame: 'celebrating', text: 'Adam led the Scientific Club Afaq at Bouira University in 2025–2026.', sound: 'fanfare' },
  { frame: 'typing', text: 'Open Lab.exe to watch a simulated feed from the ESP32 irrigation build.', sound: 'click' },
  { frame: 'waving', text: 'Hiring? Resume.exe has the PDF, and /resume has a plain web version.', sound: 'click' },
  { frame: 'typing', text: "Try 'neofetch' or 'sudo hire-adam' in Terminal.exe.", sound: 'click' },
  { frame: 'sleeping', text: 'Zzz… drag a window to the screen edge to snap it. Click me to wake up!', sound: 'click' },
];

const MascotContext = createContext<MascotContextType | undefined>(undefined);

export const MascotProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { playSwing, playClick, playDownloadFanfare } = useSound();
  const [frame, setFrame] = useState<SpiderFrame>('idle');
  // Phones skip the greeting: the screen is small and the home card already says hello.
  const [speechText, setSpeechText] = useState<string | undefined>(() =>
    typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
      ? undefined
      : "Hey! I'm Pixel Spider. Double-click an icon, or press Ctrl+K to search."
  );
  const [isSwinging, setIsSwinging] = useState<boolean>(false);
  const [activeWallpaper, setActiveWallpaper] = useState<WallpaperName>('night-city');
  const tipIndex = useRef(0);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = readStorage(WALLPAPER_KEY) as WallpaperName | null;
    if (saved && WALLPAPERS.includes(saved)) setActiveWallpaper(saved);
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const react = useCallback((nextFrame: SpiderFrame, text?: string, ms = 1800) => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setFrame(nextFrame);
    if (text !== undefined) setSpeechText(text);
    resetTimer.current = setTimeout(() => {
      setFrame('idle');
      setIsSwinging(false);
    }, ms);
  }, []);

  const changeWallpaper = useCallback(
    (name: WallpaperName) => {
      setActiveWallpaper(name);
      writeStorage(WALLPAPER_KEY, name);
      playClick();
      react('celebrating', `Wallpaper changed to ${name.replace('-', ' ')}.`, 1500);
    },
    [playClick, react]
  );

  const triggerRandomInteraction = useCallback(() => {
    const tip = TIPS[tipIndex.current % TIPS.length];
    tipIndex.current += 1;
    if (tip.sound === 'swing') {
      playSwing();
      setIsSwinging(true);
    } else if (tip.sound === 'fanfare') {
      playDownloadFanfare();
    } else {
      playClick();
    }
    react(tip.frame, tip.text, tip.frame === 'sleeping' ? 2500 : 1800);
  }, [playSwing, playDownloadFanfare, playClick, react]);

  const notifyWindowEvent = useCallback(
    (type: 'open' | 'close' | 'minimize', windowTitle?: string) => {
      if (type === 'open') react('loading', windowTitle ? `Opening ${windowTitle}…` : undefined, 900);
      else if (type === 'close') react('waving', undefined, 900);
    },
    [react]
  );

  return (
    <MascotContext.Provider
      value={{
        frame,
        speechText,
        isSwinging,
        activeWallpaper,
        setFrame,
        setSpeechText,
        react,
        triggerRandomInteraction,
        notifyWindowEvent,
        changeWallpaper,
      }}
    >
      {children}
    </MascotContext.Provider>
  );
};

export const useMascot = () => {
  const context = useContext(MascotContext);
  if (!context) {
    throw new Error('useMascot must be used within MascotProvider');
  }
  return context;
};
