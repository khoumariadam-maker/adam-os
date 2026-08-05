'use client';

import React, { useState } from 'react';
import { Window } from '../Window';
import { useSound } from '@/context/SoundContext';
import { useMascot } from '@/context/MascotContext';

export const ControlPanelWindow: React.FC = () => {
  const { playClick, isMuted, toggleSound } = useSound();
  const mascot = useMascot();

  const [scanlineOpacity, setScanlineOpacity] = useState<number>(30);
  const [crtBloom, setCrtBloom] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'display' | 'audio' | 'system'>('display');

  const handleTabChange = (tab: 'display' | 'audio' | 'system') => {
    playClick();
    setActiveTab(tab);
  };

  const handleCrtBloomToggle = () => {
    playClick();
    const nextState = !crtBloom;
    setCrtBloom(nextState);
    if (typeof window !== 'undefined') {
      const el = document.getElementById('crt-bloom-overlay');
      if (el) {
        if (nextState) el.classList.remove('hidden');
        else el.classList.add('hidden');
      }
    }
  };

  return (
    <Window id="controlpanel">
      <div className="flex flex-col gap-4 font-body text-textDim select-none">
        {/* 9x Tab Navigation */}
        <div className="flex items-center gap-1 border-b-2 border-slate pb-0 font-pixel text-xs">
          <button
            onClick={() => handleTabChange('display')}
            className={`px-3 py-1.5 border-t-2 border-x-2 border-slate rounded-t ${
              activeTab === 'display' ? 'bg-panel text-text font-bold -mb-[2px] border-b-0 border-spidey' : 'bg-panel2 text-lavender hover:text-text'
            }`}
          >
            🖥 Display & Shaders
          </button>
          <button
            onClick={() => handleTabChange('audio')}
            className={`px-3 py-1.5 border-t-2 border-x-2 border-slate rounded-t ${
              activeTab === 'audio' ? 'bg-panel text-text font-bold -mb-[2px] border-b-0 border-spidey' : 'bg-panel2 text-lavender hover:text-text'
            }`}
          >
            🔊 Audio & FX
          </button>
          <button
            onClick={() => handleTabChange('system')}
            className={`px-3 py-1.5 border-t-2 border-x-2 border-slate rounded-t ${
              activeTab === 'system' ? 'bg-panel text-text font-bold -mb-[2px] border-b-0 border-spidey' : 'bg-panel2 text-lavender hover:text-text'
            }`}
          >
            ⚙ System Specs
          </button>
        </div>

        {/* Tab 1: Display & Shaders */}
        {activeTab === 'display' && (
          <div className="space-y-4">
            <div className="win9x-box-recessed p-4 bg-panel2 space-y-3 border border-slate">
              <h3 className="font-pixel text-xs text-yellow">📺 CRT Bloom Shader Overlay</h3>
              <p className="text-xs text-textDim leading-relaxed">
                Applies an authentic 1999 CRT monitor glass bloom, vignette glow, and color enhancement.
              </p>
              <button
                onClick={handleCrtBloomToggle}
                className="win9x-button win9x-button-spidey px-4 py-2 font-pixel text-xs flex items-center gap-2"
              >
                <span>{crtBloom ? '🟩 SHADER ENABLED' : '⬛ SHADER DISABLED'}</span>
              </button>
            </div>

            <div className="win9x-box-recessed p-4 bg-panel2 space-y-3 border border-slate">
              <h3 className="font-pixel text-xs text-green">✨ CRT Scanline Density ({scanlineOpacity}%)</h3>
              <input
                type="range"
                min="0"
                max="100"
                value={scanlineOpacity}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setScanlineOpacity(val);
                  if (typeof window !== 'undefined') {
                    const scanlineEl = document.querySelector('.crt-scanlines::before') as HTMLElement;
                    if (scanlineEl) scanlineEl.style.opacity = (val / 100).toString();
                  }
                }}
                className="w-full accent-spidey cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Tab 2: Audio & Sound */}
        {activeTab === 'audio' && (
          <div className="space-y-4">
            <div className="win9x-box-recessed p-4 bg-panel2 space-y-3 border border-slate">
              <h3 className="font-pixel text-xs text-yellow">🔊 Audio Synthesizer Master</h3>
              <p className="text-xs text-textDim leading-relaxed">
                Web Audio API oscillators synthesize vintage click, swing, open/close, and chime tones. Zero external MP3 files.
              </p>
              <button
                onClick={toggleSound}
                className="win9x-button win9x-button-spidey px-4 py-2 font-pixel text-xs flex items-center gap-2"
              >
                <span>{isMuted ? '🔇 AUDIO MUTED' : '🔊 AUDIO ACTIVE'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: System Specs */}
        {activeTab === 'system' && (
          <div className="space-y-3 font-mono text-xs">
            <div className="win9x-box-recessed p-4 bg-panel2 space-y-2 border border-slate">
              <p><span className="text-yellow">OS NAME:</span> Adam OS 98 (v2.0 Revision)</p>
              <p><span className="text-yellow">KERNEL:</span> PhoenixSpider ROM v2.4</p>
              <p><span className="text-yellow">FRAMEWORK:</span> Next.js + React + Tailwind CSS</p>
              <p><span className="text-yellow">MASCOT:</span> Pixel Spider (Chibi 8-bit hybrid)</p>
              <p><span className="text-green">STATUS:</span> OPERATIONAL // 100% SPEC COMPLIANT</p>
            </div>
          </div>
        )}
      </div>
    </Window>
  );
};
