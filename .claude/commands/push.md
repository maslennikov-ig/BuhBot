---
description: Commit, push feature branch, and create/update PR to main
argument-hint: [-m "commit message"]
---

Commit current changes, push to feature branch, and create or update a PR to main.
Releases are handled automatically by **Release Please** when PRs merge to `main`.

**Workflow:**

1. **Check current branch.** If on `main`, create a feature branch:
   - Run `bd list --status=in_progress` to find active beads issue
   - Branch name: `feat/<issue-id>` or `fix/<issue-id>` based on issue type (feature/bug)
   - If no active issue: `feat/<short-description>` derived from the commit message
   - `git checkout -b <branch-name>`

2. **Stage changes:**
   - Run `git status` to review changes
   - Stage relevant files with `git add <files>` — never stage `.env` or credentials
   - Do NOT use `git add -A` blindly

3. **Commit with conventional message:**
   - If `-m` argument provided via `$ARGUMENTS`, use it as the commit message
   - Otherwise, analyze changes and generate a conventional commit message
   - Follow [docs/COMMIT_CONVENTIONS.md](../../docs/COMMIT_CONVENTIONS.md) strictly
   - Use the **format-commit-message** skill for message generation
   - Always append: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
   - If `git commit` fails (pre-commit hooks), fix issues and retry

4. **Push to remote:**
   - `git push -u origin <branch-name>`

5. **Create or update PR:**
   - Check if PR exists: `gh pr list --head <branch-name> --state open`
   - If no PR exists: create one with `gh pr create --title "<commit subject>" --body "## Summary\n<changes>\n\n## Beads\n<issue-id>" --base main`
   - If PR already exists: just push (PR auto-updates with new commits)
   - Output the PR URL

6. **Run `bd sync`** to ensure beads state is committed.

**Legacy release script** is available for manual/local releases:

```bash
bash .claude/scripts/release.sh [patch|minor|major] --yes
```
