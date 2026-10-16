'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Window } from '../Window';
import { useLanguage } from '@/context/LanguageContext';
import { useSound } from '@/context/SoundContext';
import { useMascot } from '@/context/MascotContext';
import { useWindowManager } from '@/context/WindowManagerContext';
import type { SpiderFrame } from '@/components/PixelSpider';
import { APPS, AppDef, WindowId } from '@/lib/apps';
import { PROFILE } from '@/lib/profile';
import { asset } from '@/lib/asset';
import en from '@/lib/i18n/en.json';
import { PROJECTS, Project } from '@/lib/content/projects';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface TerminalWindowProps {
  onTriggerTheater?: (file: 'en' | 'ar') => void;
  onReboot?: () => void;
}

interface Entry {
  id: number;
  cwd: string;
  command: string;
  result: React.ReactNode;
}

type WallpaperName = Parameters<ReturnType<typeof useMascot>['changeWallpaper']>[0];

const WALLPAPERS: WallpaperName[] = ['night-city', 'cyber-forest', 'pixel-mountains', 'y2k-pattern'];
const isWallpaper = (s: string): s is WallpaperName => (WALLPAPERS as string[]).includes(s);

/* ------------------------------------------------------------------ */
/* Virtual filesystem                                                  */
/* ------------------------------------------------------------------ */

interface VFile {
  type: 'file';
  kind: 'text' | 'pdf' | 'secret';
  content: string;
  /** /public path (pdfs). Always rendered through asset(). */
  href?: string;
}

interface VDir {
  type: 'dir';
  children: Record<string, VNode>;
}

type VNode = VFile | VDir;

const projectMarkdown = (p: Project): string =>
  [
    `# ${p.title.en}`,
    '',
    `> ${p.tagline.en}`,
    '',
    `Stack: ${p.stack.join(' · ')}`,
    '',
    '## Why',
    p.context.en,
    '',
    '## What I built',
    ...p.built.en.map((b) => `- ${b}`),
    '',
    '## Result',
    p.outcome.en,
  ].join('\n');

const SECRET = [
  '=== ADAM OS SECRET FORMULA ===',
  '• 40% ESP32 C++ Microcontroller Code',
  '• 40% AI Agent Workflows & Antigravity Prompts',
  '• 20% Spider-Man Nostalgia & 8-Bit Aesthetics',
].join('\n');

const textFile = (content: string, kind: VFile['kind'] = 'text'): VFile => ({ type: 'file', kind, content });
const pdfFile = (href: string): VFile => ({ type: 'file', kind: 'pdf', content: '', href });

const FS: VDir = {
  type: 'dir',
  children: {
    projects: {
      type: 'dir',
      children: Object.fromEntries(PROJECTS.map((p) => [`${p.id}.md`, textFile(projectMarkdown(p))])),
    },
    docs: {
      type: 'dir',
      children: {
        'resume_en.pdf': pdfFile(PROFILE.resumes.en.path),
        'resume_ar.pdf': pdfFile(PROFILE.resumes.ar.path),
      },
    },
    'about.txt': textFile(`${en.about.name} — ${en.about.role}\n\n${en.about.p1}\n\n${en.about.p2}`),
    'secret.txt': textFile(SECRET, 'secret'),
  },
};

const HOME = '/home/adam';

/** Resolves a user path (relative, ~, ~/x, /home/adam/x, .., .) to segments under home. */
const resolvePath = (cwd: string[], input: string): string[] => {
  let rest = input.trim();
  let base: string[] = cwd;
  if (rest === '~' || rest.startsWith('~/')) {
    base = [];
    rest = rest.slice(1);
  } else if (rest === HOME || rest.startsWith(`${HOME}/`)) {
    base = [];
    rest = rest.slice(HOME.length);
  } else if (rest.startsWith('/')) {
    base = [];
  }
  const out = [...base];
  for (const seg of rest.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      out.pop();
      continue;
    }
    out.push(seg);
  }
  return out;
};

const getNode = (path: string[]): VNode | null => {
  let node: VNode = FS;
  for (const seg of path) {
    if (node.type !== 'dir') return null;
    const next: VNode | undefined = node.children[seg];
    if (!next) return null;
    node = next;
  }
  return node;
};

const fmtPath = (path: string[]): string => (path.length ? `~/${path.join('/')}` : '~');

