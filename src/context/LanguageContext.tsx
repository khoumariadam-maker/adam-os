'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import en from '@/lib/i18n/en.json';
import ar from '@/lib/i18n/ar.json';

type Language = 'en' | 'ar';
type Dictionary = typeof en;

interface LanguageContextType {
  lang: Language;
  dir: 'ltr' | 'rtl';
  t: Dictionary;
  toggleLanguage: () => void;
}

const dictionaries: Record<Language, Dictionary> = {
  en,
  ar: ar as unknown as Dictionary,
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>('en');

  useEffect(() => {
    const saved = localStorage.getItem('adam_os_lang') as Language | null;
    if (saved === 'en' || saved === 'ar') {
      setLang(saved);
    } else {
      const browserLang = navigator.language.startsWith('ar') ? 'ar' : 'en';
      setLang(browserLang);
    }
  }, []);

  const toggleLanguage = () => {
    const nextLang = lang === 'en' ? 'ar' : 'en';
    setLang(nextLang);
    localStorage.setItem('adam_os_lang', nextLang);
  };

  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const t = dictionaries[lang];

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [dir, lang]);

  return (
    <LanguageContext.Provider value={{ lang, dir, t, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
