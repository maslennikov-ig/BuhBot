# Release Process

Releases are created by the **Release Please** GitHub Action. No manual version bump or CHANGELOG edit is required for normal releases.

## How it works

1. **Merge to main:** When PRs are merged to `main`, Release Please analyzes conventional commits since the last release.
2. **Release PR:** The action opens or updates a release PR that updates `CHANGELOG.md` and version(s) in `package.json` (and `.release-please-manifest.json`).
3. **Publish release:** Merging that release PR creates the git tag (e.g. `v0.9.20`) and the GitHub release.

## Commit format

All commits on `main` must follow [Commit Conventions](../COMMIT_CONVENTIONS.md) so Release Please can parse them correctly. Use `feat:` for minor bumps, `fix:` for patch bumps, and `BREAKING CHANGE:` or `type!` for major bumps.

## Optional: legacy script

The [.claude/scripts/release.sh](../../.claude/scripts/release.sh) script and `/push` command remain available for optional use (e.g. generating RELEASE_NOTES.md or local tagging). For normal product releases, rely on merging the Release Please PR.

## Configuration

- **Workflow:** [.github/workflows/release-please.yml](../../.github/workflows/release-please.yml)
- **Config:** [release-please-config.json](../../release-please-config.json)
- **Manifest:** [.release-please-manifest.json](../../.release-please-manifest.json)
