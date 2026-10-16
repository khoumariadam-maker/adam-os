'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PixelIcon } from '@/components/PixelIcon';
import { AnimatePresence, motion } from 'framer-motion';
import { useWindowManager } from '@/context/WindowManagerContext';
import { useLanguage } from '@/context/LanguageContext';
import { useSound } from '@/context/SoundContext';
import { useMascot, WALLPAPERS } from '@/context/MascotContext';
import { useSettings } from '@/context/SettingsContext';
import { APPS } from '@/lib/apps';
import type { IconName } from '@/lib/pixel-icons';
import { PROFILE } from '@/lib/profile';
import { asset } from '@/lib/asset';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReboot?: () => void;
  onShutdown: () => void;
}

interface Command {
  id: string;
  label: string;
  hint: string;
  glyph: IconName;
  section: 'apps' | 'actions';
  keywords: string;
  run: () => void;
}

const navigate = (href: string, newTab = false) => {
  if (newTab) window.open(href, '_blank', 'noopener,noreferrer');
  else window.location.href = href;
};

// Ctrl/⌘+K launcher: fuzzy-ish search over every app and quick action.
export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onOpenChange, onReboot, onShutdown }) => {
  const { openWindow, minimizeAll } = useWindowManager();
  const { t, toggleLanguage, lang } = useLanguage();
  const { toggleSound, isMuted, playClick, playWindowOpen } = useSound();
  const { changeWallpaper } = useMascot();
  const { settings, updateSettings } = useSettings();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const apps: Command[] = APPS.map((app) => ({
      id: `app-${app.id}`,
      label: app.title,
      hint: app.group,
      glyph: app.glyph,
      section: 'apps',
      keywords: `${app.id} ${app.keywords}`,
      run: () => {
        playWindowOpen();
        openWindow(app.id);
      },
    }));
    const actions: Command[] = [
      { id: 'cv-en', label: 'Download résumé (English PDF)', hint: 'PDF', glyph: 'download' as IconName, keywords: 'cv resume pdf english download', run: () => navigate(asset(PROFILE.resumes.en.path), true) },
      { id: 'cv-ar', label: 'Download résumé (Arabic PDF)', hint: 'PDF', glyph: 'download' as IconName, keywords: 'cv resume pdf arabic download عربي', run: () => navigate(asset(PROFILE.resumes.ar.path), true) },
      { id: 'cv-web', label: 'Open plain web résumé', hint: '/resume', glyph: 'resume' as IconName, keywords: 'cv resume plain recruiter html', run: () => navigate(asset('/resume/')) },
      { id: 'email', label: `Email ${PROFILE.email}`, hint: 'mailto', glyph: 'mail' as IconName, keywords: 'email contact mail hire', run: () => navigate(`mailto:${PROFILE.email}`) },
      ...(PROFILE.github
        ? [{ id: 'github', label: 'Open GitHub profile', hint: 'github.com', glyph: 'github' as IconName, keywords: 'github code repos source', run: () => navigate(PROFILE.github, true) }]
        : []),
      { id: 'lang', label: lang === 'en' ? 'Switch to Arabic (العربية)' : 'Switch to English', hint: 'language', glyph: 'language' as IconName, keywords: 'language arabic english rtl translate', run: toggleLanguage },
      { id: 'sound', label: isMuted ? 'Turn sound on' : 'Turn sound off', hint: 'audio', glyph: (isMuted ? 'sound-on' : 'sound-off') as IconName, keywords: 'sound audio mute volume', run: toggleSound },
      {
        id: 'theme',
        label: settings.theme === 'classic' ? 'Theme: Spider Night (dark)' : 'Theme: Windows 98 (classic)',
        hint: 'theme',
        glyph: 'paint' as IconName,
        keywords: 'theme classic dark light win98 grey gray silver appearance',
        run: () => updateSettings({ theme: settings.theme === 'classic' ? 'dark' : 'classic' }),
      },
      { id: 'desktop', label: 'Show desktop (minimize all)', hint: 'windows', glyph: 'desktop' as IconName, keywords: 'show desktop minimize all clear', run: minimizeAll },
      ...WALLPAPERS.map((w) => ({
        id: `wp-${w}`,
        label: `Wallpaper: ${w.replace('-', ' ')}`,
        hint: 'wallpaper',
        glyph: 'image' as IconName,
        keywords: `wallpaper background theme ${w}`,
        run: () => changeWallpaper(w),
      })),
      { id: 'reboot', label: 'Restart Adam OS (replay boot)', hint: 'system', glyph: 'restart' as IconName, keywords: 'reboot restart boot', run: () => onReboot?.() },
      { id: 'shutdown', label: 'Shut down', hint: 'system', glyph: 'power' as IconName, keywords: 'shutdown power off', run: onShutdown },
    ].map((c) => ({ ...c, section: 'actions' as const }));
    return [...apps, ...actions];
  }, [openWindow, minimizeAll, toggleLanguage, toggleSound, isMuted, lang, changeWallpaper, onReboot, onShutdown, playWindowOpen, settings.theme, updateSettings]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    const terms = q.split(/\s+/);
    return commands
      .map((c) => {
        const hay = `${c.label} ${c.keywords}`.toLowerCase();
        if (!terms.every((term) => hay.includes(term))) return null;
        const score = c.label.toLowerCase().startsWith(q) ? 0 : c.label.toLowerCase().includes(q) ? 1 : 2;
        return { c, score };
      })
      .filter((x): x is { c: Command; score: number } => x !== null)
      .sort((a, b) => a.score - b.score)
      .map((x) => x.c);
  }, [commands, query]);

  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const runCommand = (cmd: Command | undefined) => {
    if (!cmd) return;
    playClick();
    onOpenChange(false);
    cmd.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(results.length - 1, c + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runCommand(results[cursor]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  let lastSection: Command['section'] | null = null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-overlay-open="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-[1000] bg-black/50 flex items-start justify-center pt-[12vh] px-4"
          onPointerDown={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) onOpenChange(false);
          }}
        >
          <motion.div
            initial={{ y: -12, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: -12, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            role="dialog"
            aria-modal="true"
            aria-label="Search apps and actions"
            className="w-full max-w-lg win9x-box-raised window-active-shadow"
          >
            <div className="title-bar-active px-2 py-1 font-pixel text-[11px] flex justify-between">
              <span>Run…</span>
              <span className="opacity-75">Esc</span>
            </div>
            <div className="p-2 border-b-2 border-slate/40 bg-panel">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={t.palette.placeholder}
                aria-label={t.palette.placeholder}
                aria-controls="palette-results"
                aria-activedescendant={results[cursor] ? `palette-${results[cursor].id}` : undefined}
                autoComplete="off"
                spellCheck={false}
                className="w-full win9x-box-recessed bg-base px-3 py-2 font-mono text-sm text-text placeholder:text-lavender/60 outline-none focus:!border-spidey"
              />
            </div>
            <ul id="palette-results" ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto p-1 bg-panel">
              {results.length === 0 && <li className="px-3 py-4 text-xs text-lavender text-center">{t.palette.empty}</li>}
              {results.map((cmd, i) => {
                const header = cmd.section !== lastSection && !query;
                lastSection = cmd.section;
                return (
                  <React.Fragment key={cmd.id}>
                    {header && (
                      <li role="presentation" className="px-2 pt-2 pb-1 font-pixel text-[9px] uppercase tracking-widest text-lavender/70">
                        {cmd.section === 'apps' ? t.palette.apps : t.palette.actions}
                      </li>
                    )}
                    <li
                      id={`palette-${cmd.id}`}
                      role="option"
                      aria-selected={i === cursor}
                      data-index={i}
                      onPointerMove={() => setCursor(i)}
                      onClick={() => runCommand(cmd)}
                      className={`flex items-center gap-3 px-2 py-1.5 cursor-pointer text-sm ${
                        i === cursor ? 'bg-spidey text-onAccent' : 'text-textDim'
                      }`}
                    >
                      <span className="w-6 flex justify-center shrink-0">
                        <PixelIcon name={cmd.glyph} />
                      </span>
                      <span className="flex-1 truncate">{cmd.label}</span>
                      <span className={`font-mono text-[10px] ${i === cursor ? 'text-onAccent/75' : 'text-slate'}`}>{cmd.hint}</span>
                    </li>
                  </React.Fragment>
                );
              })}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
