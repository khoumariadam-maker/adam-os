'use client';

import React from 'react';
import { PixelIcon } from '@/components/PixelIcon';
import { useWindowManager } from '@/context/WindowManagerContext';
import { useLanguage } from '@/context/LanguageContext';
import { useSound } from '@/context/SoundContext';
import { PROFILE } from '@/lib/profile';
import { asset } from '@/lib/asset';

// Always-visible "fast path" for recruiters: who Adam is + CV + contact, one click away.
export const HireCard: React.FC<{ variant: 'desktop' | 'mobile' }> = ({ variant }) => {
  const { openWindow } = useWindowManager();
  const { t, lang } = useLanguage();
  const { playClick } = useSound();
  const ar = lang === 'ar';

  const openCv = () => {
    playClick();
    openWindow('downloads');
  };

  const actions = (
    <div className={`grid gap-1.5 ${variant === 'mobile' ? 'grid-cols-3' : 'grid-cols-1'}`}>
      <button onClick={openCv} className="win9x-button win9x-button-spidey px-2 py-1.5 font-pixel text-[10px] flex items-center justify-center gap-1.5">
        <PixelIcon name="resume" /> {t.hire.cv}
      </button>
      <a
        href={asset('/resume/')}
        className="win9x-button px-2 py-1.5 font-pixel text-[10px] flex items-center justify-center gap-1.5 text-text"
      >
        <PixelIcon name="web" /> {t.hire.web}
      </a>
      <a
        href={`mailto:${PROFILE.email}`}
        className="win9x-button px-2 py-1.5 font-pixel text-[10px] flex items-center justify-center gap-1.5 text-text"
      >
        <PixelIcon name="mail" /> {t.hire.email}
      </a>
    </div>
  );

  if (variant === 'mobile') {
    return (
      <section className="m-3 mb-2 win9x-box-raised p-3 space-y-3" aria-label="About Khoumari Adam">
        <div className="flex items-center gap-3">
          <img src={asset('/mascot/idle-01.png')} alt="" className="w-14 h-14 pixel-art bg-panel2 border border-slate" />
          <div className="min-w-0">
            <h1 className="font-pixel text-sm text-text">{ar ? PROFILE.nameAr : PROFILE.name}</h1>
            <p className="text-[12px] text-lavender leading-snug">{ar ? PROFILE.roleAr : PROFILE.role}</p>
            <p className="text-[11px] text-textDim/80">{t.hire.status}</p>
          </div>
        </div>
        {actions}
      </section>
    );
  }

  return (
    <aside
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      className="w-60 win9x-box-raised"
      aria-label="Hiring shortcut"
    >
      <div className="title-bar-active px-2 py-1 font-pixel text-[11px] flex items-center gap-1.5">
        <span className="w-2 h-2 bg-green rounded-full animate-pulse" /> {t.hire.title}
      </div>
      <div className="p-3 space-y-2.5">
        <div>
          <p className="font-pixel text-xs text-text">{ar ? PROFILE.nameAr : PROFILE.name}</p>
          <p className="text-[12px] text-lavender leading-snug mt-0.5">{ar ? PROFILE.roleAr : PROFILE.role}</p>
          <p className="text-[11px] text-textDim/80 mt-1">{t.hire.status}</p>
        </div>
        {actions}
      </div>
    </aside>
  );
};
