'use client';

import React, { createContext, useContext, useState } from 'react';
import { SpiderFrame } from '@/components/PixelSpider';
import { useSound } from './SoundContext';

type WallpaperName = 'night-city' | 'cyber-forest' | 'pixel-mountains' | 'y2k-pattern';

interface MascotContextType {
  frame: SpiderFrame;
  speechText: string | undefined;
  isSwinging: boolean;
  activeWallpaper: WallpaperName;
  setFrame: (frame: SpiderFrame) => void;
  setSpeechText: (text: string | undefined) => void;
  triggerRandomInteraction: () => void;
  notifyWindowEvent: (type: 'open' | 'close' | 'minimize', windowTitle?: string) => void;
  changeWallpaper: (name: WallpaperName) => void;
}

const MascotContext = createContext<MascotContextType | undefined>(undefined);

export const MascotProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { playSwing, playClick, playDownloadFanfare, playError } = useSound();
  const [frame, setFrame] = useState<SpiderFrame>('idle');
  const [speechText, setSpeechText] = useState<string | undefined>("Hey there! I'm Pixel Spider. Click around or right-click the desktop!");
  const [isSwinging, setIsSwinging] = useState<boolean>(false);
  const [activeWallpaper, setActiveWallpaper] = useState<WallpaperName>('night-city');
  const [interactionIndex, setInteractionIndex] = useState<number>(0);

  const changeWallpaper = (name: WallpaperName) => {
    setActiveWallpaper(name);
    playClick();
    setFrame('celebrating');
    setSpeechText(`Wallpaper changed to ${name.replace('-', ' ')}! Looks retro.`);
    setTimeout(() => setFrame('idle'), 1500);
  };

  const triggerRandomInteraction = () => {
    const nextIdx = (interactionIndex + 1) % 5;
    setInteractionIndex(nextIdx);

    switch (nextIdx) {
      case 0:
        // Swing Arc
        playSwing();
        setIsSwinging(true);
        setFrame('swinging');
        setSpeechText('Thwip! Web slinger on duty. Swinging across Adam OS!');
        setTimeout(() => {
          setIsSwinging(false);
          setFrame('idle');
        }, 1200);
        break;

      case 1:
        // Celebration Fanfare
        playDownloadFanfare();
        setFrame('celebrating');
        setSpeechText('Boom! Did you know Adam led the Scientific Club Afaq and organized robotics bootcamps?');
        setTimeout(() => setFrame('idle'), 2000);
        break;

      case 2:
        // Typing / Hardware Quote
        playClick();
        setFrame('typing');
        setSpeechText('Debugging ESP32 sensors... 35% water saved in Smart Irrigation project!');
        setTimeout(() => setFrame('idle'), 2200);
        break;

      case 3:
        // Waving
        playClick();
        setFrame('waving');
        setSpeechText("Need a fast response? Hit Email or Phone in Contact.exe — Adam replies fast!");
        setTimeout(() => setFrame('idle'), 2000);
        break;

      case 4:
        // Nap time
        playClick();
        setFrame('sleeping');
        setSpeechText('Zzz... Energy rebooting... Click me to wake up!');
        setTimeout(() => setFrame('idle'), 2500);
        break;
    }
  };

  const notifyWindowEvent = (type: 'open' | 'close' | 'minimize', windowTitle?: string) => {
    if (type === 'open') {
      setFrame('loading');
      if (windowTitle) setSpeechText(`Opening ${windowTitle}...`);
      setTimeout(() => setFrame('idle'), 1000);
    } else if (type === 'close') {
      setFrame('waving');
      if (windowTitle) setSpeechText(`Closed ${windowTitle}. What next operator?`);
      setTimeout(() => setFrame('idle'), 1200);
    }
  };

  return (
    <MascotContext.Provider
      value={{
        frame,
        speechText,
        isSwinging,
        activeWallpaper,
        setFrame,
        setSpeechText,
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
