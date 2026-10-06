'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Window } from '../Window';
import { useSound } from '@/context/SoundContext';
import { useMascot } from '@/context/MascotContext';
import { useLanguage } from '@/context/LanguageContext';
import { asset } from '@/lib/asset';

// ---------------------------------------------------------------------------
// Lab.exe: a SIMULATED telemetry dashboard of Adam's ESP32 smart irrigation
// system. Every number here is generated in the browser. It is not a live device.
// ---------------------------------------------------------------------------

type Tab = 'dash' | 'wiring' | 'video';

const HISTORY = 40;
const MAX_LOG = 60;
const TICK_MS = 1000;
const MASCOT_COOLDOWN_MS = 20000;

const STR = {
  en: {
    badge: 'SIMULATED FEED · demo data, not a live device',
    tabDash: 'Dashboard',
    tabWiring: 'Wiring',
    tabVideo: 'Video',
    uptime: 'uptime',
    soil: 'Soil moisture',
    temp: 'Air temp',
    hum: 'Humidity',
    pump: 'Pump',
    on: 'ON',
    off: 'OFF',
    pause: 'Pause',
    resume: 'Resume',
    force: 'Force water',
    threshold: 'Water below',
    serial: 'Serial monitor · 115200 baud',
    wiringNote:
      'Capacitive soil probe on an ADC1 pin (GPIO34, input-only), DHT22 on GPIO4, pump relay on GPIO26. Many relay boards want 5V on VCC: use VIN if yours does.',
    videoMissing: 'No build video yet.',
    videoHint: 'Drop a build video at public/lab/demo.mp4',
    videoCaption: 'Real build footage of the irrigation rig.',
    mascotPump: 'Soil is dry, pump ON! (simulated)',
    paused: 'PAUSED',
  },
  ar: {
    badge: 'بث محاكى · بيانات تجريبية وليست جهازًا حقيقيًا',
    tabDash: 'لوحة القياس',
    tabWiring: 'التوصيلات',
    tabVideo: 'فيديو',
    uptime: 'مدة التشغيل',
    soil: 'رطوبة التربة',
    temp: 'حرارة الهواء',
    hum: 'رطوبة الجو',
    pump: 'المضخة',
    on: 'تعمل',
    off: 'متوقفة',
    pause: 'إيقاف مؤقت',
    resume: 'استئناف',
    force: 'ري يدوي',
    threshold: 'الري تحت',
    serial: 'المراقب التسلسلي · 115200 baud',
    wiringNote:
      'حساس التربة السعوي على منفذ ADC1 ‏(GPIO34، إدخال فقط)، وDHT22 على GPIO4، ومرحّل المضخة على GPIO26. كثير من لوحات المرحّل تحتاج 5 فولت على VCC، فاستخدم VIN عند الحاجة.',
    videoMissing: 'لا يوجد فيديو للمشروع بعد.',
    videoHint: 'ضع فيديو المشروع في public/lab/demo.mp4',
    videoCaption: 'لقطات حقيقية لبناء نظام الري.',
    mascotPump: 'التربة جافة، المضخة تعمل! (محاكاة)',
    paused: 'متوقف',
  },
} as const;

