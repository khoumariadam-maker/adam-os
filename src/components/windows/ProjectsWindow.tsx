'use client';

import React, { useState } from 'react';
import { PixelIcon } from '@/components/PixelIcon';
import { Window } from '../Window';
import { useLanguage } from '@/context/LanguageContext';
import { useSound } from '@/context/SoundContext';
import { useWindowManager } from '@/context/WindowManagerContext';
import { PROJECTS, Project } from '@/lib/content/projects';
import { PROFILE } from '@/lib/profile';
import { asset } from '@/lib/asset';

const UI = {
  en: { problem: 'Why', built: 'What I built', result: 'Result', stack: 'Stack', openLab: 'Try it in Lab.exe', github: 'More on GitHub', count: 'projects' },
  ar: { problem: 'لماذا', built: 'ما الذي بنيته', result: 'النتيجة', stack: 'التقنيات', openLab: 'جرّبه في Lab.exe', github: 'المزيد على GitHub', count: 'مشاريع' },
};

// Generated pixel "cover" used until a real photo is added for the project.
const Cover: React.FC<{ project: Project; title: string }> = ({ project, title }) =>
  project.image ? (
    <img src={asset(project.image)} alt={title} className="w-full aspect-[16/7] object-cover border-2 border-slate" />
  ) : (
    <div
      className="relative w-full aspect-[16/6] border-2 border-slate overflow-hidden flex items-center gap-4 px-5"
      style={{
        background: `linear-gradient(135deg, ${project.accent}33, #0B0B10 70%), repeating-linear-gradient(0deg, transparent 0 15px, #ffffff0d 15px 16px), repeating-linear-gradient(90deg, transparent 0 15px, #ffffff0d 15px 16px)`,
      }}
      aria-hidden="true"
    >
      <PixelIcon name={project.icon} size={64} className="drop-shadow-[3px_3px_0_rgba(0,0,0,0.6)]" />
      <p className="font-mono text-[11px] leading-relaxed min-w-0" style={{ color: project.accent }}>
        {project.stack.join(' · ')}
      </p>
      <span className="absolute bottom-1.5 end-2 font-mono text-[9px] text-slate/60">{project.id}.exe</span>
    </div>
  );

export const ProjectsWindow: React.FC = () => {
  const { lang } = useLanguage();
  const { playClick } = useSound();
  const { openWindow } = useWindowManager();
  const [selectedId, setSelectedId] = useState<string>(PROJECTS[0].id);
  const ui = UI[lang];
  const project = PROJECTS.find((p) => p.id === selectedId) ?? PROJECTS[0];

  const select = (id: string) => {
    playClick();
    setSelectedId(id);
  };

  return (
    <Window id="projects" flush>
      <div className="flex flex-col md:flex-row h-full min-h-0">
        {/* Project list */}
        <nav
          aria-label="Projects"
          className="md:w-56 shrink-0 bg-panel2 border-b-2 md:border-b-0 md:border-e-2 border-slate/50 p-2 flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto"
        >
          <p className="hidden md:block px-1 pb-1 font-pixel text-[9px] uppercase tracking-widest text-lavender/70">
            {PROJECTS.length} {ui.count}
          </p>
          {PROJECTS.map((p) => {
            const active = p.id === project.id;
            return (
              <button
                key={p.id}
                onClick={() => select(p.id)}
                aria-current={active ? 'true' : undefined}
                className={`shrink-0 md:w-full flex items-center gap-2 px-2 py-2 text-start border ${
                  active ? 'bg-spidey border-lavender/60 text-onAccent' : 'border-transparent hover:bg-panel text-textDim'
                }`}
              >
                <PixelIcon name={p.icon} size={24} />
                <span className="min-w-0">
                  <span className="block font-pixel text-[11px] leading-snug truncate max-w-[180px]">{p.title[lang]}</span>
                  <span className={`hidden md:block text-[10px] truncate ${active ? 'text-onAccent/75' : 'text-lavender'}`}>{p.kind[lang]}</span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* Case study */}
        <article key={project.id} className="flex-1 overflow-y-auto p-4 space-y-4 select-text animate-[fadeIn_.18s_ease-out]">
          <Cover project={project} title={project.title[lang]} />

          <header className="space-y-1.5">
            <span
              className="inline-block font-pixel text-[9px] uppercase tracking-wider px-1.5 py-0.5 border"
              style={{ color: project.accent, borderColor: `${project.accent}88` }}
            >
              {project.kind[lang]}
            </span>
            <h3 className="font-pixel text-sm text-text">{project.title[lang]}</h3>
            <p className="text-sm text-lavender">{project.tagline[lang]}</p>
          </header>

          <section className="space-y-1">
            <h4 className="font-pixel text-[10px] uppercase tracking-wider text-yellow">{ui.problem}</h4>
            <p className="text-[13px] leading-relaxed">{project.context[lang]}</p>
          </section>

          <section className="space-y-1.5">
            <h4 className="font-pixel text-[10px] uppercase tracking-wider text-yellow">{ui.built}</h4>
            <ul className="space-y-1.5 text-[13px] leading-relaxed">
              {project.built[lang].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-green shrink-0" aria-hidden="true">▸</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="win9x-box-recessed p-3 space-y-1">
            <h4 className="font-pixel text-[10px] uppercase tracking-wider text-green">{ui.result}</h4>
            <p className="text-[13px] leading-relaxed text-text">{project.outcome[lang]}</p>
          </section>

          <section className="space-y-1.5">
            <h4 className="font-pixel text-[10px] uppercase tracking-wider text-yellow">{ui.stack}</h4>
            <div className="flex flex-wrap gap-1.5">
              {project.stack.map((tag) => (
                <span key={tag} className="font-mono text-[11px] px-2 py-0.5 bg-panel2 border border-slate/50 text-lavender">
                  {tag}
                </span>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap gap-2 pt-1">
            {project.relatedApp && (
              <button
                onClick={() => {
                  playClick();
                  openWindow(project.relatedApp!);
                }}
                className="win9x-button win9x-button-spidey px-3 py-1.5 font-pixel text-[10px]"
              >
                <PixelIcon name="lab" /> {ui.openLab}
              </button>
            )}
            {project.links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="win9x-button px-3 py-1.5 font-pixel text-[10px] text-text"
              >
                <PixelIcon name="link" /> {link.label}
              </a>
            ))}
            {PROFILE.github && (
              <a
                href={PROFILE.github}
                target="_blank"
                rel="noopener noreferrer"
                className="win9x-button px-3 py-1.5 font-pixel text-[10px] text-text"
              >
                <PixelIcon name="github" /> {ui.github}
              </a>
            )}
          </div>
        </article>
      </div>
    </Window>
  );
};
