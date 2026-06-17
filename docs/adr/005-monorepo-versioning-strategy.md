# ADR-005: Monorepo Versioning Strategy

## Status

Proposed (pending review by @maslennikov-ig)

## Date

2026-04-18

## Context

The repository is structured as a Node.js monorepo with three independently deployable components, each carrying its own `package.json`:

| File | Current Version | Managed By |
|------|----------------|------------|
| `package.json` (root) | `0.32.2` | Release Please (`.release-please-manifest.json`) |
| `frontend/package.json` | `0.14.8` | Manual hand-edits |
| `backend/package.json` | `0.30.1` | Manual hand-edits |

### How we got here

ADR-002 introduced Release Please as the primary release automation, configuring it for a single package rooted at `"."`. This was the correct minimal-viable decision at the time: one changelog, one version, one deploy pipeline. The manifest only tracks `"."`:

```json
{ ".": "0.32.2" }
```

`release-please-config.json` also lists a single package:

```json
{ "packages": { ".": {} } }
```

Since then:

- **Backend and frontend have evolved at different rates.** The backend reached `0.30.1` and the frontend `0.14.8` via hand-edits with no formal release process.
- **Commit scopes already diverge.** Contributors (and agents) routinely write `feat(frontend):`, `fix(backend):`, `chore(bot):` — the commit log implicitly carries per-component signal that Release Please currently ignores.
- **Docker images are built per component.** The CI pipeline produces three separate Docker images (`backend`, `frontend`, `monitoring`), each tagged with the root version. There is no reliable way to tell from a Docker tag whether a specific component actually changed in that release.
- **Drift grows silently.** Each `chore: sync` or `feat(frontend):` commit bumps the root version and produces a root CHANGELOG entry, but `frontend/package.json` and `backend/package.json` do not move. A reviewer looking at `backend/package.json@0.30.1` and `package.json@0.32.2` has no way to tell what changed between them.

### Constraints

- **Release automation must remain CI-driven** (no manual `/push patch` for normal releases). ADR-003 established `CI → Release Please → Deploy` as the canonical pipeline.
- **Conventional commits are enforced.** `commitlint` and documentation (CLAUDE.md, COMMIT_CONVENTIONS.md) already require the `type(scope):` format. Scoped commits are the mechanism Release Please uses to route changes to the correct component.
- **Docker image tags must be meaningful.** The `deploy.yml` workflow passes the release SHA to the VDS server; Docker images are pushed tagged with the version. Operators must be able to roll back a specific component.
- **No separate npm registry publishing.** All three packages are `private: true`. Release automation only needs to manage versions, CHANGELOG files, and GitHub Releases — not npm publishes.

## Decision Drivers

1. **Audit clarity** — ops and developers should be able to look at a Docker image tag and know exactly which code it contains, without cross-referencing root vs component versions.
2. **Changelog legibility** — a single monolithic CHANGELOG for a mixed backend/frontend/bot codebase is noisy and hard to use.
3. **Minimal developer-friction change** — commit conventions are already scoped; any solution that reuses existing `feat(frontend):` / `fix(backend):` scopes is lower friction than introducing a new workflow.
4. **Automation over manual gates** — hand-editing component versions is the current source of drift and must be eliminated.
5. **Rollback granularity** — the ability to redeploy backend `1.2.3` while keeping frontend at `2.0.1` is a hard operational requirement on a VDS with constrained resources.

## Considered Options

### Option A: Single Root Version (Synchronized Mirror)

Keep Release Please managing only the root version. Add a CI script (`scripts/sync-component-versions.sh`) that, on every Release Please bump, reads the new root version and writes it into `frontend/package.json` and `backend/package.json` as well.

**How it works:**
- Every release bumps all three `package.json` files to the same version.
- A single `CHANGELOG.md` at root covers all changes.
- Docker images are tagged with the unified version.

