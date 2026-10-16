'use client';

import React, { useState } from 'react';
import { PixelIcon } from '@/components/PixelIcon';
import { Window } from '../Window';
import { useLanguage } from '@/context/LanguageContext';
import { useSound } from '@/context/SoundContext';
import { useMascot } from '@/context/MascotContext';
import { PROFILE } from '@/lib/profile';

const fieldClass =
  'w-full win9x-box-recessed bg-base px-2.5 py-2 text-[13px] text-text placeholder:text-slate/60 outline-none focus:!border-spidey';

export const ContactWindow: React.FC = () => {
  const { t } = useLanguage();
  const { playClick } = useSound();
  const mascot = useMascot();
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const copyEmail = async () => {
    playClick();
    try {
      await navigator.clipboard.writeText(PROFILE.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.location.href = `mailto:${PROFILE.email}`;
    }
  };

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    playClick();
    const body = name ? `${message}\n\n— ${name}` : message;
    const params = new URLSearchParams({ subject: subject || 'Hello from Adam OS', body });
    mascot.react('waving', 'Opening your email app… Adam actually replies!', 2000);
    window.location.href = `mailto:${PROFILE.email}?${params.toString().replace(/\+/g, '%20')}`;
  };

  return (
    <Window id="contact">
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-pixel text-sm text-text">{t.contact.heading}</h2>
          <p className="text-[13px] text-textDim">{t.contact.intro}</p>
        </div>

        {/* Direct channels */}
        <div className="win9x-box-recessed p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] text-green select-text break-all flex-1 min-w-[180px]">{PROFILE.email}</span>
            <button onClick={copyEmail} className="win9x-button px-2.5 py-1 font-pixel text-[10px]" aria-live="polite">
              <PixelIcon name={copied ? 'check' : 'copy'} /> {copied ? t.contact.copied : t.contact.copy}
            </button>
            <a href={`mailto:${PROFILE.email}`} className="win9x-button win9x-button-spidey px-2.5 py-1 font-pixel text-[10px]">
              <PixelIcon name="mail" /> {t.contact.email_btn}
            </a>
          </div>
          {(PROFILE.github || PROFILE.linkedin) && (
            <div className="flex flex-wrap gap-2 border-t border-slate/30 pt-3">
              {PROFILE.github && (
                <a href={PROFILE.github} target="_blank" rel="noopener noreferrer" className="win9x-button px-2.5 py-1 font-pixel text-[10px] text-text">
                  <PixelIcon name="github" /> {t.contact.github}
                </a>
              )}
              {PROFILE.linkedin && (
                <a href={PROFILE.linkedin} target="_blank" rel="noopener noreferrer" className="win9x-button px-2.5 py-1 font-pixel text-[10px] text-text">
                  <PixelIcon name="link" /> {t.contact.linkedin}
                </a>
              )}
            </div>
          )}
        </div>

        {/* mailto composer: no backend, nothing stored */}
        <form onSubmit={send} className="space-y-2">
          <h3 className="font-pixel text-[10px] uppercase tracking-wider text-yellow">{t.contact.compose}</h3>
          <div className="grid sm:grid-cols-2 gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.contact.name} aria-label={t.contact.name} className={fieldClass} />
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t.contact.subject} aria-label={t.contact.subject} className={fieldClass} />
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t.contact.message}
            aria-label={t.contact.message}
            required
            rows={4}
            className={`${fieldClass} resize-none`}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-lavender/80 flex-1 min-w-[180px]">{t.contact.send_hint}</p>
            <button type="submit" className="win9x-button win9x-button-spidey px-3 py-1.5 font-pixel text-[10px]">
              <PixelIcon name="send" /> {t.contact.send}
            </button>
          </div>
        </form>

        <p className="font-mono text-xs text-green/80 italic">{t.contact.note}</p>
      </div>
    </Window>
  );
};
