'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useWindowManager, WindowId, TASKBAR_HEIGHT, clampPosition } from '@/context/WindowManagerContext';
import { useSound } from '@/context/SoundContext';
import { useMascot } from '@/context/MascotContext';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { asset } from '@/lib/asset';

interface WindowProps {
  id: WindowId;
  children: React.ReactNode;
  // Removes the default body padding (for apps that draw edge-to-edge).
  flush?: boolean;
}

type Snap = 'left' | 'right' | 'max' | null;
const SNAP_EDGE = 6;
const MIN_W = 300;
const MIN_H = 220;

export const Window: React.FC<WindowProps> = ({ id, children, flush = false }) => {
  const {
    windows,
    activeWindowId,
    closeWindow,
    minimizeWindow,
    focusWindow,
    toggleMaximizeWindow,
    updatePosition,
    updateRect,
  } = useWindowManager();
  const { playWindowClose, playClick } = useSound();
  const mascot = useMascot();
  const shouldReduceMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const [snapPreview, setSnapPreview] = useState<Snap>(null);
  const [isDragging, setIsDragging] = useState(false);

  const winState = windows[id];
  const isActive = activeWindowId === id;
  const isVisible = winState.isOpen && !winState.isMinimized;
  const titleId = `window-title-${id}`;

  // Escape closes the focused window (but not while typing in a field that uses Escape itself).
  useEffect(() => {
    if (!isActive || !isVisible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('[data-overlay-open="true"]')) return;
      playWindowClose();
      closeWindow(id);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, isVisible, id, closeWindow, playWindowClose]);

  // Move keyboard focus into a window when it opens so keyboard users land in it.
  useEffect(() => {
    if (isVisible && isActive && containerRef.current && !containerRef.current.contains(document.activeElement)) {
      containerRef.current.focus({ preventScroll: true });
    }
    // Only when the window becomes visible/active.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, isActive]);

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    playWindowClose();
    mascot.notifyWindowEvent('close', winState.title);
    closeWindow(id);
  };

  const handleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    playClick();
    minimizeWindow(id);
  };

  const handleMaximize = (e: React.MouseEvent) => {
    e.stopPropagation();
    playClick();
    toggleMaximizeWindow(id);
  };

  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    focusWindow(id);
    const startX = e.clientX;
    const startY = e.clientY;
    const wasMaximized = winState.isMaximized;
    const size = winState.size;
    // Dragging a maximized window restores it under the cursor, like real Windows.
    const origin = wasMaximized
      ? { x: e.clientX - size.width / 2, y: 0 }
      : { ...winState.position };
    let moved = false;
    let snap: Snap = null;

    const onMove = (mv: PointerEvent) => {
      const dx = mv.clientX - startX;
      const dy = mv.clientY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      moved = true;
      setIsDragging(true);
      updatePosition(id, clampPosition({ x: origin.x + dx, y: origin.y + dy }, size));
      snap = mv.clientY <= SNAP_EDGE ? 'max' : mv.clientX <= SNAP_EDGE ? 'left' : mv.clientX >= window.innerWidth - SNAP_EDGE ? 'right' : null;
      setSnapPreview(snap);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setIsDragging(false);
      setSnapPreview(null);
      if (!moved) return;
      const h = window.innerHeight - TASKBAR_HEIGHT;
      const half = Math.round(window.innerWidth / 2);
      if (snap === 'max') toggleMaximizeWindow(id);
      else if (snap === 'left') updateRect(id, { x: 0, y: 0 }, { width: half, height: h });
      else if (snap === 'right') updateRect(id, { x: half, y: 0 }, { width: window.innerWidth - half, height: h });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const { width: startW, height: startH } = winState.size;
    const pos = winState.position;
    const onMove = (mv: PointerEvent) => {
      const maxW = window.innerWidth - pos.x - 4;
      const maxH = window.innerHeight - TASKBAR_HEIGHT - pos.y - 4;
      updateRect(id, pos, {
        width: Math.max(MIN_W, Math.min(maxW, startW + mv.clientX - startX)),
        height: Math.max(MIN_H, Math.min(maxH, startH + mv.clientY - startY)),
      });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const iconImg = (
    <img
      src={asset(winState.icon)}
      alt=""
      className="w-4 h-4 pixel-art shrink-0"
      draggable={false}
    />
  );

  // Phone layout: full-height sheet above the bottom tab bar.
  if (isMobile) {
    return (
      <AnimatePresence>
        {isVisible && (
          <motion.section
            key={`mobile-${id}`}
            ref={containerRef}
            tabIndex={-1}
            role="dialog"
            aria-labelledby={titleId}
            initial={shouldReduceMotion ? { opacity: 0 } : { y: '100%' }}
            animate={shouldReduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { y: '100%' }}
            transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', damping: 30, stiffness: 280 }}
            style={{ zIndex: winState.zIndex + 100 }}
            className="fixed inset-x-0 top-0 bottom-14 bg-panel flex flex-col outline-none"
            onPointerDown={() => focusWindow(id)}
          >
            <header className="title-bar-active px-3 py-2 flex items-center justify-between border-b-2 border-slate min-h-[52px] gap-2">
              <button
                onClick={handleMinimize}
                className="win9x-button h-10 px-3 flex items-center gap-1 font-pixel text-[11px]"
                aria-label="Back to home screen"
              >
                ‹ <span>Home</span>
              </button>
              <div className="flex items-center gap-2 min-w-0">
                {iconImg}
                <h2 id={titleId} className="font-pixel text-xs text-text truncate">{winState.title}</h2>
              </div>
              <button
                onClick={handleClose}
                className="win9x-button bg-red text-text w-10 h-10 flex items-center justify-center text-base"
                aria-label="Close window"
              >
                ✕
              </button>
            </header>
            <div className={`flex-1 overflow-y-auto overscroll-contain bg-panel text-textDim font-body ${flush ? '' : 'p-4'}`}>
              {children}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    );
  }

  const maximized = winState.isMaximized;
  const frameStyle: React.CSSProperties = maximized
    ? { left: 0, top: 0, width: '100vw', height: `calc(100vh - ${TASKBAR_HEIGHT}px)` }
    : {
        left: winState.position.x,
        top: winState.position.y,
        width: winState.size.width,
        height: winState.size.height,
      };

  return (
    <>
      {/* Aero-snap style preview while dragging to a screen edge */}
      {snapPreview && (
        <div
          className="fixed pointer-events-none border-2 border-dashed border-lavender bg-spidey/15 z-[480]"
          style={{
            top: 0,
            left: snapPreview === 'right' ? '50vw' : 0,
            width: snapPreview === 'max' ? '100vw' : '50vw',
            height: `calc(100vh - ${TASKBAR_HEIGHT}px)`,
          }}
        />
      )}
      <AnimatePresence>
        {isVisible && (
          <motion.section
            key={`desktop-${id}`}
            ref={containerRef}
            tabIndex={-1}
            role="dialog"
            aria-labelledby={titleId}
            initial={shouldReduceMotion ? { opacity: 0 } : { scale: 0.94, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { scale: 0.94, opacity: 0, y: 8 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
            onPointerDownCapture={() => focusWindow(id)}
            style={{ ...frameStyle, zIndex: winState.zIndex, position: 'absolute' }}
            className={`win9x-box-raised flex flex-col outline-none ${
              isActive ? 'window-active-shadow' : 'window-inactive-shadow'
            } ${isDragging ? 'select-none' : ''}`}
          >
            {/* Title bar: drag to move, double-click to maximize */}
            <header
              onPointerDown={startDrag}
              onDoubleClick={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                toggleMaximizeWindow(id);
              }}
              className={`px-2 py-1 flex items-center justify-between select-none touch-none ${
                maximized ? '' : 'cursor-grab active:cursor-grabbing'
              } ${isActive ? 'title-bar-active text-text' : 'title-bar-inactive text-lavender'}`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                {iconImg}
                <h2 id={titleId} className="font-pixel text-xs truncate tracking-wide">
                  {winState.title}
                </h2>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={handleMinimize}
                  className="win9x-button w-6 h-5 flex items-center justify-center font-pixel text-[10px] text-text"
                  aria-label="Minimize window"
                  title="Minimize"
                >
                  _
                </button>
                <button
                  onClick={handleMaximize}
                  className="win9x-button w-6 h-5 flex items-center justify-center font-pixel text-[10px] text-text"
                  aria-label={maximized ? 'Restore window' : 'Maximize window'}
                  title={maximized ? 'Restore' : 'Maximize'}
                >
                  {maximized ? '❐' : '□'}
                </button>
                <button
                  onClick={handleClose}
                  className="win9x-button w-6 h-5 flex items-center justify-center font-pixel text-[10px] text-text hover:!bg-red"
                  aria-label="Close window"
                  title="Close (Esc)"
                >
                  ✕
                </button>
              </div>
            </header>

            <div className={`flex-1 overflow-auto bg-panel text-textDim font-body ${flush ? '' : 'p-4'}`}>
              {children}
            </div>

            {/* Status bar with resize grip */}
            {!maximized && (
              <div
                onPointerDown={startResize}
                className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize select-none touch-none resize-grip"
                aria-hidden="true"
              />
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
};
