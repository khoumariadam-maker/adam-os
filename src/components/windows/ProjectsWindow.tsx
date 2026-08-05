'use client';

import React, { useState } from 'react';
import { Window } from '../Window';
import { useLanguage } from '@/context/LanguageContext';
import { useSound } from '@/context/SoundContext';

export const ProjectsWindow: React.FC = () => {
  const { t } = useLanguage();
  const { playClick } = useSound();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const projects = [
    {
      id: 'p1',
      title: t.projects.p1_title,
      desc: t.projects.p1_desc,
      stack: t.projects.p1_stack,
      details: t.projects.p1_details,
      icon: '/icons/nav-projects.png',
    },
    {
      id: 'p2',
      title: t.projects.p2_title,
      desc: t.projects.p2_desc,
      stack: t.projects.p2_stack,
      details: t.projects.p2_details,
      icon: '/icons/file-zip.png',
    },
    {
      id: 'p3',
      title: t.projects.p3_title,
      desc: t.projects.p3_desc,
      stack: t.projects.p3_stack,
      details: t.projects.p3_details,
      icon: '/icons/ui-terminal.png',
    },
    {
      id: 'p4',
      title: t.projects.p4_title,
      desc: t.projects.p4_desc,
      stack: t.projects.p4_stack,
      details: t.projects.p4_details,
      icon: '/icons/ui-ai-spark.png',
    },
    {
      id: 'p5',
      title: t.projects.p5_title,
      desc: t.projects.p5_desc,
      stack: t.projects.p5_stack,
      details: t.projects.p5_details,
      icon: '/icons/file-doc.png',
    },
  ];

  const handleToggle = (id: string) => {
    playClick();
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <Window id="projects">
      <div className="flex flex-col gap-4 font-body">
        <div className="flex items-center justify-between border-b border-slate pb-2">
          <span className="font-pixel text-xs text-lavender uppercase tracking-wider">
            System Projects Directory ({projects.length})
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((proj) => {
            const isExpanded = expandedId === proj.id;
            return (
              <div
                key={proj.id}
                className="win9x-box-recessed p-4 bg-panel2 flex flex-col justify-between hover:border-spidey transition-colors"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 bg-panel flex-shrink-0 flex items-center justify-center border border-slate p-1">
                    <img
                      src={proj.icon}
                      alt=""
                      className="w-8 h-8 pixel-art"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="%23212CF4"/></svg>`;
                      }}
                    />
                  </div>
                  <div>
                    <h2 className="font-pixel text-xs text-text mb-1 leading-snug">
                      {proj.title}
                    </h2>
                    <p className="text-xs text-textDim leading-relaxed">
                      {proj.desc}
                    </p>
                  </div>
                </div>

                {/* Tech Stack Pills */}
                <div className="flex flex-wrap gap-1.5 my-2 font-mono text-[10px]">
                  {proj.stack.map((tag: string, idx: number) => (
                    <span
                      key={idx}
                      className="bg-panel px-2 py-0.5 border border-slate text-lavender"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Expandable Details */}
                {isExpanded && (
                  <div className="mt-3 pt-2 border-t border-slate/50 text-xs text-textDim leading-relaxed bg-panel p-2">
                    {proj.details}
                  </div>
                )}

                <button
                  onClick={() => handleToggle(proj.id)}
                  className="win9x-button mt-3 px-2 py-1 font-pixel text-[10px] text-yellow self-start hover:bg-panel"
                >
                  {isExpanded ? '▲ Hide Details' : '▼ Details'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Window>
  );
};
