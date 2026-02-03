# Commit Conventions

This document is the **single source of truth** for commit messages in BuhBot. It aligns [Conventional Commits](https://www.conventionalcommits.org/), [Keep a Changelog](https://keepachangelog.com/), and tools like **Release Please** so that changelogs and version bumps are generated correctly.

All agents and contributors MUST follow these rules when writing commit messages.

---

## 1. Conventional Commits Format

### Structure

```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

- **Type** (required): Lowercase, one of the allowed types below.
- **Scope** (optional): Lowercase, no spaces; the area of the codebase affected (e.g. `auth`, `api`, `frontend`).
- **Subject** (required): Imperative mood, lowercase, no trailing period. Max **72 characters**. Describes what the commit does, not what was done.

### Allowed Types

| Type       | Changelog / Release Please | Use for                                |
| ---------- | -------------------------- | -------------------------------------- |
| `feat`     | **Added** (minor bump)     | New user-facing or API feature         |
| `fix`      | **Fixed** (patch bump)     | Bug fix                                |
| `docs`     | Often omitted or "Other"   | Documentation only                     |
| `refactor` | Often omitted or "Changed" | Code change, no behavior/API change    |
| `test`     | Omitted                    | Adding or updating tests               |
| `chore`    | Omitted                    | Build, config, deps, tooling           |
| `style`    | Omitted                    | Formatting, whitespace, no code change |
| `perf`     | **Changed** (patch)        | Performance improvement                |
| `ci`       | Omitted                    | CI/config changes                      |

**Reserved:** Do **not** use `chore(release):` for normal commits. Release Please creates `chore(release): vX.Y.Z` for release commits; that pattern is reserved for automation.

### Breaking Changes

- **In subject:** Append `!` after type or scope: `feat!: remove legacy API` or `feat(api)!: remove legacy API`.
- **In body/footer:** Add a line starting with `BREAKING CHANGE: ` (space after colon).

Example:

```
feat(api): migrate to REST v2

BREAKING CHANGE: Authentication tokens from v1 are invalid. Use /auth/v2 to obtain new tokens.
```

---

## 2. Release Please–Specific Rules

These rules ensure Release Please (and similar tools) parse commits correctly and produce clean changelogs.

| Rule                              | Requirement                                                                                                                                                                                  |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Subject format**                | Imperative mood, lowercase, no period at end, ≤ 72 chars.                                                                                                                                    |
| **One logical change per commit** | Prefer one fix/feature per commit. Avoid "fix: resolve 6 bugs" when you can split; each commit becomes one changelog line.                                                                   |
| **No meta commits in changelog**  | Avoid commits that only say "bd sync", "update docs", or "chore: update project files" if they add no user-facing meaning. Use descriptive messages or accept they may appear under "Other". |
| **Reserve chore(release)**        | Only Release Please (or the release script) should create `chore(release): vX.Y.Z`. Never use `chore(release):` for other changes.                                                           |
| **Merge commits**                 | Prefer squash or linear history so one change = one commit. Merge commit messages like "Merge PR #18" are often ignored or produce noisy changelog entries.                                  |

### Good Examples

```
feat(auth): add OAuth2 login
fix(frontend): resolve chart overflow on analytics page
docs: add Privacy Mode configuration guide (gh-8)
refactor(queues): centralize BullMQ configuration in queue.config.ts
```

### Bad Examples

```
chore(release): bump version to 0.9.20     # Reserved for Release Please
fix: stuff                                 # Too vague
feat: add 1 skill(s), update docs           # Vague; poor changelog line
Fix(frontend): Fix button                  # Not lowercase; not imperative
feat: Add new feature.                     # Period at end; not imperative
```

---

## 3. Keep a Changelog Mapping

This project uses [Keep a Changelog](https://keepachangelog.com/). Commit types map roughly as follows:

- **Added** ← `feat`
- **Changed** ← `refactor`, `perf`, or breaking changes
- **Fixed** ← `fix`
- **Removed** ← breaking removals
- **Security** ← security-related `fix` or `feat`
- **Other** ← `docs`, `chore`, `style`, `test`, `ci` (or as configured by the release tool)

Release Please (or the release script) uses these mappings when generating `CHANGELOG.md` and release notes.

---

## 4. Optional: Issue References

To link commits to issues in changelogs and release notes:

- In **subject:** `fix(auth): resolve session timeout (gh-42)`
- In **footer:** `Fixes #42` or `Closes #123`

Use the format your issue tracker expects (e.g. `gh-42`, `#42`, `buh-xxx`).

---

## 5. References

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
- [Semantic Versioning](https://semver.org/)
- [Release Please](https://github.com/googleapis/release-please) (in use)

---

## 6. Enforcement

- **Release process:** Releases and CHANGELOG are created by Release Please when changes are merged to `main`. Conventional commits drive CHANGELOG and version bumps. Do not rely on manual `/push` for normal releases.
- **commitlint** runs on `commit-msg` (Husky) to enforce format locally. Config: `commitlint.config.js`.
- **CI** runs `pnpm format:check` as a safety net; it may run commitlint on PRs as a backup.
- **Agents** MUST use the `format-commit-message` skill (or these rules) for every commit, including when using `/push patch -m "..."`.
