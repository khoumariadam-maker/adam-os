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
    ok: 'OK',
    low: 'Dry soon',
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
    ok: 'جيدة',
    low: 'تجف قريبًا',
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
  hist: { moisture: number[]; temp: number[]; hum: number[]; t: number[] };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const pad = (n: number) => String(n).padStart(2, '0');
const clock = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const clockOf = (ms: number) => {
  const d = new Date(ms);
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
  const hist = { moisture: [] as number[], temp: [] as number[], hum: [] as number[], t: [] as number[] };
  const now = Date.now();
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
    hist.t.push(now - (HISTORY - 1 - i) * TICK_MS);
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
// Sparkline: stepped (pixel-style) line + low-opacity area, current-value dot,
// optional labelled threshold, and a crosshair tooltip (mouse, touch, keyboard).
// Colours come from CSS variables so the chart follows the active theme.
// ---------------------------------------------------------------------------
const CV = (name: string, alpha?: number) =>
  alpha === undefined ? `rgb(var(--c-${name}))` : `rgb(var(--c-${name}) / ${alpha})`;
// Accent nudged toward the text colour: lighter on the dark theme, deeper navy on classic.
const SERIES = 'color-mix(in srgb, rgb(var(--c-spidey)) 65%, rgb(var(--c-text)))';

const CHART_H = 52;
const PAD_T = 6;
const PAD_B = 6;
const PAD_R = 6;

const useWidth = <T extends HTMLElement>() => {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => setW(Math.round(entries[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
};

const Sparkline: React.FC<{
  data: number[];
  times: number[];
  min: number;
  max: number;
  format: (v: number) => string;
  label: string;
  threshold?: { value: number; label: string };
}> = ({ data, times, min, max, format, label, threshold }) => {
  const [wrapRef, measured] = useWidth<HTMLDivElement>();
  const W = measured || 160;
  const [hover, setHover] = useState<number | null>(null);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (touchTimer.current) clearTimeout(touchTimer.current);
    },
    []
  );

  const n = data.length;
  const plotW = W - PAD_R;
  const step = n > 1 ? plotW / (n - 1) : plotW;
  const xAt = (i: number) => Math.round(i * step);
  const yAt = (v: number) =>
    Math.round(CHART_H - PAD_B - ((clamp(v, min, max) - min) / (max - min)) * (CHART_H - PAD_T - PAD_B));

  let line = '';
  data.forEach((v, i) => {
    const x = xAt(i);
    const yy = yAt(v);
    line += i === 0 ? `M${x} ${yy}` : ` H${x} V${yy}`;
  });
  const baseY = CHART_H - PAD_B;
  const area = n ? `${line} V${baseY} H0 Z` : '';

  const lo = n ? Math.min(...data) : 0;
  const hi = n ? Math.max(...data) : 0;
  const last = n - 1;

  const idxFromX = (clientX: number, rect: DOMRect) =>
    clamp(Math.round(((clientX - rect.left) / Math.max(1, rect.width - PAD_R)) * (n - 1)), 0, n - 1);

  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!n) return;
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
    setHover(idxFromX(e.clientX, e.currentTarget.getBoundingClientRect()));
  };
  const onPointerEnd = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'touch') {
      // Keep the readout up briefly after the finger lifts.
      if (touchTimer.current) clearTimeout(touchTimer.current);
      touchTimer.current = setTimeout(() => {
        setHover(null);
        touchTimer.current = null;
      }, 1500);
    } else {
      setHover(null);
    }
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!n) return;
    const cur = hover ?? last;
    let next: number | null = null;
    if (e.key === 'ArrowLeft') next = Math.max(0, cur - 1);
    else if (e.key === 'ArrowRight') next = Math.min(last, cur + 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else if (e.key === 'Escape') {
      setHover(null);
      return;
    }
    if (next === null) return;
    e.preventDefault();
    setHover(next);
  };

  const hx = hover !== null ? xAt(hover) : 0;
  const tipLeft = hover !== null ? clamp(hx, 44, Math.max(44, W - 44)) : 0;
  const thY = threshold ? yAt(threshold.value) : 0;

  return (
    <div className="flex flex-col gap-0.5">
      <div ref={wrapRef} className="relative w-full" dir="ltr">
        <svg
          width={W}
          height={CHART_H}
          viewBox={`0 0 ${W} ${CHART_H}`}
          className="block w-full bg-panel border border-slate/40 cursor-crosshair focus-visible:outline focus-visible:outline-2 focus-visible:outline-spidey"
          style={{ touchAction: 'pan-y' }}
          role="img"
          tabIndex={0}
          aria-label={`${label}: now ${n ? format(data[last]) : '--'}, range ${format(lo)} to ${format(hi)} over the last ${n} seconds. Use arrow keys to inspect.`}
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onPointerUp={(e) => e.pointerType === 'touch' && onPointerEnd(e)}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
        >
          {/* Recessive grid */}
          {[0.5].map((f) => (
            <line
              key={f}
              x1={0}
              x2={W}
              y1={Math.round(PAD_T + (CHART_H - PAD_T - PAD_B) * f) + 0.5}
              y2={Math.round(PAD_T + (CHART_H - PAD_T - PAD_B) * f) + 0.5}
              style={{ stroke: CV('slate', 0.18) }}
              strokeWidth={1}
            />
          ))}

          {/* Area + line */}
          <path d={area} style={{ fill: SERIES, fillOpacity: 0.14 }} />
          <path d={line} style={{ fill: 'none', stroke: SERIES }} strokeWidth={2} strokeLinejoin="miter" />

          {/* Threshold */}
          {threshold && (
            <g>
              <line
                x1={0}
                x2={W}
                y1={thY + 0.5}
                y2={thY + 0.5}
                style={{ stroke: CV('yellow') }}
                strokeDasharray="4 3"
                strokeWidth={1}
              />
              <text
                x={4}
                y={thY > PAD_T + 10 ? thY - 3 : thY + 10}
                fontSize={9}
                fontFamily="var(--font-mono), monospace"
                style={{ fill: CV('text'), stroke: CV('panel'), strokeWidth: 3, paintOrder: 'stroke' }}
              >
                {threshold.label}
              </text>
            </g>
          )}

          {/* Crosshair */}
          {hover !== null && (
            <g>
              <line x1={hx + 0.5} x2={hx + 0.5} y1={0} y2={CHART_H} style={{ stroke: CV('text', 0.55) }} strokeWidth={1} />
              <circle cx={hx} cy={yAt(data[hover])} r={4} style={{ fill: SERIES, stroke: CV('panel') }} strokeWidth={2} />
            </g>
          )}

          {/* Current value */}
          {n > 0 && hover === null && (
            <circle cx={xAt(last)} cy={yAt(data[last])} r={4} style={{ fill: SERIES, stroke: CV('panel') }} strokeWidth={2} />
          )}
        </svg>

        {hover !== null && (
          <div
            className="pointer-events-none absolute -top-1 -translate-x-1/2 -translate-y-full z-10 win9x-box-raised bg-panel2 px-1.5 py-0.5 whitespace-nowrap font-mono leading-tight"
            style={{ left: tipLeft }}
            role="status"
          >
            <span className="text-[12px] font-bold text-text">{format(data[hover])}</span>{' '}
            <span className="text-[10px] text-lavender">{times[hover] ? clockOf(times[hover]) : ''}</span>
          </div>
        )}
      </div>
      <div className="flex justify-between font-mono text-[9px] text-lavender" dir="ltr" aria-hidden>
        <span>-{Math.max(0, n - 1)}s</span>
        <span>
          lo {format(lo)} · hi {format(hi)}
        </span>
        <span>now</span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Wiring diagram
// ---------------------------------------------------------------------------
const WiringDiagram: React.FC = () => {
  // Theme colours (CSS variables) so the diagram reads on both the dark and classic themes.
  const C = {
    vcc: CV('red'),
    gnd: CV('slate'),
    soil: CV('green'),
    dht: CV('yellow'),
    relay: SERIES,
    pin: CV('yellow'),
    board: CV('panel2'),
    chip: CV('base'),
    edge: CV('slate'),
    accent: CV('spidey'),
    text: CV('text'),
    label: CV('lavender'),
  };
  const espPins = [
    { label: '3V3', y: 40, color: C.vcc },
    { label: 'GND', y: 70, color: C.gnd },
    { label: 'GPIO34', y: 110, color: C.soil },
    { label: 'GPIO4', y: 140, color: C.dht },
    { label: 'GPIO26', y: 180, color: C.relay },
  ];
  const modules = [
    { name: 'SOIL (cap.)', y: 20, h: 60, pins: [['VCC', 35], ['GND', 50], ['AOUT', 65]] as [string, number][] },
    { name: 'DHT22', y: 90, h: 60, pins: [['VCC', 105], ['DATA', 120], ['GND', 135]] as [string, number][] },
    { name: 'RELAY', y: 160, h: 56, pins: [['VCC', 172], ['GND', 187], ['IN', 202]] as [string, number][] },
  ];
  const vcc = 150;
  const gnd = 170;
  const wire = (stroke: string, strokeWidth = 3) => ({
    style: { fill: 'none', stroke },
    strokeWidth,
    strokeLinecap: 'square' as const,
  });
  const fill = (f: string, stroke?: string) => ({ style: stroke ? { fill: f, stroke } : { fill: f } });
  const dot = (x: number, yy: number, c: string) => <rect x={x - 3} y={yy - 3} width={6} height={6} {...fill(c)} />;

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
      <rect x={10} y={20} width={100} height={185} {...fill(C.board, C.edge)} strokeWidth={2} />
      <rect x={30} y={30} width={50} height={26} {...fill(C.chip, C.accent)} strokeWidth={2} />
      <text x={55} y={47} {...fill(C.label)} fontSize={7} textAnchor="middle">WROOM</text>
      <text x={20} y={200} {...fill(C.text)} fontSize={8}>ESP32</text>
      {espPins.map((p) => (
        <g key={p.label}>
          <rect x={104} y={p.y - 3} width={8} height={6} {...fill(C.pin)} />
          <text x={100} y={p.y + 3} {...fill(p.color)} fontSize={7} textAnchor="end">{p.label}</text>
        </g>
      ))}

      {/* Power buses */}
      <path d={`M112 40 H${vcc} M${vcc} 35 V172`} {...wire(C.vcc)} />
      <path d={`M112 70 H${gnd} M${gnd} 50 V187`} {...wire(C.gnd)} />
      {dot(vcc, 40, C.vcc)}
      {dot(gnd, 70, C.gnd)}
      {[35, 105, 172].map((yy) => (
        <g key={`v${yy}`}>
          <path d={`M${vcc} ${yy} H230`} {...wire(C.vcc, 2)} />
          {dot(vcc, yy, C.vcc)}
        </g>
      ))}
      {[50, 135, 187].map((yy) => (
        <g key={`g${yy}`}>
          <path d={`M${gnd} ${yy} H230`} {...wire(C.gnd, 2)} />
          {dot(gnd, yy, C.gnd)}
        </g>
      ))}

      {/* Signal lines */}
      <path d="M112 110 H190 V65 H230" {...wire(C.soil)} />
      <path d="M112 140 H200 V120 H230" {...wire(C.dht)} />
      <path d="M112 180 H210 V202 H230" {...wire(C.relay)} />

      {/* Modules */}
      {modules.map((m) => (
        <g key={m.name}>
          <rect x={232} y={m.y} width={118} height={m.h} {...fill(C.board, C.edge)} strokeWidth={2} />
          <text x={340} y={m.y + 14} {...fill(C.text)} fontSize={7} textAnchor="end">{m.name}</text>
          {m.pins.map(([label, py]) => (
            <g key={label}>
              <rect x={228} y={py - 3} width={8} height={6} {...fill(C.pin)} />
              <text x={242} y={py + 3} {...fill(C.label)} fontSize={7}>{label}</text>
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
      sim.hist.t.push(Date.now());
      if (sim.hist.t.length > HISTORY) sim.hist.t.shift();

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

  const soilStatus = sim.pump
    ? { text: `💧 ${s.pump} ${s.on}`, cls: 'text-green border-green bg-green/10' }
    : sim.moisture < threshold + 5
    ? { text: `⚠ ${s.low}`, cls: 'text-yellow border-yellow bg-yellow/10' }
    : { text: `✓ ${s.ok}`, cls: 'text-lavender border-slate/50' };

  const tiles = [
    {
      key: 'moisture' as const,
      label: s.soil,
      value: `${Math.round(sim.moisture)}%`,
      format: (v: number) => `${Math.round(v)}%`,
      min: 0,
      max: 100,
      threshold: { value: threshold, label: `${s.threshold} ${threshold}%` },
      sub: 'GPIO34',
      status: soilStatus,
    },
    {
      key: 'temp' as const,
      label: s.temp,
      value: `${sim.temp.toFixed(1)}°C`,
      format: (v: number) => `${v.toFixed(1)}°C`,
      min: 15,
      max: 40,
      sub: 'DHT22',
    },
    {
      key: 'hum' as const,
      label: s.hum,
      value: `${Math.round(sim.hum)}%`,
      format: (v: number) => `${Math.round(v)}%`,
      min: 20,
      max: 90,
      sub: 'DHT22',
    },
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
            className={`ms-auto bg-yellow/15 text-text px-2 py-1 border-2 border-yellow ${px} text-[9px] leading-tight`}
            role="note"
          >
            <span className="text-yellow" aria-hidden>⚠</span> {s.badge}
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
                      <span className="font-mono text-[10px] text-lavender/80" dir="ltr">
                        {t.sub}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 min-h-[28px]">
                      <span className="font-mono text-2xl font-bold text-text leading-none" dir="ltr">
                        {t.value}
                      </span>
                      {'status' in t && t.status && (
                        <span className={`${px} text-[9px] px-1.5 py-0.5 border ${t.status.cls}`} role="status">
                          {t.status.text}
                        </span>
                      )}
                    </div>
                    <Sparkline
                      data={sim.hist[t.key]}
                      times={sim.hist.t}
                      min={t.min}
                      max={t.max}
                      format={t.format}
                      label={t.label}
                      threshold={'threshold' in t ? t.threshold : undefined}
                    />
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
            <div className="win9x-box-recessed bg-panel border border-slate/40">
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
            <div className="win9x-box-recessed bg-panel p-3 border border-slate/40" dir="ltr">
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
                  className="w-full max-h-[320px] bg-shade border-2 border-slate"
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
