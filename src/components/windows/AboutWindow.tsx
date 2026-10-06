'use client';

import React, { useState } from 'react';
import { PixelIcon } from '@/components/PixelIcon';
import { Window } from '../Window';
import { useLanguage } from '@/context/LanguageContext';
import { useSound } from '@/context/SoundContext';
import { useWindowManager } from '@/context/WindowManagerContext';
import { PROFILE } from '@/lib/profile';
import { asset } from '@/lib/asset';
import { WindowId } from '@/lib/apps';

type Tab = 'story' | 'experience';
type L10n = { en: string; ar: string };

const TIMELINE: Array<{ period: string; title: L10n; org: L10n; text: L10n }> = [
  {
    period: '2024 — 2027',
    title: { en: "Master's in Embedded Systems", ar: 'ماستر في الأنظمة المدمجة' },
    org: { en: 'Bouira University', ar: 'جامعة البويرة' },
    text: {
      en: 'Master 1 now, Master 2 in 2026/27. Embedded systems, IoT, hardware–software integration, AI on edge devices.',
      ar: 'ماستر 1 حالياً، وماستر 2 في 2026/27. أنظمة مدمجة، إنترنت الأشياء، تكامل العتاد والبرمجيات، والذكاء الاصطناعي على الأجهزة الطرفية.',
    },
  },
  {
    period: '2025 — 2026',
    title: { en: 'President', ar: 'رئيس' },
    org: { en: 'Scientific Club Afaq — Bouira University', ar: 'النادي العلمي آفاق — جامعة البويرة' },
    text: {
      en: 'Ran the Race Event Challenge: 4 days taking 30+ participants from zero electronics to ESP32 robot cars and a robot-soccer final.',
      ar: 'نظّمت تحدي السباق: 4 أيام نقلت فيها أكثر من 30 مشاركاً من الصفر إلى سيارات ESP32 روبوتية ونهائي كرة قدم روبوتية.',
    },
  },
  {
    period: '2024 — 2025',
    title: { en: 'Arduino & Robotics Instructor', ar: 'مدرّب آردوينو وروبوتيك' },
    org: { en: 'CLS Bouira', ar: 'CLS البويرة' },
    text: {
      en: 'Taught kids aged 10–16, with a curriculum I wrote from “what is an LED” to autonomous line-following cars.',
      ar: 'درّست أطفالاً بين 10 و16 سنة بمنهج كتبته بنفسي، من «ما هو الـLED» إلى سيارات تتبع الخط الذاتية.',
    },
  },
  {
    period: '2024 — now',
    title: { en: 'Agentic AI & full-stack builder', ar: 'مطوّر وكلاء ذكاء اصطناعي وتطبيقات كاملة' },
    org: { en: 'Independent', ar: 'مستقل' },
    text: {
      en: 'Multi-agent dev workflow on a self-hosted Raspberry Pi; school management software shipped in 2 months.',
      ar: 'سير عمل تطوير متعدد الوكلاء على Raspberry Pi ذاتي الاستضافة؛ وبرنامج تسيير مدارس أُنجز في شهرين.',
    },
  },
];

const FACTS: Array<{ k: L10n; v: L10n }> = [
  { k: { en: 'Based in', ar: 'المقر' }, v: { en: 'Bouira, Algeria', ar: 'البويرة، الجزائر' } },
  { k: { en: 'Studying', ar: 'الدراسة' }, v: { en: 'M1 Embedded Systems', ar: 'ماستر 1 أنظمة مدمجة' } },
  { k: { en: 'Graduating', ar: 'التخرج' }, v: { en: '2027', ar: '2027' } },
  { k: { en: 'Languages', ar: 'اللغات' }, v: { en: 'Arabic · English · French', ar: 'العربية · الإنجليزية · الفرنسية' } },
];

