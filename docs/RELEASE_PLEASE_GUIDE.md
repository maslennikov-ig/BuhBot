# Release-Please Troubleshooting & Best Practices Guide

> **Repository:** [maslennikov-ig/BuhBot](https://github.com/maslennikov-ig/BuhBot/)  
> **Action:** `googleapis/release-please-action@v4`  
> **Merge Strategy:** Squash and merge  
> **Current Version:** `0.21.3` (pre-1.0.0)

---

## Table of Contents

- [1. How Release-Please Works with Squash and Merge](#1-how-release-please-works-with-squash-and-merge)
- [2. Why Commits Get Missed — Complete List of Reasons](#2-why-commits-get-missed--complete-list-of-reasons)
  - [2a. PR Title Not in Conventional Commit Format](#2a-pr-title-not-in-conventional-commit-format)
  - [2b. Commit Types That Don't Trigger Version Bumps](#2b-commit-types-that-dont-trigger-version-bumps)
  - [2c. The workflow_run Trigger Timing Issue](#2c-the-workflow_run-trigger-timing-issue)
  - [2d. GitHub Token Permissions](#2d-github-token-permissions)
  - [2e. Commit Message Truncation](#2e-commit-message-truncation)
  - [2f. Legacy CHANGELOG.md Content](#2f-legacy-changelogmd-content)
- [3. BEGIN_COMMIT_OVERRIDE / END_COMMIT_OVERRIDE](#3-begin_commit_override--end_commit_override)
- [4. Version Bump Rules — Complete Reference](#4-version-bump-rules--complete-reference)
- [5. Step-by-Step Verification and Fix Checklist](#5-step-by-step-verification-and-fix-checklist)
- [6. Recommended Configuration Improvements](#6-recommended-configuration-improvements)
- [7. Best Practices for Squash-and-Merge with Release-Please](#7-best-practices-for-squash-and-merge-with-release-please)

---

## 1. How Release-Please Works with Squash and Merge

When a pull request is merged with GitHub's **"Squash and merge"** strategy, GitHub collapses all commits from the PR branch into a **single commit** on the target branch (`main`).

That single merge commit is structured as follows:

| Part | Source |
|---|---|
| **First line** (commit title) | The **PR title** as shown in the GitHub UI |
| **Body** (extended description) | The **PR description** or the list of squashed commits |

Release-please reads **the first line** of each merge commit on `main` to determine the conventional commit type. It parses the first line looking for a pattern like:

```
type(scope): description
```

> **⚠️ Warning:** If the PR title does not follow the conventional commit format (`type(scope): description` or `type: description`), release-please will **completely ignore** that commit. It will not appear in the changelog and will not trigger any version bump.

GitHub's default squash commit title appends the PR number as a suffix like `(#123)` — this is fine and expected. Release-please strips this suffix during parsing.

**Example of a properly formatted squash merge commit:**

```
fix(sla): resolve timer drift in working hours (#226)

* fix timer calculation for DST transitions
* add unit tests for edge cases
* update documentation
```

Release-please reads `fix(sla): resolve timer drift in working hours` → detects `fix:` → triggers a PATCH version bump and adds the entry to the "Bug Fixes" changelog section.

---

## 2. Why Commits Get Missed — Complete List of Reasons

### 2a. PR Title Not in Conventional Commit Format

When using squash-merge, the **PR title becomes the commit message** on `main`. If the PR title doesn't follow conventional commit format, release-please ignores it entirely.

**❌ Bad PR titles (release-please ignores these):**

```
Update something
Merge feature branch
Fix the bug in parser
Updated dependencies and docs
```

**✅ Good PR titles (release-please detects these):**

```
fix: resolve null pointer in cache service
feat(bot): add /diagnose command
docs: update commitlint to v20.4.2 and release-please guidelines
chore: update dependencies
```

> **💡 Tip:** GitHub's squash-merge dialog auto-fills the commit title from the PR title. Always ensure your PR title follows the `type(scope): description` format **before** creating the PR.

### 2b. Commit Types That Don't Trigger Version Bumps

This is the **most common reason** commits appear to be "missing" from a release PR.

Only certain conventional commit types trigger a version bump:

- **`feat:`** → triggers a MINOR bump (`0.x.0`)
- **`fix:`** → triggers a PATCH bump (`0.0.x`)
- **`perf:`** → triggers a PATCH bump (`0.0.x`)
- **`deps:`** → triggers a PATCH bump (`0.0.x`)
- **`BREAKING CHANGE:`** or **`!`** suffix → triggers a MAJOR bump (`x.0.0`)*

Types like `docs:`, `chore:`, `refactor:`, `ci:`, `test:`, `style:`, and `build:` do **NOT** trigger any version bump by themselves. They only appear in the changelog **if there is already a version-bumping commit** (`feat:`, `fix:`, `perf:`) in the same commit range.

> **⚠️ Warning: This is the most likely reason `docs: update commitlint to v20.4.2 and release-please guidelines (#225)` is missing from PR #233.**
>
> Here's what happened:
> 1. Version `0.21.3` was released
> 2. `docs: #225` was merged to `main` — release-please ran but found **no version-bumping commit**, so it did **not** create a release PR
> 3. `fix: #226` through `fix: #232` were merged — release-please created PR #233 with a PATCH bump
>
> At step 3, release-please **should** have included the `docs:` commit in the changelog since it scans from the last release tag to HEAD. If it did not, the commit message format of #225 on `main` may not match `docs:` — verify the actual merge commit message (see [Section 5](#5-step-by-step-verification-and-fix-checklist)).

### 2c. The `workflow_run` Trigger Timing Issue

The current workflow in [`.github/workflows/release-please.yml`](.github/workflows/release-please.yml) uses a `workflow_run` trigger:

```yaml
on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [main]
```

This means each commit to `main` triggers a CI run, and when CI completes, release-please runs. Consider the following sequence:

1. `docs: #225` merges → CI runs → release-please runs → **no version bump needed** → no PR created
2. `fix: #226` merges → CI runs → release-please runs → **PATCH bump needed** → PR #233 created

When release-please creates PR #233 in step 2, it scans **all commits** from the last release tag (`buhbot-v0.21.3`) to `HEAD`. This means the `docs:` commit from step 1 **should** be in the scan range.

> **💡 Tip:** The `workflow_run` trigger timing is generally **NOT** the issue. Release-please always scans from the last release tag to the current HEAD, regardless of when or how many times it runs. If commits are missing, the root cause is almost always the commit message format or the version-bump behavior.

### 2d. GitHub Token Permissions

The workflow uses `secrets.GITHUB_TOKEN` with these permissions:

```yaml
permissions:
  contents: write
  pull-requests: write
  issues: write
  actions: read
```

This is sufficient for release-please to:

- Read all commits on the `main` branch
- Create and update release PRs
- Create GitHub releases and tags

> **💡 Tip:** Token permissions are unlikely to be the cause of missing commits. If permissions were insufficient, release-please would fail entirely rather than silently skip commits.

### 2e. Commit Message Truncation

The project's [`commitlint.config.js`](commitlint.config.js) enforces `header-max-length: 72`:

```js
'header-max-length': [2, 'always', 72],
```

When GitHub creates a squash-merge commit, it appends `(#NNN)` to the PR title. For long titles, this can push the total length beyond 72 characters:

```
feat(some-long-scope): some long description text here (#225)
│─────────────────── 62 chars total ──────────────────────────│
```

While this can cause **commitlint validation failures** (which run via Husky on local commits), it does **NOT** affect release-please. Release-please reads commits from the GitHub API and does not enforce any length limits.

> **💡 Tip:** If commitlint blocks a squash-merge commit locally, the issue is the header length — not release-please. Consider increasing `header-max-length` to `100` to accommodate the `(#NNN)` suffix GitHub adds.

### 2f. Legacy CHANGELOG.md Content

The project's [`CHANGELOG.md`](CHANGELOG.md) contains legacy Keep-a-Changelog format entries below the release-please managed section. Specifically:

- An `## [Unreleased]` section at line 587
- Old-style entries using `### Fixed`, `### Added`, `### Other` headers
- Entries dating back to versions `0.1.0` through `0.9.19`

This mixed format can potentially confuse release-please's CHANGELOG parser when it attempts to insert new entries. Release-please expects to own the entire CHANGELOG and looks for its own markers to determine where to insert content.

> **⚠️ Warning:** The legacy content in `CHANGELOG.md` should be cleaned up. Remove or archive the old Keep-a-Changelog format entries below the release-please managed section. See [Section 5, Step 6](#5-step-by-step-verification-and-fix-checklist).

---

## 3. BEGIN_COMMIT_OVERRIDE / END_COMMIT_OVERRIDE

Release-please supports special markers in the **merge commit body** that override what it reads from the first line.

### What It Is

When release-please encounters `BEGIN_COMMIT_OVERRIDE` and `END_COMMIT_OVERRIDE` markers in a commit's body, it uses the content **between** those markers **instead of** the commit's first line for changelog generation and version bump calculation.

### Syntax

```
BEGIN_COMMIT_OVERRIDE
feat: add new feature
fix: resolve bug in parser
fix!: breaking change in API
END_COMMIT_OVERRIDE
```

Each line between the markers must be a valid conventional commit message. Scope is optional — both `feat(api): description` and `feat: description` work.

### When to Use It

- When a single squash-merged PR contains **multiple conventional commits** that should each be recorded separately in the changelog
- When you want to **override** the PR title's conventional commit type
- When you need to inject a **BREAKING CHANGE** that wasn't reflected in the PR title

### How to Use It with Squash-and-Merge

1. On GitHub, click **"Squash and merge"** on the PR
2. GitHub shows a dialog with two fields:
   - **Commit title** (first line) — pre-filled with the PR title
   - **Extended description** (body) — pre-filled with the PR description or squashed commit list
3. In the **extended description** field, add the override markers
4. Click **"Confirm squash and merge"**

Everything between `BEGIN_COMMIT_OVERRIDE` and `END_COMMIT_OVERRIDE` replaces the commit title for release-please's analysis.

### Example — PR with Multiple Changes

**PR title:** `fix: update dependencies (#100)`

**Extended description (body) — edit this at merge time:**

```
This PR updates several dependencies and adds a new endpoint.

BEGIN_COMMIT_OVERRIDE
feat: add new API endpoint for user profiles
fix: resolve memory leak in cache service
docs: update API documentation
END_COMMIT_OVERRIDE
```

**Result:** Release-please creates changelog entries for **all three** commits:

- "Features" section: `add new API endpoint for user profiles`
- "Bug Fixes" section: `resolve memory leak in cache service`
- "Documentation" section: `update API documentation`

The version bump is **MINOR** (due to `feat:`), not PATCH (which the PR title's `fix:` would have caused).

### Important Rules

| Rule | Details |
|---|---|
| **Location** | Markers must be in the **commit body**, not just the PR description UI |
| **Format** | Each line between markers must be a valid conventional commit message |
| **Scope** | Optional — `feat(api): desc` and `feat: desc` both work |
| **Breaking changes** | Include `BREAKING CHANGE: description` as a footer, or use `!` suffix |
| **Blank lines** | Avoid blank lines between the markers |

### PR Description vs. Merge Commit Body

> **⚠️ Warning:** The PR description on GitHub (what you see in the PR UI) is **not the same** as the commit message. Release-please reads **commit messages** from the Git history, not PR descriptions.
>
> **However**, with squash-and-merge, GitHub copies the PR description into the commit body by default. So if you add the override markers to the PR description **before** merging, they will end up in the commit body.
>
> You can also edit the extended description directly in the merge dialog at merge time.

---

## 4. Version Bump Rules — Complete Reference

### Version Bump Table

| Commit Type | Version Bump | Example |
|---|---|---|
| `feat:` | **MINOR** (`0.x.0`) | `feat: add user profile page` |
| `feat!:` or `feat:` + `BREAKING CHANGE` footer | **MAJOR** (`x.0.0`)* | `feat!: redesign API` |
| `fix:` | **PATCH** (`0.0.x`) | `fix: resolve null pointer` |
| `fix!:` | **MAJOR** (`x.0.0`)* | `fix!: change error format` |
| `perf:` | **PATCH** (`0.0.x`) | `perf: optimize query` |
| `deps:` | **PATCH** (`0.0.x`) | `deps: update express to v5` |
| `docs:` | **None** | `docs: update README` |
| `chore:` | **None** | `chore: update deps` |
| `refactor:` | **None** | `refactor: extract service` |
| `test:` | **None** | `test: add unit tests` |
| `ci:` | **None** | `ci: update workflow` |
| `build:` | **None** | `build: update webpack` |
| `style:` | **None** | `style: fix formatting` |
| `revert:` | **None**** | `revert: revert feat X` |

### Pre-1.0.0 Version Behavior

\* **For pre-1.0.0 versions** (like this project at `0.21.3`), breaking changes behave differently by default:

| Scenario | Default Behavior (pre-1.0.0) | With Config Override |
|---|---|---|
| `feat!:` (BREAKING) | Bumps **MINOR** (e.g., `0.21.3` → `0.22.0`) | With `bump-minor-pre-major: true`: same |
| `feat:` | Bumps **MINOR** (e.g., `0.21.3` → `0.22.0`) | — |
| `fix:` | Bumps **PATCH** (e.g., `0.21.3` → `0.21.4`) | — |
| `fix!:` (BREAKING) | Bumps **MINOR** (e.g., `0.21.3` → `0.22.0`) | With `bump-minor-pre-major: true`: same |

#### Configuration Options

- **`bump-minor-pre-major`** (`boolean`, default: `false`): When `true`, breaking changes bump MINOR instead of MAJOR for pre-1.0.0 versions. This is the **recommended** setting for pre-1.0.0 projects to prevent accidental jumps to `1.0.0`.

- **`bump-patch-for-minor-pre-major`** (`boolean`, default: `false`): When `true`, `feat:` bumps PATCH instead of MINOR for pre-1.0.0 versions. Useful if you want fine-grained control over version increments before reaching `1.0.0`.

\*\* `revert:` bumps based on what was reverted — reverting a `feat:` triggers a MINOR bump, reverting a `fix:` triggers a PATCH bump.

### Non-Bumping Types and the Changelog

Types that don't trigger a version bump (`docs:`, `chore:`, `refactor:`, etc.) will **still appear in the changelog** — but only if:

1. There is at least one version-bumping commit in the same range
2. The type is configured with `"hidden": false` in [`release-please-config.json`](release-please-config.json)

Current visibility configuration:

| Type | Changelog Section | Visible |
|---|---|---|
| `feat` | Features | ✅ Yes |
| `fix` | Bug Fixes | ✅ Yes |
| `perf` | Performance | ✅ Yes |
| `refactor` | Refactoring | ✅ Yes |
| `docs` | Documentation | ✅ Yes |
| `chore` | Maintenance | ✅ Yes |
| `revert` | Reverts | ✅ Yes |
| `test` | Tests | ❌ Hidden |
| `build` | Build System | ❌ Hidden |
| `ci` | CI/CD | ❌ Hidden |
| `style` | Styles | ❌ Hidden |

---

## 5. Step-by-Step Verification and Fix Checklist

Use this checklist to diagnose why commits may be missing from a release PR.

### Step 1: Verify PR Titles Follow Conventional Commit Format

1. Go to **GitHub → Pull Requests → Closed**
2. Filter to show PRs merged after the last release (`v0.21.3`, released 2026-02-27)
3. Check the **title** of every merged PR
4. Each title **must** start with `type(optional-scope): description`

> **💡 Tip:** Use GitHub branch protection rules or a CI check like [`amannn/action-semantic-pull-request`](https://github.com/amannn/action-semantic-pull-request) to enforce conventional commit PR titles automatically.

### Step 2: Verify Merge Commit Messages on `main`

```bash
git log --oneline v0.21.3..HEAD
```

- Each commit should start with a conventional commit prefix (`feat:`, `fix:`, `docs:`, etc.)
- Look for any that don't match the pattern `type(scope): ...` or `type: ...`

**Alternative — check only the first word of each commit:**

```bash
git log --oneline v0.21.3..HEAD | grep -v -E '^[a-f0-9]+ (feat|fix|docs|chore|refactor|perf|test|build|ci|style|revert)(\(.+\))?!?:'
```

This shows commits that do **not** match the conventional commit pattern.

### Step 3: Check if `docs: #225` Is in the Commit Range

```bash
git log --oneline --all --grep="update commitlint"
```

Verify that:
- This commit exists on the `main` branch
- It is between the `v0.21.3` / `buhbot-v0.21.3` tag and `HEAD`

```bash
git log --oneline buhbot-v0.21.3..HEAD --grep="update commitlint"
```

If the commit **doesn't appear** in this range, it was either:
- Merged before the `v0.21.3` release (and is already included in a previous version)
- Not actually on `main` (check the branch it was merged into)

### Step 4: Verify Release-Please Can See the Commits

1. Go to [PR #233](https://github.com/maslennikov-ig/BuhBot/pull/233) on GitHub
2. Check the PR **description** — release-please lists the commits it detected
3. **If `docs: #225` is listed** in the PR description but not in the CHANGELOG preview → it's a `changelogSections` config issue (check `"hidden"` setting for `docs`)
4. **If it's not listed at all** → the merge commit message format on `main` may be wrong

### Step 5: Force Release-Please to Re-scan

If you've verified the commit exists and has the correct format, force a re-scan:

**Option A:** Close and reopen PR #233 on GitHub

**Option B:** Push a new commit to `main` (even an empty one):

```bash
git commit --allow-empty -m "fix: trigger release-please rescan"
git push origin main
```

> **⚠️ Warning:** Option B creates an artificial `fix:` commit that will bump the version. Only use this if you actually need a version bump or are comfortable with the extra entry in the changelog.

### Step 6: Clean Up Legacy CHANGELOG Content

The [`CHANGELOG.md`](CHANGELOG.md) contains old Keep-a-Changelog format entries below the release-please managed section (starting around line 587 with `## [Unreleased]`).

**Actions:**

1. Identify where release-please's managed entries end (after the last `## [0.x.x](https://github.com/...)` entry)
2. Remove or move the entire legacy section (from `## [Unreleased]` onwards) to an archive file like `docs/archive/CHANGELOG-legacy.md`
3. Remove the `## [Unreleased]` line
4. Commit the cleanup: `chore: remove legacy changelog entries`

### Step 7: Consider Adding Config Options

Add these to [`release-please-config.json`](release-please-config.json):

```json
{
  "bump-minor-pre-major": true,
  "bump-patch-for-minor-pre-major": true,
  "include-v-in-tag": true
}
```

- **`bump-minor-pre-major`**: Prevents accidental `1.0.0` release from a breaking change while in `0.x.x`
- **`bump-patch-for-minor-pre-major`**: Makes `feat:` bump PATCH instead of MINOR during pre-1.0.0 development
- **`include-v-in-tag`**: Creates tags like `v0.21.4` instead of `buhbot-v0.21.4`

---

## 6. Recommended Configuration Improvements

Here is the improved [`release-please-config.json`](release-please-config.json):

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "release-type": "node",
  "changelog-path": "CHANGELOG.md",
  "bump-minor-pre-major": true,
  "bump-patch-for-minor-pre-major": true,
  "packages": {
    ".": {
      "changelog-path": "CHANGELOG.md"
    }
  },
  "changelogSections": [
    { "type": "feat", "section": "Features", "hidden": false },
    { "type": "fix", "section": "Bug Fixes", "hidden": false },
    { "type": "perf", "section": "Performance", "hidden": false },
    { "type": "refactor", "section": "Refactoring", "hidden": false },
    { "type": "docs", "section": "Documentation", "hidden": false },
    { "type": "chore", "section": "Maintenance", "hidden": false },
    { "type": "revert", "section": "Reverts", "hidden": false },
    { "type": "test", "section": "Tests", "hidden": true },
    { "type": "build", "section": "Build System", "hidden": true },
    { "type": "ci", "section": "CI/CD", "hidden": true },
    { "type": "style", "section": "Styles", "hidden": true }
  ]
}
```

### Changes from Current Config

| Change | Reason |
|---|---|
| Added `"bump-minor-pre-major": true` | Prevents accidental `1.0.0` release from breaking changes during `0.x.x` development |
| Added `"bump-patch-for-minor-pre-major": true` | Makes `feat:` commits bump PATCH instead of MINOR during pre-1.0.0, giving finer version control |
| Added explicit `"changelog-path"` in packages | Ensures changelog path is explicit per package for clarity |

---

## 7. Best Practices for Squash-and-Merge with Release-Please

### PR Title Discipline

1. **Always ensure PR titles follow conventional commit format** before creating the PR
2. Use the format: `type(scope): description` or `type: description`
3. Keep titles concise — GitHub will append `(#NNN)` on squash-merge

### Automated Enforcement

Add a CI check to enforce conventional commit PR titles. Use [`amannn/action-semantic-pull-request`](https://github.com/amannn/action-semantic-pull-request) in your CI workflow:

```yaml
# .github/workflows/ci.yml (add this job)
pr-title:
  name: Validate PR Title
  runs-on: ubuntu-latest
  if: github.event_name == 'pull_request'
  steps:
    - uses: amannn/action-semantic-pull-request@v5
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      with:
        types: |
          feat
          fix
          docs
          style
          refactor
          perf
          test
          build
          ci
          chore
          revert
```

### Multi-Change PRs

When a single PR contains multiple significant changes that should each have their own changelog entry, use `BEGIN_COMMIT_OVERRIDE` in the merge commit body (see [Section 3](#3-begin_commit_override--end_commit_override)).

### Understanding Non-Bumping Types

For `docs:`, `chore:`, `refactor:`, and similar non-bumping commits:

- They **will not** trigger a release on their own
- They **will** appear in the changelog once a `fix:`/`feat:`/`perf:` commit lands in the same range
- If you need them to trigger a release, change the PR title to `fix:` or `feat:` instead
- Accept that they'll be included in the **next** release triggered by a version-bumping commit

### Merge Workflow Summary

```
┌─────────────────────────────────────────────────┐
│  Developer creates PR with conventional title   │
│  e.g., "fix(sla): resolve timer drift"          │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│  CI validates PR title (semantic-pull-request)  │
│  ✅ Pass → PR can be merged                     │
│  ❌ Fail → Developer fixes the title            │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│  Reviewer clicks "Squash and merge"             │
│  - Verify title is correct                      │
│  - Add BEGIN_COMMIT_OVERRIDE if multi-change    │
│  - Confirm merge                                │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│  CI runs on main → completes                    │
│  workflow_run triggers release-please            │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│  Release-please scans commits since last tag    │
│  - Creates/updates release PR if bump needed    │
│  - Includes all non-hidden types in changelog   │
└─────────────────────────────────────────────────┘
```

---

## Quick Reference Card

| Question | Answer |
|---|---|
| Why is my `docs:` commit missing from the release PR? | `docs:` doesn't trigger a version bump. It will appear once a `fix:`/`feat:` lands. |
| How do I force a release? | Push a `fix:` or `feat:` commit (even `fix: trigger release`). |
| How do I include multiple changelog entries from one PR? | Use `BEGIN_COMMIT_OVERRIDE` / `END_COMMIT_OVERRIDE` in the merge commit body. |
| Why did release-please not create a PR? | No version-bumping commits (`feat:`, `fix:`, `perf:`) since the last release. |
| How do I re-trigger release-please? | Close and reopen the release PR, or push any commit to `main`. |
| Where does release-please read commit messages from? | The Git history on `main` (via GitHub API), **not** PR descriptions. |
| Does the `(#123)` suffix in squash-merge affect anything? | No, release-please handles it correctly. |
