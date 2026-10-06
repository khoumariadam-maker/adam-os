'use client';

import React from 'react';
import { Window } from '../Window';
import { useLanguage } from '@/context/LanguageContext';

type L10n = { en: string; ar: string };

interface SkillGroup {
  glyph: string;
  title: L10n;
  skills: Array<{ name: string; usedIn: L10n }>;
}

// No self-rated percentages: every skill points at where it was actually used.
const GROUPS: SkillGroup[] = [
  {
    glyph: '⚡',
    title: { en: 'Embedded & Hardware', ar: 'الأنظمة المدمجة والعتاد' },
    skills: [
      { name: 'ESP32', usedIn: { en: 'Smart Irrigation · Race Challenge cars', ar: 'الري الذكي · سيارات تحدي السباق' } },
      { name: 'Embedded C / C++', usedIn: { en: 'Firmware for sensors, motors & Bluetooth control', ar: 'برمجيات المستشعرات والمحركات والتحكم بالبلوتوث' } },
      { name: 'Arduino', usedIn: { en: 'Teaching kids 10–16 at CLS Bouira', ar: 'تدريس الأطفال 10–16 سنة في CLS البويرة' } },
      { name: 'Sensors & motor drivers', usedIn: { en: 'DHT22, soil moisture, line-following, PWM', ar: 'DHT22، رطوبة التربة، تتبع الخط، PWM' } },
      { name: 'Raspberry Pi', usedIn: { en: 'Self-hosted 24/7 home server', ar: 'خادم منزلي يعمل 24/7' } },
    ],
  },
  {
    glyph: '🧩',
    title: { en: 'Software', ar: 'البرمجيات' },
    skills: [
      { name: 'React / Next.js', usedIn: { en: 'School management software · this site', ar: 'برنامج تسيير المدارس · هذا الموقع' } },
      { name: 'TypeScript', usedIn: { en: 'Web apps and dashboards', ar: 'تطبيقات ولوحات ويب' } },
      { name: 'Python', usedIn: { en: 'ML model · automation scripts', ar: 'نموذج التعلم الآلي · سكربتات الأتمتة' } },
      { name: 'Tailwind CSS', usedIn: { en: 'Client web apps · this site', ar: 'تطبيقات العملاء · هذا الموقع' } },
    ],
  },
  {
    glyph: '☁',
    title: { en: 'Cloud & Systems', ar: 'السحابة والأنظمة' },
    skills: [
      { name: 'Firebase', usedIn: { en: 'Real-time sensor data for Smart Irrigation', ar: 'بيانات المستشعرات الآنية للري الذكي' } },
      { name: 'Linux / SSH', usedIn: { en: 'Headless Raspberry Pi server', ar: 'خادم Raspberry Pi بدون شاشة' } },
      { name: 'Docker', usedIn: { en: 'Side projects on the home lab', ar: 'مشاريع جانبية على المختبر المنزلي' } },
      { name: 'Cron', usedIn: { en: 'Scheduled automation jobs', ar: 'مهام أتمتة مجدولة' } },
    ],
  },
  {
    glyph: '🤖',
    title: { en: 'AI', ar: 'الذكاء الاصطناعي' },
    skills: [
      { name: 'Agentic workflows', usedIn: { en: 'Multi-agent dev team', ar: 'فريق تطوير متعدد الوكلاء' } },
      { name: 'LangChain', usedIn: { en: 'Agent orchestration', ar: 'تنسيق الوكلاء' } },
      { name: 'Prompt engineering', usedIn: { en: 'Agent roles · AI-assisted builds', ar: 'أدوار الوكلاء · البناء بمساعدة الذكاء الاصطناعي' } },
    ],
  },
  {
    glyph: '🎓',
    title: { en: 'People', ar: 'العمل مع الناس' },
    skills: [
      { name: 'Teaching', usedIn: { en: 'Robotics instructor · CLS Bouira', ar: 'مدرّب روبوتيك · CLS البويرة' } },
      { name: 'Workshop design', usedIn: { en: '4-day Race Challenge, 30+ participants', ar: 'تحدي السباق 4 أيام، أكثر من 30 مشاركاً' } },
      { name: 'Leadership', usedIn: { en: 'President, Scientific Club Afaq', ar: 'رئيس النادي العلمي آفاق' } },
    ],
  },
];

const LANGUAGES: Array<{ name: L10n; level: L10n }> = [
  { name: { en: 'Arabic', ar: 'العربية' }, level: { en: 'Native', ar: 'اللغة الأم' } },
  { name: { en: 'English', ar: 'الإنجليزية' }, level: { en: 'Fluent', ar: 'بطلاقة' } },
  { name: { en: 'French', ar: 'الفرنسية' }, level: { en: 'Working proficiency', ar: 'مستوى عملي' } },
];

export const SkillsWindow: React.FC = () => {
  const { lang } = useLanguage();

  return (
    <Window id="skills">
      <div className="space-y-4 select-text">
        <p className="text-[13px] text-lavender">
          {lang === 'ar'
            ? 'كل مهارة هنا مرتبطة بمكان استعملتها فيه فعلاً.'
            : 'No made-up percentages — every skill here points to where I actually used it.'}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {GROUPS.map((group) => (
            <section key={group.title.en} className="win9x-box-recessed p-3 space-y-2">
              <h3 className="flex items-center gap-2 font-pixel text-xs text-text border-b border-slate/30 pb-1.5">
                <span aria-hidden="true">{group.glyph}</span>
                {group.title[lang]}
              </h3>
              <ul className="space-y-1.5">
                {group.skills.map((skill) => (
                  <li key={skill.name} className="leading-snug">
                    <span className="font-mono text-[12px] text-green">{skill.name}</span>
                    <span className="block text-[11px] text-textDim/80">{skill.usedIn[lang]}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="win9x-box-recessed p-3 space-y-2">
            <h3 className="flex items-center gap-2 font-pixel text-xs text-text border-b border-slate/30 pb-1.5">
              <span aria-hidden="true">🌐</span>
              {lang === 'ar' ? 'اللغات' : 'Languages'}
            </h3>
            <ul className="space-y-1.5">
              {LANGUAGES.map((l) => (
                <li key={l.name.en} className="flex justify-between text-[12px]">
                  <span className="text-text">{l.name[lang]}</span>
                  <span className="text-lavender">{l.level[lang]}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </Window>
  );
};
