'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { APPS, WindowId } from '@/lib/apps';
import { readJSON, writeStorage } from '@/lib/storage';
import { MOBILE_BREAKPOINT } from '@/lib/hooks/useIsMobile';

export type { WindowId } from '@/lib/apps';

export const TASKBAR_HEIGHT = 40;
// Leaves room for the desktop icon columns on the left.
const DESKTOP_ICON_GUTTER = 230;
const LAYOUT_STORAGE_KEY = 'adam_os_window_layout_v2';

type Point = { x: number; y: number };
type Size = { width: number; height: number };

export interface WindowState {
  id: WindowId;
  title: string;
  icon: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  position: Point;
  size: Size;
  hasLayout: boolean;
}

interface State {
  windows: Record<WindowId, WindowState>;
  // Stacking order, bottom -> top. Only open windows are listed.
  order: WindowId[];
}

type Action =
  | { type: 'open'; id: WindowId }
  | { type: 'close'; id: WindowId }
  | { type: 'minimize'; id: WindowId }
  | { type: 'focus'; id: WindowId }
  | { type: 'toggleMaximize'; id: WindowId }
  | { type: 'setPosition'; id: WindowId; position: Point }
  | { type: 'setRect'; id: WindowId; position: Point; size: Size }
  | { type: 'minimizeAll' }
  | { type: 'closeAll' }
  | { type: 'clampAll' };

interface WindowManagerContextType {
  windows: Record<WindowId, WindowState>;
  activeWindowId: WindowId | null;
  openWindow: (id: WindowId) => void;
  closeWindow: (id: WindowId) => void;
  minimizeWindow: (id: WindowId) => void;
  focusWindow: (id: WindowId) => void;
  toggleMaximizeWindow: (id: WindowId) => void;
  updatePosition: (id: WindowId, position: Point) => void;
  updateRect: (id: WindowId, position: Point, size: Size) => void;
  updateSize: (id: WindowId, size: Size) => void;
  minimizeAll: () => void;
  closeAll: () => void;
}

const viewport = () => ({
  w: typeof window === 'undefined' ? 1280 : window.innerWidth,
  h: typeof window === 'undefined' ? 800 : window.innerHeight - TASKBAR_HEIGHT,
});

const fitSize = (size: Size): Size => {
  const { w, h } = viewport();
  return {
    width: Math.max(280, Math.min(size.width, w - 24)),
    height: Math.max(200, Math.min(size.height, h - 24)),
  };
};

// Keeps at least the title bar reachable so a window can never be lost off-screen.
export const clampPosition = (pos: Point, size: Size): Point => {
  const { w, h } = viewport();
  return {
    x: Math.round(Math.min(Math.max(pos.x, 80 - size.width), w - 80)),
    y: Math.round(Math.min(Math.max(pos.y, 0), h - 32)),
  };
};

const cascadePosition = (size: Size, openCount: number): Point => {
  const { w, h } = viewport();
  const left = Math.min(DESKTOP_ICON_GUTTER, Math.max(12, w - size.width - 12));
  const freeW = w - left;
  const x = left + Math.max(0, (freeW - size.width) / 2) + openCount * 28;
  const y = Math.max(16, (h - size.height) / 2 - 20) + openCount * 28;
  return clampPosition({ x, y }, size);
};

const topVisible = (state: State, exclude?: WindowId): WindowId | null => {
  for (let i = state.order.length - 1; i >= 0; i--) {
    const id = state.order[i];
    if (id !== exclude && !state.windows[id].isMinimized) return id;
  }
  return null;
};

const withZ = (state: State): State => {
  const windows = { ...state.windows };
  state.order.forEach((id, idx) => {
    if (windows[id].zIndex !== 100 + idx) windows[id] = { ...windows[id], zIndex: 100 + idx };
  });
  return { ...state, windows };
};

const patch = (state: State, id: WindowId, changes: Partial<WindowState>): State => ({
  ...state,
  windows: { ...state.windows, [id]: { ...state.windows[id], ...changes } },
});

