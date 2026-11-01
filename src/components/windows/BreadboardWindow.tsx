'use client';

// Breadboard.exe: a 3D breadboard you can build real circuits on. The physics is a proper
// DC solver (src/lib/circuit/solver.ts); the 3D scene is lazy-loaded so three.js only
// downloads when this window opens.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Window } from '../Window';
import { useSound } from '@/context/SoundContext';
import { useMascot } from '@/context/MascotContext';
import { useWindowManager } from '@/context/WindowManagerContext';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { soundSynth } from '@/lib/audio/sound-synth';
import { readJSON, writeStorage } from '@/lib/storage';
import { describeHole, getHole, holeDistance, isRail, netOf } from '@/lib/circuit/board';
import {
  BATTERIES,
  BUZZER,
  BatteryType,
  CAP_REVERSE_LIMIT,
  CAP_VALUES,
  POT_VALUES,
  formatFarads,
  potOhms,
  LED_BURN,
  LED_FULL_BRIGHT,
  LED_HOT,
  LED_SPECS,
  LedColor,
  MAX_SPAN,
  PART_LABEL,
  Part,
  PartKind,
  RESISTOR_VALUES,
  WIRE_COLORS,
  WIRE_HEX,
  WireColor,
  formatAmps,
  formatOhms,
  formatVolts,
  newPartId,
  partTitle,
} from '@/lib/circuit/parts';
import { BATTERY_PART, PRESETS } from '@/lib/circuit/presets';
import { SolveResult, solveCircuit } from '@/lib/circuit/solver';
import type { SceneProps, ViewMode } from '../breadboard/BreadboardScene';

const BreadboardScene = dynamic(() => import('../breadboard/BreadboardScene'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center font-pixel text-[10px] text-lavender">Warming up the soldering iron…</div>
  ),
});

type PlaceKind = Exclude<PartKind, 'battery'>;
type Tool = 'select' | 'delete' | PlaceKind;

const STORE_KEY = 'adam_os_breadboard_v1';
const PLACE_TOOLS: PlaceKind[] = ['wire', 'resistor', 'led', 'button', 'buzzer', 'pot', 'cap', 'meter'];

// ---- tiny line-art glyphs for the toolbar ------------------------------------------------------------
const Glyph: React.FC<{ kind: Tool | 'battery' | 'undo' | 'view' | 'flow' | 'pixel' | 'flip' | 'move' }> = ({ kind }) => {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'square' as const, strokeLinejoin: 'miter' as const };
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden className="shrink-0">
      {kind === 'select' && <path {...p} d="M3 2v11l3-3 2 5 2-1-2-5h4z" />}
      {kind === 'delete' && <path {...p} d="M3 4h10M6 4V2h4v2M4.5 4l1 10h5l1-10" />}
      {kind === 'wire' && <path {...p} d="M2 13V9c0-5 12-5 12 0v4" />}
      {kind === 'resistor' && <path {...p} d="M1 8h3l1-3 2 6 2-6 2 6 1-3h3" />}
      {kind === 'led' && (
        <>
          <path {...p} d="M4 13V6a4 4 0 0 1 8 0v7M3 10h10" />
          <path {...p} d="M13 2l2-1M14 5h2" />
        </>
      )}
      {kind === 'button' && (
        <>
          <rect {...p} x={2} y={8} width={12} height={5} />
          <path {...p} d="M5 8V5h6v3" />
        </>
      )}
      {kind === 'buzzer' && (
        <>
          <circle {...p} cx={7} cy={8} r={5} />
          <circle cx={7} cy={8} r={1.2} fill="currentColor" />
          <path {...p} d="M13.5 4.5c1.5 2 1.5 5 0 7" />
        </>
      )}
      {kind === 'battery' && (
        <>
          <rect {...p} x={2} y={5} width={11} height={7} />
          <path {...p} d="M13 7h2v3h-2M5 8.5h3M6.5 7v3" />
        </>
      )}
      {kind === 'undo' && <path {...p} d="M5 3L2 6l3 3M2 6h8a4 4 0 0 1 0 8H7" />}
      {kind === 'view' && <path {...p} d="M8 1l6 3.5v7L8 15l-6-3.5v-7zM8 8l6-3.5M8 8v7M8 8L2 4.5" />}
      {kind === 'flow' && <path {...p} d="M1 8h3M6 8h3M11 8h4M12 5l3 3-3 3" />}
      {kind === 'pixel' && <path fill="currentColor" d="M2 2h4v4H2zM6 6h4v4H6zM10 10h4v4h-4zM10 2h4v4h-4zM2 10h4v4H2z" />}
      {kind === 'flip' && <path {...p} d="M2 5h10l-3-3M14 11H4l3 3" />}
      {kind === 'move' && <path {...p} d="M8 1v14M1 8h14M8 1L6 3M8 1l2 2M8 15l-2-2M8 15l2-2M1 8l2-2M1 8l2 2M15 8l-2-2M15 8l-2 2" />}
      {kind === 'pot' && (
        <>
          <circle {...p} cx={8} cy={8} r={5.5} />
          <path {...p} d="M8 8L4.5 4.5" />
        </>
      )}
      {kind === 'cap' && (
        <>
          <rect {...p} x={4} y={2} width={8} height={10} />
          <path {...p} d="M6 12v3M10 12v3M10 4v6" />
        </>
      )}
      {kind === 'meter' && (
        <>
          <rect {...p} x={3} y={1} width={10} height={14} />
          <rect {...p} x={5} y={3} width={6} height={3} />
          <circle {...p} cx={8} cy={10} r={2} />
        </>
      )}
    </svg>
  );
};

const TOOL_LABEL: Record<Tool, string> = {
  select: 'Select',
  delete: 'Delete',
  wire: 'Wire',
  resistor: 'Resistor',
  led: 'LED',
  button: 'Button',
  buzzer: 'Buzzer',
  pot: 'Pot',
  cap: 'Capacitor',
  meter: 'Meter',
};

