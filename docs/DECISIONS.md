# Decisions log

> Short entries, newest at the top. One entry per decision a future agent might otherwise re-debate.
> Format: date · decision · why · alternatives rejected · who decided.

## D-001 · 2026-11-14 · GitHub is the project brain
- **Decision**: All project memory lives in this repo (docs/ + issues + PRs). No external notes app.
- **Why**: Both agents (Claude Code, Codex) can read it in the cloud without the owner's PC.
- **Rejected**: Obsidian vault (local-only, agents can't reach it unattended).
- **Decided by**: Owner

## D-002 · 2026-11-14 · Claude implements, Codex reviews
- **Decision**: One implementer (Claude Code) and one reviewer (Codex) per PR. They communicate only
  through GitHub issues, PR comments and labels.
- **Why**: Avoids two agents editing the same code; gives every change an independent review.
- **Decided by**: Owner
