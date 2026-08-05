'use client';

import React, { createContext, useContext, useState } from 'react';

export type WindowId = 'about' | 'projects' | 'skills' | 'terminal' | 'jukebox' | 'downloads' | 'contact' | 'snake' | 'controlpanel' | 'explorer' | 'paint';

export interface WindowState {
  id: WindowId;
  title: string;
  icon: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

interface WindowManagerContextType {
  windows: Record<WindowId, WindowState>;
  activeWindowId: WindowId | null;
  openWindow: (id: WindowId) => void;
  closeWindow: (id: WindowId) => void;
  minimizeWindow: (id: WindowId) => void;
  focusWindow: (id: WindowId) => void;
  toggleMaximizeWindow: (id: WindowId) => void;
  updatePosition: (id: WindowId, position: { x: number; y: number }) => void;
}

const initialWindows: Record<WindowId, WindowState> = {
  about: {
    id: 'about',
    title: 'About.exe',
    icon: '/icons/nav-about.png',
    isOpen: true,
    isMinimized: false,
    isMaximized: false,
    zIndex: 101,
    position: { x: 40, y: 30 },
    size: { width: 580, height: 460 },
  },
  projects: {
    id: 'projects',
    title: 'Projects.exe',
    icon: '/icons/nav-projects.png',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    zIndex: 100,
    position: { x: 120, y: 60 },
    size: { width: 680, height: 480 },
  },
  skills: {
    id: 'skills',
    title: 'Skills.exe',
    icon: '/icons/nav-skills.png',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    zIndex: 100,
    position: { x: 140, y: 70 },
    size: { width: 560, height: 440 },
  },
  terminal: {
    id: 'terminal',
    title: 'Terminal.exe',
    icon: '/icons/ui-terminal.png',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    zIndex: 100,
    position: { x: 160, y: 80 },
    size: { width: 600, height: 440 },
  },
  jukebox: {
    id: 'jukebox',
    title: 'Jukebox.exe',
    icon: '/icons/ui-ai-spark.png',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    zIndex: 100,
    position: { x: 180, y: 90 },
    size: { width: 480, height: 380 },
  },
  downloads: {
    id: 'downloads',
    title: 'Downloads.exe',
    icon: '/icons/nav-downloads.png',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    zIndex: 100,
    position: { x: 200, y: 90 },
    size: { width: 520, height: 380 },
  },
  contact: {
    id: 'contact',
    title: 'Contact.exe',
    icon: '/icons/nav-contact.png',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    zIndex: 100,
    position: { x: 280, y: 120 },
    size: { width: 440, height: 320 },
  },
  snake: {
    id: 'snake',
    title: 'SpiderSnake.exe',
    icon: '/icons/file-zip.png',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    zIndex: 100,
    position: { x: 220, y: 100 },
    size: { width: 480, height: 440 },
  },
  controlpanel: {
    id: 'controlpanel',
    title: 'ControlPanel.exe',
    icon: '/icons/nav-skills.png',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    zIndex: 100,
    position: { x: 100, y: 80 },
    size: { width: 520, height: 400 },
  },
  explorer: {
    id: 'explorer',
    title: 'Explorer.exe',
    icon: '/icons/ui-folder-open.png',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    zIndex: 100,
    position: { x: 140, y: 90 },
    size: { width: 620, height: 460 },
  },
  paint: {
    id: 'paint',
    title: 'Paint.exe',
    icon: '/icons/ui-ai-spark.png',
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    zIndex: 100,
    position: { x: 180, y: 110 },
    size: { width: 500, height: 460 },
  },
};

const WindowManagerContext = createContext<WindowManagerContextType | undefined>(undefined);

export const WindowManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [windows, setWindows] = useState<Record<WindowId, WindowState>>(initialWindows);
  const [activeWindowId, setActiveWindowId] = useState<WindowId | null>('about');
  const [maxZIndex, setMaxZIndex] = useState<number>(101);

  const focusWindow = (id: WindowId) => {
    setWindows((prev) => {
      if (!prev[id].isOpen) return prev;
      const nextZ = maxZIndex + 1;
      setMaxZIndex(nextZ);
      return {
        ...prev,
        [id]: {
          ...prev[id],
          isMinimized: false,
          zIndex: nextZ,
        },
      };
    });
    setActiveWindowId(id);
  };

  const openWindow = (id: WindowId) => {
    setWindows((prev) => {
      const nextZ = maxZIndex + 1;
      setMaxZIndex(nextZ);
      return {
        ...prev,
        [id]: {
          ...prev[id],
          isOpen: true,
          isMinimized: false,
          zIndex: nextZ,
        },
      };
    });
    setActiveWindowId(id);
  };

  const closeWindow = (id: WindowId) => {
    setWindows((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        isOpen: false,
      },
    }));
    if (activeWindowId === id) {
      setActiveWindowId(null);
    }
  };

  const minimizeWindow = (id: WindowId) => {
    setWindows((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        isMinimized: !prev[id].isMinimized,
      },
    }));
    if (activeWindowId === id) {
      setActiveWindowId(null);
    }
  };

  const toggleMaximizeWindow = (id: WindowId) => {
    setWindows((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        isMaximized: !prev[id].isMaximized,
      },
    }));
  };

  const updatePosition = (id: WindowId, position: { x: number; y: number }) => {
    setWindows((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        position,
      },
    }));
  };

  return (
    <WindowManagerContext.Provider
      value={{
        windows,
        activeWindowId,
        openWindow,
        closeWindow,
        minimizeWindow,
        focusWindow,
        toggleMaximizeWindow,
        updatePosition,
      }}
    >
      {children}
    </WindowManagerContext.Provider>
  );
};

export const useWindowManager = () => {
  const context = useContext(WindowManagerContext);
  if (!context) {
    throw new Error('useWindowManager must be used within WindowManagerProvider');
  }
  return context;
};
