'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Window } from '../Window';
import { useSound } from '@/context/SoundContext';
import { useMascot } from '@/context/MascotContext';

type Difficulty = 'beginner' | 'intermediate';
type Status = 'ready' | 'playing' | 'won' | 'lost';

interface Cell {
  mine: boolean;
  adj: number;
  revealed: boolean;
  flagged: boolean;
  exploded?: boolean;
}

const CONFIGS: Record<Difficulty, { w: number; h: number; mines: number; label: string }> = {
  beginner: { w: 9, h: 9, mines: 10, label: 'Beginner' },
  intermediate: { w: 16, h: 16, mines: 40, label: 'Intermediate' },
};

const BEST_KEY = 'adam_os_minesweeper_best';
const LONG_PRESS_MS = 450;

// Classic Win98 number colours, nudged for legibility on the dark theme.
const NUMBER_COLORS = ['', '#6C8BFF', '#72FFB4', '#FF3A66', '#A78BFA', '#FF9F43', '#3DD6D0', '#FFFFFF', '#B0B3BC'];

const emptyBoard = (w: number, h: number): Cell[] =>
  Array.from({ length: w * h }, () => ({ mine: false, adj: 0, revealed: false, flagged: false }));

const neighbours = (i: number, w: number, h: number): number[] => {
  const x = i % w;
  const y = Math.floor(i / w);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) out.push(ny * w + nx);
    }
  }
  return out;
};

// Mines are placed after the first click, keeping that cell and its neighbours clear.
const plantMines = (board: Cell[], w: number, h: number, mines: number, safe: number): Cell[] => {
  const excluded = new Set([safe, ...neighbours(safe, w, h)]);
  let candidates = board.map((_, i) => i).filter((i) => !excluded.has(i));
  if (candidates.length < mines) candidates = board.map((_, i) => i).filter((i) => i !== safe);
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const next = board.map((c) => ({ ...c, mine: false, adj: 0 }));
  candidates.slice(0, mines).forEach((i) => (next[i].mine = true));
  next.forEach((c, i) => {
    c.adj = neighbours(i, w, h).filter((n) => next[n].mine).length;
  });
  return next;
};

// Reveals the given cells (flood-filling zeros). Returns the index of a mine hit, or -1.
const revealCells = (board: Cell[], start: number[], w: number, h: number): number => {
  const stack = [...start];
  let hit = -1;
  while (stack.length) {
    const i = stack.pop()!;
    const c = board[i];
    if (c.revealed || c.flagged) continue;
    c.revealed = true;
    if (c.mine) {
      hit = i;
      continue;
    }
    if (c.adj === 0) neighbours(i, w, h).forEach((n) => !board[n].revealed && stack.push(n));
  }
  return hit;
};

