# Implementation Plan: Monorepo Versioning Migration (gh-310)

**ADR reference:** [ADR-005: Monorepo Versioning Strategy](../adr/005-monorepo-versioning-strategy.md)
**Branch:** `fix/gh-310-monorepo-versioning`
**Beads task:** after this ADR is approved, create the implementation task linked to this epic. A template command (adjust the parent epic id to the one tracking this batch — currently `buh-kopt` for the 2026-04-19 code-review remediation):

```bash
bd create "Migrate to per-package Release Please monorepo config (gh-310)" \
  --type=chore --priority=2 --external-ref=gh-310 \
  --deps "parent:<epic-id>"
```

Record the resulting `buh-*` id at the top of this plan file in a follow-up commit so reviewers of the implementation PR can find the task directly.

---

## Pre-Migration Checklist

- [ ] ADR-005 reviewed and approved by @maslennikov-ig
- [ ] No open Release Please PRs in flight (merge or close before starting)
- [ ] Current root version confirmed: `0.32.2`
- [ ] Worktree created: `fix/gh-310-monorepo-versioning` off `main`

---

## Step 1: Bump Component Versions to Baseline

**Files to edit:**

- `backend/package.json` — change `"version": "0.30.1"` to `"version": "0.32.2"`
- `frontend/package.json` — change `"version": "0.14.8"` to `"version": "0.32.2"`

**Rationale:** Aligns all three packages at a clean baseline (`0.32.2 = current root`). After this, Release Please takes over all three versions. The historical hand-edited values (`0.30.1`, `0.14.8`) are not semantically meaningful and are discarded.

**Verification:** `jq .version backend/package.json frontend/package.json package.json` — all three should read `0.32.2`.

---

## Step 2: Update `release-please-config.json`

Replace the current single-package config with a three-package config:

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "release-type": "node",
  "packages": {
    ".": {
      "changelog-path": "CHANGELOG.md",
      "component": "root"
    },
    "backend": {
      "changelog-path": "CHANGELOG.md",
      "component": "backend",
      "release-type": "node"
    },
    "frontend": {
      "changelog-path": "CHANGELOG.md",
      "component": "frontend",
      "release-type": "node"
    }
  },
  "changelogSections": [
    { "type": "feat",     "section": "Features",      "hidden": false },
    { "type": "fix",      "section": "Bug Fixes",      "hidden": false },
    { "type": "perf",     "section": "Performance",    "hidden": false },
    { "type": "refactor", "section": "Refactoring",    "hidden": false },
    { "type": "docs",     "section": "Documentation",  "hidden": false },
    { "type": "chore",    "section": "Maintenance",    "hidden": false },
    { "type": "revert",   "section": "Reverts",        "hidden": false },
    { "type": "test",     "section": "Tests",          "hidden": true  },
    { "type": "build",    "section": "Build System",   "hidden": true  },
    { "type": "ci",       "section": "CI/CD",          "hidden": true  },
    { "type": "style",    "section": "Styles",         "hidden": true  }
  ]
}
```

**Verification:** Validate JSON with `node -e "JSON.parse(require('fs').readFileSync('release-please-config.json','utf8'))"`.

---

## Step 3: Update `.release-please-manifest.json`

```json
{
  ".": "0.32.2",
  "backend": "0.32.2",
  "frontend": "0.32.2"
}
```

**Verification:** `cat .release-please-manifest.json | jq .` — confirm three keys, all `"0.32.2"`.

---

## Step 4: Update `.github/workflows/release-please.yml`

First, make sure the Release Please action step itself has `include-component-in-tag: true`. Without that flag, multi-package mode emits identical `v0.32.3` tags for every package and the per-component tags (`backend-v0.33.0`, `frontend-v0.15.0`) referenced below would never appear:

```yaml
- uses: googleapis/release-please-action@v4
  id: release
  with:
    token: ${{ secrets.RELEASE_BOT_PAT }}
    config-file: release-please-config.json
    manifest-file: .release-please-manifest.json
    include-component-in-tag: true   # REQUIRED for per-component tags
```

Then in the `Trigger Production Deploy` step, replace the current flat `releases_created` logic with per-component output handling. Note the per-path output name is `<path>--release_created` (**singular** — the plural `releases_created` is the top-level aggregate flag, a different thing):

```yaml
- name: Trigger Production Deploy
  if: steps.release.outputs.releases_created == 'true'
  uses: actions/github-script@v7
  with:
    script: |
      const backendReleased  = '${{ steps.release.outputs.backend--release_created }}' === 'true';
      const frontendReleased = '${{ steps.release.outputs.frontend--release_created }}' === 'true';
      const backendTag       = '${{ steps.release.outputs.backend--tag_name }}' || '';
      const frontendTag      = '${{ steps.release.outputs.frontend--tag_name }}' || '';
      const releaseSha       = '${{ steps.release_info.outputs.release_sha }}';

      await github.rest.actions.createWorkflowDispatch({
        owner: context.repo.owner,
        repo:  context.repo.repo,
        workflow_id: 'deploy.yml',
        ref: 'main',
        inputs: {
          backend_released:  String(backendReleased),
          frontend_released: String(frontendReleased),
          backend_tag:       backendTag,
          frontend_tag:      frontendTag,
          sha:               releaseSha,
          skip_approval:     'false'
        }
      });