**Pros:**
- Minimal Release Please config change — manifest and config need only a post-bump hook, not structural changes.
- One version to communicate externally ("BuhBot 0.33.0 is released").
- No need to teach contributors new scoping conventions (they already exist, they just won't influence separate changelogs).
- Simpler deploy pipeline — one version number to pass around.

**Cons:**
- Version numbers become meaningless at the component level. Backend `0.33.0` may contain zero backend changes — it bumped only because a frontend feature shipped.
- Docker images tagged with root version still do not indicate which component binary actually changed.
- Changelogs remain monolithic and noisy; a backend developer has to read through frontend changes to find relevant entries.
- Drift will re-emerge if the sync script is not run on every release (script adds a new manual gate).
- Does not align with the actual independent deploy cadence the project already uses (frontend and backend are built and deployed as separate Docker services).

### Option B: Per-Package Independent Semver (Recommended)

Configure Release Please as a multi-package monorepo by expanding `release-please-config.json` and `.release-please-manifest.json` to list `backend/`, `frontend/`, and `.` (root) as separate, independently versioned packages. Each component gets its own CHANGELOG, its own version, and its own GitHub Release.

**How it works — correction (2026-04-19 code review):** Release Please multi-package mode routes commits by **file path**, not by commit-message scope. The internal `CommitSplit` utility walks each commit's `git diff --name-only` against the `packages` config and attributes the commit to every package whose `packagePath` prefix matches a changed file.

Concrete consequences:
- A `fix(backend): handle null telegramId` commit that only touches `frontend/src/*.tsx` goes into the **frontend** release, regardless of the `backend` scope in the subject.
- A `feat: add OTel` commit with no scope that touches `backend/src/*.ts` goes into the **backend** release.
- A commit that touches files under both `backend/` and `frontend/` is attributed to **both** packages, producing version bumps on each.
- The commit-message scope still appears in each package's CHANGELOG as the conventional-commit prefix, but it is a display-time label, not a routing signal.

Each component's Docker image is tagged with its own component version. The manifest tracks three independent cursors:

```json
{ ".": "0.32.2", "backend": "1.0.0", "frontend": "0.15.0" }
```

**Pros:**
- Commits that touch `backend/*` files automatically increment `backend/package.json` — objective, not prone to human error on scope naming.
- Each component's CHANGELOG contains only entries whose commits modified that component's files.
- Docker image tags directly reflect the component semver — operators can `docker pull backend:1.2.3` with meaning.
- Eliminates hand-editing as the source of drift — Release Please owns all component versions.
- Independent rollback: redeploy `backend:1.2.1` without touching the frontend image.

**Cons:**
- Commits that touch files in multiple packages produce version bumps on each — e.g. a migration that adds a Prisma model and a corresponding frontend UI tweak will bump both `backend` and `frontend`. Usually desired, but needs to be understood.
- Three concurrent Release Please PRs may appear simultaneously; reviewers must merge each independently (the [linked-versions](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md#linked-versions) plugin can fold them into one if the overhead becomes a problem).
- Initial version alignment requires a deliberate decision (see Implementation Plan, Step 3).
- The deploy workflow must be updated to handle per-component release outputs rather than a single `releases_created` boolean. The correct per-path output name is `<path>--release_created` (singular) — see Step 4.
- Developers cannot control routing by editing the commit subject alone; mis-routing has to be fixed by an actual file change (which is arguably a strength, but surprises people familiar with scope-based tools like Changesets).

### Option D: Changesets (`@changesets/cli`)

Changesets is the de-facto standard for independent package versioning in Node.js monorepos. Developers run `pnpm changeset` at the end of a PR, pick which packages bumped and at what severity, and commit a generated `.changeset/*.md` file. A separate `changesets` action then aggregates pending changesets and opens a release PR per package.

**How it works:**
- Routing signal is an explicit author-authored changeset file, not file paths or commit scopes.
- Each changeset declares which packages bump and at what severity (patch/minor/major).
- CHANGELOGs are built from human-authored changeset summaries, not from commit messages.

**Pros:**
- Clearest authoring model for multi-package bumps — author declares intent explicitly.
- Human-readable changelog entries independent of commit message discipline.
- Common in JS ecosystem (pnpm/turborepo monorepos).

**Cons:**
- Requires developers to run `pnpm changeset` and commit a changeset file on every multi-package PR. This is non-zero friction — easy to forget, and CI enforcement requires a dedicated check.
- We already have conventional-commit + commitlint hooks producing machine-parseable commit history. Adopting Changesets discards that automation and replaces it with a different manual step.
- Docker image tagging integration requires additional glue (the changesets action doesn't know about Docker).
- Existing ADR-002 picked Release Please specifically for its zero-configuration changelog generation. Switching tool families is a larger decision than reconfiguring RP.

### Option C: Hybrid (Root Tracks Deploy Train, Components Track Internal Semver)

Keep root version as a "deploy train" cadence version managed by Release Please. Frontend and backend carry their own internal semver updated by scoped Release Please instances, but they are linked: every root release triggers a patch bump in both components regardless of changes.

**How it works:**
- Root version (`0.x.y`) represents "release cadence" — the product-level version customers see.
- Component versions (`backend/0.x.y`, `frontend/0.x.y`) are bumped by Release Please only when their respective scoped commits exist, but are also force-bumped to match the root patch on every release.

**Pros:**
- Single "product version" for marketing/stakeholder communication.
- Components still get independent changelogs when they have relevant commits.

**Cons:**
- Two versioning systems solving different problems, neither solving either cleanly.
- The forced-bump behavior requires custom Release Please plugins or a post-bump script — adding complexity without the clean semantics of Option B.
- Docker image tags are still ambiguous (is backend `0.32.5` a security fix or a forced bump?).
- Higher cognitive load: contributors must understand when their commit affects the root version vs the component version.

## Decision Outcome

**Adopt Option B: Per-Package Independent Semver.**

Release Please already underpins the release process (see ADR-002) and natively supports multi-package monorepo configuration through `release-please-config.json`'s `packages` map — this is a **configuration expansion, not a tooling change**. File-path routing is arguably stronger than scope-based routing: it eliminates the "wrong-scope drift" class of bug entirely, because version attribution is a mechanical function of what the commit changed rather than a prose field the author has to type correctly.

The operational benefit (meaningful Docker tags, per-component rollback, legible changelogs) is proportionate to the one-time migration cost (updating config files, aligning initial versions, updating the deploy workflow).

Option A was rejected because it only superficially resolves the drift — it makes component versions match the root number, but the root number remains semantically tied to the full monorepo rather than to any individual component. Option C was rejected as the most complex with the least benefit. Option D (Changesets) was rejected because it discards our existing conventional-commit + commitlint automation in exchange for author-authored changeset files with roughly equivalent outcomes.

## Consequences

### Positive

- Version numbers in `backend/package.json` and `frontend/package.json` become the authoritative, machine-managed source of truth for each component.
- Docker image tags are semantically meaningful per component.
- CHANGELOG files per component are targeted and readable.
- No more manual hand-edits to component `package.json` files.
- Independent component rollback is operationally straightforward.

### Negative

- The deploy workflow (`deploy.yml`) must handle per-component release outputs. Release Please produces per-path outputs named `<path>--release_created` (singular — see Step 4). The workflow needs to detect which component was released and trigger the appropriate Docker build/push.
- Commits that modify files in multiple packages produce version bumps on all of them. Usually desired (a cross-cutting refactor really does change backend + frontend), but a contributor needs to realise that touching `frontend/next.config.js` inside a "backend-only" feature branch will also bump `frontend/package.json`.
- The commit subject's scope (`feat(backend):`) no longer controls routing — only the changelog header label. A PR titled `fix(backend):` that accidentally only edits frontend files will end up in the frontend changelog under a `### Bug Fixes` header labelled `backend:`, which is weird-looking but not broken. Mitigation: commitlint already enforces that scope matches an allowed list; add a softer pre-push check that warns when the scope does not match any of the modified packages.
- Migration requires a one-time version alignment decision (see Step 3 of the Implementation Plan).
- Reviewing and merging three separate Release Please PRs adds a small operational overhead compared to one. The [`linked-versions`](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md#linked-versions) plugin can fold them back into one PR if the overhead becomes measurable.

### Required Follow-Up Tasks

1. Update `release-please-config.json` and `.release-please-manifest.json` (Implementation Plan Step 1–2).
2. Update `.github/workflows/release-please.yml` to handle per-component outputs (Step 4).
3. Update `CONTRIBUTING.md` with scoped commit conventions (Step 5).
4. Update Docker tagging in CI to use component versions (Step 6).
5. Create Beads task for the migration PR (Step 7).

## Implementation Plan

### Step 1: Decide Initial Component Versions

Before updating config files, a baseline version decision is needed for `backend` and `frontend`. Two options:

**Option 1a — Reset to match root (`0.32.2`):**
Bump both `backend/package.json` and `frontend/package.json` to `0.32.2` as a starting baseline. Signals "we were tracking root before; now we branch off from here." Simple, no history confusion.

**Option 1b — Formalize historical versions:**
Accept `backend: 0.30.1` and `frontend: 0.14.8` as the starting manifest cursors, acknowledging that these reflect the components' actual independent evolution. Requires documenting why the gap exists.

Recommendation: **Option 1a** — bump both to `0.32.2` as a clean baseline. The historical gap in hand-edited versions is not semantically meaningful (it reflects editing behavior, not independent feature cadence) and would confuse consumers of the component versions. Document the reset in the migration PR description.

### Step 2: Update `release-please-config.json`

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
      "component": "backend"
    },
    "frontend": {
      "changelog-path": "CHANGELOG.md",
      "component": "frontend"
    }
  },
  "changelogSections": [
    { "type": "feat",     "section": "Features",       "hidden": false },
    { "type": "fix",      "section": "Bug Fixes",       "hidden": false },
    { "type": "perf",     "section": "Performance",     "hidden": false },
    { "type": "refactor", "section": "Refactoring",     "hidden": false },
    { "type": "docs",     "section": "Documentation",   "hidden": false },
    { "type": "chore",    "section": "Maintenance",     "hidden": false },
    { "type": "revert",   "section": "Reverts",         "hidden": false },
    { "type": "test",     "section": "Tests",           "hidden": true  },
    { "type": "build",    "section": "Build System",    "hidden": true  },
    { "type": "ci",       "section": "CI/CD",           "hidden": true  },
    { "type": "style",    "section": "Styles",          "hidden": true  }
  ]
}
```

Note: the `component` field is a logical package identifier — it's the key used by Release Please to name the per-package release PR, to prefix tags (combined with `include-component-in-tag: true` in the workflow step, see Step 4), and to key the `.release-please-manifest.json` entries. The top-level `release-type: node` covers all three packages; the per-package `release-type` was removed to avoid the impression that `backend` is special.

Routing across the three entries is **by file path**: commits that touch files under `backend/` are attributed to the `backend` package, files under `frontend/` go to `frontend`, and anything else (root `package.json`, `docs/`, `.github/`, etc.) goes to `.`. The commit-message scope is not involved in this decision — it only appears as the changelog header label inside whichever package the commit was routed to.

### Step 3: Update `.release-please-manifest.json`

```json
{
  ".": "0.32.2",
  "backend": "0.32.2",
  "frontend": "0.32.2"
}
```

(Reflects Option 1a baseline decision above.)

### Step 4: Update `.github/workflows/release-please.yml`

The Release Please action outputs per-package boolean and version keys when configured as a multi-package monorepo. The correct per-path output name is `<path>--release_created` (**singular** — the plural `releases_created` is the top-level aggregate flag, which is a different thing). Key outputs:

- `steps.release.outputs.releases_created` — top-level aggregate: `true` if any package released.
- `steps.release.outputs.backend--release_created` — backend released (note: singular `release_created`).
- `steps.release.outputs.frontend--release_created` — frontend released.
- `steps.release.outputs.backend--tag_name` — e.g. `backend-v0.33.0` when `include-component-in-tag: true`.
- `steps.release.outputs.frontend--tag_name` — e.g. `frontend-v0.15.0`.

`include-component-in-tag` defaults to `false`, which would produce `v0.32.3` tags for all three packages — they would collide as soon as versions diverge. The flag **must** be set to `true` on the action step for the component-prefixed tags used below to actually appear.

The deploy trigger step should be updated to pass component-level information to `deploy.yml`, which can then selectively rebuild only the changed Docker service(s):

```yaml
- uses: googleapis/release-please-action@v4
  id: release
  with:
    token: ${{ secrets.RELEASE_BOT_PAT }}
    config-file: release-please-config.json
    manifest-file: .release-please-manifest.json
    include-component-in-tag: true   # REQUIRED — produces `backend-v0.33.0` etc.

- name: Trigger Production Deploy
  if: steps.release.outputs.releases_created == 'true'
  uses: actions/github-script@v7
  with:
    script: |
      const backendReleased  = '${{ steps.release.outputs.backend--release_created }}'  === 'true';
      const frontendReleased = '${{ steps.release.outputs.frontend--release_created }}' === 'true';
      const backendTag       = '${{ steps.release.outputs.backend--tag_name }}';
      const frontendTag      = '${{ steps.release.outputs.frontend--tag_name }}';

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
          skip_approval:     'false'
        }
      });
