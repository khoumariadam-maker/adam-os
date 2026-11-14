# AGENTS.md — Shared rules for every AI agent in this repo

This file is read automatically by **Codex** (cloud tasks + code review) and, through `CLAUDE.md`,
by **Claude Code** (cloud sessions, scheduled tasks, GitHub Action). It is the single source of
truth for how agents work here. If anything conflicts with this file, this file wins — except a
direct instruction from the owner in an issue or PR comment.

## Roles

| Role | Who | Does | Never does |
|---|---|---|---|
| **Owner** | The human (repo owner) | Writes/approves issues, merges PRs, deploys | — |
| **Implementer** | Claude Code | Picks one `agent-ready` issue, builds it on a branch, opens a draft PR, fixes review findings | Merge, deploy, push to `main` |
| **Reviewer** | Codex | Reviews every PR against the issue + the guidelines below, posts findings | Push commits to someone else's PR branch, approve-to-merge |

One implementer, one reviewer. Agents never work on the same branch at the same time.

## Before you write any code

1. Read, in this order: `docs/VISION.md` → `docs/REQUIREMENTS.md` → `docs/ARCHITECTURE.md` →
   `docs/DESIGN_SYSTEM.md` (UI work) → `docs/DECISIONS.md` → the issue itself and all its comments.
2. If the issue has no clear **acceptance criteria**, or it contradicts the docs: do NOT guess.
   Comment on the issue with the specific questions, add label `blocked`, remove `agent-ready`, stop.
3. Check there is no open PR already linked to the issue (search PRs for `#<issue-number>`).

## Hard rules

1. Work only on issues labelled `agent-ready` (or PRs labelled `needs-fix`).
2. One issue = one branch = one PR. Never bundle unrelated changes.
3. Branch name: `agent/<issue-number>-<short-slug>` (e.g. `agent/12-login-form`).
4. Never push to `main`. Never merge. Never deploy. Never change repo settings, secrets or workflows
   in `.github/workflows/` unless the issue explicitly asks for it.
5. Never commit secrets, tokens, `.env` files, real customer data or production database dumps.
   Use `.env.example` with placeholder values.
6. Never weaken or delete tests to make CI pass. If a test is wrong, say so in the PR and explain.
7. Don't add a new dependency without stating why in the PR (and recording it in `docs/DECISIONS.md`
   if it's a framework-level choice).
8. Follow `docs/DESIGN_SYSTEM.md` for anything visual. Don't invent new colors/fonts/spacing.
9. Keep changes small. If an issue turns out bigger than ~400 changed lines, stop, propose a split
   in an issue comment, and implement only the first part.
10. When in doubt, stop and ask in the issue. A blocked task is cheaper than a wrong one.

## Commands

Agents must run these before opening/updating a PR and paste the real result lines in the PR.

```bash
npm ci                 # install
npm run typecheck      # tsc --noEmit — must be clean
npm run test:circuit   # Breadboard solver checks — must print "All circuit checks passed."
npm run build          # static export to ./out — must succeed
npm run test:visual    # optional: Playwright screenshots (needs `npx playwright install chromium`)
```

If you intentionally change how a screen looks, update baselines with
`npm run test:visual -- --update-snapshots` and say so in the PR. If you couldn't run visual tests,
say "visual tests not run" — never claim they passed.

## Project-specific rules (adam-os)

- **What it is**: Khoumari Adam's portfolio, a Windows 98-style desktop. Next.js 14 app router,
  **static export** (`output: 'export'`) — no server code, no API routes, no backend, no analytics, no cookies.
- **Two themes** must both look right: *Spider Night* (dark, default) and *Windows 98* (`data-theme='classic'`).
  Use the CSS variables in `src/app/globals.css` (`rgb(var(--c-…))`) — never hard-code colors.
- **Two languages**: every user-facing string goes in BOTH `src/lib/i18n/en.json` and `ar.json`.
  Arabic is right-to-left — check layout with `dir="rtl"`.
- **Phones**: phones get a home screen + full-screen app sheets. Every feature must work by touch at
  360 px width and must never cause sideways scrolling.
- **Assets**: any path into `public/` goes through `asset()` from `src/lib/asset.ts`.
- **Icons**: use the pixel icon set in `src/lib/pixel-icons.ts`; don't add icon libraries or emoji icons.
- **New apps**: register in `src/lib/apps.ts` (window manager, Start menu, taskbar and Ctrl+K are built from it).
- **Motion**: every animation must respect `prefers-reduced-motion`.
- **Performance**: heavy libraries (three.js etc.) are lazy-loaded only when their app opens. Don't add
  anything heavy to the first page load.