const treeLines = (dir: VDir, prefix = ''): string[] => {
  const entries = Object.entries(dir.children);
  return entries.flatMap(([name, child], i) => {
    const last = i === entries.length - 1;
    const line = `${prefix}${last ? '└── ' : '├── '}${name}${child.type === 'dir' ? '/' : ''}`;
    return child.type === 'dir' ? [line, ...treeLines(child, prefix + (last ? '    ' : '│   '))] : [line];
  });
};

/* ------------------------------------------------------------------ */
/* Commands metadata                                                   */
/* ------------------------------------------------------------------ */

type HelpGroup = 'Portfolio' | 'System' | 'Fun';
const HELP_GROUPS: HelpGroup[] = ['Portfolio', 'System', 'Fun'];

const HELP: { group: HelpGroup; usage: string; desc: string }[] = [
  { group: 'Portfolio', usage: 'about', desc: "Khoumari Adam's story & background" },
  { group: 'Portfolio', usage: 'projects', desc: 'List engineered projects' },
  { group: 'Portfolio', usage: 'skills', desc: 'Hardware & software skill levels' },
  { group: 'Portfolio', usage: 'neofetch', desc: 'System info, Adam edition' },
  { group: 'Portfolio', usage: 'apps', desc: 'List every installed app' },
  { group: 'Portfolio', usage: 'open <app>', desc: 'Open an app window (alias: start)' },
  { group: 'Portfolio', usage: 'contact', desc: 'Email & GitHub (alias: email)' },
  { group: 'Portfolio', usage: 'github', desc: 'Open GitHub profile in a new tab' },
  { group: 'Portfolio', usage: 'cv [en|ar]', desc: 'Download résumé PDF via theater sequence' },
  { group: 'Portfolio', usage: 'resume', desc: 'Plain, printable résumé page' },
  { group: 'System', usage: 'ls [dir]', desc: 'List directory contents' },
  { group: 'System', usage: 'cd <dir>', desc: 'Change directory' },
  { group: 'System', usage: 'pwd', desc: 'Print working directory' },
  { group: 'System', usage: 'cat <file>', desc: 'Print a file' },
  { group: 'System', usage: 'tree', desc: 'Show the directory tree' },
  { group: 'System', usage: 'whoami', desc: 'Who is logged in' },
  { group: 'System', usage: 'date', desc: 'Current date & time' },
  { group: 'System', usage: 'echo <text>', desc: 'Print text' },
  { group: 'System', usage: 'history', desc: 'Command history' },
  { group: 'System', usage: 'wallpaper <name>', desc: 'Switch desktop wallpaper' },
  { group: 'System', usage: 'reboot', desc: 'Reboot Adam OS (full BIOS sequence)' },
  { group: 'System', usage: 'clear', desc: 'Clear the screen (Ctrl+L)' },
  { group: 'Fun', usage: 'spidey', desc: 'Play the Pixel Spider 8-bit theme ♫' },
  { group: 'Fun', usage: 'spider', desc: 'Trigger a Pixel Spider web swing' },
  { group: 'Fun', usage: 'matrix', desc: 'Simulated hacker readout (alias: hack)' },
  { group: 'Fun', usage: 'sl', desc: 'ASCII steam locomotive (alias: train)' },
  { group: 'Fun', usage: 'ping', desc: 'Test Spidey-Sense latency' },
  { group: 'Fun', usage: 'coffee', desc: 'Brew a fresh cup' },
  { group: 'Fun', usage: 'sudo <cmd>', desc: 'Become root. Good luck.' },
  { group: 'Fun', usage: 'exit', desc: 'Try to leave' },
];

const COMMAND_NAMES: string[] = [
  'help', 'about', 'bio', 'projects', 'skills', 'neofetch', 'apps', 'open', 'start', 'contact', 'email',
  'github', 'cv', 'resume', 'ls', 'cd', 'pwd', 'cat', 'tree', 'whoami', 'date', 'echo', 'history',
  'wallpaper', 'reboot', 'clear', 'spidey', 'theme', 'spider', 'matrix', 'hack', 'sl', 'train', 'ping',
  'coffee', 'sudo', 'exit',
];

