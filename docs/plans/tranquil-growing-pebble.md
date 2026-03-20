# Plan: Feature Branch Workflow + `/push` Command Rework

## Context

Текущий подход — прямые пуши в `main`. Это вызывает каскад проблем с Release Please:

1. **CI отменяется**: каждый push в main → CI starts → Release Please мержит свой PR → новый push → concurrency отменяет предыдущий CI
2. **Wasted CI runs**: из 10 последних CI на feature-коммиты, 8 получили `cancelled`
3. **Deploy нестабилен**: deploy triggers на `workflow_run` CI, cancelled CI = skipped deploy
4. **Нет code review**: код попадает в main без проверки

Решение: переход на **feature branches + PRs**, плюс доработка `/push` команды.

## Изменения

### 1. CI workflow: исправить concurrency

**Файл**: `.github/workflows/ci.yml` (строки 9-11)

Сейчас:
```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

Заменить на:
```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

**Логика**: PR-пуши отменяют предыдущий CI того же PR (обновление ветки). Пуши в main (merge PR) НЕ отменяют друг друга — каждый мерж получает полный CI.

### 2. `/push` команда: из release-скрипта в PR-workflow

**Файл**: `.claude/commands/push.md` — полная перезапись.

**Новое поведение `/push [-m "message"]`:**

1. Проверить ветку — если на `main`, создать feature-branch:
   - Имя: `feat/<beads-id>` или `fix/<beads-id>` (из текущего in_progress beads issue)
   - Fallback: `feat/<timestamp>` если нет active issue
2. Stage изменения (`git add` нужных файлов)
3. Commit с conventional message (из `-m` аргумента или auto-detect)
4. Push в remote feature branch (`git push -u origin <branch>`)
5. Создать PR в main (`gh pr create`) или обновить существующий
6. Вернуть URL PR

**Команда больше НЕ запускает `release.sh`**. Релизы — только через Release Please.

Новый `push.md`:
```markdown
---
description: Commit, push feature branch, and create/update PR to main
argument-hint: [-m "commit message"]
---

Commit current changes, push to feature branch, and create or update a PR to main.

**Workflow:**

1. Check current branch. If on `main`, create a feature branch:
   - Run `bd list --status=in_progress` to find active beads issue
   - Branch name: `feat/<issue-id>` or `fix/<issue-id>` based on issue type
   - If no active issue: `feat/<short-description>` from the commit message
   - `git checkout -b <branch-name>`

2. Stage changes:
   - Run `git status` to review changes
   - Stage relevant files (`git add <files>`) — never stage .env or credentials
   - Do NOT use `git add -A` blindly

3. Commit with conventional message:
   - If `-m` argument provided, use it: `git commit -m "$MESSAGE"`
   - Otherwise, analyze changes and generate conventional commit message
   - Follow docs/COMMIT_CONVENTIONS.md strictly
   - Always append: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

4. Push to remote:
   - `git push -u origin <branch-name>`

5. Create or update PR:
   - Check if PR exists: `gh pr list --head <branch-name> --state open`
   - If no PR: `gh pr create --title "<commit subject>" --body "..." --base main`
   - If PR exists: just push (PR auto-updates)
   - Return PR URL

**Legacy release script** (`release.sh`) is available via direct invocation for manual releases:
```bash
bash .claude/scripts/release.sh [patch|minor|major] --yes
```
```

### 3. CLAUDE.md: обновить workflow-инструкции

**Файл**: `CLAUDE.md`

#### 3a. Секция "COMMIT STRATEGY" (строки ~57-67)

Заменить:
```
Run `/push patch` after EACH completed task
```

На:
```
Run `/push` after EACH completed task (commits to feature branch, creates PR).
Releases are handled by Release Please when PR merges to main.
```

#### 3b. Секция "Session Close Protocol" (строки ~161-172)

Заменить `git push` на PR-ориентированный workflow:
```bash
git status              # 1. What changed?
git add <files>         # 2. Stage the right files
bd sync                 # 3. Sync beads
git commit -m "..."     # 4. Commit with issue ID
bd sync                 # 5. Sync any new beads changes
git push -u origin HEAD # 6. Push feature branch
gh pr create/view       # 7. Create or view PR
```

#### 3c. Добавить правило "Feature Branch Workflow"

В секцию "Project Conventions" добавить:
```
**Git Workflow**:
- Always work on feature branches, never push directly to main
- Branch naming: `feat/<issue-id>`, `fix/<issue-id>`, `chore/<description>`
- Use `/push` to commit, push, and create PR
- PRs merge to main via GitHub (squash merge preferred)
- Release Please creates release PR automatically after merge
- Direct push to main is blocked by branch protection
```

### 4. speckit.implement.md: обновить ссылки на /push

**Файл**: `.claude/commands/speckit.implement.md` (строки 170, 183)

Заменить:
```
9. COMMIT: Run `/push patch`
...
- **Commit after each task**: Run `/push patch` before moving to next
```

На:
```
9. COMMIT: Run `/push` (or `/push -m "feat(scope): description"`)
...
- **Commit after each task**: Run `/push` before moving to next
```

### 5. Branch protection: применить через gh api

**Файл**: `.github/BRANCH_PROTECTION.md` — уже документирован.

Выполнить после мержа плана:
```bash
gh api repos/maslennikov-ig/BuhBot/branches/main/protection \
  --method PUT \
  -f required_status_checks='{"strict":true,"contexts":["CI Success"]}' \
  -f enforce_admins=false \
  -F required_pull_request_reviews='{"required_approving_review_count":0,"dismiss_stale_reviews":false}' \
  -f restrictions=null \
  -F allow_force_pushes=false \
  -F allow_deletions=false \
  -F required_linear_history=true
```

> **Примечание**: `required_approving_review_count: 0` — мы единственный разработчик + Claude, обязательный review не нужен. Ключевое ограничение: PR + passing CI, не approval count. `enforce_admins: false` — чтобы admin мог push в экстренных случаях.

### 6. Release Please: без изменений

Workflow `release-please.yml` уже корректно настроен — триггерится на push в main (= merge PR). Конфигурация не меняется.

## Files to Modify

| # | Файл | Изменение |
|---|------|-----------|
| 1 | `.github/workflows/ci.yml` | `cancel-in-progress` → conditional |
| 2 | `.claude/commands/push.md` | Полная перезапись (release.sh → PR workflow) |
| 3 | `CLAUDE.md` | Обновить commit strategy, session close, добавить git workflow |
| 4 | `.claude/commands/speckit.implement.md` | `/push patch` → `/push` |
| 5 | GitHub Settings | Branch protection через `gh api` |

## НЕ меняем

- `.claude/scripts/release.sh` — оставляем как legacy, доступен для ручных релизов
- `.github/workflows/release-please.yml` — корректен
- `.github/workflows/deploy.yml` — корректен
- `.husky/*`, `commitlint.config.js` — branch-agnostic, не требуют изменений

## Verification

1. `ci.yml` — проверить что CI не отменяется при последовательных мержах в main
2. `/push` — протестировать: создать feature branch, закоммитить, создать PR
3. Branch protection — попробовать `git push origin main` напрямую (должен быть rejected)
4. Release Please — замержить PR в main, убедиться что release PR создаётся
5. Deploy — после прохождения CI на main, deploy должен запуститься
