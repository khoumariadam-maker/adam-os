'use client';

import React from 'react';
import { Window } from '../Window';

export const SkillsWindow: React.FC = () => {
  const skillCategories = [
    {
      category: 'Embedded & Firmware',
      icon: '⚡',
      items: [
        { name: 'ESP32 & Microcontrollers', level: 95, tag: 'FreeRTOS / C++' },
        { name: 'Sensors & Actuators', level: 92, tag: 'I2C / SPI / UART / PWM' },
        { name: 'Autonomous Robotics', level: 90, tag: 'Line-Following / Motor Drivers' },
        { name: 'Hardware Prototyping', level: 85, tag: 'PCB / Soldering / Breadboards' },
      ],
    },
    {
      category: 'Software & AI Intelligence',
      icon: '🧠',
      items: [
        { name: 'Agentic Dev Workflows', level: 94, tag: 'Antigravity / Multi-Agent' },
        { name: 'Machine Learning Models', level: 88, tag: 'PyTorch / Soil Classifier' },
        { name: 'React & TypeScript', level: 86, tag: 'Next.js / Web Applications' },
        { name: 'Linux Server Administration', level: 84, tag: 'Raspberry Pi / Self-Hosted VPS' },
      ],
    },
  ];

  return (
    <Window id="skills">
      <div className="flex flex-col gap-6 font-body text-textDim">
        <div className="flex items-center justify-between border-b border-slate pb-2">
          <span className="font-pixel text-xs text-lavender uppercase tracking-wider">
            System Diagnostics // Hardware & Software Gauges
          </span>
          <span className="font-mono text-[10px] text-green bg-panel2 px-2 py-0.5 border border-slate">
            STATUS: 100% OPERATIONAL
          </span>
        </div>

        {/* Skill Category Cards */}
        {skillCategories.map((cat, idx) => (
          <div key={idx} className="win9x-box-recessed p-4 bg-panel2 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate/40 pb-2">
              <span className="text-base">{cat.icon}</span>
              <h3 className="font-pixel text-xs text-text">{cat.category}</h3>
            </div>

            <div className="space-y-3">
              {cat.items.map((skill, sIdx) => (
                <div key={sIdx} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-pixel text-[11px] text-text">{skill.name}</span>
                    <span className="font-mono text-[10px] text-yellow">{skill.tag}</span>
                  </div>
                  {/* Retro LED Meter Bar */}
                  <div className="w-full bg-base border border-slate p-0.5 flex gap-0.5">
                    <div
                      className="h-3 bg-green transition-all duration-300 shadow-[0_0_8px_rgba(114,255,180,0.5)]"
                      style={{ width: `${skill.level}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Window>
  );
};