```

`deploy.yml` will need matching `workflow_dispatch` inputs and conditional build steps — this is a follow-up task for the migration PR. Verify output names against the [release-please-action README](https://github.com/googleapis/release-please-action#outputs) before the implementation PR goes in; the action has historically changed the exact shape of outputs between major versions.

### Step 5: Document Scoped Commit Convention in `CONTRIBUTING.md`

Add a "Commit Scopes" section clarifying which scopes route to which component:

| Scope | Component | Example |
|-------|-----------|---------|
| `frontend` | `frontend/package.json` | `feat(frontend): add dark mode toggle` |
| `backend` | `backend/package.json` | `fix(backend): handle null telegramId` |
| `bot` | root | `feat(bot): SLA escalation notifications` |
| `infra`, `ci`, `deps` | root | `chore(ci): add path filtering` |
| _(no scope)_ | root | `docs: update README` |

### Step 6: Update Docker Image Tagging

Update `ci.yml` and `deploy.yml` to tag backend and frontend Docker images with their component versions, not the root version. The component version can be read from `backend/package.json` and `frontend/package.json` at build time using `jq`.

This is a follow-up concern: the first migration PR can keep root-version tagging as a transitional state. Once Release Please is producing per-component versions cleanly, the Docker tagging migration is a separate PR.

### Step 7: Create Beads Task for Migration PR

```bash
bd create "Migrate to per-package Release Please monorepo config (gh-310)" -t chore -p 2
```

Assign to `fix/gh-310-monorepo-versioning` branch, PR to `main`.

## References

- [Release Please — Monorepo Support](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md)
- [Release Please — Config Schema](https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json)
- [Release Please Action — Multi-package outputs](https://github.com/googleapis/release-please-action#outputs)
- [ADR-002: Release Please as Primary Release Automation](002-release-please.md)
- [ADR-003: CI/CD Workflow Optimization and Sequential Release Pipeline](003-ci-cd-workflow-optimization.md)
- [docs/COMMIT_CONVENTIONS.md](../COMMIT_CONVENTIONS.md)
- [GitHub Issue #310](https://github.com/maslennikov-ig/BuhBot/issues/310)
- [`.release-please-manifest.json`](../../.release-please-manifest.json)
- [`.github/workflows/release-please.yml`](../../.github/workflows/release-please.yml)

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-04-18 | 1.0 | Initial ADR — proposed for @maslennikov-ig review |
| 2026-04-19 | 1.1 | Code-review pass (PR #318): corrected the fundamental routing model — Release Please multi-package routes by file path, not commit-message scope. Rewrote Option B's "How it works / Pros / Cons", consequences, and Step 4 accordingly. Fixed the `releases_created` → `release_created` output name. Added the required `include-component-in-tag: true` flag to the workflow snippet. Added Option D (Changesets) as a considered alternative. Removed redundant per-package `release-type` from the config snippet. Clarified the `component` field description. |
