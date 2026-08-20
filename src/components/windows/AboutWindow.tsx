'use client';

import React, { useState } from 'react';
import { Window } from '../Window';
import { useLanguage } from '@/context/LanguageContext';
import { useSound } from '@/context/SoundContext';

export const AboutWindow: React.FC = () => {
  const { t } = useLanguage();
  const { playClick } = useSound();
  const [activeTab, setActiveTab] = useState<'story' | 'lab' | 'afaq'>('story');

  const handleTabChange = (tab: 'story' | 'lab' | 'afaq') => {
    playClick();
    setActiveTab(tab);
  };

  return (
    <Window id="about">
      <div className="flex flex-col gap-4 font-body text-textDim">
        {/* 9x Tab Bar */}
        <div className="flex items-center gap-1 border-b-2 border-slate pb-0 font-pixel text-xs">
          <button
            onClick={() => handleTabChange('story')}
            className={`px-3 py-1.5 border-t-2 border-x-2 border-slate rounded-t ${
              activeTab === 'story' ? 'bg-panel text-text font-bold -mb-[2px] border-b-0 border-spidey' : 'bg-panel2 text-lavender hover:text-text'
            }`}
          >
            📜 Story & Bio
          </button>

          <button
            onClick={() => handleTabChange('lab')}
            className={`px-3 py-1.5 border-t-2 border-x-2 border-slate rounded-t ${
              activeTab === 'lab' ? 'bg-panel text-text font-bold -mb-[2px] border-b-0 border-spidey' : 'bg-panel2 text-lavender hover:text-text'
            }`}
          >
            🔬 Hardware Rig
          </button>

          <button
            onClick={() => handleTabChange('afaq')}
            className={`px-3 py-1.5 border-t-2 border-x-2 border-slate rounded-t ${
              activeTab === 'afaq' ? 'bg-panel text-text font-bold -mb-[2px] border-b-0 border-spidey' : 'bg-panel2 text-lavender hover:text-text'
            }`}
          >
            👑 Afaq Club & Workshops
          </button>
        </div>

        {/* Tab 1: Story & Bio */}
        {activeTab === 'story' && (
          <div className="flex flex-col md:flex-row gap-5 items-start">
            <div className="win9x-box-recessed p-2 bg-panel2 flex-shrink-0 mx-auto md:mx-0 border-2 border-spidey">
              <img
                src="/mascot/adam-portrait.png"
                alt="Khoumari Adam Portrait"
                className="w-36 h-36 md:w-40 md:h-40 object-contain pixel-art"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="%23171722"/><rect x="20" y="20" width="120" height="120" fill="%231f1f2e" stroke="%23212CF4" stroke-width="2"/><circle cx="80" cy="70" r="30" fill="%23212CF4"/><rect x="45" y="110" width="70" height="30" fill="%230B0B10"/><text x="80" y="75" font-family="monospace" font-size="20" fill="%23FFFFFF" text-anchor="middle">ADAM</text></svg>`;
                }}
              />
            </div>

            <div className="flex-1 space-y-3 font-body">
              <div>
                <h1 className="font-pixel text-base md:text-lg text-text mb-0.5">
                  {t.about.name}
                </h1>
                <p className="font-pixel text-[10px] text-lavender uppercase tracking-wider">
                  {t.about.role}
                </p>
              </div>

              <div className="win9x-box-recessed p-3 bg-panel2 space-y-2 text-xs leading-relaxed border border-slate/50">
                <p>{t.about.p1}</p>
                <p>{t.about.p2}</p>
                <p>{t.about.p3}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Hardware Rig */}
        {activeTab === 'lab' && (
          <div className="space-y-4 font-mono text-xs">
            <div className="win9x-box-recessed p-4 bg-panel2 space-y-3 border border-slate">
              <h3 className="font-pixel text-xs text-yellow">💻 Primary Development Workstation</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-textDim">
                <p>• Microcontrollers: <span className="text-green">ESP32-WROOM-32 / STM32F4</span></p>
                <p>• Single-Board Server: <span className="text-green">Raspberry Pi 4B (8GB)</span></p>
                <p>• Sensors & Instruments: <span className="text-green">Capacitive Moisture / DSO Oscilloscope</span></p>
                <p>• Prototyping: <span className="text-green">Custom Soldering Station / PCB Layout</span></p>
              </div>
            </div>

            <div className="win9x-box-recessed p-3 bg-base border border-spidey flex justify-between items-center text-xs">
              <span className="text-lavender">LAB STATUS: 24/7 AGENTIC WORKFLOW ONLINE</span>
              <span className="text-green font-pixel text-[10px]">OK 100%</span>
            </div>
          </div>
        )}

        {/* Tab 3: Afaq Presidency & Leadership */}
        {activeTab === 'afaq' && (
          <div className="space-y-3 text-xs font-body">
            <div className="win9x-box-recessed p-3 bg-panel2 border border-slate space-y-2">
              <h3 className="font-pixel text-xs text-yellow">👑 President — Scientific Club Afaq (2025–2026)</h3>
              <p className="text-textDim leading-relaxed">
                Led Bouira University's flagship scientific student club. Organized university hackathons, embedded systems workshops, and guided 150+ students through hands-on technology projects.
              </p>
            </div>

            <div className="win9x-box-recessed p-3 bg-panel2 border border-slate space-y-2">
              <h3 className="font-pixel text-xs text-green">🤖 Robotics Instructor — CLS Bouira</h3>
              <p className="text-textDim leading-relaxed">
                Taught Arduino, sensor wiring, and motor driver circuitry to kids and beginners. Designed the 4-day Rocket League autonomous car competition curriculum.
              </p>
            </div>
          </div>
        )}
      </div>
    </Window>
  );
};