export const AboutWindow: React.FC = () => {
  const { t, lang } = useLanguage();
  const { playClick } = useSound();
  const { openWindow } = useWindowManager();
  const [activeTab, setActiveTab] = useState<Tab>('story');

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'story', label: lang === 'ar' ? 'من أنا' : 'Story' },
    { id: 'experience', label: lang === 'ar' ? 'المسار' : 'Experience' },
  ];

  const go = (id: WindowId) => {
    playClick();
    openWindow(id);
  };

  return (
    <Window id="about">
      <div className="flex flex-col gap-4">
        {/* Header card */}
        <div className="flex items-center gap-4">
          <div className="win9x-box-recessed p-1.5 shrink-0">
            <img src={asset('/mascot/idle-01.png')} alt="Pixel Spider, Adam's avatar" className="w-20 h-20 md:w-24 md:h-24 object-contain pixel-art" />
          </div>
          <div className="min-w-0 space-y-1">
            <h1 className="font-pixel text-base md:text-lg text-text">{t.about.name}</h1>
            <p className="text-[13px] text-lavender">{t.about.role}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button onClick={() => go('projects')} className="win9x-button win9x-button-spidey px-2.5 py-1 font-pixel text-[10px]">
                <PixelIcon name="projects" /> {lang === 'ar' ? 'المشاريع' : 'Projects'}
              </button>
              <button onClick={() => go('downloads')} className="win9x-button px-2.5 py-1 font-pixel text-[10px]">
                <PixelIcon name="resume" /> {lang === 'ar' ? 'السيرة' : 'Résumé'}
              </button>
              <button onClick={() => go('contact')} className="win9x-button px-2.5 py-1 font-pixel text-[10px]">
                <PixelIcon name="contact" /> {lang === 'ar' ? 'تواصل' : 'Contact'}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div role="tablist" className="flex items-end gap-1 border-b-2 border-slate font-pixel text-[11px]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => {
                playClick();
                setActiveTab(tab.id);
              }}
              className={`px-3 border-t-2 border-x-2 border-slate -mb-[2px] ${
                activeTab === tab.id ? 'bg-panel text-text py-1.5 border-b-2 border-b-panel' : 'bg-panel2 text-lavender py-1 hover:text-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'story' && (
          <div role="tabpanel" className="grid md:grid-cols-[1fr_190px] gap-4 select-text">
            <div className="space-y-3 text-[13px] leading-relaxed">
              <p>{t.about.p1}</p>
              <p>{t.about.p2}</p>
              <p>{t.about.p3}</p>
            </div>
            <dl className="win9x-box-recessed p-3 space-y-2 text-[12px] self-start">
              {FACTS.map((f) => (
                <div key={f.k.en}>
                  <dt className="font-pixel text-[9px] uppercase tracking-wider text-lavender/70">{f.k[lang]}</dt>
                  <dd className="text-text">{f.v[lang]}</dd>
                </div>
              ))}
              <div>
                <dt className="font-pixel text-[9px] uppercase tracking-wider text-lavender/70">Email</dt>
                <dd>
                  <a href={`mailto:${PROFILE.email}`} className="text-green underline underline-offset-2 break-all">
                    {PROFILE.email}
                  </a>
                </dd>
              </div>
            </dl>
          </div>
        )}

        {activeTab === 'experience' && (
          <ol role="tabpanel" className="relative border-s-2 border-spidey/60 ms-2 space-y-4 select-text">
            {TIMELINE.map((item) => (
              <li key={item.period + item.title.en} className="ps-4 relative">
                <span className="absolute -start-[7px] top-1 w-3 h-3 bg-spidey border-2 border-lavender" aria-hidden="true" />
                <p className="font-mono text-[11px] text-yellow">{item.period}</p>
                <h3 className="font-pixel text-xs text-text mt-0.5">{item.title[lang]}</h3>
                <p className="text-[12px] text-lavender">{item.org[lang]}</p>
                <p className="text-[13px] leading-relaxed mt-1">{item.text[lang]}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Window>
  );
};
