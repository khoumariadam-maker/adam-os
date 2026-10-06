'use client';

import React, { useState } from 'react';
import { PixelIcon } from '@/components/PixelIcon';
import { Window } from '../Window';
import { useSound } from '@/context/SoundContext';
import { useMascot, WALLPAPERS } from '@/context/MascotContext';
import { useSettings, ThemeName } from '@/context/SettingsContext';
import { useLanguage } from '@/context/LanguageContext';
import { asset } from '@/lib/asset';

type Tab = 'display' | 'system';

const THEMES: Array<{ id: ThemeName; label: string; hint: string; desktop: string; panel: string; title: string; text: string; border: string }> = [
  { id: 'dark', label: 'Spider Night', hint: 'Dark cobalt (default)', desktop: '#0B0B10', panel: '#171722', title: 'linear-gradient(90deg,#121a9c,#5e66ff)', text: '#E1E2E7', border: '#B0B3BC' },
  { id: 'classic', label: 'Windows 98', hint: 'Silver, navy and teal', desktop: '#008080', panel: '#c0c0c0', title: 'linear-gradient(90deg,#000080,#1084d0)', text: '#000000', border: '#808080' },
];

const Toggle: React.FC<{ label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, hint, checked, onChange }) => (
  <label className="flex items-start gap-3 cursor-pointer py-1.5">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 w-4 h-4 accent-spidey" />
    <span>
      <span className="block text-[13px] text-text">{label}</span>
      <span className="block text-[11px] text-lavender/80">{hint}</span>
    </span>
  </label>
);

export const ControlPanelWindow: React.FC = () => {
  const { playClick, isMuted, toggleSound } = useSound();
  const { activeWallpaper, changeWallpaper } = useMascot();
  const { settings, updateSettings } = useSettings();
  const { lang, toggleLanguage } = useLanguage();
  const [tab, setTab] = useState<Tab>('display');

  const resetDesktop = () => {
    playClick();
    try {
      window.localStorage.removeItem('adam_os_window_layout_v2');
    } catch {
      // ignore
    }
    window.location.reload();
  };

  return (
    <Window id="controlpanel">
      <div className="flex flex-col gap-4">
        <div role="tablist" className="flex items-end gap-1 border-b-2 border-slate font-pixel text-[11px]">
          {(['display', 'system'] as Tab[]).map((id) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => {
                playClick();
                setTab(id);
              }}
              className={`px-3 border-t-2 border-x-2 border-slate -mb-[2px] capitalize ${
                tab === id ? 'bg-panel text-text py-1.5 border-b-2 border-b-panel' : 'bg-panel2 text-lavender py-1 hover:text-text'
              }`}
            >
              {id === 'display' ? 'Display' : 'System'}
            </button>
          ))}
        </div>

        {tab === 'display' && (
          <div className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="font-pixel text-[10px] uppercase tracking-wider text-yellow mb-2">Theme</legend>
              <div className="grid grid-cols-2 gap-2">
                {THEMES.map((th) => (
                  <button
                    key={th.id}
                    onClick={() => {
                      playClick();
                      updateSettings({ theme: th.id });
                    }}
                    aria-pressed={settings.theme === th.id}
                    className={`p-1.5 border-2 text-start ${settings.theme === th.id ? 'border-spidey bg-spidey/15' : 'border-slate/40 hover:border-lavender'}`}
                  >
                    {/* Mini window preview drawn with the theme's own colours */}
                    <span className="block h-14 relative overflow-hidden" style={{ background: th.desktop }} aria-hidden="true">
                      <span className="absolute left-2 top-2 right-4 bottom-1 border" style={{ background: th.panel, borderColor: th.border }}>
                        <span className="block h-2.5" style={{ background: th.title }} />
                        <span className="block mx-1.5 mt-1.5 h-1 w-3/4" style={{ background: th.text, opacity: 0.6 }} />
                        <span className="block mx-1.5 mt-1 h-1 w-1/2" style={{ background: th.text, opacity: 0.4 }} />
                      </span>
                    </span>
                    <span className="block font-pixel text-[10px] mt-1.5">{th.label}</span>
                    <span className="block text-[11px] text-lavender">{th.hint}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="font-pixel text-[10px] uppercase tracking-wider text-yellow mb-2">Wallpaper</legend>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {WALLPAPERS.map((w) => (
                  <button
                    key={w}
                    onClick={() => changeWallpaper(w)}
                    aria-pressed={activeWallpaper === w}
                    className={`p-1 border-2 text-start ${activeWallpaper === w ? 'border-spidey bg-spidey/20' : 'border-slate/40 hover:border-lavender'}`}
                  >
                    <img src={asset(`/wallpapers/${w}-16x9.jpg`)} alt="" className="w-full aspect-video object-cover pixel-art" />
                    <span className="block font-pixel text-[9px] mt-1 capitalize truncate">{w.replace('-', ' ')}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="win9x-box-recessed p-3 space-y-1">
              <legend className="sr-only">Effects</legend>
              <Toggle
                label="CRT glass bloom"
                hint="Vignette + glow like a 1999 monitor."
                checked={settings.crtBloom}
                onChange={(v) => updateSettings({ crtBloom: v })}
              />
              <Toggle
                label="Living wallpaper"
                hint="Twinkling stars, fireflies and drifting clouds (dark theme)."
                checked={settings.liveWallpaper}
                onChange={(v) => updateSettings({ liveWallpaper: v })}
              />
              <Toggle
                label="Screensaver"
                hint="Flying through spider webs after 90s idle."
                checked={settings.screensaver}
                onChange={(v) => updateSettings({ screensaver: v })}
              />
              <Toggle
                label="Pixel cursor"
                hint="8-bit cursor with a cobalt trail (mouse only)."
                checked={settings.customCursor}
                onChange={(v) => updateSettings({ customCursor: v })}
              />
              <label className="block pt-2">
                <span className="text-[13px] text-text">Scanline intensity ({settings.scanlines}%)</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={settings.scanlines}
                  onChange={(e) => updateSettings({ scanlines: Number(e.target.value) })}
                  className="w-full accent-spidey mt-1"
                />
                <span className="text-[11px] text-lavender/80">Used on the boot and shutdown screens.</span>
              </label>
            </fieldset>
          </div>
        )}

        {tab === 'system' && (
          <div className="space-y-4">
            <div className="win9x-box-recessed p-3 space-y-1">
              <Toggle label="Sound effects" hint="Synthesized with the Web Audio API — no audio files." checked={!isMuted} onChange={toggleSound} />
              <Toggle label="العربية (Arabic, right-to-left)" hint="Switch the interface language." checked={lang === 'ar'} onChange={toggleLanguage} />
            </div>
            <dl className="win9x-box-recessed p-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[12px]">
              <dt className="text-yellow">OS</dt>
              <dd>Adam OS 98</dd>
              <dt className="text-yellow">Built with</dt>
              <dd>Next.js 14 · React 18 · Tailwind · Framer Motion</dd>
              <dt className="text-yellow">Hosting</dt>
              <dd>Static export — no backend, no tracking</dd>
              <dt className="text-yellow">Shortcuts</dt>
              <dd>Ctrl+K search · Esc close · drag title to screen edge to snap</dd>
            </dl>
            <button onClick={resetDesktop} className="win9x-button px-3 py-1.5 font-pixel text-[10px]">
              <PixelIcon name="restart" /> Reset window positions
            </button>
          </div>
        )}
      </div>
    </Window>
  );
};