- **Sound**: synthesize with the Web Audio helpers in `src/lib/audio/` — no audio files.
- **Content truth**: never invent facts about Adam (jobs, degrees, numbers, clients). If content is
  needed, use a clearly marked placeholder and say so in the PR.
- The `.agent/` and `adam-os-spec/` folders are history from the original build — read for context,
  don't follow their personas; this file wins.

## Workflow (labels drive everything)

```
agent-ready ──► in-progress ──► needs-review ──► (needs-fix ⇄ needs-review) ──► ready-for-approval ──► merged by owner
                     │
                     └──► blocked  (questions posted, waiting on owner)
```

| Label | Meaning | Set by |
|---|---|---|
| `agent-ready` | Approved, clear, can be picked up | Owner |
| `in-progress` | An agent is working on it — others keep off | Implementer, when starting |
| `needs-review` | PR open, waiting for Codex review | Implementer, when PR is opened/updated |
| `needs-fix` | Review found problems that must be fixed | Reviewer / owner / auto-fix workflow |
| `ready-for-approval` | Review is clean and CI is green — owner should look | Implementer |
| `blocked` | Needs a human answer | Anyone |
| `needs-human` | Auto-fix loop hit its limit — owner must step in | Auto-fix workflow |
| `priority:high` / `priority:low` | Ordering for the queue | Owner |

## Implementer checklist (Claude)

1. Add `in-progress` to the issue, remove `agent-ready`, comment "Starting — branch `agent/…`".
2. Create the branch from latest `main`.
3. Implement. Write/extend tests for the new behavior.
4. Run the commands above. Fix what you broke.
5. Open a **draft PR** using the PR template. Title: `[#<issue>] <what it does>`. Body must say
   `Closes #<issue>`.
6. Swap issue label `in-progress` → `needs-review`; add `needs-review` to the PR.
7. Comment `@codex review` on the PR if automatic reviews are not on.

### Fixing review findings

1. Read every unresolved review comment on the PR (Codex and owner).
2. Fix each valid finding in a new commit on the same branch. Don't force-push.
3. If you disagree with a finding, reply to that comment with the reason — don't silently ignore it.
4. Re-run the commands. Push. Reply on the PR with a short list: finding → what you did.
5. Labels: remove `needs-fix`, add `needs-review`.
6. When the latest review has no P0/P1 findings and CI is green: mark the PR ready for review,
   label `ready-for-approval`.

## Task completion report (every PR description and final issue comment)

- Issue number
- What changed (files/areas, in plain words)
- How it was tested — commands run and their **actual** results (paste the summary line)
- Known risks / what you're unsure about
- Follow-up work (suggest new issues; don't do them)

## Review guidelines

Codex reads this section for every PR review. Report findings with a priority:

- **P0 — must fix before merge**: security holes (auth bypass, injection, secrets in code, data leaks,
  missing permission checks), data loss, crashes on a main path, the PR doesn't do what the issue's
  acceptance criteria require.
- **P1 — should fix before merge**: logic bugs, missing error handling on user input or network calls,
  missing tests for new behavior, breaking an existing feature, violating a Hard rule above.
- **P2 — nice to have**: naming, small refactors, minor performance outside hot paths.

Also check:
- Every acceptance criterion in the linked issue is met — list any that aren't as P0.
- No secrets, tokens, real emails/phone numbers or production URLs with credentials in the diff.
- No PII (names, phone numbers, emails, payment info) written to logs.
- UI changes follow `docs/DESIGN_SYSTEM.md`.
- New dependencies are justified in the PR.
- Tests were not weakened or deleted to pass CI.
- adam-os specifics (P1 if broken): works in both themes; every new string exists in `en.json` AND
  `ar.json`; RTL layout not broken; usable by touch at 360 px with no sideways scroll; animations
  respect reduced motion; `public/` paths use `asset()`; nothing heavy added to the first page load;
  no backend/tracking/cookies introduced; no invented facts about Adam.

Don't comment on pure formatting a linter would catch. Keep findings specific: file, line, what's
wrong, how to fix. If the PR is clean, say so in one line.

## Recording decisions

Any choice a future agent would otherwise re-debate (framework, database, auth provider, folder
structure, API style) goes into `docs/DECISIONS.md` as a short entry in the same PR.