const normApp = (s: string): string => s.toLowerCase().replace(/\.exe$/, '');
const findApp = (query: string): AppDef | undefined => {
  const q = normApp(query);
  return APPS.find((a) => a.id === q || normApp(a.title) === q);
};

const levenshtein = (a: string, b: string): number => {
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
};

const suggest = (input: string): string | null => {
  let best: string | null = null;
  let bestDist = 3;
  for (const name of COMMAND_NAMES) {
    const d = levenshtein(input, name);
    if (d < bestDist) {
      best = name;
      bestDist = d;
    }
  }
  return bestDist <= 2 ? best : null;
};

const commonPrefix = (items: string[]): string => {
  if (!items.length) return '';
  let prefix = items[0];
  for (const item of items.slice(1)) {
    while (!item.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
};

const formatUptime = (ms: number): string => {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h ? `${h} hour${h === 1 ? '' : 's'}` : '', `${m} min${m === 1 ? '' : 's'}`, `${s} sec${s === 1 ? '' : 's'}`]
    .filter(Boolean)
    .join(', ');
};

const mailto = (subject?: string): string =>
  `mailto:${PROFILE.email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;

/* ------------------------------------------------------------------ */
/* ASCII art                                                           */
/* ------------------------------------------------------------------ */

const SPIDER_LOGO = String.raw`   \  \  ||  /  /
    \  \ || /  /
  ___\__(oo)__/___
     /  /()\  \
    /  / || \  \
   /  /  ||  \  \

    A D A M  O S
        98`;

const SPIDER_SWING = String.raw`   /\  /\
  //\\//\\
  \\_  _//  THWIP! Pixel Spider active on system.
   / \/ \ `;

const TRAIN = String.raw`      ====        ________ ________.       =========
  _D _|  |_______/        |        |====|_  | |_____
 |   |   |       |   ADAM |   OS   |    | | | |  |  |
 |___|___|_______|________|________|____|_|_|_|__|__|
   (o) (o)        (o)  (o) (o)  (o)     (o) (o)`;

const COFFEE = String.raw`      ( (
       ) )
    ........
    |      |]
    \      /
     '----'
  coffee.exe: brewed 1 cup of hot Java.
  (ESP32 firmware compiles 12% faster now.)`;

const ACCESS_BANNER = String.raw`╔══════════════════════════════════════╗
║   ACCESS GRANTED  ::  uid=0(hire)    ║
╚══════════════════════════════════════╝`;

/* ------------------------------------------------------------------ */
/* Small output components                                             */
/* ------------------------------------------------------------------ */

const HireAdam: React.FC = () => {
  const [pct, setPct] = useState<number>(0);

  useEffect(() => {
    if (pct >= 100) return;
    const timer = window.setTimeout(() => setPct((p) => Math.min(100, p + 7)), 70);
    return () => window.clearTimeout(timer);
  }, [pct]);

  const filled = Math.round(pct / 5);
  const bar = `${'█'.repeat(filled)}${'░'.repeat(20 - filled)}`;

  return (
    <div className="space-y-1">
      <pre className="text-green leading-tight">{ACCESS_BANNER}</pre>
      <p className="text-lavender">[sudo] password for recruiter: ********</p>
      <p className={pct < 100 ? 'text-yellow animate-pulse' : 'text-yellow'}>
        ACCESS GRANTED — offer letter compiling... [{bar}] {pct}%
      </p>
      {pct >= 100 && (
        <div className="space-y-1">
          <p className="text-green">✔ offer_letter.pdf compiled with 0 warnings.</p>
          <p>
            Final step:{' '}
            <a href={mailto("Let's work together")} className="text-yellow underline">
              email {PROFILE.email} — &quot;Let&apos;s work together&quot;
            </a>
          </p>
        </div>
      )}
    </div>
  );
};

const Prompt: React.FC<{ cwd: string }> = ({ cwd }) => (
  <span className="font-bold whitespace-nowrap select-none">
    <span className="text-green">adam@os</span>
    <span className="text-lavender">:</span>
    <span className="text-yellow">{cwd}</span>
    <span className="text-lavender">$</span>
  </span>
);

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export const TerminalWindow: React.FC<TerminalWindowProps> = ({ onTriggerTheater, onReboot }) => {
  const { t } = useLanguage();
  const { playClick, playError, playSpidermanTheme } = useSound();
  const mascot = useMascot();
  const { openWindow } = useWindowManager();

  const nextId = useRef<number>(1);
  const mountedAt = useRef<number>(Date.now());
  const inputRef = useRef<HTMLInputElement | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);

  const [input, setInput] = useState<string>('');
  const [cwd, setCwd] = useState<string[]>([]);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<string>('');
  const [entries, setEntries] = useState<Entry[]>([
    {
      id: 0,
      cwd: '~',
      command: 'sys.init',
      result: (
        <div className="text-green space-y-1">
          <p className="font-pixel text-xs text-yellow">{t.terminal.title}</p>
          <p className="whitespace-pre-line">{t.terminal.welcome}</p>
          <p className="text-lavender">
            Try <span className="text-green">neofetch</span>, <span className="text-green">ls</span>,{' '}
            <span className="text-green">open projects</span> or <span className="text-green">sudo hire-adam</span>. Tab
            completes, ↑/↓ recalls.
          </p>
        </div>
      ),
    },
  ]);

  // Auto-focus whenever the input mounts (i.e. whenever the window opens).
  const setInputRef = useCallback((node: HTMLInputElement | null) => {
    inputRef.current = node;
    node?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const el = outputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);

  const pushEntry = (command: string, result: React.ReactNode, at: string = fmtPath(cwd)) => {
    const id = nextId.current++;
    setEntries((prev) => [...prev, { id, cwd: at, command, result }]);
  };

  const mascotMoment = (frame: SpiderFrame, text: string, ms = 2000) => {
    mascot.setFrame(frame);
    mascot.setSpeechText(text);
    window.setTimeout(() => mascot.setFrame('idle'), ms);
  };

  const clearScreen = () => setEntries([]);

  /* ---------------------------- command runner ---------------------------- */

  const run = (raw: string, history: string[]): React.ReactNode => {
    const tokens = raw.split(/\s+/);
    const name = tokens[0].toLowerCase();
    const args = tokens.slice(1);
    const arg = args[0]?.toLowerCase() ?? '';
    const rest = raw.slice(tokens[0].length).trim();

    switch (name) {
      case 'help':
        return (
          <div className="space-y-2">
            {HELP_GROUPS.map((group) => (
              <div key={group}>
                <p className="text-yellow">{group}</p>
                <div className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-0.5 pl-2">
                  {HELP.filter((h) => h.group === group).map((h) => (
                    <React.Fragment key={h.usage}>
                      <span className="text-green">{h.usage}</span>
                      <span className="text-lavender">{h.desc}</span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-lavender/70">Tip: ↑/↓ history · Tab completes · Ctrl+L clears</p>
          </div>
        );

      /* ------------------------------ portfolio ----------------------------- */

      case 'bio':
      case 'about':
        return (
          <div className="text-textDim space-y-1">
            <p>
              <span className="text-yellow font-pixel">{PROFILE.name}</span> | {PROFILE.role}
            </p>
            <p>• Master 1 Student in Embedded Systems at Bouira University (Graduating 2027)</p>
            <p>• Former President of Scientific Club Afaq (2025-2026)</p>
            <p>• Robotics & Arduino Instructor for kids at CLS Bouira</p>
            <p>• Builder of ESP32 smart irrigation, Rocket League robotic cars & 24/7 AI agents</p>
            <p className="text-lavender">More: cat about.txt · open about</p>
          </div>
        );

      case 'projects':
        return (
          <div className="space-y-1">
            {PROJECTS.map((p, i) => (
              <p key={p.id}>
                <span className="text-yellow">[{i + 1}] {p.title.en}</span>{' '}
                <span className="text-lavender">— {p.tagline.en}</span>
              </p>
            ))}
            <p className="text-lavender">Read one: cat ~/projects/&lt;file&gt;.md · or: open projects</p>
          </div>
        );

      case 'skills':
        return (
          <div className="space-y-0.5 whitespace-pre">
            <p>ESP32 / Embedded C++ ... [████████████] 95%</p>
            <p>Python / AI Agents ..... [██████████░░] 88%</p>
            <p>React / TypeScript ..... [██████████░░] 86%</p>
            <p>Linux / RPi VPS ........ [█████████░░░] 82%</p>
            <p>Robotics & Sensors ..... [████████████] 92%</p>
          </div>
        );

      case 'neofetch': {
        const info: [string, React.ReactNode][] = [
          ['OS', 'Adam OS 98'],
          ['Host', 'Bouira University — M1 Embedded Systems'],
          ['Kernel', 'ESP32-WROOM-32'],
          ['Shell', 'adamsh'],
          ['Uptime', formatUptime(Date.now() - mountedAt.current)],
          ['Packages', `${APPS.length} apps`],
          ['Stack', 'C/C++, Python, TypeScript'],
          [
            'Contact',
            <a key="mail" href={mailto()} className="text-green underline">
              {PROFILE.email}
            </a>,
          ],
        ];
        const swatches = ['bg-base', 'bg-red', 'bg-green', 'bg-yellow', 'bg-spidey', 'bg-lavender', 'bg-textDim', 'bg-panel'];
        return (
          <div className="flex flex-col sm:flex-row gap-4">
            <pre className="text-spidey leading-tight [text-shadow:0_0_6px_#212CF4]">{SPIDER_LOGO}</pre>
            <div className="space-y-0.5">
              <p>
                <span className="text-green font-bold">adam</span>
                <span className="text-lavender">@</span>
                <span className="text-green font-bold">os</span>
              </p>
              <p className="text-lavender">-------------</p>
              {info.map(([label, value]) => (
                <p key={label}>
                  <span className="text-yellow font-bold">{label}</span>
                  <span className="text-lavender">: </span>
                  <span className="text-textDim">{value}</span>
                </p>
              ))}
              <div className="flex pt-2">
                {swatches.map((c) => (
                  <span key={c} className={`${c} w-5 h-3 border border-slate/40`} />
                ))}
              </div>
            </div>
          </div>
        );
      }

      case 'apps':
        return (
          <div className="grid grid-cols-[7rem_10rem_1fr] gap-x-3 gap-y-0.5">
            <span className="text-yellow">ID</span>
            <span className="text-yellow">TITLE</span>
            <span className="text-yellow">GROUP</span>
            {APPS.map((a) => (
              <React.Fragment key={a.id}>
                <span className="text-green">{a.id}</span>
                <span className="text-textDim">{a.title}</span>
                <span className="text-lavender">{a.group}</span>
              </React.Fragment>
            ))}
            <span className="col-span-3 text-lavender pt-1">Usage: open &lt;id|title&gt;</span>
          </div>
        );

      case 'open':
      case 'start': {
        if (!rest) {
          return <p className="text-yellow">Usage: {name} &lt;app&gt; — type &apos;apps&apos; to list them.</p>;
        }
        const app = findApp(rest);
        if (!app) {
          playError();
          return (
            <p className="text-red">
              {name}: no such app &apos;{rest}&apos;. Type &apos;apps&apos; to list them.
            </p>
          );
        }
        const id: WindowId = app.id;
        openWindow(id);
        return <p className="text-green">Launching {app.title}...</p>;
      }

      case 'email':
      case 'contact':
        return (
          <div className="space-y-0.5">
            <p>
              <span className="text-yellow">Email </span>
              <a href={mailto()} className="text-green underline">
                {PROFILE.email}
              </a>
            </p>
            {PROFILE.github && (
              <p>
                <span className="text-yellow">GitHub </span>
                <a href={PROFILE.github} target="_blank" rel="noopener noreferrer" className="text-green underline">
                  {PROFILE.github.replace(/^https?:\/\//, '')}
                </a>
              </p>
            )}
            <p>
              <span className="text-yellow">Where </span>
              <span className="text-textDim">{PROFILE.location}</span>
            </p>
          </div>
        );

      case 'github':
        if (!PROFILE.github) return <p className="text-yellow">github: no profile configured.</p>;
        window.open(PROFILE.github, '_blank', 'noopener,noreferrer');
        return (
          <p>
            Opening{' '}
            <a href={PROFILE.github} target="_blank" rel="noopener noreferrer" className="text-green underline">
              {PROFILE.github}
            </a>{' '}
            in a new tab...
          </p>
        );

      case 'cv': {
        if (arg && arg !== 'en' && arg !== 'ar') {
          return <p className="text-yellow">Usage: cv [en|ar]</p>;
        }
        const lang: 'en' | 'ar' = arg === 'ar' ? 'ar' : 'en';
        onTriggerTheater?.(lang);
        return <p className="text-green">Triggering CV download theater sequence ({lang.toUpperCase()})...</p>;
      }

      case 'resume':
        return (
          <div className="space-y-0.5">
            <p>
              Plain, printable résumé page:{' '}
              <a href={asset('/resume')} target="_blank" rel="noopener noreferrer" className="text-green underline">
                /resume
              </a>
            </p>
            <p className="text-lavender">PDFs: cv en · cv ar · or: open downloads</p>
          </div>
        );

      /* ------------------------------- system ------------------------------- */

      case 'pwd':
        return <p>{cwd.length ? `${HOME}/${cwd.join('/')}` : HOME}</p>;

      case 'ls': {
        const target = resolvePath(cwd, arg || '.');
        const node = getNode(target);
        if (!node) return <p className="text-red">ls: cannot access &apos;{arg}&apos;: No such file or directory</p>;
        if (node.type === 'file') return <p>{target[target.length - 1]}</p>;
        const names = Object.entries(node.children);
        if (!names.length) return null;
        return (
          <div className="flex flex-wrap gap-x-5 gap-y-0.5">
            {names.map(([n, child]) => (
              <span
                key={n}
                className={child.type === 'dir' ? 'text-yellow font-bold' : child.kind === 'pdf' ? 'text-lavender' : 'text-green'}
              >
                {n}
                {child.type === 'dir' ? '/' : ''}
              </span>
            ))}
          </div>
        );
      }

      case 'cd': {
        const target = resolvePath(cwd, arg || '~');
        const node = getNode(target);
        if (!node) return <p className="text-red">cd: {arg}: No such file or directory</p>;
        if (node.type !== 'dir') return <p className="text-red">cd: {arg}: Not a directory</p>;
        setCwd(target);
        return null;
      }

      case 'cat': {
        if (!arg) return <p className="text-yellow">Usage: cat &lt;file&gt; — try &apos;ls&apos; or &apos;cat secret.txt&apos;</p>;
        const node = getNode(resolvePath(cwd, arg));
        if (!node) return <p className="text-red">cat: {arg}: No such file or directory</p>;
        if (node.type === 'dir') return <p className="text-red">cat: {arg}: Is a directory</p>;
        if (node.kind === 'pdf') {
          return (
            <div className="space-y-0.5">
              <p className="text-yellow">cat: {arg}: binary PDF — that would print a lot of garbage.</p>
              <p className="text-lavender">
                Use <span className="text-green">cv {arg.includes('_ar') ? 'ar' : 'en'}</span> or{' '}
                <span className="text-green">open downloads</span> instead, or{' '}
                <a href={asset(node.href ?? '')} target="_blank" rel="noopener noreferrer" className="text-green underline">
                  view it directly
                </a>
                .
              </p>
            </div>
          );
        }
        return (
          <pre className={`whitespace-pre-wrap break-words ${node.kind === 'secret' ? 'text-yellow' : 'text-textDim'}`}>
            {node.content}
          </pre>
        );
      }

      case 'tree': {
        const target = resolvePath(cwd, arg || '.');
        const node = getNode(target);
        if (!node || node.type !== 'dir') return <p className="text-red">tree: {arg}: not a directory</p>;
        return <pre className="leading-tight text-textDim">{[fmtPath(target), ...treeLines(node)].join('\n')}</pre>;
      }

      case 'whoami':
        return (
          <div>
            <p>adam</p>
            <p className="text-lavender">
              {PROFILE.name} — {PROFILE.role}
            </p>
          </div>
        );

      case 'date':
        return <p>{new Date().toString()}</p>;

      case 'echo':
        return <p className="whitespace-pre-wrap break-words">{rest}</p>;

      case 'history':
        return (
          <div className="grid grid-cols-[3rem_1fr]">
            {history.map((h, i) => (
              <React.Fragment key={i}>
                <span className="text-lavender text-right pr-3">{i + 1}</span>
                <span>{h}</span>
              </React.Fragment>
            ))}
          </div>
        );

      case 'wallpaper':
        if (!arg) return <p className="text-yellow">Usage: wallpaper {WALLPAPERS.join(' | ')}</p>;
        if (isWallpaper(arg)) {
          mascot.changeWallpaper(arg);
          return <p className="text-green">Wallpaper set to {arg}!</p>;
        }
        return (
          <p className="text-red">
            Unknown wallpaper &apos;{arg}&apos;. Available: {WALLPAPERS.join(', ')}
          </p>
        );

      case 'reboot':
        mascot.setSpeechText('Rebooting system... Stand by!');
        if (onReboot) window.setTimeout(onReboot, 800);
        return <p className="text-yellow">Reboot sequence initiated...</p>;

      /* -------------------------------- fun -------------------------------- */

      case 'spidey':
      case 'theme':
        playSpidermanTheme();
        mascotMoment('celebrating', '♫ Pixel Spider theme activated! Original 8-bit composition by Adam OS. ♫', 3000);
        return (
          <div className="text-yellow font-pixel space-y-1">
            <p>♫ Playing Pixel Spider Theme (8-bit original composition) ♫</p>
            <p className="text-green text-[10px]">Notes: C4 ➔ Eb4 ➔ F4 ➔ G4 ➔ Eb4 ➔ C4</p>
          </div>
        );

      case 'spider':
        mascot.triggerRandomInteraction();
        return <pre className="text-spidey leading-tight">{SPIDER_SWING}</pre>;

      case 'matrix':
      case 'hack':
        mascotMoment('typing', 'ACCESS GRANTED. Overriding mainframe security protocols...', 2500);
        return (
          <div className="text-green text-[10px] space-y-0.5 animate-pulse bg-base p-2 border border-green">
            <p>OVERRIDE SEC_KEY // 0x8F9A2B4C [OK]</p>
            <p>01000001 01000100 01000001 01001101 00100000 01001111 01010011</p>
            <p>ESP32 REVERSE SHELL OPEN AT 192.168.1.100:8080</p>
            <p>ROBOTIC CAR MOTORS: PWM FULL FREQUENCY [100%]</p>
            <p className="text-yellow">SYSTEM HACK COMPLETE: YOU ARE NOW OPERATOR</p>
          </div>
        );

      case 'sl':
      case 'train':
        return <pre className="text-yellow text-[10px] leading-tight">{TRAIN}</pre>;

      case 'ping':
        return <p>Pinging Spidey-Sense network... 0.1ms latency (100% web coverage)</p>;

      case 'coffee':
        return <pre className="text-yellow leading-tight">{COFFEE}</pre>;

      case 'sudo':
        if (arg === 'hire-adam') {
          mascotMoment('celebrating', 'ROOT ACCESS GRANTED! Best decision you made today.', 3000);
          return <HireAdam />;
        }
        playError();
        mascotMoment('sleeping', 'Nice try! Khoumari Adam is the only root user here.', 2000);
        if (!arg) return <p className="text-yellow">usage: sudo &lt;command&gt; (hint: sudo hire-adam)</p>;
        return <p className="text-red">adam is not in the sudoers file. This incident will be reported 🕷</p>;

      case 'exit':
        mascotMoment('waving', "Leaving already? I'll keep the terminal warm.", 2000);
        return (
          <p className="text-yellow">
            logout: nice try. Adam OS has no exit — only the ✕ button and a strongly worded{' '}
            <span className="text-green">sudo hire-adam</span>.
          </p>
        );

      default: {
        playError();
        const guess = suggest(name);
        return (
          <div>
            <p className="text-red">adamsh: command not found: {tokens[0]}</p>
            {guess ? (
              <p className="text-lavender">
                did you mean <span className="text-green">{guess}</span>?
              </p>
            ) : (
              <p className="text-lavender">Type &apos;help&apos; for options.</p>
            )}
          </div>
        );
      }
    }
  };

  /* ------------------------------ input handlers ----------------------------- */

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = input.trim();
    setInput('');
    setHistIdx(null);
    setDraft('');
    if (!raw) {
      pushEntry('', null);
      return;
    }

    playClick();
    const nextHistory = cmdHistory[cmdHistory.length - 1] === raw ? cmdHistory : [...cmdHistory, raw];
    setCmdHistory(nextHistory);

    if (raw.split(/\s+/)[0].toLowerCase() === 'clear') {
      clearScreen();
      return;
    }
    const at = fmtPath(cwd);
    pushEntry(raw, run(raw, nextHistory), at);
  };

  const argCandidates = (cmd: string, current: string): string[] => {
    const lower = current.toLowerCase();
    const starts = (list: string[]) => list.filter((c) => c.startsWith(lower));
    switch (cmd) {
      case 'open':
      case 'start':
        return starts(APPS.map((a) => a.id));
      case 'wallpaper':
        return starts(WALLPAPERS);
      case 'cv':
        return starts(['en', 'ar']);
      case 'sudo':
        return starts(['hire-adam']);
      case 'ls':
      case 'cd':
      case 'cat':
      case 'tree': {
        const slash = lower.lastIndexOf('/');
        const dirPart = slash >= 0 ? lower.slice(0, slash + 1) : '';
        const prefix = lower.slice(slash + 1);
        const dirNode = getNode(resolvePath(cwd, dirPart || '.'));
        if (!dirNode || dirNode.type !== 'dir') return [];
        const dirsOnly = cmd !== 'cat' && cmd !== 'ls';
        return Object.entries(dirNode.children)
          .filter(([n, child]) => n.startsWith(prefix) && (!dirsOnly || child.type === 'dir'))
          .map(([n, child]) => `${dirPart}${n}${child.type === 'dir' ? '/' : ''}`);
      }
      default:
        return [];
    }
  };

  const complete = () => {
    const match = input.match(/^(.*\s)?(\S*)$/);
    if (!match) return;
    const head = match[1] ?? '';
    const current = match[2] ?? '';
    const isCommand = head.trim() === '';
    if (isCommand && !current) return;

    const candidates = isCommand
      ? COMMAND_NAMES.filter((n) => n.startsWith(current.toLowerCase()))
      : argCandidates(head.trim().split(/\s+/)[0].toLowerCase(), current);

    if (!candidates.length) return;
    if (candidates.length === 1) {
      const only = candidates[0];
      setInput(`${head}${only}${only.endsWith('/') ? '' : ' '}`);
      return;
    }
    const prefix = commonPrefix(candidates);
    if (prefix.length > current.length) {
      setInput(`${head}${prefix}`);
      return;
    }
    pushEntry(
      input,
      <div className="flex flex-wrap gap-x-5 text-lavender">
        {candidates.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      // Keep the window's focus trap from stealing Tab.
      e.preventDefault();
      e.stopPropagation();
      complete();
      return;
    }
    if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault();
      clearScreen();
      return;
    }
    if (e.key === 'ArrowUp') {
      if (!cmdHistory.length) return;
      e.preventDefault();
      if (histIdx === null) setDraft(input);
      const idx = histIdx === null ? cmdHistory.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(idx);
      setInput(cmdHistory[idx]);
      return;
    }
    if (e.key === 'ArrowDown') {
      if (histIdx === null) return;
      e.preventDefault();
      const idx = histIdx + 1;
      if (idx >= cmdHistory.length) {
        setHistIdx(null);
        setInput(draft);
      } else {
        setHistIdx(idx);
        setInput(cmdHistory[idx]);
      }
    }
  };

  const focusInput = (e: React.MouseEvent) => {
    // Don't steal focus while the user is selecting text to copy, or clicking a link.
    if ((e.target as HTMLElement).closest('a')) return;
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;
    inputRef.current?.focus({ preventScroll: true });
  };

  return (
    <Window id="terminal">
      <div
        className="theme-dark win9x-box-recessed bg-base p-4 min-h-[320px] h-full font-mono text-xs text-green flex flex-col justify-between cursor-text"
        onClick={focusInput}
      >
        <div ref={outputRef} className="space-y-3 overflow-y-auto max-h-[360px] pr-2 select-text" aria-live="polite">
          {entries.map((item) => (
            <div key={item.id} className="space-y-1">
              <div className="flex items-start gap-2 text-lavender">
                <Prompt cwd={item.cwd} />
                <span className="break-all">{item.command}</span>
              </div>
              {item.result !== null && item.result !== undefined && <div className="pl-4">{item.result}</div>}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-4 pt-2 border-t border-slate/30">
          <Prompt cwd={fmtPath(cwd)} />
          <input
            ref={setInputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setHistIdx(null);
            }}
            onKeyDown={handleKeyDown}
            aria-label="Terminal command input"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="flex-1 min-w-0 bg-transparent text-green outline-none font-mono text-xs caret-green select-text"
          />
        </form>
      </div>
    </Window>
  );
};
