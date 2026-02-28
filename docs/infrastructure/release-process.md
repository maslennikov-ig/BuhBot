# Release Process

Releases are created by the **Release Please** GitHub Action. No manual version bump or CHANGELOG edit is required for normal releases.

## How it works

1. **Merge to main:** When PRs are merged to `main`, CI runs first.
2. **Release Please runs:** After CI completes successfully, the Release Please workflow triggers (via `workflow_run`).
3. **Release PR:** The action opens or updates a release PR that updates `CHANGELOG.md` and version(s) in `package.json` (and `.release-please-manifest.json`).
4. **Publish release:** Merging that release PR creates the git tag (e.g. `v0.9.20`) and the GitHub release.
5. **Deploy to Production:** After the release is published, the production deployment is triggered automatically (only if a version bump occurred).

**Important:** Release Please only *creates or updates* the release PR. It does **not** merge it. The tag and GitHub release are created only when that PR is merged (e.g. by a maintainer or by enabling [GitHub Auto-merge](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/automatically-merging-a-pull-request) on the release PR).

## Commit format

All commits on `main` must follow [Commit Conventions](../COMMIT_CONVENTIONS.md) so Release Please can parse them correctly. Use `feat:` for minor bumps, `fix:` for patch bumps, and `BREAKING CHANGE:` or `type!` for major bumps.

## Optional: legacy script

The [.claude/scripts/release.sh](../../.claude/scripts/release.sh) script and `/push` command remain available for optional use (e.g. generating RELEASE_NOTES.md or local tagging). For normal product releases, rely on merging the Release Please PR.

## Configuration

- **Workflow:** [.github/workflows/release-please.yml](../../.github/workflows/release-please.yml) — triggers on `workflow_run` after CI completes, then creates/updates the release PR.
- **Deploy Workflow:** [.github/workflows/deploy.yml](../../.github/workflows/deploy.yml) — triggered automatically by Release Please when a release is created (not on every CI run).

## Troubleshooting

- **"Resource not accessible by integration" or "Resource not accessible by personal access token"**  
  The workflow must grant `actions: read` in addition to `contents`, `pull-requests`, and `issues`. See [release-please-action#1048](https://github.com/googleapis/release-please-action/issues/1048). The workflow file already sets these permissions.

- **"GitHub Actions is not permitted to create or approve pull requests"** (Release Please fails at creating the release PR)  
  Enable the setting so the default `GITHUB_TOKEN` can create and update the release PR:
  1. On GitHub: **Settings** → **Actions** → **General**.
  2. Under **Workflow permissions**, enable **"Allow GitHub Actions to create and approve pull requests"**.
  3. Click **Save**.

  If the checkbox is grayed out, the repository's organization is overriding it: an org admin must enable it in **Organization** → **Settings** → **Actions** → **General** first.  
  See [GitHub Docs: Preventing GitHub Actions from creating or approving pull requests](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#preventing-github-actions-from-creating-or-approving-pull-requests).

- **Release PR was created but no release appeared** (e.g. PR #30 open, no tag/release)  
  Release Please does not merge the release PR. You must merge it (squash or merge) to create the tag and GitHub release. Options:
  1. **Manual:** Open the release PR on GitHub and use "Squash and merge" (or "Merge pull request") once you're satisfied with the changelog.
  2. **Auto-merge:** On the release PR, enable [Auto-merge](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/automatically-merging-a-pull-request) so it merges when branch protection requirements (e.g. CI) pass.

## VDS deployment requirement

The **Deploy to Production** workflow does not sync `backend/.env` (or other `.env` files) to the VDS for security. The server must already have `backend/.env` with at least `DATABASE_URL` and `TELEGRAM_BOT_TOKEN` before running a GitHub-triggered deploy. The deploy script ([infrastructure/scripts/github-deploy.sh](../../infrastructure/scripts/github-deploy.sh)) runs a pre-flight check and fails with a clear error if the file is missing or incomplete.