const readBest = (): Partial<Record<Difficulty, number>> => {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const Led: React.FC<{ value: number; label: string }> = ({ value, label }) => {
  const clamped = Math.max(-99, Math.min(999, value));
  const text = clamped < 0 ? `-${String(Math.abs(clamped)).padStart(2, '0')}` : String(clamped).padStart(3, '0');
  return (
    <div
      role="status"
      aria-label={`${label}: ${clamped}`}
      className="bg-black text-red font-mono font-bold text-xl leading-none px-1.5 py-1 tracking-widest border border-slate/60 shadow-[inset_1px_1px_0_#0B0B10] min-w-[3.6rem] text-center"
      style={{ textShadow: '0 0 6px rgba(255,58,102,0.75)' }}
    >
      {text}
    </div>
  );
};

export const MinesweeperWindow: React.FC = () => {
  const { playClick, playError, playDownloadFanfare } = useSound();
  const { setFrame, setSpeechText } = useMascot();

  const [difficulty, setDifficulty] = useState<Difficulty>('beginner');
  const cfg = CONFIGS[difficulty];
  const [board, setBoard] = useState<Cell[]>(() => emptyBoard(cfg.w, cfg.h));
  const [status, setStatus] = useState<Status>('ready');
  const [elapsed, setElapsed] = useState(0);
  const [pressing, setPressing] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [best, setBest] = useState<Partial<Record<Difficulty, number>>>({});
  const [coarse, setCoarse] = useState(false);

  const startRef = useRef<number>(0);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const lastPointerType = useRef<string>('mouse');
  const mascotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setBest(readBest());
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(pointer: coarse)');
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  useEffect(
    () => () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      if (mascotTimer.current) clearTimeout(mascotTimer.current);
    },
    []
  );

  // Timer
  useEffect(() => {
    if (status !== 'playing') return;
    const id = setInterval(() => {
      setElapsed(Math.min(999, Math.floor((Date.now() - startRef.current) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, [status]);

  const reset = useCallback(
    (diff: Difficulty = difficulty) => {
      const c = CONFIGS[diff];
      setBoard(emptyBoard(c.w, c.h));
      setStatus('ready');
      setElapsed(0);
      setPressing(false);
      setCursor((cur) => Math.min(cur, c.w * c.h - 1));
    },
    [difficulty]
  );

  const changeDifficulty = (diff: Difficulty) => {
    playClick();
    setDifficulty(diff);
    setCursor(0);
    reset(diff);
  };

  const mascotSay = (frame: Parameters<typeof setFrame>[0], text: string) => {
    setFrame(frame);
    setSpeechText(text);
    if (mascotTimer.current) clearTimeout(mascotTimer.current);
    mascotTimer.current = setTimeout(() => setFrame('idle'), 2500);
  };

  const finish = (next: Cell[], hit: number) => {
    if (hit >= 0) {
      next.forEach((c) => {
        if (c.mine && !c.flagged) c.revealed = true;
      });
      next[hit].exploded = true;
      setBoard(next);
      setStatus('lost');
      playError();
      mascotSay('sleeping', 'Caught in the web! Click the face to try again.');
      return;
    }
    const safeLeft = next.some((c) => !c.mine && !c.revealed);
    if (!safeLeft) {
      next.forEach((c) => {
        if (c.mine) c.flagged = true;
      });
      const time = Math.min(999, Math.max(1, Math.round((Date.now() - startRef.current) / 1000)));
      setElapsed(time);
      setBoard(next);
      setStatus('won');
      playDownloadFanfare();
      const prev = best[difficulty];
      const isRecord = prev === undefined || time < prev;
      if (isRecord) {
        const updated = { ...best, [difficulty]: time };
        setBest(updated);
        try {
          localStorage.setItem(BEST_KEY, JSON.stringify(updated));
        } catch {
          /* storage unavailable */
        }
      }
      mascotSay(
        'celebrating',
        isRecord ? `New ${cfg.label} record: ${time}s! Spider-sense tingling!` : `Cleared in ${time}s! Every mine webbed up.`
      );
      return;
    }
    setBoard(next);
  };

  const openCell = (i: number) => {
    if (status === 'won' || status === 'lost') return;
    const cell = board[i];
    if (cell.flagged) return;

    if (status === 'ready') {
      const planted = plantMines(board, cfg.w, cfg.h, cfg.mines, i);
      startRef.current = Date.now();
      setStatus('playing');
      playClick();
      const hit = revealCells(planted, [i], cfg.w, cfg.h);
      finish(planted, hit);
      return;
    }

    const next = board.map((c) => ({ ...c }));
    if (cell.revealed) {
      // Chord: reveal neighbours when the flag count matches the number.
      if (cell.adj === 0) return;
      const ns = neighbours(i, cfg.w, cfg.h);
      const flags = ns.filter((n) => next[n].flagged).length;
      if (flags !== cell.adj) return;
      const targets = ns.filter((n) => !next[n].revealed && !next[n].flagged);
      if (!targets.length) return;
      playClick();
      finish(next, revealCells(next, targets, cfg.w, cfg.h));
      return;
    }
    playClick();
    finish(next, revealCells(next, [i], cfg.w, cfg.h));
  };

  const toggleFlag = (i: number) => {
    if (status === 'won' || status === 'lost') return;
    if (board[i].revealed) return;
    playClick();
    setBoard((b) => b.map((c, idx) => (idx === i ? { ...c, flagged: !c.flagged } : c)));
  };

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onCellPointerDown = (e: React.PointerEvent, i: number) => {
    lastPointerType.current = e.pointerType;
    longPressFired.current = false;
    setCursor(i);
    if (e.button !== 0) return;
    if (status === 'ready' || status === 'playing') setPressing(true);
    if (e.pointerType === 'touch') {
      clearLongPress();
      longPressTimer.current = setTimeout(() => {
        longPressFired.current = true;
        longPressTimer.current = null;
        setPressing(false);
        toggleFlag(i);
        try {
          navigator.vibrate?.(20);
        } catch {
          /* ignore */
        }
      }, LONG_PRESS_MS);
    }
  };

  const onCellPointerEnd = () => {
    clearLongPress();
    setPressing(false);
  };

  const onCellClick = (i: number) => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    openCell(i);
  };

  const onCellContextMenu = (e: React.MouseEvent, i: number) => {
    e.preventDefault();
    // On touch, long-press is handled by our own timer; ignore the native contextmenu.
    if (lastPointerType.current === 'touch') return;
    toggleFlag(i);
  };

  const focusCell = (i: number) => {
    setCursor(i);
    cellRefs.current[i]?.focus();
  };

  const onBoardKeyDown = (e: React.KeyboardEvent) => {
    const x = cursor % cfg.w;
    const y = Math.floor(cursor / cfg.w);
    let next = -1;
    switch (e.key) {
      case 'ArrowUp':
        next = ((y - 1 + cfg.h) % cfg.h) * cfg.w + x;
        break;
      case 'ArrowDown':
        next = ((y + 1) % cfg.h) * cfg.w + x;
        break;
      case 'ArrowLeft':
        next = y * cfg.w + ((x - 1 + cfg.w) % cfg.w);
        break;
      case 'ArrowRight':
        next = y * cfg.w + ((x + 1) % cfg.w);
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        toggleFlag(cursor);
        return;
      default:
        return; // Enter / Space trigger the focused button's native click.
    }
    e.preventDefault();
    focusCell(next);
  };

  const flagsUsed = board.filter((c) => c.flagged).length;
  const face = status === 'won' ? '😎' : status === 'lost' ? '😵' : pressing ? '😮' : '🙂';
  const cellSize = coarse ? 30 : 24;

  const cellLabel = (c: Cell, i: number): string => {
    const pos = `Row ${Math.floor(i / cfg.w) + 1}, column ${(i % cfg.w) + 1}`;
    if (c.revealed) {
      if (c.mine) return `${pos}: mine`;
      return c.adj ? `${pos}: ${c.adj}` : `${pos}: empty`;
    }
    if (c.flagged) return `${pos}: flagged`;
    return `${pos}: hidden`;
  };

  return (
    <Window id="minesweeper">
      <div className="flex flex-col gap-2 font-pixel select-none text-text">
        {/* Difficulty bar */}
        <div className="flex flex-wrap items-center gap-1 text-[10px]">
          {(Object.keys(CONFIGS) as Difficulty[]).map((d) => (
            <button
              key={d}
              onClick={() => changeDifficulty(d)}
              aria-pressed={difficulty === d}
              className={`win9x-button px-2 py-1 ${difficulty === d ? 'win9x-button-spidey' : ''}`}
            >
              {CONFIGS[d].label}
            </button>
          ))}
          <span className="ml-auto font-mono text-[10px] text-lavender">
            BEST: {best[difficulty] !== undefined ? `${best[difficulty]}s` : '---'}
          </span>
        </div>

        {/* Game frame */}
        <div className="win9x-box-raised p-2 flex flex-col gap-2 max-w-full">
          {/* Header: counter / face / timer */}
          <div className="win9x-box-recessed flex items-center justify-between px-2 py-1.5">
            <Led value={cfg.mines - flagsUsed} label="Mines left" />
            <button
              onClick={() => {
                playClick();
                reset();
              }}
              aria-label="New game"
              title="New game"
              className="win9x-button relative w-10 h-10 flex items-center justify-center text-xl leading-none"
            >
              <span aria-hidden>{face}</span>
              {/* tiny spider-web twist */}
              <span aria-hidden className="absolute -top-1 -right-1 text-[10px] leading-none">
                🕷
              </span>
            </button>
            <Led value={elapsed} label="Seconds" />
          </div>

          {/* Board (scrolls horizontally if the window is narrow) */}
          <div className="overflow-x-auto overflow-y-hidden max-w-full">
            <div
              role="grid"
              aria-label={`Minesweeper ${cfg.label} board`}
              onKeyDown={onBoardKeyDown}
              className="win9x-box-recessed inline-grid p-[3px] mx-auto"
              style={{ gridTemplateColumns: `repeat(${cfg.w}, ${cellSize}px)`, touchAction: 'manipulation' }}
            >
              {board.map((c, i) => {
                const shown = c.revealed;
                const wrongFlag = status === 'lost' && c.flagged && !c.mine;
                let content: React.ReactNode = null;
                if (wrongFlag) content = <span className="text-red">✕</span>;
                else if (c.flagged) content = '🚩';
                else if (shown && c.mine) content = '🕷';
                else if (shown && c.adj > 0)
                  content = (
                    <span className="font-mono font-bold" style={{ color: NUMBER_COLORS[c.adj] }}>
                      {c.adj}
                    </span>
                  );
                return (
                  <button
                    key={i}
                    ref={(el) => {
                      cellRefs.current[i] = el;
                    }}
                    role="gridcell"
                    tabIndex={i === cursor ? 0 : -1}
                    aria-label={cellLabel(c, i)}
                    onClick={() => onCellClick(i)}
                    onContextMenu={(e) => onCellContextMenu(e, i)}
                    onPointerDown={(e) => onCellPointerDown(e, i)}
                    onPointerUp={onCellPointerEnd}
                    onPointerLeave={onCellPointerEnd}
                    onPointerCancel={onCellPointerEnd}
                    onFocus={() => setCursor(i)}
                    style={{ width: cellSize, height: cellSize, fontSize: coarse ? 15 : 13, WebkitTouchCallout: 'none' }}
                    className={`flex items-center justify-center leading-none focus-visible:outline-offset-[-2px] ${
                      shown
                        ? `border border-slate/25 ${c.exploded ? 'bg-red' : 'bg-base'}`
                        : 'bg-panel2 shadow-[inset_2px_2px_0_#FFFFFF,inset_-2px_-2px_0_#0B0B10] active:shadow-none active:bg-base'
                    }`}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <p className="font-mono text-[10px] text-lavender leading-relaxed">
          {status === 'won'
            ? `Swept in ${elapsed}s.`
            : status === 'lost'
            ? 'Boom. Click the face to restart.'
            : coarse
            ? 'Tap to reveal · long-press to flag · tap a number to chord.'
            : 'Click reveal · right-click flag · click number to chord · arrows + Enter / F.'}
        </p>
      </div>
    </Window>
  );
};
