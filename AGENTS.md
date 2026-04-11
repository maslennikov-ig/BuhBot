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
bd hooks install      # Reinstall git hook shims after a bd upgrade if hooks fail
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   - **Commit before pushing**: Stage with `git add`, then run `git commit -m "..."`. **Always check the command output and exit code.** If `git commit` fails, the output contains the reason (lint, format, or commit message). Fix those issues and run `git commit` again. Do not use `git commit --no-verify` unless the user explicitly requests it.
   ```bash
   git pull --rebase
   # If the local Beads DB looks empty or broken after clone/upgrade:
   bd bootstrap --yes
   # If .beads/issues.jsonl has data but the local DB is empty:
   bd import
   # If git hooks still point at old subcommands after a bd upgrade:
   bd hooks install
   # If this repo commits .beads/issues.jsonl, refresh it before push:
   bd export -o .beads/issues.jsonl
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
- If **commit** fails (e.g. pre-commit or commit-msg hook), read the terminal output, fix the reported issues (ESLint, Prettier, or commit message format), and retry `git commit`. Do not assume the commit succeeded without checking.
- Beads 1.0.0 requires explicit `bd bootstrap`, `bd import`, `bd export`, and `bd hooks install` steps as needed
