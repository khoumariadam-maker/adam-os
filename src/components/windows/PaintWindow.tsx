'use client';

import React, { useState } from 'react';
import { Window } from '../Window';
import { useSound } from '@/context/SoundContext';
import { useMascot } from '@/context/MascotContext';

const GRID_SIZE = 16;
const PALETTE_COLORS = [
  '#0B0B10', // base
  '#171722', // panel
  '#212CF4', // spidey blue
  '#FFFFFF', // white
  '#E1E2E7', // textDim
  '#C3C6ED', // lavender
  '#72FFB4', // green
  '#FF3A66', // red
  '#FFE55C', // yellow
  '#B0B3BC', // slate
];

export const PaintWindow: React.FC = () => {
  const { playClick, playDownloadFanfare } = useSound();
  const mascot = useMascot();

  const [grid, setGrid] = useState<string[]>(Array(GRID_SIZE * GRID_SIZE).fill('#0B0B10'));
  const [selectedColor, setSelectedColor] = useState<string>('#212CF4');

  const handleCellClick = (index: number) => {
    playClick();
    setGrid((prev) => {
      const next = [...prev];
      next[index] = selectedColor;
      return next;
    });
  };

  const handleClear = () => {
    playClick();
    setGrid(Array(GRID_SIZE * GRID_SIZE).fill('#0B0B10'));
    mascot.setFrame('idle');
    mascot.setSpeechText('Canvas cleared! Fresh start!');
  };

  const handleInspectArt = () => {
    playDownloadFanfare();
    mascot.setFrame('celebrating');
    mascot.setSpeechText('Woah! That pixel artwork belongs in a museum! Spidey approved! 🎨');
  };

  return (
    <Window id="paint">
      <div className="flex flex-col items-center gap-4 font-body text-textDim select-none">
        {/* Paint Header */}
        <div className="w-full flex justify-between items-center text-xs font-pixel bg-panel2 p-2 border border-slate">
          <span className="text-yellow">Paint.exe (16x16 Pixel Canvas)</span>
          <button
            onClick={handleInspectArt}
            className="win9x-button win9x-button-spidey px-3 py-1 text-[10px] text-text"
          >
            Show Pixel Spider
          </button>
        </div>

        {/* 16x16 Pixel Canvas */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(16, minmax(0, 1fr))',
            gridTemplateRows: 'repeat(16, minmax(0, 1fr))',
          }}
          className="w-64 h-64 bg-[#0B0B10] border-2 border-slate p-0.5"
        >
          {grid.map((color, idx) => (
            <div
              key={idx}
              onClick={() => handleCellClick(idx)}
              style={{ backgroundColor: color }}
              className="w-full h-full border-[0.5px] border-slate/10 cursor-pointer hover:opacity-80"
            />
          ))}
        </div>

        {/* Locked 10-Token Color Swatch Palette */}
        <div className="flex flex-wrap justify-center gap-1.5 p-2 bg-panel2 border border-slate">
          {PALETTE_COLORS.map((hex) => (
            <button
              key={hex}
              onClick={() => {
                playClick();
                setSelectedColor(hex);
              }}
              style={{ backgroundColor: hex }}
              className={`w-6 h-6 border-2 ${
                selectedColor === hex ? 'border-yellow scale-110 shadow-[0_0_6px_#FFE55C]' : 'border-slate'
              }`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="w-full flex justify-between items-center font-mono text-xs">
          <span className="text-lavender">CURRENT COLOR: <span style={{ color: selectedColor }}>■ {selectedColor}</span></span>
          <button onClick={handleClear} className="win9x-button px-3 py-1 font-pixel text-[10px] text-red">
            CLEAR CANVAS
          </button>
        </div>
      </div>
    </Window>
  );
};
