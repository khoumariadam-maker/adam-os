'use client';

import React from 'react';
import { Window } from '../Window';
import { useLanguage } from '@/context/LanguageContext';
import { useSound } from '@/context/SoundContext';

export const ContactWindow: React.FC = () => {
  const { t } = useLanguage();
  const { playClick } = useSound();

  const handleEmail = () => {
    playClick();
    window.open('mailto:khoumariadam@gmail.com', '_self');
  };

  const handlePhone = () => {
    playClick();
    window.open('tel:077628207', '_self');
  };

  return (
    <Window id="contact">
      <div className="flex flex-col items-center justify-center py-6 px-4 gap-6 font-body text-center">
        <div className="space-y-1">
          <h2 className="font-pixel text-sm text-text">Direct Line to Adam</h2>
          <p className="text-xs text-textDim">
            No forms. No social trackers. Reach out directly via email or phone.
          </p>
        </div>

        {/* Two Large Windows-9x Beveled Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <button
            onClick={handleEmail}
            className="win9x-button win9x-button-spidey flex-1 py-3 px-4 font-pixel text-xs flex items-center justify-center gap-2 hover:bg-spidey/80 active:translate-y-px"
          >
            <span>✉</span>
            <span>{t.contact.email_btn}</span>
          </button>

          <button
            onClick={handlePhone}
            className="win9x-button flex-1 py-3 px-4 font-pixel text-xs text-yellow flex items-center justify-center gap-2 hover:bg-panel2 active:translate-y-px"
          >
            <span>📞</span>
            <span>{t.contact.phone_btn}</span>
          </button>
        </div>

        {/* Technical readout note */}
        <div className="pt-4 border-t border-slate/30 w-full">
          <p className="font-mono text-xs text-green italic">
            {t.contact.note}
          </p>
        </div>
      </div>
    </Window>
  );
};