// Keyboard shortcuts for the tools.
const TOOL_KEYS: Record<string, Tool> = { v: 'select', w: 'wire', r: 'resistor', l: 'led', b: 'button', z: 'buzzer', p: 'pot', c: 'cap', m: 'meter', x: 'delete' };
const KEY_OF = Object.fromEntries(Object.entries(TOOL_KEYS).map(([k, t]) => [t, k.toUpperCase()])) as Record<Tool, string>;

const defaultParts = (): Part[] => [{ ...BATTERY_PART }, ...PRESETS[0].parts.map((p) => ({ ...p }))];

const sanitize = (raw: unknown): Part[] | null => {
  if (!Array.isArray(raw)) return null;
  const ok = raw.filter(
    (p): p is Part =>
      p && typeof p.id === 'string' && typeof p.kind === 'string' && Array.isArray(p.pins) && p.pins.length === 2 && p.pins.every((h: string) => !!getHole(h))
  );
  if (!ok.some((p) => p.kind === 'battery')) ok.unshift({ ...BATTERY_PART });
  return ok;
};

export const BreadboardWindow: React.FC = () => {
  return (
    <Window id="breadboard" flush>
      <Breadboard />
    </Window>
  );
};

const Breadboard: React.FC = () => {
  const isMobile = useIsMobile();
  const { isMuted, playClick, playError } = useSound();
  const { react } = useMascot();
  const { activeWindowId } = useWindowManager();
  const isActive = activeWindowId === 'breadboard';

  const [parts, setPartsRaw] = useState<Part[]>(() => sanitize(readJSON<{ parts?: unknown }>(STORE_KEY, {}).parts) ?? defaultParts());
  const history = useRef<Part[][]>([]);
  const [tool, setToolRaw] = useState<Tool>('select');
  const [pending, setPending] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number; touch?: boolean } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pressed, setPressed] = useState<Set<string>>(() => new Set());
  const [view, setView] = useState<ViewMode>('angle');
  const [viewNonce, setViewNonce] = useState(0);
  // Flowing-current dots are motion: off by default when the system asks for reduced motion.
  const [showCurrent, setShowCurrent] = useState(() => typeof window === 'undefined' || !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [pixel, setPixel] = useState(false);
  const [burns, setBurns] = useState<{ id: string; at: number }[]>([]);
  const [message, setMessage] = useState<{ text: string; tone: 'info' | 'warn' | 'good' } | null>(null);
  const [lesson, setLesson] = useState<{ title: string; blurb: string } | null>(() => (readJSON<{ parts?: unknown }>(STORE_KEY, {}).parts ? null : { title: PRESETS[0].title, blurb: PRESETS[0].blurb }));
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [opts, setOpts] = useState<{ ohms: number; led: LedColor; wire: WireColor; uf: number }>({ ohms: 330, led: 'red', wire: 'red', uf: 1000 });
  // Properties carried over when a part is moved (applied to the next placement only).
  const carry = useRef<Partial<Part> | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const autoTopDone = useRef(false);

  const setParts = useCallback((next: Part[] | ((prev: Part[]) => Part[]), record = true) => {
    setPartsRaw((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      if (record && value !== prev) {
        history.current.push(prev);
        if (history.current.length > 60) history.current.shift();
      }
      return value;
    });
  }, []);

  useEffect(() => writeStorage(STORE_KEY, JSON.stringify({ parts })), [parts]);

  const flash = useCallback((text: string, tone: 'info' | 'warn' | 'good' = 'info') => setMessage({ text, tone }), []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), message.tone === 'warn' ? 7000 : 4200);
    return () => clearTimeout(t);
  }, [message]);

  // Capacitors need time: while any exist, step the solver in real time until things settle.
  const hasCaps = parts.some((p) => p.kind === 'cap');
  const dcResult = useMemo(() => (hasCaps ? null : solveCircuit(parts, pressed)), [hasCaps, parts, pressed]);
  const capV = useRef<Record<string, number>>({});
  const [stepResult, setStepResult] = useState<SolveResult | null>(null);
  useEffect(() => {
    if (!hasCaps) {
      capV.current = {};
      setStepResult(null);
      return;
    }
    let raf = 0;
    let last = performance.now();
    let quiet = 0;
    const step = () => {
      const now = performance.now();
      const elapsed = Math.min(0.1, Math.max(0.001, (now - last) / 1000));
      last = now;
      const n = Math.ceil(elapsed / 0.004);
      const before = capV.current;
      let r: SolveResult | null = null;
      for (let i = 0; i < n; i++) {
        r = solveCircuit(parts, pressed, { capV: capV.current, dt: elapsed / n });
        capV.current = r.capV;
      }
      const delta = Math.max(0, ...Object.keys(capV.current).map((id) => Math.abs(capV.current[id] - (before[id] ?? 0))));
      setStepResult(r);
      quiet = delta < 2e-4 ? quiet + 1 : 0;
      if (quiet < 20) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [hasCaps, parts, pressed]);
  const result: SolveResult = dcResult ?? stepResult ?? solveCircuit(parts, pressed, { capV: capV.current, dt: 0.004 });
  const battery = parts.find((p) => p.kind === 'battery')!;
  const selected = parts.find((p) => p.id === selectedId) ?? null;
  const meter = parts.find((p) => p.kind === 'meter');

  const occupied = useMemo(() => {
    const m = new Map<string, string>();
    // Meter probes just touch the metal, so they don't block a hole.
    for (const p of parts) if (p.kind !== 'meter') for (const h of p.pins) m.set(h, p.id);
    return m;
  }, [parts]);

  // ---- tool + placement -------------------------------------------------------------------------------
  const setTool = (t: Tool) => {
    playClick();
    setToolRaw(t);
    setPending(null);
    if (t !== 'select') setSelectedId(null);
    if (PLACE_TOOLS.includes(t as PlaceKind)) {
      flash(
        t === 'meter'
          ? 'Meter: tap where the red probe goes, then where the black probe goes. It shows the voltage between them.'
          : `${TOOL_LABEL[t]}: tap the hole for the first leg, then the hole for the second.`
      );
      if (isMobile && view === 'angle' && !autoTopDone.current) {
        autoTopDone.current = true;
        setView('top');
        setViewNonce((n) => n + 1);
      }
    } else if (t === 'delete') flash('Delete: tap a part to remove it.');
  };

  const makePart = (kind: PlaceKind, a: string, b: string, id = newPartId(kind)): Part => {
    const base: Part = { id, kind, pins: [a, b] };
    if (kind === 'resistor') base.ohms = opts.ohms;
    if (kind === 'led') base.color = opts.led;
    if (kind === 'wire') base.color = opts.wire;
    if (kind === 'cap') base.uf = opts.uf;
    if (kind === 'pot') {
      base.ohms = 10000;
      base.pos = 0.5;
    }
    return id === 'ghost' || !carry.current ? base : { ...base, ...carry.current, id, kind, pins: [a, b] };
  };

  const checkPlacement = (kind: PlaceKind, a: string, b: string): string | null => {
    if (kind !== 'meter' && occupied.has(b)) return 'That hole already has a leg in it.';
    const d = holeDistance(a, b);
    if (d > MAX_SPAN[kind]) return `The ${PART_LABEL[kind].toLowerCase()}'s legs only reach about ${Math.floor(MAX_SPAN[kind])} holes.`;
    return null;
  };

  const placing = PLACE_TOOLS.includes(tool as PlaceKind) ? (tool as PlaceKind) : null;
  const ghost = useMemo<SceneProps['ghost']>(() => {
    if (!placing || !pending || !hover || hover.id === pending) return null;
    const valid = !checkPlacement(placing, pending, hover.id);
    return { part: makePart(placing, pending, hover.id, 'ghost'), valid };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placing, pending, hover?.id, occupied, opts]);

  const removePart = (id: string) => {
    const p = parts.find((q) => q.id === id);
    if (!p || p.kind === 'battery') {
      if (p) flash('The battery stays. Use its switch to turn it off.', 'warn');
      return;
    }
    soundSynth.playPop();
    setParts((prev) => prev.filter((q) => q.id !== id));
    if (selectedId === id) setSelectedId(null);
    flash(`Removed the ${partTitle(p)}.`);
  };

  const onHoleClick = (id: string) => {
    const owner = occupied.get(id);
    if (tool === 'select') {
      setSelectedId(owner ?? null);
      if (owner) playClick();
      return;
    }
    if (tool === 'delete') {
      if (owner) removePart(owner);
      return;
    }
    if (!placing) return;
    if (!pending) {
      if (owner && placing !== 'meter') {
        playError();
        flash('That hole already has a leg in it.', 'warn');
        return;
      }
      playClick();
      setPending(id);
      return;
    }
    if (id === pending) {
      setPending(null);
      return;
    }
    const err = checkPlacement(placing, pending, id);
    if (err) {
      playError();
      flash(err, 'warn');
      return;
    }
    const part = makePart(placing, pending, id);
    carry.current = null;
    soundSynth.playTick(true);
    // Only one multimeter: placing it again moves the probes.
    setParts((prev) => [...(placing === 'meter' ? prev.filter((p) => p.kind !== 'meter') : prev), part]);
    setPending(null);
    if (placing === 'meter') {
      flash('Probes placed. The meter shows the red probe’s voltage minus the black probe’s.', 'good');
      setToolRaw('select');
    } else if (placing !== 'wire' && netOf(part.pins[0]) === netOf(part.pins[1])) {
      flash(`Both legs are in the same strip, so the ${PART_LABEL[placing].toLowerCase()} is shorted out. Move one leg to another column.`, 'warn');
    } else flash(`${partTitle(part)} placed. Tap two more holes for another, or pick Select.`, 'good');
  };

  const onPartClick = (id: string) => {
    if (tool === 'delete') return removePart(id);
    playClick();
    setSelectedId(id);
  };

  const press = useCallback((id: string, down: boolean) => {
    setPressed((prev) => {
      if (down === prev.has(id)) return prev;
      const next = new Set(prev);
      if (down) next.add(id);
      else next.delete(id);
      soundSynth.playTick(down);
      return next;
    });
  }, []);

  // Release every held button when the pointer comes up anywhere.
  useEffect(() => {
    if (!pressed.size) return;
    const up = () => setPressed(new Set());
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [pressed.size]);

  const undo = useCallback(() => {
    const prev = history.current.pop();
    if (!prev) return flash('Nothing to undo.');
    setPartsRaw(prev);
    setSelectedId(null);
    setPending(null);
    flash('Undone.');
  }, [flash]);

  const updatePart = (id: string, patch: Partial<Part>, record = true) => setParts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)), record);

  // Pick a part back up: remove it and place a copy (same value/colour) at two new holes.
  const movePart = (id: string) => {
    const p = parts.find((q) => q.id === id);
    if (!p || p.kind === 'battery') return;
    setParts((prev) => prev.filter((q) => q.id !== id));
    setSelectedId(null);
    setToolRaw(p.kind as PlaceKind);
    setPending(null);
    const { id: _id, pins: _pins, kind: _kind, ...props } = p;
    carry.current = { ...props, burnt: false };
    playClick();
    flash(`Moving the ${partTitle(p)}: tap the two new holes.`);
  };

  const onKnob = useCallback(
    (id: string, pos: number, phase: 'start' | 'move' | 'end') => {
      if (phase === 'start') {
        setPartsRaw((prev) => {
          history.current.push(prev);
          return prev;
        });
        setSelectedId(id);
      } else if (phase === 'move') {
        setPartsRaw((prev) => prev.map((p) => (p.id === id ? { ...p, pos } : p)));
      }
    },
    []
  );

  const loadPreset = (i: number) => {
    const preset = PRESETS[i];
    setParts([{ ...battery, battery: '9v', on: true }, ...preset.parts.map((p) => ({ ...p }))]);
    setSelectedId(null);
    setPending(null);
    setToolRaw('select');
    setExamplesOpen(false);
    setLesson({ title: preset.title, blurb: preset.blurb });
    setBurns([]);
    playClick();
  };

  const clearBoard = () => {
    setParts([{ ...battery }]);
    setSelectedId(null);
    setPending(null);
    setLesson(null);
    flash('Board cleared. Pick a part and tap two holes to place it.');
  };

  // ---- keyboard ---------------------------------------------------------------------------------------
  useEffect(() => {
    if (!isActive) return;
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape' && (pending || selectedId || tool !== 'select' || examplesOpen)) {
        e.preventDefault();
        if (examplesOpen) setExamplesOpen(false);
        else if (pending) setPending(null);
        else if (selectedId) setSelectedId(null);
        else setToolRaw('select');
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        removePart(selectedId);
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && TOOL_KEYS[e.key.toLowerCase()]) {
        e.preventDefault();
        setTool(TOOL_KEYS[e.key.toLowerCase()]);
      } else if (e.key === ' ' && selected?.kind === 'button' && !e.repeat) {
        e.preventDefault();
        press(selected.id, true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ' && selected?.kind === 'button') press(selected.id, false);
    };
    // Capture phase so Escape is handled here before the window manager closes the window.
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, pending, selectedId, tool, examplesOpen, selected, undo, press]);

  // ---- consequences: burnt LEDs, shorts, buzzers, mascot -------------------------------------------------
  const resultRef = useRef(result);
  resultRef.current = result;
  const overSince = useRef(new Map<string, number>());
  const lastSay = useRef(0);
  const say = useCallback(
    (frame: Parameters<typeof react>[0], text: string, ms = 2400, force = false) => {
      const now = Date.now();
      if (!force && now - lastSay.current < 7000) return;
      lastSay.current = now;
      react(frame, text, ms);
    },
    [react]
  );

  // One watcher for anything that can be destroyed: LEDs with too much current, and
  // electrolytic capacitors connected backwards. Each gets a moment of drama first.
  const partsRef = useRef(parts);
  partsRef.current = parts;
  useEffect(() => {
    const timer = setInterval(() => {
      const t = performance.now();
      const r = resultRef.current;
      const over = new Set<string>();
      const toBurn: Part[] = [];
      for (const p of partsRef.current) {
        if (p.burnt) continue;
        let limit = 0;
        if (p.kind === 'led') {
          const amps = r.parts[p.id]?.current ?? 0;
          if (amps > LED_BURN) limit = amps > 0.1 ? 1100 : 1800;
        } else if (p.kind === 'cap' && (r.parts[p.id]?.drop ?? 0) < -CAP_REVERSE_LIMIT) limit = 1600;
        if (!limit) continue;
        over.add(p.id);
        const since = overSince.current.get(p.id) ?? t;
        overSince.current.set(p.id, since);
        if (t - since > limit) toBurn.push(p);
      }
      overSince.current.forEach((_, id) => !over.has(id) && overSince.current.delete(id));
      if (!toBurn.length) return;
      const ids = toBurn.map((p) => p.id);
      ids.forEach((id) => overSince.current.delete(id));
      soundSynth.playBurnout();
      setBurns((b) => [...b.filter((x) => t - x.at < 3000), ...ids.map((id) => ({ id, at: t }))]);
      setParts((prev) => prev.map((p) => (ids.includes(p.id) ? { ...p, burnt: true } : p)), false);
      if (toBurn.some((p) => p.kind === 'cap')) {
        flash('Bang! The capacitor was in backwards. Electrolytic capacitors have a + leg and a − leg (the striped side). Tap it to flip and replace it.', 'warn');
        say('surprised', 'Bang! 💥 That capacitor was backwards.', 2800, true);
      } else {
        flash('Pop! Too much current burnt out the LED. Add a resistor in series, then tap it and press Replace.', 'warn');
        say('surprised', 'Pop! 💥 That LED needed a resistor.', 2800, true);
      }
    }, 80);
    return () => clearInterval(timer);
  }, [flash, say, setParts]);

  const wasShort = useRef(false);
  useEffect(() => {
    if (result.short && !wasShort.current) {
      playError();
      say('dizzy', 'Short circuit! + is wired straight to −.', 2600, true);
    }
    wasShort.current = result.short;
  }, [result.short, playError, say]);

  const litCount = parts.filter((p) => p.kind === 'led' && result.parts[p.id]?.on).length;
  const prevLit = useRef(litCount);
  useEffect(() => {
    if (litCount > prevLit.current) {
      const lines = ['It lights up! ⚡', 'Nice circuit!', 'Electrons go brrr ⚡', 'Look at it glow!'];
      say('celebrating', lines[Math.floor(Math.random() * lines.length)], 1800);
    }
    prevLit.current = litCount;
  }, [litCount, say]);

  const buzzLevel = parts.reduce((m, p) => (p.kind === 'buzzer' && result.parts[p.id]?.on ? Math.max(m, result.parts[p.id].current / 0.04) : m), 0);
  useEffect(() => {
    soundSynth.setBuzzer(isMuted ? 0 : buzzLevel);
  }, [buzzLevel, isMuted]);
  useEffect(() => () => soundSynth.setBuzzer(0), []);

  // ---- hover / probe ------------------------------------------------------------------------------------
  const onHoverHole = useCallback((id: string | null, x: number, y: number) => {
    setHover((prev) => {
      if (!id) return prev?.touch ? prev : null;
      if (prev && prev.id === id && !prev.touch && Math.abs(prev.x - x) < 24 && Math.abs(prev.y - y) < 24) return prev;
      return { id, x, y };
    });
  }, []);
  const onHoleClickWrapped = (id: string) => {
    onHoleClick(id);
    setHover((h) => (h ? { ...h, id, touch: true } : h));
  };
  useEffect(() => {
    if (!hover?.touch) return;
    const t = setTimeout(() => setHover((h) => (h?.touch ? null : h)), 2600);
    return () => clearTimeout(t);
  }, [hover]);

  const hoverValid = !!hover && (!placing ? true : pending ? !checkPlacement(placing, pending, hover.id) || hover.id === pending : !occupied.has(hover.id));

  const tooltip = useMemo(() => {
    if (!hover || !stageRef.current) return null;
    const rect = stageRef.current.getBoundingClientRect();
    const h = getHole(hover.id);
    if (!h) return null;
    const net = netOf(hover.id);
    const v = result.net[net];
    const owner = occupied.get(hover.id);
    const ownerPart = owner ? parts.find((p) => p.id === owner) : undefined;
    const lines = [
      describeHole(hover.id),
      isRail(h.row) ? 'Whole rail is connected' : `Strip ${h.col} (${'abcde'.includes(h.row) ? 'a–e' : 'f–j'}) is connected`,
      v === undefined ? 'Not connected to anything' : !result.reachable.has(net) ? 'Floating: no path to the battery' : `${formatVolts(v)} vs battery −`,
    ];
    if (ownerPart) lines.push(`Leg of: ${partTitle(ownerPart)}`);
    const left = Math.min(rect.width - 190, Math.max(4, hover.x - rect.left + 14));
    const top = Math.min(rect.height - 80, Math.max(4, hover.y - rect.top + 16));
    return { left, top, lines };
  }, [hover, result, occupied, parts]);

  // ---- status line ----------------------------------------------------------------------------------------
  const status = (() => {
    if (placing === 'meter') return pending ? `Now tap where the black probe goes (red is on ${describeHole(pending)}).` : 'Tap where the red probe goes.';
    if (placing && pending) return `Now tap the hole for the second leg (from ${describeHole(pending)}). Esc cancels.`;
    if (placing) return `Placing ${TOOL_LABEL[placing].toLowerCase()}: tap the first hole.`;
    if (tool === 'delete') return 'Tap a part to delete it.';
    return isMobile ? 'Tap a part to inspect it. Hold a button to press it.' : 'Click a part to inspect it, hold a button to press it, drag to orbit, scroll to zoom.';
  })();

  const spec = BATTERIES[battery.battery ?? '9v'];
  const battOn = battery.on !== false;

  const cycleView = () => {
    playClick();
    setView((v) => (v === 'angle' ? 'top' : 'angle'));
    setViewNonce((n) => n + 1);
  };

  // ---- render ------------------------------------------------------------------------------------------------
  const toolBtn = (t: Tool) => (
    <button
      key={t}
      onClick={() => setTool(t)}
      aria-pressed={tool === t}
      title={`${TOOL_LABEL[t]} (${KEY_OF[t]})`}
      className={`win9x-button h-8 px-2 flex items-center gap-1.5 text-[10px] shrink-0 ${tool === t ? 'win9x-button-spidey' : ''}`}
    >
      <Glyph kind={t} />
      <span className={isMobile ? 'sr-only' : ''}>{TOOL_LABEL[t]}</span>
    </button>
  );

  const swatch = (hex: string, active: boolean, label: string, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`w-6 h-6 shrink-0 border-2 ${active ? 'border-text scale-110' : 'border-slate/60'}`}
      style={{ background: hex }}
    />
  );

  const optionsBar = (() => {
    if (tool === 'resistor')
      return (
        <label className="flex items-center gap-1.5 text-[10px] text-lavender shrink-0">
          VALUE
          <select
            value={opts.ohms}
            onChange={(e) => setOpts((o) => ({ ...o, ohms: Number(e.target.value) }))}
            className="win9x-box-recessed bg-base text-text px-1 py-1 text-[11px] font-mono"
          >
            {RESISTOR_VALUES.map((v) => (
              <option key={v} value={v}>
                {formatOhms(v)}
              </option>
            ))}
          </select>
        </label>
      );
    if (tool === 'cap')
      return (
        <label className="flex items-center gap-1.5 text-[10px] text-lavender shrink-0">
          VALUE
          <select
            value={opts.uf}
            onChange={(e) => setOpts((o) => ({ ...o, uf: Number(e.target.value) }))}
            className="win9x-box-recessed bg-base text-text px-1 py-1 text-[11px] font-mono"
          >
            {CAP_VALUES.map((v) => (
              <option key={v} value={v}>
                {formatFarads(v)}
              </option>
            ))}
          </select>
          <span className="font-body text-[11px] text-textDim normal-case">Stripe = − leg</span>
        </label>
      );
    if (tool === 'led')
      return (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-lavender">COLOUR</span>
          {(Object.keys(LED_SPECS) as LedColor[]).map((c) => swatch(LED_SPECS[c].hex, opts.led === c, `${LED_SPECS[c].label} LED`, () => setOpts((o) => ({ ...o, led: c }))))}
        </div>
      );
    if (tool === 'wire')
      return (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-lavender">COLOUR</span>
          {WIRE_COLORS.map((c) => swatch(WIRE_HEX[c], opts.wire === c, `${c} wire`, () => setOpts((o) => ({ ...o, wire: c }))))}
        </div>
      );
    return null;
  })();

  return (
    <div className="h-full min-h-0 flex flex-col font-pixel text-text select-none">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-1.5 py-1 border-b-2 border-slate/40 overflow-x-auto no-scrollbar">
        {(['select', ...PLACE_TOOLS, 'delete'] as Tool[]).map(toolBtn)}
        <span className="w-px h-6 bg-slate/50 mx-1 shrink-0" />
        <button onClick={undo} title="Undo (Ctrl+Z)" className="win9x-button h-8 px-2 flex items-center gap-1.5 text-[10px] shrink-0">
          <Glyph kind="undo" />
          <span className={isMobile ? 'sr-only' : ''}>Undo</span>
        </button>
        <div className="relative shrink-0">
          <button
            onClick={() => setExamplesOpen((o) => !o)}
            aria-expanded={examplesOpen}
            className={`win9x-button h-8 px-2 text-[10px] ${examplesOpen ? 'win9x-button-spidey' : ''}`}
          >
            Examples ▾
          </button>
        </div>
      </div>

      {/* Second row: battery, view and part options */}
      <div className="flex items-center gap-2 px-1.5 py-1 border-b-2 border-slate/40 overflow-x-auto no-scrollbar text-[10px]">
        <span className="flex items-center gap-1 text-lavender shrink-0">
          <Glyph kind="battery" />
        </span>
        <select
          value={battery.battery ?? '9v'}
          onChange={(e) => {
            updatePart(battery.id, { battery: e.target.value as BatteryType });
            playClick();
          }}
          aria-label="Battery"
          className="win9x-box-recessed bg-base text-text px-1 py-1 text-[11px] font-mono shrink-0"
        >
          {(Object.keys(BATTERIES) as BatteryType[]).map((b) => (
            <option key={b} value={b}>
              {BATTERIES[b].label}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            updatePart(battery.id, { on: !battOn });
            playClick();
          }}
          aria-pressed={battOn}
          className={`win9x-button h-7 px-2 shrink-0 ${battOn ? 'win9x-button-spidey' : ''}`}
        >
          {battOn ? 'ON' : 'OFF'}
        </button>
        <span className="w-px h-5 bg-slate/50 shrink-0" />
        <button onClick={cycleView} className="win9x-button h-7 px-2 flex items-center gap-1 shrink-0" title="Switch between 3D and top view">
          <Glyph kind="view" />
          {view === 'angle' ? 'Top view' : '3D view'}
        </button>
        <button
          onClick={() => setShowCurrent((s) => !s)}
          aria-pressed={showCurrent}
          className={`win9x-button h-7 px-2 flex items-center gap-1 shrink-0 ${showCurrent ? 'win9x-button-spidey' : ''}`}
          title="Show current flow"
        >
          <Glyph kind="flow" />
          Current
        </button>
        <button
          onClick={() => setPixel((s) => !s)}
          aria-pressed={pixel}
          className={`win9x-button h-7 px-2 flex items-center gap-1 shrink-0 ${pixel ? 'win9x-button-spidey' : ''}`}
          title="Retro pixel rendering"
        >
          <Glyph kind="pixel" />
          Pixel
        </button>
        {optionsBar && <span className="w-px h-5 bg-slate/50 shrink-0" />}
        {optionsBar}
      </div>

      {/* 3D stage */}
      <div ref={stageRef} className="relative flex-1 min-h-[220px] bg-base overflow-hidden">
        <BreadboardScene
          parts={parts}
          result={result}
          ghost={ghost}
          pending={pending}
          hover={hover?.id ?? null}
          hoverValid={hoverValid}
          selectedId={selectedId}
          pressed={pressed}
          showCurrent={showCurrent}
          view={view}
          viewNonce={viewNonce}
          pixel={pixel}
          burns={burns}
          interactive={placing ? 'place' : tool === 'delete' ? 'delete' : 'select'}
          onHoverHole={onHoverHole}
          onHoleClick={onHoleClickWrapped}
          onPartClick={onPartClick}
          onPress={press}
          onKnob={onKnob}
          onToggleBattery={() => {
            updatePart(battery.id, { on: !battOn });
            playClick();
          }}
          onBackgroundClick={() => {
            if (pending) setPending(null);
            else setSelectedId(null);
          }}
        />

        {tooltip && (
          <div className="absolute pointer-events-none win9x-box-raised px-2 py-1 text-[10px] leading-relaxed max-w-[200px] z-10" style={{ left: tooltip.left, top: tooltip.top }}>
            {tooltip.lines.map((l, i) => (
              <div key={i} className={i === 0 ? 'text-text' : 'text-textDim font-body text-[11px]'}>
                {l}
              </div>
            ))}
          </div>
        )}

        {meter && !selected && (
          <button
            onClick={() => setSelectedId(meter.id)}
            className={`absolute z-10 win9x-box-raised px-2 py-1 font-mono text-[12px] text-text flex items-center gap-1.5 ${isMobile ? 'top-1 right-1' : 'top-2 right-2'}`}
            title="Multimeter reading"
          >
            <Glyph kind="meter" />
            {formatVolts(result.parts[meter.id]?.drop ?? 0)}
          </button>
        )}

        {result.short && (
          <div role="alert" className="absolute top-2 left-1/2 -translate-x-1/2 bg-red text-white px-3 py-1.5 text-[10px] border-2 border-black/40 animate-pulse z-10 max-w-[90%] text-center">
            SHORT CIRCUIT! {formatAmps(result.batteryCurrent)} straight from + to −. The battery is getting hot.
          </div>
        )}

        {examplesOpen && (
          <div className="absolute top-1 left-1 z-20 win9x-box-raised p-1 w-[min(320px,calc(100%-8px))] max-h-[80%] overflow-y-auto" data-overlay-open="true">
            {PRESETS.map((p, i) => (
              <button key={p.id} onClick={() => loadPreset(i)} className="block w-full text-left px-2 py-1.5 hover:bg-spidey hover:text-onAccent group">
                <div className="text-[10px] text-text group-hover:text-onAccent">{p.title}</div>
                <div className="font-body text-[11px] text-textDim group-hover:text-onAccent/85 leading-snug">{p.blurb}</div>
              </button>
            ))}
            <div className="border-t-2 border-slate/40 mt-1 pt-1">
              <button
                onClick={() => {
                  setExamplesOpen(false);
                  clearBoard();
                }}
                className="block w-full text-left px-2 py-1.5 hover:bg-spidey hover:text-onAccent text-[10px] text-text"
              >
                Clear the board (start from scratch)
              </button>
            </div>
          </div>
        )}

        {lesson && !selected && (
          <div className={`absolute z-10 win9x-box-raised p-2 ${isMobile ? 'left-1 right-1 bottom-1' : 'left-2 bottom-2 w-72'}`}>
            <div className="flex justify-between items-start gap-2">
              <div className="text-[10px] text-text">{lesson.title}</div>
              <button onClick={() => setLesson(null)} aria-label="Close lesson" className="win9x-button w-5 h-5 text-[10px] leading-none">
                ×
              </button>
            </div>
            <p className="font-body text-[12px] text-textDim leading-snug mt-1">{lesson.blurb}</p>
          </div>
        )}

        {selected && (
          <Inspector
            part={selected}
            result={result}
            pressed={pressed.has(selected.id)}
            mobile={isMobile}
            onClose={() => setSelectedId(null)}
            onChange={(patch) => updatePart(selected.id, patch)}
            onDelete={() => removePart(selected.id)}
            onMove={() => movePart(selected.id)}
            onPress={(down) => press(selected.id, down)}
          />
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between gap-2 px-2 py-1 border-t-2 border-slate/40 text-[10px] min-h-[30px]">
        <span
          className={`truncate font-body text-[12px] ${message?.tone === 'warn' ? 'text-red' : message?.tone === 'good' ? 'text-green' : 'text-textDim'}`}
          aria-live="polite"
        >
          {message?.text ?? status}
        </span>
        <span className="shrink-0 font-mono text-[11px] text-lavender">
          {battOn ? `${formatVolts(spec.volts)} · ${formatAmps(result.batteryCurrent)}` : 'Battery off'}
        </span>
      </div>
    </div>
  );
};

// ---- Inspector -------------------------------------------------------------------------------------------------
const Inspector: React.FC<{
  part: Part;
  result: ReturnType<typeof solveCircuit>;
  pressed: boolean;
  mobile: boolean;
  onClose: () => void;
  onChange: (patch: Partial<Part>) => void;
  onDelete: () => void;
  onMove: () => void;
  onPress: (down: boolean) => void;
}> = ({ part, result, pressed, mobile, onClose, onChange, onDelete, onMove, onPress }) => {
  const r = result.parts[part.id];
  const current = r?.current ?? 0;
  const drop = r?.drop ?? 0;
  const rows: [string, string][] = [];
  let note: { text: string; tone: 'good' | 'warn' | 'info' } | null = null;

  if (part.kind === 'battery') {
    const spec = BATTERIES[part.battery ?? '9v'];
    rows.push(['Voltage', formatVolts(spec.volts)], ['Delivering', formatAmps(result.batteryCurrent)], ['Power', `${(Math.abs(result.batteryCurrent) * drop * 1000).toFixed(0)} mW`]);
    if (result.short) note = { text: 'Short circuit! Something connects + straight to −.', tone: 'warn' };
    else if (part.on === false) note = { text: 'Switched off. Nothing will flow.', tone: 'info' };
  } else {
    rows.push(['Current', formatAmps(current)], ['Voltage across', formatVolts(Math.abs(drop))]);
    if (part.kind === 'resistor') rows.push(['Power', `${((r?.power ?? 0) * 1000).toFixed(1)} mW`]);
    if (part.kind === 'led') {
      const spec = LED_SPECS[(part.color as LedColor) ?? 'red'];
      const bright = Math.min(100, Math.round(Math.sqrt(Math.max(0, current) / LED_FULL_BRIGHT) * 100));
      rows.push(['Brightness', part.burnt ? '—' : `${bright}%`], ['Needs', `${spec.vf.toFixed(1)} V to turn on`]);
      if (part.burnt) note = { text: 'Burnt out. Too much current flowed. Add a resistor before replacing it.', tone: 'warn' };
      else if (current > LED_HOT) note = { text: 'Too much current! It will burn out. Use a bigger resistor.', tone: 'warn' };
      else if (current > 1e-4) note = { text: 'Lit. 5–20 mA is the happy range for an LED.', tone: 'good' };
      else if (drop < -0.3) note = { text: "It's backwards. LEDs only conduct one way: flip it so the anode (+) faces the battery's +.", tone: 'warn' };
      else if (drop > 0.1) note = { text: `Not enough voltage: it needs ${spec.vf.toFixed(1)} V but gets ${drop.toFixed(2)} V.`, tone: 'info' };
      else note = { text: 'No current. Is the circuit a complete loop back to −?', tone: 'info' };
    }
    if (part.kind === 'buzzer') {
      if (r?.on) note = { text: 'Beeping! Active buzzers have their own oscillator inside.', tone: 'good' };
      else if (drop < -0.3) note = { text: "It's backwards. The + leg must face the battery's +.", tone: 'warn' };
      else note = { text: `Silent. It needs about ${BUZZER.vf + 0.6} V and a complete loop.`, tone: 'info' };
    }
    if (part.kind === 'button') note = { text: pressed ? 'Pressed: the switch is closed, current can flow.' : 'Released: the switch is open, nothing flows through it.', tone: 'info' };
    if (part.kind === 'pot') {
      rows.push(['Resistance now', formatOhms(Math.round(potOhms(part)))], ['Knob', `${Math.round((part.pos ?? 0.5) * 100)}%`]);
      note = { text: 'Drag the knob in 3D (or use the slider) to change its resistance. Less resistance, more current.', tone: 'info' };
    }
    if (part.kind === 'cap') {
      const v = result.capV[part.id] ?? drop;
      rows.splice(1, 1, ['Charge', formatVolts(v)]);
      if (part.burnt) note = { text: 'Vented! It was connected backwards. The striped leg must go to the lower voltage (−).', tone: 'warn' };
      else if (v < -0.3) note = { text: 'Backwards! The striped (−) leg is at the higher voltage. Flip it before it pops.', tone: 'warn' };
      else if (current > 1e-4) note = { text: 'Charging: it stores energy like a tiny bucket of electrons.', tone: 'good' };
      else if (current < -1e-4) note = { text: 'Discharging: it is giving its stored energy back to the circuit.', tone: 'good' };
      else note = { text: Math.abs(v) > 0.05 ? 'Holding its charge.' : 'Empty. Connect it to a voltage to charge it.', tone: 'info' };
    }
    if (part.kind === 'meter') {
      rows.length = 0;
      rows.push(['Reading', formatVolts(drop)], ['Red probe', describeHole(part.pins[0])], ['Black probe', describeHole(part.pins[1])]);
      note = { text: 'A voltmeter shows the difference between its probes and draws no current. Put black on − to measure any point.', tone: 'info' };
    }
    if (part.kind === 'wire' && Math.abs(current) > 0.5) note = { text: 'Lots of current in this wire. Check for a short.', tone: 'warn' };
  }

  return (
    <div
      className={`absolute z-20 win9x-box-raised p-2 text-[10px] ${mobile ? 'left-1 right-1 bottom-1 max-h-[55%] overflow-y-auto' : 'right-2 top-2 w-64'}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-text leading-snug">{partTitle(part)}</div>
        <button onClick={onClose} aria-label="Close inspector" className="win9x-button w-5 h-5 leading-none shrink-0">
          ×
        </button>
      </div>
      <div className="font-mono text-[10px] text-lavender mt-0.5">
        {part.kind === 'battery' ? 'Leads: + rail / − rail (top)' : `${describeHole(part.pins[0])} → ${describeHole(part.pins[1])}`}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 mt-2 font-body text-[12px]">
        {rows.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt className="text-textDim">{k}</dt>
            <dd className="text-text font-mono text-right">{v}</dd>
          </React.Fragment>
        ))}
      </dl>
      {note && <p className={`mt-2 font-body text-[12px] leading-snug ${note.tone === 'warn' ? 'text-red' : note.tone === 'good' ? 'text-green' : 'text-textDim'}`}>{note.text}</p>}

      <div className="flex flex-wrap items-center gap-1 mt-2">
        {part.kind === 'resistor' && (
          <select
            value={part.ohms ?? 220}
            onChange={(e) => onChange({ ohms: Number(e.target.value) })}
            aria-label="Resistance"
            className="win9x-box-recessed bg-base text-text px-1 py-1 text-[11px] font-mono"
          >
            {RESISTOR_VALUES.map((v) => (
              <option key={v} value={v}>
                {formatOhms(v)}
              </option>
            ))}
          </select>
        )}
        {part.kind === 'pot' && (
          <>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round((part.pos ?? 0.5) * 100)}
              onChange={(e) => onChange({ pos: Number(e.target.value) / 100 })}
              aria-label="Knob position"
              className="flex-1 min-w-[120px] accent-[rgb(var(--c-spidey))]"
            />
            <select
              value={part.ohms ?? 10000}
              onChange={(e) => onChange({ ohms: Number(e.target.value) })}
              aria-label="Potentiometer value"
              className="win9x-box-recessed bg-base text-text px-1 py-1 text-[11px] font-mono"
            >
              {POT_VALUES.map((v) => (
                <option key={v} value={v}>
                  {formatOhms(v)}
                </option>
              ))}
            </select>
          </>
        )}
        {part.kind === 'cap' && (
          <select
            value={part.uf ?? 1000}
            onChange={(e) => onChange({ uf: Number(e.target.value) })}
            aria-label="Capacitance"
            className="win9x-box-recessed bg-base text-text px-1 py-1 text-[11px] font-mono"
          >
            {CAP_VALUES.map((v) => (
              <option key={v} value={v}>
                {formatFarads(v)}
              </option>
            ))}
          </select>
        )}
        {part.kind === 'led' &&
          (Object.keys(LED_SPECS) as LedColor[]).map((c) => (
            <button
              key={c}
              onClick={() => onChange({ color: c })}
              aria-label={`${LED_SPECS[c].label} LED`}
              aria-pressed={part.color === c}
              className={`w-6 h-6 border-2 ${part.color === c ? 'border-text' : 'border-slate/60'}`}
              style={{ background: LED_SPECS[c].hex }}
            />
          ))}
        {part.kind === 'wire' &&
          WIRE_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onChange({ color: c })}
              aria-label={`${c} wire`}
              aria-pressed={part.color === c}
              className={`w-6 h-6 border-2 ${part.color === c ? 'border-text' : 'border-slate/60'}`}
              style={{ background: WIRE_HEX[c] }}
            />
          ))}
        {part.kind === 'battery' && (
          <>
            <select
              value={part.battery ?? '9v'}
              onChange={(e) => onChange({ battery: e.target.value as BatteryType })}
              aria-label="Battery type"
              className="win9x-box-recessed bg-base text-text px-1 py-1 text-[11px] font-mono"
            >
              {(Object.keys(BATTERIES) as BatteryType[]).map((b) => (
                <option key={b} value={b}>
                  {BATTERIES[b].label}
                </option>
              ))}
            </select>
            <button onClick={() => onChange({ on: part.on === false })} className={`win9x-button h-7 px-2 ${part.on !== false ? 'win9x-button-spidey' : ''}`}>
              {part.on !== false ? 'Switch off' : 'Switch on'}
            </button>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-1 mt-2">
        {part.kind === 'button' && (
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              onPress(true);
            }}
            onPointerUp={() => onPress(false)}
            onPointerLeave={() => pressed && onPress(false)}
            className={`win9x-button h-9 px-3 flex-1 ${pressed ? 'win9x-button-spidey' : ''}`}
            style={{ touchAction: 'none' }}
          >
            Hold to press
          </button>
        )}
        {(part.kind === 'led' || part.kind === 'cap') && part.burnt && (
          <button onClick={() => onChange({ burnt: false })} className="win9x-button h-7 px-2 win9x-button-spidey">
            Replace {part.kind === 'led' ? 'LED' : 'capacitor'}
          </button>
        )}
        {part.kind !== 'battery' && (
          <>
            <button onClick={onMove} className="win9x-button h-7 px-2 flex items-center gap-1">
              <Glyph kind="move" /> {part.kind === 'meter' ? 'Move probes' : 'Move'}
            </button>
            {(part.kind === 'led' || part.kind === 'buzzer' || part.kind === 'cap' || part.kind === 'meter') && (
              <button onClick={() => onChange({ pins: [part.pins[1], part.pins[0]] })} className="win9x-button h-7 px-2 flex items-center gap-1">
                <Glyph kind="flip" /> Flip
              </button>
            )}
            <button onClick={onDelete} className="win9x-button h-7 px-2 flex items-center gap-1">
              <Glyph kind="delete" /> Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
};