const raise = (order: WindowId[], id: WindowId) => [...order.filter((w) => w !== id), id];

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'open': {
      const win = state.windows[action.id];
      if (win.isOpen) {
        return withZ({ ...patch(state, action.id, { isMinimized: false }), order: raise(state.order, action.id) });
      }
      const size = fitSize(win.size);
      const visibleCount = state.order.filter((id) => !state.windows[id].isMinimized).length;
      const position = win.hasLayout ? clampPosition(win.position, size) : cascadePosition(size, visibleCount);
      return withZ({
        ...patch(state, action.id, { isOpen: true, isMinimized: false, size, position, hasLayout: true }),
        order: raise(state.order, action.id),
      });
    }
    case 'close':
      return withZ({
        ...patch(state, action.id, { isOpen: false, isMinimized: false, isMaximized: false }),
        order: state.order.filter((id) => id !== action.id),
      });
    case 'minimize': {
      if (!state.windows[action.id].isOpen) return state;
      // Minimized windows sink to the bottom so the next visible one becomes active.
      return withZ({
        ...patch(state, action.id, { isMinimized: true }),
        order: [action.id, ...state.order.filter((id) => id !== action.id)],
      });
    }
    case 'focus': {
      if (!state.windows[action.id].isOpen) return state;
      if (state.order[state.order.length - 1] === action.id && !state.windows[action.id].isMinimized) return state;
      return withZ({ ...patch(state, action.id, { isMinimized: false }), order: raise(state.order, action.id) });
    }
    case 'toggleMaximize':
      return withZ({
        ...patch(state, action.id, { isMaximized: !state.windows[action.id].isMaximized, isMinimized: false }),
        order: raise(state.order, action.id),
      });
    case 'setPosition':
      return patch(state, action.id, { position: action.position, isMaximized: false });
    case 'setRect':
      return patch(state, action.id, { position: action.position, size: action.size, isMaximized: false });
    case 'minimizeAll': {
      const windows = { ...state.windows };
      state.order.forEach((id) => {
        windows[id] = { ...windows[id], isMinimized: true };
      });
      return { ...state, windows };
    }
    case 'closeAll': {
      const windows = { ...state.windows };
      state.order.forEach((id) => {
        windows[id] = { ...windows[id], isOpen: false, isMinimized: false, isMaximized: false };
      });
      return { windows, order: [] };
    }
    case 'clampAll': {
      let next = state;
      state.order.forEach((id) => {
        const win = next.windows[id];
        const size = fitSize(win.size);
        next = patch(next, id, { size, position: clampPosition(win.position, size) });
      });
      return next;
    }
    default:
      return state;
  }
};

type SavedLayout = Partial<Record<WindowId, { position: Point; size: Size }>>;

const createInitialState = (): State => {
  const saved = readJSON<SavedLayout>(LAYOUT_STORAGE_KEY, {});
  const windows = {} as Record<WindowId, WindowState>;
  APPS.forEach((app) => {
    const layout = saved[app.id];
    windows[app.id] = {
      id: app.id,
      title: app.title,
      icon: app.icon,
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 100,
      position: layout?.position ?? { x: 0, y: 0 },
      size: layout?.size ?? app.size,
      hasLayout: Boolean(layout),
    };
  });
  let state: State = { windows, order: [] };
  // Desktop visitors land on About.exe; phones land on the app launcher.
  if (typeof window !== 'undefined' && window.innerWidth >= MOBILE_BREAKPOINT) {
    state = reducer(state, { type: 'open', id: 'about' });
  }
  return state;
};

const WindowManagerContext = createContext<WindowManagerContextType | undefined>(undefined);

export const WindowManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  // Persist window positions/sizes so the desktop looks the same on the next visit.
  useEffect(() => {
    const timeout = setTimeout(() => {
      const layout: SavedLayout = {};
      APPS.forEach(({ id }) => {
        const win = state.windows[id];
        if (win.hasLayout) layout[id] = { position: win.position, size: win.size };
      });
      writeStorage(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    }, 400);
    return () => clearTimeout(timeout);
  }, [state.windows]);

  useEffect(() => {
    const onResize = () => dispatch({ type: 'clampAll' });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const openWindow = useCallback((id: WindowId) => dispatch({ type: 'open', id }), []);
  const closeWindow = useCallback((id: WindowId) => dispatch({ type: 'close', id }), []);
  const minimizeWindow = useCallback((id: WindowId) => dispatch({ type: 'minimize', id }), []);
  const focusWindow = useCallback((id: WindowId) => dispatch({ type: 'focus', id }), []);
  const toggleMaximizeWindow = useCallback((id: WindowId) => dispatch({ type: 'toggleMaximize', id }), []);
  const updatePosition = useCallback((id: WindowId, position: Point) => dispatch({ type: 'setPosition', id, position }), []);
  const updateRect = useCallback(
    (id: WindowId, position: Point, size: Size) => dispatch({ type: 'setRect', id, position, size }),
    []
  );
  const minimizeAll = useCallback(() => dispatch({ type: 'minimizeAll' }), []);
  const closeAll = useCallback(() => dispatch({ type: 'closeAll' }), []);

  const value = useMemo<WindowManagerContextType>(
    () => ({
      windows: state.windows,
      activeWindowId: topVisible(state),
      openWindow,
      closeWindow,
      minimizeWindow,
      focusWindow,
      toggleMaximizeWindow,
      updatePosition,
      updateRect,
      updateSize: (id, size) => updateRect(id, state.windows[id].position, size),
      minimizeAll,
      closeAll,
    }),
    [state, openWindow, closeWindow, minimizeWindow, focusWindow, toggleMaximizeWindow, updatePosition, updateRect, minimizeAll, closeAll]
  );

  return <WindowManagerContext.Provider value={value}>{children}</WindowManagerContext.Provider>;
};

export const useWindowManager = () => {
  const context = useContext(WindowManagerContext);
  if (!context) {
    throw new Error('useWindowManager must be used within WindowManagerProvider');
  }
  return context;
};
