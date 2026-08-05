'use client';

import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface TrailDot {
  id: number;
  x: number;
  y: number;
}

export const CustomCursor: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [trail, setTrail] = useState<TrailDot[]>([]);
  const [isPointer, setIsPointer] = useState<boolean>(false);
  const [isTouch, setIsTouch] = useState<boolean>(false);

  useEffect(() => {
    // Detect touch device
    if (typeof window !== 'undefined' && 'ontouchstart' in window) {
      setIsTouch(true);
      return;
    }

    let dotId = 0;

    const handleMouseMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });

      // Check if hovering over clickable element
      const target = e.target as HTMLElement | null;
      if (target) {
        const clickable = target.closest('button, a, input, select, textarea, [role="button"], .cursor-pointer');
        setIsPointer(!!clickable);
      }

      // Add dot to trail (capped at 3 per Art Bible spec)
      if (!shouldReduceMotion) {
        dotId++;
        const newDot: TrailDot = { id: dotId, x: e.clientX, y: e.clientY };
        setTrail((prev) => [...prev.slice(-2), newDot]);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [shouldReduceMotion]);

  if (isTouch || shouldReduceMotion) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[99999]">
      {/* 3 Trailing Cobalt Dots (300ms ease-out decay per Art Bible spec) */}
      {trail.map((dot, index) => (
        <motion.div
          key={dot.id}
          initial={{ opacity: 0.8, scale: 1 }}
          animate={{ opacity: 0, scale: 0.2 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{ left: dot.x - 3, top: dot.y - 3 }}
          className="fixed w-1.5 h-1.5 bg-[#212CF4] rounded-full shadow-[0_0_4px_#212CF4]"
        />
      ))}

      {/* Main Pixel Cursor Pointer */}
      <div
        style={{ left: pos.x, top: pos.y }}
        className="fixed -translate-x-1 -translate-y-1 transition-transform duration-75"
      >
        {isPointer ? (
          /* Clicking Hand Pointer Icon */
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="pixel-art drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            <path d="M7 2V12H9V14H11V16H15V14H17V12H19V8H17V6H15V4H13V2H7Z" fill="#212CF4" stroke="#0B0B10" strokeWidth="1.5" />
            <path d="M9 4V10H11V12H15V10H17V8H15V6H13V4H9Z" fill="#FFFFFF" />
          </svg>
        ) : (
          /* Arrow Pointer Icon */
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="pixel-art drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            <path d="M1 1L1 17L5 13L8 19L11 18L8 12L14 12L1 1Z" fill="#212CF4" stroke="#0B0B10" strokeWidth="1.5" />
            <path d="M3 4L3 13L6 10L8 14L9 13.5L7 9.5L11 9.5L3 4Z" fill="#FFFFFF" />
          </svg>
        )}
      </div>
    </div>
  );
};
