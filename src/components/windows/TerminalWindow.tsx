'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Window } from '../Window';
import { useLanguage } from '@/context/LanguageContext';
import { useSound } from '@/context/SoundContext';
import { useMascot } from '@/context/MascotContext';

interface CommandOutput {
  command: string;
  result: string | React.ReactNode;
}

interface TerminalWindowProps {
  onTriggerTheater?: (file: 'en' | 'ar') => void;
  onReboot?: () => void;
}

export const TerminalWindow: React.FC<TerminalWindowProps> = ({ onTriggerTheater, onReboot }) => {
  const { t } = useLanguage();
  const { playClick, playError, playSpidermanTheme } = useSound();
  const mascot = useMascot();

  const [inputVal, setInputVal] = useState<string>('');
  const [history, setHistory] = useState<CommandOutput[]>([
    {
      command: 'sys.init',
      result: (
        <div className="text-green space-y-1">
          <p className="font-pixel text-xs text-yellow">{t.terminal.title}</p>
          <p>{t.terminal.welcome}</p>
          <p className="text-lavender text-[11px]">Type 'spiderman' for the 1994 theme song or 'matrix' for hacking mode!</p>
        </div>
      ),
    },
  ]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const rawCmd = inputVal.trim();
    const cmd = rawCmd.toLowerCase();
    if (!cmd) return;

    playClick();
    let result: React.ReactNode = '';

    // Handle args
    const parts = cmd.split(' ');
    const mainCmd = parts[0];
    const arg = parts[1];

    switch (mainCmd) {
      case 'help':
        result = (
          <div className="space-y-1 text-lavender font-mono text-xs">
            <p className="text-yellow">Adam OS Interactive Commands:</p>
            <p><span className="text-green">spidey</span>     - Play the Pixel Spider 8-bit theme song ♫ (original composition)</p>
            <p><span className="text-green">matrix</span> / <span className="text-green">hack</span> - Simulated hacker matrix readout</p>
            <p><span className="text-green">reboot</span>     - Reboot Adam OS to full BIOS sequence</p>
            <p><span className="text-green">wallpaper</span>  - Switch wallpaper (usage: wallpaper night-city|cyber-forest|pixel-mountains|y2k-pattern)</p>
            <p><span className="text-green">sudo</span>       - Execute command as superuser</p>
            <p><span className="text-green">sl</span> / <span className="text-green">train</span>   - ASCII Steam Locomotive train</p>
            <p><span className="text-green">bio</span> / <span className="text-green">about</span> - Print Khoumari Adam's story & background</p>
            <p><span className="text-green">projects</span>  - List engineered projects & tech readouts</p>
            <p><span className="text-green">skills</span>    - Print hardware & software skill levels</p>
            <p><span className="text-green">contact</span>   - Show direct email and phone number</p>
            <p><span className="text-green">cv</span>        - Download resume PDF via theater sequence</p>
            <p><span className="text-green">spider</span>    - Trigger Pixel Spider web swing</p>
            <p><span className="text-green">ping</span>      - Test Spidey-Sense network latency</p>
            <p><span className="text-green">cat</span>       - Read file (try: cat secret.txt)</p>
            <p><span className="text-green">clear</span>     - Clear terminal buffer</p>
          </div>
        );
        break;

      case 'spidey':
      case 'theme':
        playSpidermanTheme();
        mascot.setFrame('celebrating');
        mascot.setSpeechText('♫ Pixel Spider theme activated! Original 8-bit composition by Adam OS. ♫');
        result = (
          <div className="text-yellow font-pixel text-xs space-y-1">
            <p>♫ Playing Pixel Spider Theme (8-bit original composition) ♫</p>
            <p className="text-green text-[10px]">Notes: C4 ➔ Eb4 ➔ F4 ➔ G4 ➔ Eb4 ➔ C4</p>
          </div>
        );
        break;

      case 'matrix':
      case 'hack':
        mascot.setFrame('typing');
        mascot.setSpeechText('ACCESS GRANTED. Overriding mainframe security protocols...');
        result = (
          <div className="text-green font-mono text-[10px] space-y-0.5 animate-pulse bg-base p-2 border border-green">
            <p>OVERRIDE SEC_KEY // 0x8F9A2B4C [OK]</p>
            <p>01000001 01000100 01000001 01001101 00100000 01001111 01000011</p>
            <p>ESP32 REVERSE SHELL OPEN AT 192.168.1.100:8080</p>
            <p>ROBOTIC CAR MOTORS: PWM FULL FREQUENCY [100%]</p>
            <p className="text-yellow">SYSTEM HACK COMPLETE: YOU ARE NOW OPERATOR</p>
          </div>
        );
        break;

      case 'reboot':
        mascot.setSpeechText('Rebooting system... Stand by!');
        if (onReboot) {
          setTimeout(onReboot, 800);
        }
        result = <p className="text-yellow">Reboot sequence initiated...</p>;
        break;

      case 'wallpaper':
        if (!arg) {
          result = <p className="text-yellow">Usage: wallpaper night-city | cyber-forest | pixel-mountains | y2k-pattern</p>;
        } else if (['night-city', 'cyber-forest', 'pixel-mountains', 'y2k-pattern'].includes(arg)) {
          mascot.changeWallpaper(arg as 'night-city' | 'cyber-forest' | 'pixel-mountains' | 'y2k-pattern');
          result = <p className="text-green">Wallpaper set to {arg}!</p>;
        } else {
          result = <p className="text-red">Unknown wallpaper '{arg}'. Available: night-city, cyber-forest, pixel-mountains, y2k-pattern</p>;
        }
        break;

      case 'sudo':
        playError();
        mascot.setFrame('sleeping');
        mascot.setSpeechText('Nice try! Khoumari Adam is the only root user here.');
        result = <p className="text-red">sudo: Permission denied. Khoumari Adam is root.</p>;
        break;

      case 'sl':
      case 'train':
        result = (
          <pre className="text-yellow font-mono text-[10px] leading-tight">
{`      ====        ________ ________.       =========
  _D _|  |_______/        |        |====|_  | |_____
 |   |   |       |   ADAM |   OS   |    | | | |  |  |
 |___|___|_______|________|________|____|_|_|_|__|__|
   (o) (o)        (o)  (o) (o)  (o)     (o) (o)`}
          </pre>
        );
        break;

      case 'ping':
        result = <p className="text-green">Pinging Spidey-Sense network... 0.1ms latency (100% web coverage)</p>;
        break;

      case 'cat':
        if (arg === 'secret.txt') {
          result = (
            <div className="text-yellow font-mono text-xs space-y-1">
              <p>=== ADAM OS SECRET FORMULA ===</p>
              <p>• 40% ESP32 C++ Microcontroller Code</p>
              <p>• 40% AI Agent Workflows & Antigravity Prompts</p>
              <p>• 20% Spider-Man Nostalgia & 8-Bit Aesthetics</p>
            </div>
          );
        } else {
          result = <p className="text-red">cat: {arg || 'file'}: No such file. Try 'cat secret.txt'</p>;
        }
        break;

      case 'bio':
      case 'about':
        result = (
          <div className="text-textDim text-xs space-y-2 font-mono">
            <p><span className="text-yellow font-pixel">Khoumari Adam</span> | Embedded Systems Engineer x AI Vibe Coder</p>
            <p>• Master 1 Student at Bouira University (Graduating 2027)</p>
            <p>• Former President of Scientific Club Afaq (2025-2026)</p>
            <p>• Robotics & Arduino Instructor for kids at CLS Bouira</p>
            <p>• Builder of ESP32 smart irrigation, Rocket League robotic cars & 24/7 AI agents</p>
          </div>
        );
        break;

      case 'projects':
        result = (
          <div className="text-xs space-y-2 font-mono">
            <p className="text-yellow">[1] Smart Irrigation System (ESP32 + ML Soil Prediction)</p>
            <p className="text-yellow">[2] ESP32 Robotic Cars (Line-following & Rocket League Soccer)</p>
            <p className="text-yellow">[3] Raspberry Pi AI Server (Self-hosted Linux 24/7 Agents)</p>
            <p className="text-yellow">[4] Agentic Dev Team (Architect, Builder, Debugger, Anti-slop)</p>
            <p className="text-yellow">[5] School Management ERP (Full private school tuition & financial ERP)</p>
          </div>
        );
        break;

      case 'skills':
        result = (
          <div className="text-xs space-y-1 font-mono">
            <p>ESP32 / Embedded C++ ... [████████████] 95%</p>
            <p>Python / AI Agents ..... [██████████░░] 88%</p>
            <p>React / TypeScript ..... [██████████░░] 86%</p>
            <p>Linux / RPi VPS ........ [█████████░░░] 82%</p>
            <p>Robotics & Sensors ..... [████████████] 92%</p>
          </div>
        );
        break;

      case 'contact':
        result = (
          <div className="text-xs font-mono space-y-1">
            <p>Email: <a href="mailto:khoumariadam@gmail.com" className="text-green underline">khoumariadam@gmail.com</a></p>
            <p>Phone: <a href="tel:077628207" className="text-yellow underline">077628207</a></p>
          </div>
        );
        break;

      case 'cv':
        if (onTriggerTheater) onTriggerTheater('en');
        result = <p className="text-green">Triggering CV Download Theater sequence...</p>;
        break;

      case 'spider':
        mascot.triggerRandomInteraction();
        result = (
          <pre className="text-spidey font-mono text-[10px] leading-tight">
{`   /\\  /\\
  //\\\\//\\\\
  \\\\_  _//  THWIP! Pixel Spider active on system.
   / \\/ \\`}
          </pre>
        );
        break;

      case 'clear':
        setHistory([]);
        setInputVal('');
        return;

      default:
        playError();
        result = <p className="text-red">Command not recognized: '{cmd}'. Type 'help' for options.</p>;
        break;
    }

    setHistory((prev) => [...prev, { command: rawCmd, result }]);
    setInputVal('');
  };

  return (
    <Window id="terminal">
      <div
        className="win9x-box-recessed bg-base p-4 min-h-[320px] font-mono text-xs text-green flex flex-col justify-between cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="space-y-3 overflow-y-auto max-h-[360px] pr-2">
          {history.map((item, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center gap-2 text-lavender">
                <span className="text-green font-bold">{t.terminal.prompt}</span>
                <span>{item.command}</span>
              </div>
              <div className="pl-4">{item.result}</div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Command Input Form */}
        <form onSubmit={handleCommand} className="flex items-center gap-2 mt-4 pt-2 border-t border-slate/30">
          <span className="text-green font-bold select-none">{t.terminal.prompt}</span>
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            className="flex-1 bg-transparent text-green outline-none font-mono text-xs caret-green"
            autoFocus
          />
        </form>
      </div>
    </Window>
  );
};
