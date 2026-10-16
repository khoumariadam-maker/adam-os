'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { readJSON, writeStorage } from '@/lib/storage';

export type ThemeName = 'dark' | 'classic';

export interface Settings {
  theme: ThemeName;
  crtBloom: boolean;
  scanlines: number; // 0-100
  screensaver: boolean;
  liveWallpaper: boolean;
  customCursor: boolean;
}

const DEFAULTS: Settings = { theme: 'dark', crtBloom: false, scanlines: 30, screensaver: true, liveWallpaper: true, customCursor: true };
const KEY = 'adam_os_settings';

interface SettingsContextType {
  settings: Settings;
  updateSettings: (changes: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    setSettings({ ...DEFAULTS, ...readJSON<Partial<Settings>>(KEY, {}) });
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--scanline-opacity', String(settings.scanlines / 100));
  }, [settings.scanlines]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.theme === 'classic' ? '#008080' : '#0B0B10');
  }, [settings.theme]);

  const updateSettings = (changes: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...changes };
      writeStorage(KEY, JSON.stringify(next));
      return next;
    });
  };

  return <SettingsContext.Provider value={{ settings, updateSettings }}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};
