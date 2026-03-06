# ADR-003: CI/CD Workflow Optimization and Sequential Release Pipeline

## Status

Accepted

## Date

2026-02-28

## Context

The current CI/CD and release workflows have several issues that need to be addressed:

### Issues Identified

1. **Race Condition Between CI and Release Please**
   - Both `ci.yml` and `release-please.yml` trigger on `push` to `main`
   - Release Please ran before CI completed, causing unreliable behavior
   - No guarantee that code passed CI before release preparation

2. **Unintended Deployment Triggers**
   - `deploy.yml` triggers on every CI workflow completion via `workflow_run`
   - Deployments ran even for documentation-only changes with no code changes
   - No distinction between code changes and non-code changes

3. **Release PR Creation Inconsistency**
   - Release Please sometimes didn't create PRs for certain commit types
   - No clear path filtering for when releases should be created

### Current Implementation

#### CI Workflow (`.github/workflows/ci.yml`)
- **Trigger:** `push` to `main` and `pull_request` to `main`
- **Jobs:**
  - `lint` - ESLint code quality (backend only)
  - `format` - Prettier formatting check
  - `type-check` - TypeScript validation (backend only)
  - `build-docker` - Build 3 Docker images (backend, frontend, monitoring)
  - `security-scan` - npm audit critical (backend only)
  - `test` - Unit tests with Redis (backend only)
  - `ci-success` - Summary and notifications
- **Issue:** Runs full pipeline including Docker builds on all commits, including documentation-only changes

#### Release Please Workflow (`.github/workflows/release-please.yml`)
- **Original Trigger:** `push` to `main` (conflicted with CI)
- **Issue:** Race condition - no guarantee CI completed first

#### Deploy Workflow (`.github/workflows/deploy.yml`)
- **Trigger:** `workflow_run` on CI completion
- **Issue:** Deploys on every CI run, regardless of whether code changed

### Industry Best Practices

Based on research of GitHub Actions documentation and Release Please best practices:

1. **Sequential Workflow Execution**
   - Use `workflow_run` trigger to ensure one workflow completes before another starts
   - This is the recommended pattern for CI → Release → Deploy sequences

2. **Conditional Deployment**
   - Only trigger deployments when actual releases are created
   - Use Release Please outputs (`releases_created`) to determine if deployment should run

3. **Path-Based Filtering**
   - Use `paths` or `paths-ignore` to skip unnecessary builds
   - Docker builds should only run on code changes, not documentation

4. **Release Please Outputs**
   - `releases_created` - boolean indicating if a release was created
   - `version` - the version that was released
   - These can be used to conditionally trigger downstream actions

## Decision

### Solution Implemented (PR #226)

We have implemented the following changes:

#### 1. Release Please Workflow (`.github/workflows/release-please.yml`)

**Changed trigger from:**
```yaml
on:
  push:
    branches: [main]
```

**To:**
```yaml
on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [main]
```

This ensures Release Please only runs after CI completes successfully.

**Added conditional deployment trigger:**
```yaml
- name: Trigger Production Deploy
  if: steps.release.outputs.releases_created == 'true'
  uses: actions/github-script@v7
  with:
    script: |
      await github.rest.actions.createWorkflowDispatch({
        owner: context.repo.owner,
        repo: context.repo.repo,
        workflow_id: 'deploy.yml',
        ref: 'main'
      });
```

#### 2. Deploy Workflow (`.github/workflows/deploy.yml`)

**Removed the `workflow_run` trigger:**
```yaml
# REMOVED:
# on:
#   workflow_run:
#     workflows: ['CI']
#     types: [completed]
#     branches: [main]
```

**Kept only manual trigger:**
```yaml
on:
  workflow_dispatch:
    inputs:
      skip_approval:
        description: 'Skip manual approval (emergency deploy)'
        required: false
        default: 'false'
        type: boolean
```

Now deployment only happens:
1. Manually via `workflow_dispatch`
2. Automatically when triggered by Release Please after a version bump

#### 3. New Release Flow

```
PR merged → CI runs → Release Please runs → (if version bumped) → Deploy to Production
```

This ensures:
- CI always completes before Release Please runs
- Production deployment only happens when code actually changes (version bump)
- No unnecessary deployments for docs-only or no-code changes

## Alternatives Considered

### Alternative 1: Split Release Please into Two Workflows

Create separate `release-pr.yml` and `release-tag.yml` workflows:
- **Pros:** More granular control over PR creation vs release tagging
- **Cons:** More complex to maintain, more files to manage

**Decision:** Not implemented - single workflow solution achieves same result with less complexity.

### Alternative 2: Use Path Filtering in CI

Add `paths-ignore` to CI workflow to skip Docker builds on documentation changes:
```yaml
on:
  push:
    branches: [main]
    paths-ignore:
      - '**.md'
      - 'docs/**'
```

**Decision:** Recommended for future optimization but not implemented in this PR. Would save ~5-10 minutes per documentation-only commit.

### Alternative 3: Use `repository_dispatch` Events

Use custom events to trigger workflows:
- **Pros:** Maximum control over trigger conditions
- **Cons:** More complex to set up and maintain

**Decision:** Not implemented - `workflow_run` provides sufficient control for current needs.

## Migration Strategy

### For Existing Workflows

No breaking changes are required. The modifications are additive:

1. Release Please now waits for CI - existing behavior preserved, just sequenced correctly
2. Deploy now requires manual trigger or Release Please dispatch - prevents accidental deployments
3. No changes to how developers commit code

### Rollback Plan

If issues arise:
1. Revert PR #226 changes
2. Restore original `release-please.yml` trigger to `push`
3. Restore `workflow_run` trigger in `deploy.yml`
4. Everything returns to previous behavior

## Open Questions

1. **Should we add path filtering to CI?**
   - Would skip Docker builds on documentation-only changes
   - Saves ~5-10 minutes per doc commit
   - Answer: **Yes, implement now** - This will be implemented as part of the release workflow optimization

2. **Should we add a staging deployment?**
   - Current flow goes directly to production
   - Consider staging for larger changes
   - Answer: **After Blue/Green envs setup** - Will evaluate once Blue/Green deployment environments are configured

3. **How should we handle failed deployments?**
   - Currently has rollback mechanism
   - Should we add automated retry?
   - Answer: **After Blue/Green envs setup** - Will add automated retry once Blue/Green environments provide proper rollback capabilities

4. **Should Release Please create releases for docs-only changes?**
   - Currently it could, but deploy won't trigger
   - Could add path filtering to skip release for docs-only
   - Answer: **Simplified workflow** - Release Please runs unconditionally and handles its own logic based on conventional commits. If no conventional commit types (feat:, fix:, etc.) are found, no release is created.

## References

- [Release Please Action](https://github.com/googleapis/release-please-action)
- [GitHub Actions workflow_run trigger](https://docs.github.com/en/actions/learn-github-actions/introduction-to-github-actions)
- [ADR-002: Release Please as Primary Release Automation](002-release-please.md)
- [Release Process Documentation](../infrastructure/release-process.md)
- [Commit Conventions](../COMMIT_CONVENTIONS.md)

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-28 | 1.0 | Initial ADR created |
