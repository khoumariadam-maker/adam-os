'use client';

// Client-side, unauthenticated GitHub data for the desktop widget + GitHub window.
// The site is static (no backend), so we call the public REST API directly, cache the
// result in sessionStorage for 10 minutes, and degrade gracefully on rate limits/offline.

import { useCallback, useEffect, useState } from 'react';
import { PROFILE } from '@/lib/profile';

const API = 'https://api.github.com';
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_PREFIX = 'adam_os_github_v1:';

export const GITHUB_USER: string = (() => {
  const m = PROFILE.github.match(/github\.com\/([^/?#]+)/i);
  return m ? m[1] : '';
})();

export interface GhUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
  location: string | null;
}

export interface GhRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  html_url: string;
  pushed_at: string;
  updated_at: string;
  fork: boolean;
}

export interface GhEvent {
  id: string;
  type: string;
  created_at: string;
  repo: { name: string };
  payload: {
    size?: number;
    commits?: { message: string }[];
    ref?: string | null;
    ref_type?: string;
    action?: string;
  };
}

export interface GitHubData {
  user: GhUser;
  repos: GhRepo[];
  events: GhEvent[];
  fetchedAt: number;
}

export type GitHubErrorKind = 'rate_limit' | 'offline' | 'not_found' | 'error';

export type GitHubState =
  | { status: 'loading' }
  | { status: 'ready'; data: GitHubData; stale: boolean }
  | { status: 'error'; kind: GitHubErrorKind; resetAt?: number };

class GitHubError extends Error {
  constructor(public kind: GitHubErrorKind, public resetAt?: number) {
    super(kind);
  }
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------
const cacheKey = (user: string) => `${CACHE_PREFIX}${user.toLowerCase()}`;

const readCache = (user: string): GitHubData | null => {
  try {
    const raw = sessionStorage.getItem(cacheKey(user));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GitHubData;
    if (!parsed || typeof parsed.fetchedAt !== 'number' || !parsed.user) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeCache = (user: string, data: GitHubData) => {
  try {
    sessionStorage.setItem(cacheKey(user), JSON.stringify(data));
  } catch {
    /* storage unavailable or full */
  }
};

const isFresh = (d: GitHubData) => Date.now() - d.fetchedAt < CACHE_TTL_MS;

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------
const getJson = async <T,>(path: string, signal?: AbortSignal): Promise<T> => {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { headers: { Accept: 'application/vnd.github+json' }, signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new GitHubError('offline');
  }
  if (res.ok) return (await res.json()) as T;
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get('x-ratelimit-reset'));
    throw new GitHubError('rate_limit', Number.isFinite(reset) && reset > 0 ? reset * 1000 : undefined);
  }
  if (res.status === 404) throw new GitHubError('not_found');
  throw new GitHubError('error');
};

const fetchAll = async (user: string): Promise<GitHubData> => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new GitHubError('offline');
  const u = encodeURIComponent(user);
  const [userRes, reposRes, eventsRes] = await Promise.allSettled([
    getJson<GhUser>(`/users/${u}`),
    getJson<GhRepo[]>(`/users/${u}/repos?sort=pushed&per_page=6`),
    getJson<GhEvent[]>(`/users/${u}/events/public?per_page=30`),
  ]);
  if (userRes.status === 'rejected') {
    throw userRes.reason instanceof GitHubError ? userRes.reason : new GitHubError('error');
  }
  return {
    user: userRes.value,
    repos: reposRes.status === 'fulfilled' && Array.isArray(reposRes.value) ? reposRes.value : [],
    events: eventsRes.status === 'fulfilled' && Array.isArray(eventsRes.value) ? eventsRes.value : [],
    fetchedAt: Date.now(),
  };
};

// Shared in-flight request so the widget and the window never double-fetch.
let inflight: Promise<GitHubData> | null = null;

export const loadGitHub = async (user: string = GITHUB_USER, force = false): Promise<GitHubData> => {
  const cached = readCache(user);
  if (cached && isFresh(cached) && !force) return cached;
  if (!inflight) {
    inflight = fetchAll(user)
      .then((d) => {
        writeCache(user, d);
        return d;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
};

/** React hook: cached GitHub data with loading / error states. */
export const useGitHub = (user: string = GITHUB_USER) => {
  const [state, setState] = useState<GitHubState>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    if (!user) {
      setState({ status: 'error', kind: 'not_found' });
      return;
    }
    const cached = readCache(user);
    if (cached && isFresh(cached) && nonce === 0) {
      setState({ status: 'ready', data: cached, stale: false });
      return;
    }
    // Show stale data immediately while revalidating.
    setState(cached ? { status: 'ready', data: cached, stale: true } : { status: 'loading' });
    loadGitHub(user, nonce > 0)
      .then((data) => alive && setState({ status: 'ready', data, stale: false }))
      .catch((e: unknown) => {
        if (!alive) return;
        if (cached) {
          setState({ status: 'ready', data: cached, stale: true });
          return;
        }
        const err = e instanceof GitHubError ? e : new GitHubError('error');
        setState({ status: 'error', kind: err.kind, resetAt: err.resetAt });
      });
    return () => {
      alive = false;
    };
  }, [user, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { state, retry };
};

// ---------------------------------------------------------------------------
// Derivations
// ---------------------------------------------------------------------------
export const timeAgo = (iso: string, now: number = Date.now()): string => {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
};

/** Repo name without the owner prefix when it is the profile owner. */
export const shortRepo = (full: string, user: string = GITHUB_USER): string => {
  const [owner, name] = full.split('/');
  return owner && name && owner.toLowerCase() === user.toLowerCase() ? name : full;
};

export const describeEvent = (e: GhEvent): string => {
  const repo = shortRepo(e.repo.name);
  const p = e.payload;
  switch (e.type) {
    case 'PushEvent': {
      const n = p.size ?? p.commits?.length ?? 0;
      return n > 1 ? `pushed ${n} commits to ${repo}` : `pushed to ${repo}`;
    }
    case 'CreateEvent':
      return p.ref_type === 'repository' ? `created ${repo}` : `created ${p.ref_type ?? 'ref'} ${p.ref ?? ''} in ${repo}`.replace(/\s+/g, ' ');
    case 'DeleteEvent':
      return `deleted ${p.ref_type ?? 'ref'} in ${repo}`;
    case 'WatchEvent':
      return `starred ${repo}`;
    case 'ForkEvent':
      return `forked ${repo}`;
    case 'PullRequestEvent':
      return `${p.action ?? 'updated'} a PR in ${repo}`;
    case 'IssuesEvent':
      return `${p.action ?? 'updated'} an issue in ${repo}`;
    case 'IssueCommentEvent':
      return `commented in ${repo}`;
    case 'PullRequestReviewEvent':
      return `reviewed a PR in ${repo}`;
    case 'ReleaseEvent':
      return `released ${repo}`;
    case 'PublicEvent':
      return `open-sourced ${repo}`;
    default:
      return `${e.type.replace(/Event$/, '').toLowerCase()} · ${repo}`;
  }
};

export interface HeatCell {
  /** Local date key YYYY-MM-DD */
  date: string;
  count: number;
  /** false for days after today (padding in the last column) */
  inRange: boolean;
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Pushes per day for the last `weeks` weeks, as columns (oldest → newest) of 7 days
 * (Sunday → Saturday). The last column contains today.
 */
export const buildHeatmap = (events: GhEvent[], weeks = 7, now: Date = new Date()): HeatCell[][] => {
  const counts = new Map<string, number>();
  for (const e of events) {
    if (e.type !== 'PushEvent') continue;
    const k = dayKey(new Date(e.created_at));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay() - (weeks - 1) * 7);
  const cols: HeatCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      const k = dayKey(day);
      col.push({ date: k, count: counts.get(k) ?? 0, inRange: day.getTime() <= today.getTime() });
    }
    cols.push(col);
  }
  return cols;
};

/** Total pushes in the heatmap window. */
export const heatmapTotal = (cols: HeatCell[][]): number =>
  cols.reduce((sum, col) => sum + col.reduce((s, c) => s + c.count, 0), 0);
