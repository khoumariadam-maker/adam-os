'use client';

import React from 'react';
import { useWindowManager, WindowId } from '@/context/WindowManagerContext';
import { useSound } from '@/context/SoundContext';
import { PROFILE } from '@/lib/profile';
import {
  buildHeatmap,
  describeEvent,
  GhEvent,
  GitHubErrorKind,
  heatmapTotal,
  HeatCell,
  timeAgo,
  useGitHub,
} from '@/lib/github';

export const GITHUB_WINDOW_ID: WindowId = 'github';

// ---------------------------------------------------------------------------
// Shared pieces (also used by GitHubWindow)
// ---------------------------------------------------------------------------

// Sequential single-hue scale: accent at increasing opacity. Zero is a neutral track.
const LEVELS = ['bg-slate/20', 'bg-spidey/35', 'bg-spidey/55', 'bg-spidey/80', 'bg-spidey'] as const;

const levelFor = (count: number, max: number): number => {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));
};

const fmtDay = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

export const GitHubHeatmap: React.FC<{
  events: GhEvent[];
  cell?: number;
  gap?: number;
  showLegend?: boolean;
}> = ({ events, cell = 10, gap = 2, showLegend = false }) => {
  const cols = buildHeatmap(events, 7);
  const max = Math.max(0, ...cols.flat().map((c) => c.count));
  const total = heatmapTotal(cols);
  const label = (c: HeatCell) => `${c.count} push${c.count === 1 ? '' : 'es'} · ${fmtDay(c.date)}`;
  return (
    <div className="flex flex-col gap-1">
      <div
        role="img"
        aria-label={`${total} public pushes in the last 7 weeks`}
        className="flex"
        style={{ gap }}
        dir="ltr"
      >
        {cols.map((col, ci) => (
          <div key={ci} className="flex flex-col" style={{ gap }}>
            {col.map((c) => (
              <span
                key={c.date}
                title={c.inRange ? label(c) : undefined}
                className={c.inRange ? `${LEVELS[levelFor(c.count, max)]} hover:outline hover:outline-1 hover:outline-text` : 'opacity-0'}
                style={{ width: cell, height: cell }}
              />
            ))}
          </div>
        ))}
      </div>
      {showLegend && (
        <div className="flex items-center gap-1 font-mono text-[10px] text-lavender" dir="ltr" aria-hidden>
          <span>less</span>
          {LEVELS.map((l) => (
            <span key={l} className={l} style={{ width: cell, height: cell }} />
          ))}
          <span>more</span>
          <span className="ms-auto text-textDim">{total} pushes / 7 wk</span>
        </div>
      )}
    </div>
  );
};

export const GitHubSkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading GitHub activity">
    <div className="flex items-center gap-2">
      <span className="w-10 h-10 bg-slate/25 motion-safe:animate-pulse" />
      <span className="flex-1 flex flex-col gap-1.5">
        <span className="h-2.5 w-3/4 bg-slate/25 motion-safe:animate-pulse" />
        <span className="h-2.5 w-1/2 bg-slate/20 motion-safe:animate-pulse" />
      </span>
    </div>
    <span className="h-[82px] w-full bg-slate/15 motion-safe:animate-pulse" />
    {Array.from({ length: rows }, (_, i) => (
      <span key={i} className="h-2.5 bg-slate/20 motion-safe:animate-pulse" style={{ width: `${90 - i * 15}%` }} />
    ))}
  </div>
);

const errorDetail = (kind: GitHubErrorKind, resetAt?: number): string => {
  switch (kind) {
    case 'rate_limit':
      return resetAt
        ? `API rate limit hit · back around ${new Date(resetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : 'API rate limit hit · try again in a bit';
    case 'offline':
      return 'You seem to be offline.';
    case 'not_found':
      return 'Profile not found.';
    default:
      return 'Could not reach api.github.com.';
  }
};

export const GitHubFallback: React.FC<{ kind: GitHubErrorKind; resetAt?: number; onRetry?: () => void }> = ({
  kind,
  resetAt,
  onRetry,
}) => (
  <div className="flex flex-col gap-2 text-[12px] text-textDim">
    <p>
      <span aria-hidden>💤 </span>GitHub is taking a nap —{' '}
      <a href={PROFILE.github} target="_blank" rel="noopener noreferrer" className="text-spidey underline font-bold">
        open profile ↗
      </a>
    </p>
    <p className="font-mono text-[10px] text-lavender">{errorDetail(kind, resetAt)}</p>
    {onRetry && kind !== 'not_found' && (
      <button onClick={onRetry} className="win9x-button self-start px-2 py-1 font-pixel text-[10px] text-text">
        ↻ Retry
      </button>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// Desktop widget
// ---------------------------------------------------------------------------
export const GitHubWidget: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { openWindow } = useWindowManager();
  const { playClick } = useSound();
  const { state, retry } = useGitHub();

  const open = () => {
    playClick();
    openWindow(GITHUB_WINDOW_ID);
  };

  return (
    <aside
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      className={`w-60 win9x-box-raised ${className}`}
      aria-label="GitHub activity"
    >
      <button
        onClick={open}
        className="title-bar-active w-full px-2 py-1 font-pixel text-[11px] text-onAccent flex items-center gap-1.5 text-start"
        title="Open GitHub.exe"
      >
        <span aria-hidden>🐙</span>
        <span className="flex-1">GitHub</span>
        <span aria-hidden className="text-[10px] opacity-80">
          ⧉
        </span>
      </button>

      <div className="p-3 space-y-2.5">
        {state.status === 'loading' && <GitHubSkeleton />}

        {state.status === 'error' && <GitHubFallback kind={state.kind} resetAt={state.resetAt} onRetry={retry} />}

        {state.status === 'ready' && (
          <>
            <div className="flex items-center gap-2">
              <img
                src={`${state.data.user.avatar_url}${state.data.user.avatar_url.includes('?') ? '&' : '?'}s=24`}
                alt=""
                width={40}
                height={40}
                className="w-10 h-10 pixel-art border border-slate bg-panel2"
                style={{ imageRendering: 'pixelated' }}
              />
              <div className="min-w-0">
                <p className="font-pixel text-[11px] text-text truncate">@{state.data.user.login}</p>
                <p className="text-[12px] text-textDim">
                  <span className="font-mono font-bold text-text">{state.data.user.public_repos}</span> public repos
                </p>
              </div>
            </div>

            <div className="win9x-box-recessed bg-panel p-1.5 flex justify-center">
              <GitHubHeatmap events={state.data.events} cell={10} gap={2} />
            </div>

            {state.data.events.length > 0 ? (
              <ul className="space-y-1">
                {state.data.events.slice(0, 3).map((e) => (
                  <li key={e.id} className="text-[11px] leading-snug text-textDim truncate" dir="ltr">
                    {describeEvent(e)} <span className="text-lavender">· {timeAgo(e.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-lavender">No recent public activity.</p>
            )}
          </>
        )}
      </div>
    </aside>
  );
};
