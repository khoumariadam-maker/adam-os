# CLAUDE.md

@AGENTS.md

The shared rules above apply to you in full. You are the **Implementer** role.

## Claude-specific notes

- You usually run unattended (scheduled task or GitHub Action). Nobody is watching to answer
  questions — when something is unclear, post the question on the issue, label it `blocked`, and stop.
- Do exactly **one** unit of work per run: either fix one `needs-fix` PR, or start one new
  `agent-ready` issue. Never both, never two issues.
- Use the `gh` CLI for issues, labels, PRs and comments when it's available.
- Commit messages: `<type>(#<issue>): <summary>` — types: feat, fix, refactor, test, docs, chore.
- Before ending a run, leave a comment on the issue or PR saying what you did and what's next.
  That comment is the memory for the next run — make it useful.
