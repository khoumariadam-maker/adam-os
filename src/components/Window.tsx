'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useWindowManager, WindowId } from '@/context/WindowManagerContext';
import { useSound } from '@/context/SoundContext';
import { useMascot } from '@/context/MascotContext';

interface WindowProps {
  id: WindowId;
  children: React.ReactNode;
}

export const Window: React.FC<WindowProps> = ({ id, children }) => {
  const { windows, activeWindowId, closeWindow, minimizeWindow, focusWindow, toggleMaximizeWindow } = useWindowManager();
  const { playWindowClose, playClick } = useSound();
  const mascot = useMascot();
  const shouldReduceMotion = useReducedMotion();
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const winState = windows[id];
  const isActive = activeWindowId === id;
  const isVisible = winState.isOpen && !winState.isMinimized;

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Escape key closes active window
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isActive && winState.isOpen && !winState.isMinimized) {
        playWindowClose();
        closeWindow(id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, winState.isOpen, winState.isMinimized, id]);

  // Focus trap — keeps Tab/Shift+Tab within the active window per WCAG & spec
  const handleFocusTrap = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !containerRef.current) return;
    const focusable = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first || !containerRef.current.contains(document.activeElement)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last || !containerRef.current.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  useEffect(() => {
    if (!isVisible || !isActive || isMobile) return;
    document.addEventListener('keydown', handleFocusTrap);
    return () => document.removeEventListener('keydown', handleFocusTrap);
  }, [isVisible, isActive, isMobile, handleFocusTrap]);

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

  // Animation config — respects prefers-reduced-motion
  const windowOpenAnim = shouldReduceMotion
    ? { scale: 1, opacity: 1 }
    : { scale: 1, opacity: 1 };
  const windowInitAnim = shouldReduceMotion
    ? { scale: 1, opacity: 0 }
    : { scale: 0.92, opacity: 0 };
  const windowExitAnim = shouldReduceMotion
    ? { opacity: 0 }
    : { scale: 0.92, opacity: 0 };

  // Mobile layout
  if (isMobile) {
    return (
      <AnimatePresence>
        {isVisible && (
          <motion.div
            key={`mobile-${id}`}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[300] bg-panel flex flex-col w-full h-full border-2 border-slate"
            onClick={() => focusWindow(id)}
          >
            {/* Mobile Sheet Header */}
            <div className="bg-panel2 px-4 py-3 flex items-center justify-between border-b-2 border-slate min-h-[48px]">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-spidey rounded-sm" />
                <span className="font-pixel text-xs text-text truncate">{winState.title}</span>
              </div>
              <button
                onClick={handleClose}
                className="win9x-button bg-red text-text font-bold w-11 h-11 flex items-center justify-center text-base rounded-none active:scale-95"
                aria-label="Close window"
              >
                ✕
              </button>
            </div>
            {/* Mobile Sheet Content */}
            <div className="flex-1 overflow-y-auto p-4 bg-panel text-textDim font-body">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Desktop Draggable Window — wrapped in AnimatePresence for proper exit animation
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key={`desktop-${id}`}
          ref={containerRef}
          drag
          dragMomentum={false}
          dragConstraints={{ left: 0, top: 0, right: window.innerWidth - winState.size.width - 20, bottom: window.innerHeight - winState.size.height - 60 }}
          initial={windowInitAnim}
          animate={windowOpenAnim}
          exit={windowExitAnim}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }
          }
          onMouseDown={() => focusWindow(id)}
          style={{
            zIndex: isActive ? 200 : winState.zIndex,
            left: winState.position.x,
            top: winState.position.y,
            width: winState.isMaximized ? 'calc(100vw - 16px)' : winState.size.width,
            height: winState.isMaximized ? 'calc(100vh - 56px)' : winState.size.height,
            position: 'absolute',
          }}
          className={`win9x-box-raised flex flex-col ${isActive ? 'window-active-shadow border-spidey' : 'window-inactive-shadow border-slate'}`}
        >
          {/* Windows 9x Title Bar */}
          <div
            className={`px-3 py-1.5 flex items-center justify-between select-none cursor-move ${
              isActive ? 'bg-panel2 text-text border-b border-slate' : 'bg-panel text-textDim border-b border-slate/50'
            }`}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <img
                src={winState.icon}
                alt=""
                className="w-4 h-4 pixel-art"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%23212CF4"/></svg>`;
                }}
              />
              <span className="font-pixel text-xs truncate tracking-wide">{winState.title}</span>
            </div>

            {/* 9x Chrome Controls — all have ARIA labels per spec */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleMinimize}
                className="win9x-button w-5 h-5 flex items-center justify-center font-pixel text-[10px] text-yellow hover:bg-panel"
                aria-label="Minimize window"
                title="Minimize"
              >
                _
              </button>
              <button
                onClick={handleMaximize}
                className="win9x-button w-5 h-5 flex items-center justify-center font-pixel text-[10px] text-lavender hover:bg-panel"
                aria-label="Maximize window"
                title="Maximize"
              >
                □
              </button>
              <button
                onClick={handleClose}
                className="win9x-button w-5 h-5 flex items-center justify-center font-pixel text-[10px] text-text bg-red/80 hover:bg-red"
                aria-label="Close window"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Window Body Container */}
          <div className="flex-1 overflow-y-auto p-4 bg-panel text-textDim font-body">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
