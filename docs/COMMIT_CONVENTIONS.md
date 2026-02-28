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
- **Subject** (required): Imperative mood, no trailing period. Max **72 characters**. Describes what the commit does, not what was done. Multiple case formats are allowed (see [Allowed Subject Cases](#allowed-subject-cases)).

### Allowed Types

| Type       | Changelog Section       | Use for                                |
| ---------- | ---------------------- | -------------------------------------- |
| `feat`     | **Features** (minor)   | New user-facing or API feature         |
| `fix`      | **Bug Fixes** (patch)  | Bug fix                                |
| `docs`     | **Documentation**     | Documentation only                     |
| `refactor` | **Refactoring**        | Code change, no behavior/API change    |
| `test`     | (hidden)               | Adding or updating tests               |
| `build`    | (hidden)               | Build system, dependencies             |
| `chore`    | **Maintenance**        | Build, config, deps, tooling           |
| `style`    | (hidden)               | Formatting, whitespace, no code change |
| `perf`     | **Performance**         | Performance improvement                |
| `ci`       | (hidden)               | CI/config changes                      |
| `revert`   | **Reverts**            | Reverting a previous commit            |

### Allowed Subject Cases

The linter accepts the following case formats for commit subjects:

| Case          | Example              | Notes                                  |
| ------------- | -------------------- | -------------------------------------- |
| `lower-case`  | `add feature`        | **Recommended** - consistent style     |
| `upper-case`  | `ADD FEATURE`        | For emphasis or constants              |
| `camel-case`  | `addFeature`         | For code references (function names)   |
| `kebab-case`  | `add-feature`        | For file/branch references             |
| `pascal-case` | `AddFeature`         | For class/component references         |
| `sentence-case`| `Add feature`       | Natural sentence format                |
| `snake-case`  | `add_feature`        | For variable/function references       |
| `start-case`  | `Add Feature`        | Title format                           |

> **Note:** While multiple cases are permitted by the linter, `lower-case` is strongly recommended for consistency and readability across the project.

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
| **Subject format**                | Imperative mood, no period at end, ≤ 72 chars. Lowercase recommended; other cases allowed when appropriate (e.g., code references).                                                          |
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

**Valid Case Variations** (lowercase recommended, but these are accepted):

```
feat(api): addFeature support              # camel-case - for function names
fix(ui): Fix Button component               # pascal-case - for React components
docs(readme): UPDATE-API-DOCS               # upper-case - for emphasis
refactor: add-new-utilities-helper          # kebab-case - for file references
```

### Bad Examples

```
chore(release): bump version to 0.9.20     # Reserved for Release Please
fix: stuff                                 # Too vague
feat: add 1 skill(s), update docs           # Vague; poor changelog line
feat: Add new feature.                     # Period at end; not imperative
```

---

## 3. Keep a Changelog Mapping

This project uses [Keep a Changelog](https://keepachangelog.com/) with custom sections configured in [`release-please-config.json`](../../release-please-config.json). Commit types map as follows:

- **Features** ← `feat` (minor version bump)
- **Bug Fixes** ← `fix` (patch version bump)
- **Performance** ← `perf` (patch version bump)
- **Refactoring** ← `refactor`
- **Documentation** ← `docs`
- **Maintenance** ← `chore`
- **Reverts** ← `revert`
- **(hidden)** ← `test`, `build`, `ci`, `style`

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

- **Release process:** Releases and CHANGELOG are created by Release Please when changes are merged to `main`. The workflow waits for CI to complete, then creates/updates a release PR. When that PR is merged, the release is published and production deployment is triggered automatically (only if a version bump occurred). **Documentation-only changes** (markdown files in `docs/`, root `.md` files) will run through CI but will NOT create a release PR or trigger deployment. This optimization saves resources and prevents unnecessary releases for non-code changes. Conventional commits drive CHANGELOG and version bumps. Do not rely on manual `/push` for normal releases.
- **commitlint** runs on `commit-msg` (Husky) to enforce format locally. Config: `commitlint.config.js`.
- **CI** runs `pnpm format:check` as a safety net; it may run commitlint on PRs as a backup.
- **Agents** MUST use the `format-commit-message` skill (or these rules) for every commit, including when using `/push patch -m "..."`.

## 7. AI & Squash Merge Guidelines

See: [Release-Please: How can I fix release notes?](https://github.com/googleapis/release-please/tree/main#how-can-i-fix-release-notes)

### BEGIN_COMMIT_OVERRIDE Pattern

For PRs with multiple changes, wrap additional commits:

```
feat: add new feature

BEGIN_COMMIT_OVERRIDE
fix: fix bug in existing feature
chore: update dependencies
END_COMMIT_OVERRIDE
```

### Multiple Commits in Body

Each line with `type(scope):` in body is parsed as separate commit:

```
feat: primary feature

fix(ci): unmask test failures
fix(db): apply migrations
refactor(sla): improve patterns

Refs: issue-id
```