```

Also add `workflow_dispatch` inputs to `deploy.yml`:

```yaml
workflow_dispatch:
  inputs:
    sha:
      description: 'Commit SHA to deploy'
      required: false
      default: ''
    backend_released:
      description: 'Backend component was released'
      required: false
      default: 'false'
    frontend_released:
      description: 'Frontend component was released'
      required: false
      default: 'false'
    backend_tag:
      description: 'Backend release tag (e.g. backend-v1.0.0)'
      required: false
      default: ''
    frontend_tag:
      description: 'Frontend release tag (e.g. frontend-v1.0.0)'
      required: false
      default: ''
    skip_approval:
      description: 'Skip manual approval (emergency deploy)'
      required: false
      default: 'false'
      type: boolean
```

**Note:** Docker-level conditional builds per component can be a follow-up PR. For the initial migration, the deploy workflow can continue to build and push all images when `releases_created == 'true'`. The inputs above are additive and non-breaking.

**Verification:** `yamllint .github/workflows/release-please.yml .github/workflows/deploy.yml` (or open in GitHub Actions editor to validate YAML).

---

## Step 5: Update `CONTRIBUTING.md`

`CONTRIBUTING.md` does not exist on `main` (confirmed via `ls CONTRIBUTING.md` before this plan was drafted). **Create it at the repo root** with at minimum the "Commit scope reference" section below and a pointer to `docs/COMMIT_CONVENTIONS.md` for the full rules.

**Commit scope reference to add** (corrected 2026-04-19: Release Please routes by **file path**, not by commit scope — the scope is only a label for the changelog entry; the package bump is determined by which files the commit modified):

| You touched these files | Release Please bumps | Example commit |
|-------------------------|---------------------|----------------|
| `frontend/**` | `frontend/package.json` + `frontend/CHANGELOG.md` | `feat(frontend): add dark mode toggle` |
| `backend/**` | `backend/package.json` + `backend/CHANGELOG.md` | `fix(backend): handle null telegramId` |
| `backend/**` + `frontend/**` (cross-cutting) | BOTH packages (each with the same commit) | `feat: add OTel tracing` modifying both |
| root files (`package.json`, `docs/`, `.github/`, `infrastructure/`, …) | root `package.json` + `CHANGELOG.md` | `chore(ci): update workflow` |

**Common misconceptions worth explicitly calling out** in CONTRIBUTING.md:

- Writing `fix(backend):` in the subject does **not** force the bump into the `backend` package. If the diff only touches `frontend/**`, the bump goes to `frontend` and the commit subject becomes the changelog entry's header label only.
- Unscoped commits that only touch root files go to the root package. Unscoped commits that touch `backend/**` go to the `backend` package even without a scope.
- If you want a cross-cutting refactor NOT to bump both packages, split the PR into two commits so each touches only one package's files.

**Verification:** Read through the updated file; confirm the scopes table is present and that the clarifications on path-routing vs scope-labelling are clear.

---

## Step 6: Dry-Run Release Please Locally (Optional but Recommended)

If the `release-please` CLI is available:

```bash
npx release-please release-pr \
  --token=$GITHUB_TOKEN \
  --repo-url=maslennikov-ig/BuhBot \
  --config-file=release-please-config.json \
  --manifest-file=.release-please-manifest.json \
  --dry-run
```

This validates that Release Please can parse the new config and manifest without creating an actual PR.

---

## Step 7: Commit and Open PR

```bash
# Stage only the relevant files
git add release-please-config.json \
        .release-please-manifest.json \
        backend/package.json \
        frontend/package.json \
        .github/workflows/release-please.yml \
        .github/workflows/deploy.yml \
        CONTRIBUTING.md \
        docs/adr/005-monorepo-versioning-strategy.md \
        docs/plans/gh-310-monorepo-versioning-plan.md

git commit -m "chore(ci): adopt per-package Release Please for monorepo versioning (gh-310)"

git push -u origin fix/gh-310-monorepo-versioning
gh pr create \
  --title "chore(ci): adopt per-package Release Please for monorepo versioning" \
  --body "Closes #310. See docs/adr/005-monorepo-versioning-strategy.md for rationale."
```

---

## Post-Migration Verification

After the PR is merged and Release Please runs for the first time:

- [ ] Release Please creates up to three release PRs (one per package) for any commits since the last release that modified files under `backend/`, `frontend/`, or the repo root respectively. If the `linked-versions` plugin is configured later, the three PRs can fold into one combined PR; without it expect three.
- [ ] `backend/CHANGELOG.md` and `frontend/CHANGELOG.md` are created by Release Please on first per-component release.
- [ ] Docker images continue to build and deploy without errors.
- [ ] `.release-please-manifest.json` is updated by Release Please with the new per-component versions after merge.

---

## Follow-Up Tasks (Out of Scope for This PR)

| Task | Priority | Notes |
|------|----------|-------|
| Update Docker image tagging to use component versions | Medium | Tag `backend:$BACKEND_VERSION` instead of root version |
| Tighten commitlint scope allowlist | Low | Enforce valid scopes in `.commitlintrc` to prevent drift |
| Add `frontend/CHANGELOG.md` and `backend/CHANGELOG.md` stubs | Low | Release Please will create them on first release; stubs optional |
| Evaluate linked-versioning mode | Low | Release Please supports `linked-versions: true` for coordinated bumps — evaluate if independent versions diverge too far |