interface Sim {
  moisture: number;
  temp: number;
  hum: number;
  pump: boolean;
  target: number;
  uptime: number;
  rssi: number;
  tick: number;
  hist: { moisture: number[]; temp: number[]; hum: number[] };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const pad = (n: number) => String(n).padStart(2, '0');
const clock = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const fmtUptime = (s: number) => {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d}d ${pad(h)}:${pad(m)}:${pad(s % 60)}`;
};

const initialSim = (): Sim => {
  const moisture = rand(42, 52);
  const temp = rand(24, 29);
  const hum = rand(45, 58);
  // Seed a plausible history so the sparklines are not empty on open.
  const hist = { moisture: [] as number[], temp: [] as number[], hum: [] as number[] };
  let m = moisture + HISTORY * 0.45;
  let t = temp;
  let h = hum;
  for (let i = 0; i < HISTORY; i++) {
    m -= rand(0.3, 0.6);
    t = clamp(t + rand(-0.25, 0.25), 18, 38);
    h = clamp(h + rand(-0.6, 0.6), 30, 80);
    hist.moisture.push(m);
    hist.temp.push(t);
    hist.hum.push(h);
  }
  return {
    moisture: m,
    temp: t,
    hum: h,
    pump: false,
    target: 70,
    uptime: Math.floor(rand(2 * 3600, 40 * 3600)),
    rssi: -Math.round(rand(58, 66)),
    tick: 0,
    hist,
  };
};

// ---------------------------------------------------------------------------
// Pixel-style stepped sparkline
// ---------------------------------------------------------------------------
const Sparkline: React.FC<{
  data: number[];
  min: number;
  max: number;
  color: string;
  marker?: number;
}> = ({ data, min, max, color, marker }) => {
  const W = 120;
  const H = 32;
  const step = W / (HISTORY - 1);
  const y = (v: number) => Math.round(H - 2 - ((clamp(v, min, max) - min) / (max - min)) * (H - 4));
  let d = '';
  data.forEach((v, i) => {
    const x = Math.round(i * step);
    const yy = y(v);
    d += i === 0 ? `M${x} ${yy}` : ` H${x} V${yy}`;
  });
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-8 bg-base border border-slate/40"
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="#B0B3BC" strokeOpacity={0.12} strokeWidth={1} />
      ))}
      {marker !== undefined && (
        <line x1={0} x2={W} y1={y(marker)} y2={y(marker)} stroke="#FFE55C" strokeDasharray="3 3" strokeWidth={1} />
      )}
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Wiring diagram
// ---------------------------------------------------------------------------
const WiringDiagram: React.FC = () => {
  const espPins = [
    { label: '3V3', y: 40, color: '#FF3A66' },
    { label: 'GND', y: 70, color: '#B0B3BC' },
    { label: 'GPIO34', y: 110, color: '#72FFB4' },
    { label: 'GPIO4', y: 140, color: '#FFE55C' },
    { label: 'GPIO26', y: 180, color: '#C3C6ED' },
  ];
  const modules = [
    { name: 'SOIL (cap.)', y: 20, h: 60, pins: [['VCC', 35], ['GND', 50], ['AOUT', 65]] as [string, number][] },
    { name: 'DHT22', y: 90, h: 60, pins: [['VCC', 105], ['DATA', 120], ['GND', 135]] as [string, number][] },
    { name: 'RELAY', y: 160, h: 56, pins: [['VCC', 172], ['GND', 187], ['IN', 202]] as [string, number][] },
  ];
  const vcc = 150;
  const gnd = 170;
  const wire = { fill: 'none', strokeWidth: 3, strokeLinecap: 'square' as const };
  const dot = (x: number, yy: number, c: string) => <rect x={x - 3} y={yy - 3} width={6} height={6} fill={c} />;

  return (
    <svg
      viewBox="0 0 360 225"
      className="w-full max-w-[560px] mx-auto h-auto"
      shapeRendering="crispEdges"
      role="img"
      aria-label="ESP32 wiring: GPIO34 to soil sensor AOUT, GPIO4 to DHT22 data, GPIO26 to relay IN, 3V3 and GND to all modules"
      fontFamily='"PixelAE","Press Start 2P",monospace'
    >
      {/* ESP32 board */}
      <rect x={10} y={20} width={100} height={185} fill="#1f1f2e" stroke="#B0B3BC" strokeWidth={2} />
      <rect x={30} y={30} width={50} height={26} fill="#0B0B10" stroke="#212CF4" strokeWidth={2} />
      <text x={55} y={47} fill="#C3C6ED" fontSize={7} textAnchor="middle">WROOM</text>
      <text x={20} y={200} fill="#FFFFFF" fontSize={8}>ESP32</text>
      {espPins.map((p) => (
        <g key={p.label}>
          <rect x={104} y={p.y - 3} width={8} height={6} fill="#FFE55C" />
          <text x={100} y={p.y + 3} fill={p.color} fontSize={7} textAnchor="end">{p.label}</text>
        </g>
      ))}

      {/* Power buses */}
      <path d={`M112 40 H${vcc} M${vcc} 35 V172`} stroke="#FF3A66" {...wire} />
      <path d={`M112 70 H${gnd} M${gnd} 50 V187`} stroke="#B0B3BC" {...wire} />
      {dot(vcc, 40, '#FF3A66')}
      {dot(gnd, 70, '#B0B3BC')}
      {[35, 105, 172].map((yy) => (
        <g key={`v${yy}`}>
          <path d={`M${vcc} ${yy} H230`} stroke="#FF3A66" {...wire} strokeWidth={2} />
          {dot(vcc, yy, '#FF3A66')}
        </g>
      ))}
      {[50, 135, 187].map((yy) => (
        <g key={`g${yy}`}>
          <path d={`M${gnd} ${yy} H230`} stroke="#B0B3BC" {...wire} strokeWidth={2} />
          {dot(gnd, yy, '#B0B3BC')}
        </g>
      ))}

      {/* Signal lines */}
      <path d="M112 110 H190 V65 H230" stroke="#72FFB4" {...wire} />
      <path d="M112 140 H200 V120 H230" stroke="#FFE55C" {...wire} />
      <path d="M112 180 H210 V202 H230" stroke="#C3C6ED" {...wire} />

      {/* Modules */}
      {modules.map((m) => (
        <g key={m.name}>
          <rect x={232} y={m.y} width={118} height={m.h} fill="#171722" stroke="#B0B3BC" strokeWidth={2} />
          <text x={340} y={m.y + 14} fill="#FFFFFF" fontSize={7} textAnchor="end">{m.name}</text>
          {m.pins.map(([label, py]) => (
            <g key={label}>
              <rect x={228} y={py - 3} width={8} height={6} fill="#FFE55C" />
              <text x={242} y={py + 3} fill="#C3C6ED" fontSize={7}>{label}</text>
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
export const LabWindow: React.FC = () => {
  const { playClick } = useSound();
  const mascot = useMascot();
  const { lang, dir } = useLanguage();
  const reduceMotion = useReducedMotion();
  const s = STR[lang] ?? STR.en;
  const px = lang === 'ar' ? 'font-body' : 'font-pixel';

  const [tab, setTab] = useState<Tab>('dash');
  const [running, setRunning] = useState(true);
  const [threshold, setThreshold] = useState(35);
  const [videoFailed, setVideoFailed] = useState(false);
  const [, forceRender] = useState(0);

  const simRef = useRef<Sim | null>(null);
  if (simRef.current === null) simRef.current = initialSim();
  const logRef = useRef<string[]>([]);
  const thresholdRef = useRef(threshold);
  const lastMascotRef = useRef(0);
  const mascotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mascotRef = useRef(mascot);
  const speechRef = useRef<string>(s.mascotPump);
  const logBoxRef = useRef<HTMLDivElement>(null);

  mascotRef.current = mascot;
  speechRef.current = s.mascotPump;

  const pushLog = useCallback((line: string) => {
    const next = [...logRef.current, `[${clock()}] ${line}`];
    logRef.current = next.length > MAX_LOG ? next.slice(next.length - MAX_LOG) : next;
  }, []);

  const reactMascot = useCallback(() => {
    const now = Date.now();
    if (now - lastMascotRef.current < MASCOT_COOLDOWN_MS) return;
    lastMascotRef.current = now;
    const m = mascotRef.current;
    m.setFrame('celebrating');
    m.setSpeechText(speechRef.current);
    if (mascotTimerRef.current) clearTimeout(mascotTimerRef.current);
    mascotTimerRef.current = setTimeout(() => {
      mascotRef.current.setFrame('idle');
      mascotRef.current.setSpeechText(undefined);
      mascotTimerRef.current = null;
    }, 3500);
  }, []);

  const pumpOn = useCallback(
    (reason: string) => {
      const sim = simRef.current!;
      if (sim.pump) return;
      sim.pump = true;
      sim.target = clamp(thresholdRef.current + 25, 55, 80);
      pushLog(`${reason} -> PUMP ON (GPIO26=HIGH, target ${Math.round(sim.target)}%)`);
      reactMascot();
    },
    [pushLog, reactMascot]
  );

  // Boot banner (once per mount)
  useEffect(() => {
    if (logRef.current.length === 0) {
      pushLog('ets Jun  8 2016 00:22:57  rst:0x1 (POWERON_RESET)');
      pushLog('esp32-irrigation-01 booting... [SIMULATION MODE]');
      pushLog('wifi: connected, rssi=' + simRef.current!.rssi + 'dBm');
      pushLog('firebase: auth ok, syncing /devices/esp32-irrigation-01');
      pushLog('ml: decision model loaded (features: soil, temp, rh)');
      forceRender((n) => n + 1);
    }
  }, [pushLog]);

  // Simulation loop: runs only while mounted and not paused.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const sim = simRef.current!;
      const th = thresholdRef.current;
      sim.tick += 1;
      sim.uptime += 1;
      if (sim.tick % 3 === 0) sim.rssi = clamp(sim.rssi + Math.round(rand(-2, 2)), -78, -52);

      // Environment random walks (mean-reverting)
      sim.temp = clamp(sim.temp + rand(-0.2, 0.2) + (27 - sim.temp) * 0.02, 18, 38);
      sim.hum = clamp(sim.hum + rand(-0.6, 0.6) + (55 - sim.hum) * 0.02 + (sim.pump ? 0.25 : 0), 30, 85);

      if (sim.pump) {
        sim.moisture = clamp(sim.moisture + rand(1.6, 2.6), 0, 95);
        if (sim.moisture >= sim.target) {
          sim.pump = false;
          pushLog(`moisture=${Math.round(sim.moisture)}% >= ${Math.round(sim.target)}% -> PUMP OFF (GPIO26=LOW)`);
        }
      } else {
        // Evaporation is faster when it is hot and dry.
        const dry = 0.35 + (sim.temp - 24) * 0.03 + (55 - sim.hum) * 0.008;
        sim.moisture = clamp(sim.moisture - clamp(dry, 0.2, 0.9) - rand(0, 0.15), 5, 95);
        if (sim.moisture < th) {
          const p = clamp(0.6 + (th - sim.moisture) * 0.05 + (sim.temp - 25) * 0.02, 0.5, 0.99);
          pushLog(`ml: p(water)=${p.toFixed(2)} | moisture=${Math.round(sim.moisture)}% < ${th}%`);
          pumpOn(`moisture=${Math.round(sim.moisture)}% < ${th}%`);
        }
      }

      for (const [k, v] of [
        ['moisture', sim.moisture],
        ['temp', sim.temp],
        ['hum', sim.hum],
      ] as const) {
        const arr = sim.hist[k];
        arr.push(v);
        if (arr.length > HISTORY) arr.shift();
      }

      if (sim.tick % 5 === 0) {
        pushLog(
          `soil=${Math.round(sim.moisture)}% t=${sim.temp.toFixed(1)}C rh=${Math.round(sim.hum)}% pump=${
            sim.pump ? 1 : 0
          } -> firebase PUT 200`
        );
      }
      forceRender((n) => n + 1);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [running, pushLog, pumpOn]);

  // Clean up the pending mascot reset on unmount.
  useEffect(
    () => () => {
      if (mascotTimerRef.current) {
        clearTimeout(mascotTimerRef.current);
        mascotRef.current.setFrame('idle');
        mascotRef.current.setSpeechText(undefined);
      }
    },
    []
  );

  // Auto-scroll the serial monitor (scroll the box itself, never the page).
  const logLen = logRef.current.length;
  const lastLine = logRef.current[logLen - 1];
  useEffect(() => {
    const el = logBoxRef.current;
    if (!el) return;
    if (reduceMotion) el.scrollTop = el.scrollHeight;
    else el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [logLen, lastLine, reduceMotion, tab]);

  const sim = simRef.current;

  const toggleRun = () => {
    playClick();
    pushLog(running ? '-- monitor paused by user --' : '-- monitor resumed --');
    setRunning((r) => !r);
  };

  const forceWater = () => {
    playClick();
    if (sim.pump) {
      pushLog('manual override ignored: pump already ON');
    } else {
      pumpOn('manual override (Force water)');
    }
    forceRender((n) => n + 1);
  };

  const onThreshold = (v: number) => {
    thresholdRef.current = v;
    setThreshold(v);
  };

  const commitThreshold = () => {
    pushLog(`config: water threshold set to ${thresholdRef.current}%`);
    forceRender((n) => n + 1);
  };

  const tabBtn = (id: Tab, label: string) => (
    <button
      key={id}
      onClick={() => {
        playClick();
        setTab(id);
      }}
      className={`px-3 py-1.5 border-t-2 border-x-2 border-slate rounded-t text-xs ${px} ${
        tab === id ? 'bg-panel text-text font-bold -mb-[2px] border-b-0 border-spidey' : 'bg-panel2 text-lavender hover:text-text'
      }`}
      aria-pressed={tab === id}
    >
      {label}
    </button>
  );

  const tiles = [
    {
      key: 'moisture' as const,
      label: s.soil,
      value: `${Math.round(sim.moisture)}%`,
      color: sim.pump ? '#72FFB4' : sim.moisture < threshold + 5 ? '#FFE55C' : '#C3C6ED',
      min: 0,
      max: 100,
      marker: threshold,
      sub: `${s.threshold} ${threshold}%`,
    },
    { key: 'temp' as const, label: s.temp, value: `${sim.temp.toFixed(1)}°C`, color: '#FF3A66', min: 15, max: 40, sub: 'DHT22' },
    { key: 'hum' as const, label: s.hum, value: `${Math.round(sim.hum)}%`, color: '#212CF4', min: 20, max: 90, sub: 'DHT22' },
  ];

  return (
    <Window id="lab">
      <div className="flex flex-col gap-3 font-body text-textDim select-none" dir={dir}>
        {/* Header strip */}
        <div className="win9x-box-recessed bg-panel2 p-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <div className="flex items-center gap-2 font-mono" dir="ltr">
            <img src={asset('/icons/ui-browser.png')} alt="" className="w-4 h-4 pixel-art" />
            <span className="text-text">esp32-irrigation-01</span>
          </div>
          <span className="font-mono text-lavender" dir="ltr">
            {s.uptime}: <span className="text-text">{fmtUptime(sim.uptime)}</span>
          </span>
          <span className="font-mono text-lavender" dir="ltr">
            Wi-Fi: <span className="text-green">{sim.rssi} dBm</span>
          </span>
          <span
            className={`ms-auto bg-yellow text-[#0B0B10] px-2 py-1 border-2 border-base ${px} text-[9px] leading-tight`}
            role="note"
          >
            ⚠ {s.badge}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b-2 border-slate">
          {tabBtn('dash', s.tabDash)}
          {tabBtn('wiring', s.tabWiring)}
          {tabBtn('video', s.tabVideo)}
        </div>

        {tab === 'dash' && (
          <div className="flex flex-col gap-3">
            {/* Sensor tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {tiles.map((t) => {
                const isSoil = t.key === 'moisture';
                const active = isSoil && sim.pump;
                return (
                  <div
                    key={t.key}
                    className={`win9x-box-recessed p-2 flex flex-col gap-1 transition-colors ${
                      active ? 'bg-green/10 border border-green' : 'bg-panel2 border border-slate/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`${px} text-[10px] text-lavender`}>{t.label}</span>
                      <span className="font-mono text-[10px] text-slate">{t.sub}</span>
                    </div>
                    <div className="font-mono text-xl text-text" dir="ltr">
                      {t.value}
                    </div>
                    <Sparkline data={sim.hist[t.key]} min={t.min} max={t.max} color={t.color} marker={t.marker} />
                  </div>
                );
              })}
            </div>

            {/* Controls + pump */}
            <div className="win9x-box-raised bg-panel p-2 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <motion.span
                  className={`inline-block w-3 h-3 border-2 border-base ${sim.pump ? 'bg-green' : 'bg-slate/40'}`}
                  animate={sim.pump && !reduceMotion ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
                  transition={sim.pump && !reduceMotion ? { duration: 0.8, repeat: Infinity } : { duration: 0 }}
                  aria-hidden="true"
                />
                <span className={`${px} text-[10px] ${sim.pump ? 'text-green' : 'text-lavender'}`}>
                  {s.pump}: {sim.pump ? s.on : s.off}
                </span>
              </div>

              <button onClick={toggleRun} className={`win9x-button px-3 py-1 text-[10px] ${px}`}>
                {running ? `❚❚ ${s.pause}` : `▶ ${s.resume}`}
              </button>
              <button onClick={forceWater} className={`win9x-button win9x-button-spidey px-3 py-1 text-[10px] ${px}`}>
                💧 {s.force}
              </button>

              <label className="flex items-center gap-2 flex-1 min-w-[180px]">
                <span className={`${px} text-[10px] text-yellow whitespace-nowrap`}>
                  {s.threshold} {threshold}%
                </span>
                <input
                  type="range"
                  min={20}
                  max={50}
                  value={threshold}
                  onChange={(e) => onThreshold(Number(e.target.value))}
                  onPointerUp={commitThreshold}
                  onKeyUp={commitThreshold}
                  className="flex-1 accent-spidey cursor-pointer"
                  aria-label={s.threshold}
                />
              </label>
            </div>

            {/* Serial monitor */}
            <div className="win9x-box-recessed bg-base border border-slate/40">
              <div className="flex items-center justify-between px-2 py-1 border-b border-slate/30">
                <span className={`${px} text-[9px] text-lavender`}>{s.serial}</span>
                {!running && <span className={`${px} text-[9px] text-yellow`}>{s.paused}</span>}
              </div>
              <div
                ref={logBoxRef}
                dir="ltr"
                className="h-36 sm:h-32 overflow-y-auto px-2 py-1 font-mono text-[11px] leading-snug text-green select-text"
                aria-live="off"
              >
                {logRef.current.map((line, i) => (
                  <div
                    key={`${i}-${line}`}
                    className={`whitespace-pre-wrap break-all ${
                      line.includes('PUMP ON') ? 'text-yellow' : line.includes('PUMP OFF') ? 'text-lavender' : ''
                    }`}
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'wiring' && (
          <div className="flex flex-col gap-3">
            <div className="win9x-box-recessed bg-base p-3 border border-slate/40" dir="ltr">
              <WiringDiagram />
            </div>
            <p className="text-xs text-lavender leading-relaxed">{s.wiringNote}</p>
          </div>
        )}

        {tab === 'video' && (
          <div className="flex flex-col gap-2">
            {!videoFailed ? (
              <>
                <video
                  src={asset('/lab/demo.mp4')}
                  controls
                  preload="metadata"
                  playsInline
                  className="w-full max-h-[320px] bg-base border-2 border-slate"
                  onError={() => setVideoFailed(true)}
                />
                <p className="text-xs text-lavender">{s.videoCaption}</p>
              </>
            ) : (
              <div className="win9x-box-recessed bg-panel2 border border-dashed border-slate p-6 flex flex-col items-center justify-center gap-3 text-center min-h-[200px]">
                <img src={asset('/icons/file-zip.png')} alt="" className="w-10 h-10 pixel-art opacity-70" />
                <span className={`${px} text-xs text-yellow`}>{s.videoMissing}</span>
                <span className="font-mono text-xs text-lavender" dir="ltr">
                  {s.videoHint}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </Window>
  );
};
