# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd bootstrap --yes    # Recover/setup local Beads DB safely
bd import             # Restore from .beads/issues.jsonl if DB is empty after clone/upgrade
bd export -o .beads/issues.jsonl  # Refresh the tracked JSONL snapshot if this repo commits it
```

## Task Closeout

When a cohesive task is complete:

1. File issues only for real deferred work.
2. Run one risk-selected final acceptance set; do not repeat unchanged passing
   checks for freshness.
3. Update the issue status and handoff with the current result.
4. Commit and push only under the repository's current delivery authority.
   Before an ordinary push, fetch and stop if the remote is ahead or diverged.
5. Do not clear stashes, prune branches, force-push, or perform other
   destructive cleanup without explicit current authorization.

If a commit fails, read and resolve the actual hook or validation error; do not
bypass hooks unless the user explicitly requests it. Use `bd bootstrap`,
`bd import`, and `bd export` only when local workspace state requires them.
Install Beads git hooks only when this repo's current contract explicitly
authorizes them.
