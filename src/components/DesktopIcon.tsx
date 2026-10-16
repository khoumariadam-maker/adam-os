'use client';

import React from 'react';
import { WindowId } from '@/lib/apps';
import { asset } from '@/lib/asset';

interface DesktopIconProps {
  id: WindowId;
  label: string;
  iconSrc: string;
  isSelected: boolean;
  onSelect: (id: WindowId, additive: boolean) => void;
  onOpen: (id: WindowId) => void;
}

export const DesktopIcon: React.FC<DesktopIconProps> = ({ id, label, iconSrc, isSelected, onSelect, onOpen }) => {
  return (
    <button
      type="button"
      data-icon-id={id}
      aria-label={`Open ${label}`}
      title={label}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        // Touch: one tap opens (like a phone). Mouse: click selects, double-click opens.
        if ((e.nativeEvent as PointerEvent).pointerType === 'touch') onOpen(id);
        else onSelect(id, e.ctrlKey || e.metaKey);
      }}
      onDoubleClick={() => onOpen(id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onOpen(id);
        }
      }}
      className="group flex flex-col items-center justify-start gap-1 p-1.5 w-[88px] md:w-[96px] h-[88px] md:h-[92px] outline-none focus-visible:outline-dotted focus-visible:outline-1 focus-visible:outline-lavender"
    >
      <span className="relative w-12 h-12 md:w-11 md:h-11 flex items-center justify-center">
        <img
          src={asset(iconSrc)}
          alt=""
          draggable={false}
          className="w-full h-full object-contain pixel-art drop-shadow-[2px_2px_0_rgba(0,0,0,0.7)] transition-transform group-hover:-translate-y-0.5"
        />
        {/* Win98 selection: a dithered accent tint clipped to the icon's own shape */}
        {isSelected && (
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-spidey/60 pointer-events-none"
            style={{
              maskImage: `url(${asset(iconSrc)})`,
              WebkitMaskImage: `url(${asset(iconSrc)})`,
              maskSize: 'contain',
              WebkitMaskSize: 'contain',
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskPosition: 'center',
            }}
          />
        )}
      </span>
      <span
        className={`icon-label font-pixel leading-tight text-center px-1 line-clamp-2 ${
          label.length > 9 ? 'text-[10px] tracking-tight' : 'text-[11px]'
        } ${
          isSelected ? 'bg-spidey text-onAccent outline-dotted outline-1 outline-lavender' : 'text-white'
        }`}
      >
        {label}
      </span>
    </button>
  );
};
