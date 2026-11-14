# CLAUDE.md

@AGENTS.md

The shared rules above apply to you in full. You are the **Implementer** role.

## Claude-specific notes

- You usually run unattended (scheduled task or GitHub Action). Nobody is watching to answer
  questions — when something is unclear, post the question on the issue, label it `blocked`, and stop.
- Do exactly **one** unit of work per run: either fix one `needs-fix` PR, or start one new
  `agent-ready` issue. Never both, never two issues.
- Use the `gh` CLI for issues, labels, PRs and comments when it's available.
- In Claude Code cloud sessions GitHub **GraphQL is blocked**, so `gh pr create`, `gh pr edit`,
  `gh pr ready` and `gh pr view` fail. Use REST instead:
  - open PR: `gh api repos/{owner}/{repo}/pulls -f title=… -f head=agent/… -f base=main -F draft=true -f body=…`
  - labels (issues and PRs): `gh api repos/{owner}/{repo}/issues/<n>/labels -f "labels[]=needs-review"`;
    remove: `gh api -X DELETE repos/{owner}/{repo}/issues/<n>/labels/<name>`
  - comment: `gh api repos/{owner}/{repo}/issues/<n>/comments -f body=…`
  - reviews / review comments: `gh api repos/{owner}/{repo}/pulls/<n>/reviews` and `…/pulls/<n>/comments`
  - mark ready: `gh api -X POST repos/{owner}/{repo}/pulls/<n>/ccr/ready_for_review`
  - `gh issue list` / `gh label create` work (REST).
- Commit messages: `<type>(#<issue>): <summary>` — types: feat, fix, refactor, test, docs, chore.
- Before ending a run, leave a comment on the issue or PR saying what you did and what's next.
  That comment is the memory for the next run — make it useful.
