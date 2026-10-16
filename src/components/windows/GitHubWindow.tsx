'use client';

import React from 'react';
import { Window } from '../Window';
import { PROFILE } from '@/lib/profile';
import { describeEvent, GITHUB_USER, timeAgo, useGitHub } from '@/lib/github';
import { GitHubFallback, GitHubHeatmap, GitHubSkeleton, GITHUB_WINDOW_ID } from '../GitHubWidget';

export const GitHubWindow: React.FC = () => {
  const { state, retry } = useGitHub();

  return (
    <Window id={GITHUB_WINDOW_ID}>
      <div className="flex flex-col gap-3 font-body text-textDim" dir="ltr">
        {state.status === 'loading' && (
          <div className="win9x-box-raised bg-panel p-3">
            <GitHubSkeleton rows={5} />
          </div>
        )}

        {state.status === 'error' && (
          <div className="win9x-box-raised bg-panel p-3">
            <GitHubFallback kind={state.kind} resetAt={state.resetAt} onRetry={retry} />
          </div>
        )}

        {state.status === 'ready' && (
          <>
            {/* Profile header */}
            <section className="win9x-box-raised bg-panel p-3 flex flex-wrap items-center gap-3">
              <img
                src={`${state.data.user.avatar_url}${state.data.user.avatar_url.includes('?') ? '&' : '?'}s=32`}
                alt=""
                width={64}
                height={64}
                className="w-16 h-16 pixel-art border-2 border-slate bg-panel2 shrink-0"
                style={{ imageRendering: 'pixelated' }}
              />
              <div className="min-w-0 flex-1">
                <h2 className="font-pixel text-sm text-text truncate">{state.data.user.name || state.data.user.login}</h2>
                <p className="font-mono text-[11px] text-lavender">@{state.data.user.login}</p>
                {state.data.user.bio && <p className="text-[12px] mt-1 leading-snug">{state.data.user.bio}</p>}
                <p className="font-mono text-[11px] mt-1 flex flex-wrap gap-x-3">
                  <span>
                    <b className="text-text">{state.data.user.public_repos}</b> repos
                  </span>
                  <span>
                    <b className="text-text">{state.data.user.followers}</b> followers
                  </span>
                  {state.stale && <span className="text-yellow">⚠ cached</span>}
                </p>
              </div>
              <a
                href={state.data.user.html_url || PROFILE.github}
                target="_blank"
                rel="noopener noreferrer"
                className="win9x-button win9x-button-spidey px-3 py-1.5 font-pixel text-[10px]"
              >
                Profile ↗
              </a>
            </section>

            {/* Activity heatmap */}
            <section className="win9x-box-recessed bg-panel p-3 flex flex-col gap-2">
              <h3 className="font-pixel text-[10px] text-lavender">Public pushes · last 7 weeks</h3>
              <div className="overflow-x-auto">
                <GitHubHeatmap events={state.data.events} cell={18} gap={3} showLegend />
              </div>
            </section>

            <div className="grid gap-3 md:grid-cols-2">
              {/* Repos */}
              <section className="flex flex-col gap-2 min-w-0">
                <h3 className="font-pixel text-[10px] text-lavender">Recently pushed repos</h3>
                {state.data.repos.length === 0 && <p className="text-[12px] text-lavender">No public repos yet.</p>}
                <ul className="flex flex-col gap-2">
                  {state.data.repos.map((r) => (
                    <li key={r.id} className="win9x-box-raised bg-panel2 p-2 flex flex-col gap-1 min-w-0">
                      <a
                        href={r.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[12px] font-bold text-text hover:text-spidey hover:underline truncate"
                      >
                        {r.name} <span aria-hidden>↗</span>
                      </a>
                      {r.description && <p className="text-[12px] leading-snug line-clamp-2">{r.description}</p>}
                      <p className="font-mono text-[10px] text-lavender flex flex-wrap gap-x-3">
                        {r.language && (
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-spidey inline-block" aria-hidden />
                            {r.language}
                          </span>
                        )}
                        <span aria-label={`${r.stargazers_count} stars`}>★ {r.stargazers_count}</span>
                        <span>updated {timeAgo(r.pushed_at || r.updated_at)}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Events */}
              <section className="flex flex-col gap-2 min-w-0">
                <h3 className="font-pixel text-[10px] text-lavender">Recent activity</h3>
                {state.data.events.length === 0 ? (
                  <p className="text-[12px] text-lavender">No recent public activity.</p>
                ) : (
                  <ul className="win9x-box-recessed bg-panel p-2 flex flex-col divide-y divide-slate/25">
                    {state.data.events.slice(0, 12).map((e) => (
                      <li key={e.id} className="py-1 text-[12px] leading-snug flex gap-2 min-w-0">
                        <span className="min-w-0 flex-1 break-words">
                          <a
                            href={`https://github.com/${e.repo.name}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-spidey hover:underline"
                          >
                            {describeEvent(e)}
                          </a>
                        </span>
                        <span className="font-mono text-[10px] text-lavender whitespace-nowrap">{timeAgo(e.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <p className="font-mono text-[10px] text-lavender">
              Live from api.github.com/users/{GITHUB_USER} · refreshed {timeAgo(new Date(state.data.fetchedAt).toISOString())}
            </p>
          </>
        )}
      </div>
    </Window>
  );
};
