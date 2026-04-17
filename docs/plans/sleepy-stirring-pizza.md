# Plan: Process open GitHub Issues (batch 2026-04-17)

## Context

Запущена команда `/process-issues`. В репозитории открыто 10 issues; из них 7 помечены `[HOLD]` (явный статус "OUT OF SCOPE FOR CURRENT CYCLE — DO NOT START IMPLEMENTATION NOW") и их трогать нельзя по прямой инструкции в теле задач. Реальный scope этого прохода — 3 бага с `priority: high`, все P1 по скорингу:

- **#289** `bug(frontend): AccountantSelect popover renders behind Add Chat modal` — невозможно назначить бухгалтера при подключении чата (блокирует основной пользовательский сценарий).
- **#290** `bug(violations): 'Превышение SLA' always shows +0m instead of elapsed delta` — ключевая бизнес-метрика на странице `/violations` всегда показывает `+0m`, что делает SLA-мониторинг бесполезным.
- **#291** `bug(bot): Survey completion message exposes star rating in chat` — после голосования в опросе звёзды остаются в чате, хотя по продуктовому требованию их видно должно быть только в админке.

Решения пользователя после уточнения:
- #290 делаем **frontend + backend** (добавляем `slaBreachedAt` в схему, миграция, обновление сеттеров, затем frontend-расчёт).
- Деплоим **тремя независимыми PR** (каждая задача — отдельная ветка/worktree).

Цели: закрыть все три бага с фиксами в root cause (не симптомах), с тестами, прогнать quality gates (`npm run type-check`, `npm run build`, relevant tests), завести Beads tasks с зависимостями, отдельные PR в `main`.

## Scoring summary

| Rank | Issue | Title | Sev | Imp | Lkh | Total | Priority | Complexity |
|------|-------|-------|-----|-----|-----|-------|----------|------------|
| 1 | #290 | SLA `+0m` | 7 | 7 | 10 | **24** | P1 | Medium (DB migration + backend + frontend) |
| 1 | #289 | Accountant popover under modal | 7 | 7 | 10 | **24** | P1 | Simple (1 className) |
| 2 | #291 | Survey stars echoed | 5 | 7 | 10 | **22** | P1 | Simple (2 lines) |

Похожий закрытый прецедент для #289: **gh-238 / buh-jd5** (та же проблема в `/chats/[id]` settings, фикс = миграция на shadcn Popover + portal). Разница здесь: шаблон уже Popover/portal, проблема только в z-index (`z-50` < `z-[1200]` модалки).

## Dependency graph

Все три задачи независимы — разные файлы, разные слои, нет пересечений.

```
epic-batch (parent)
 ├─ task-289 (simple, frontend)       — parallel
 ├─ task-290 (medium, backend→frontend) — parallel (внутри: 290a blocks 290b blocks 290c)
 └─ task-291 (simple, backend bot)    — parallel
```

Порядок исполнения: параллельно (`#291` → `#289` → `#290` по нарастанию сложности, если последовательно; или 3 worktree одновременно при наличии).

## Beads decomposition (to create at execute time)

```
bd create -t epic --priority=1 --title="Process GitHub Issues batch 2026-04-17"
  → <epic-id>

bd create -t bug --priority=1 --external-ref="gh-291" \
  --title="gh-291: Survey completion message exposes stars in chat" \
  --deps parent:<epic-id>
  → <task-291>

bd create -t bug --priority=1 --external-ref="gh-289" \
  --title="gh-289: AccountantSelect popover renders behind Add Chat modal" \
  --deps parent:<epic-id>
  → <task-289>

bd create -t bug --priority=1 --external-ref="gh-290" \
  --title="gh-290: SLA '+0m' in /violations — add slaBreachedAt + proper excess calc" \
  --deps parent:<epic-id>
  → <task-290>

# Внутренние подзадачи #290 (sequential):
bd create -t task --priority=1 --title="290a: Prisma migration — add slaBreachedAt" --deps parent:<task-290>
bd create -t task --priority=1 --title="290b: Backend — persist slaBreachedAt on breach + expose in sla.ts" --deps parent:<task-290>
bd dep add <290b> <290a>
bd create -t task --priority=1 --title="290c: Frontend — recalc excess with now()/responseAt, adaptive units, warning" --deps parent:<task-290>
bd dep add <290c> <290b>
```

## Execution plan per issue

### Task 291 — Survey stars

**Root cause.** `backend/src/bot/handlers/survey.handler.ts:138-139` конструирует `stars = '⭐'.repeat(rating)` и склеивает в `confirmText` перед `editMessageText`. `THANK_YOU_MESSAGE` (в `backend/src/bot/keyboards/survey.keyboard.ts:83-85`) уже без звёзд. Рейтинг сохраняется в БД в `recordResponse` строкой выше — на данные изменение не влияет.

**Fix (minimal).** Удалить две строки и передать `THANK_YOU_MESSAGE` напрямую:

- Файл: `backend/src/bot/handlers/survey.handler.ts`
- Строки 137–142:
  - удалить `const stars = '⭐'.repeat(rating);`
  - удалить `const confirmText = ...`
  - `ctx.editMessageText(confirmText, ...)` → `ctx.editMessageText(THANK_YOU_MESSAGE, { parse_mode: 'Markdown' })`
- Transient toast `answerCbQuery` не меняем — это личный поп-ап, не часть persistent сообщения.

**TDD.** Написать тест на `survey.handler` (Vitest), mock `ctx.editMessageText`, RED: проверить что передаётся строка БЕЗ `⭐`, GREEN: применить fix. Проверить что `recordResponse` вызван до editMessage.

**Verification.** `npm run type-check`, `npm run test -- survey.handler`, ручной прогон в dev: отправить тестовый опрос, кликнуть рейтинг, убедиться что в чате только thank-you текст.

**Branch/PR.** `fix/gh-291-survey-stars` → PR в `main` с сообщением `fix(bot): hide stars from survey completion message (gh-291)`.

---

### Task 289 — AccountantSelect popover z-index

**Root cause.** `InvitationModal` root использует `z-[1200]` (frontend/src/components/chats/InvitationModal.tsx:164). Общий `PopoverContent` (`frontend/src/components/ui/popover.tsx:22`) задаёт `z-50`. Radix портирует popover в `<body>`, но tailwind z-index `50 < 1200` — popover визуально под модалкой. `AccountantSelect` (`frontend/src/components/chats/AccountantSelect.tsx:239-247`) не пробрасывает свой className с z-index. `cn()` в `frontend/src/lib/utils.ts` использует `tailwind-merge` → переданный `z-[1300]` корректно перезапишет дефолт `z-50`.

**Fix (scoped, minimal).** В `AccountantSelect.tsx:239-247` — добавить `z-[1300]` в начало `className` `<PopoverContent>`. Не трогать shared `popover.tsx` (другие попаперы не должны получать глобальный z-index, чтобы не создать регрессии, например, с tooltip/dropdown в таблицах).

- Файл: `frontend/src/components/chats/AccountantSelect.tsx`
- Строка ~240: `className="z-[1300] w-[--radix-popover-trigger-width] p-0 rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface)] shadow-lg shadow-black/10"`

Почему `z-[1300]`: модалка `z-[1200]`, запас до уровня notification layer. Тот же слой что уже используется в других fix-ах (проверить `git grep "z-\[1300"`).

**TDD.** Playwright E2E: открыть `/chats`, кликнуть "Добавить чат", в модалке открыть `AccountantSelect`, проверить что popover в DOM имеет computed z-index > модалки (`page.evaluate(() => getComputedStyle(...).zIndex)`) и clickable. RED перед фиксом, GREEN после.

**Verification.** `npm run type-check`, `npm run build`, `pnpm e2e -- chats/add-chat-modal`. Ручной прогон в браузере.

**Branch/PR.** `fix/gh-289-accountant-popover-zindex` → PR в `main`, сообщение `fix(frontend): raise AccountantSelect popover z-index above modal (gh-289)`.

---

### Task 290 — SLA excess calculation (frontend + backend)

**Root cause.**
- Frontend `frontend/src/app/violations/page.tsx:183-185` считает `max(0, responseTimeMinutes - slaMinutes)`. Если `responseTimeMinutes` равен `null` (нет ответа) — падает в `0`. Нет учёта `now()` для breach без ответа.
- Backend схема не хранит timestamp момента breach-а (`prisma/schema.prisma` у `ClientRequest` есть `receivedAt`, `responseAt`, `slaTimerStartedAt`, `slaBreached`, но нет `slaBreachedAt`). Без него нельзя реализовать edge-case "SLA status changed but no answer yet" — нужен фиксированный момент, когда breach был зафиксирован.
- `slaBreached: true` ставится в трёх местах: `backend/src/services/sla/timer.service.ts:722`, `backend/src/queues/sla-timer.worker.ts:183`, `backend/src/bot/handlers/accountant.handler.ts:74`. Все три надо обновить чтобы писать `slaBreachedAt = new Date()` синхронно с флагом.

**Fix (three phases).**

#### 290a — Prisma migration

- Добавить поле `slaBreachedAt DateTime? @map("sla_breached_at") @db.Timestamptz(6)` в модель `ClientRequest` (`backend/prisma/schema.prisma`, рядом с `slaBreached`).
- Добавить индекс `@@index([slaBreachedAt])` (аналогично существующему `@@index([slaBreached])`).
- Создать миграцию вручную (по конвенции проекта, см. CLAUDE.md memory: `prisma migrate dev` иногда падает на shadow DB) с backfill для существующих строк: `UPDATE client_requests SET sla_breached_at = COALESCE(response_at, sla_timer_started_at + INTERVAL '1 minute' * sla_working_minutes) WHERE sla_breached = true AND sla_breached_at IS NULL;`.
- Запустить `prisma generate`.

#### 290b — Backend

- Обновить три setter-а `slaBreached: true` → добавить рядом `slaBreachedAt: now`:
  - `backend/src/services/sla/timer.service.ts:722`
  - `backend/src/queues/sla-timer.worker.ts:183`
  - `backend/src/bot/handlers/accountant.handler.ts:74`
- В `backend/src/api/trpc/routers/sla.ts`:
  - В `RequestOutput` (строка 141) добавить `slaBreachedAt: z.date().nullable()`.
  - В `formatRequestOutput` (строка 211) пробросить `slaBreachedAt: request.slaBreachedAt`.
- Обновить схема-контрактные тесты (`backend/src/api/trpc/routers/__tests__/schema-contracts.test.ts:683, 831`) — добавить новое поле.
- Вернуть тесты сервиса `timer.service` зелёными (проверить `backend/src/services/sla/__tests__/`).

#### 290c — Frontend

- В `frontend/src/app/violations/page.tsx:172-200` переписать расчёт:
  - `x = req.responseAt ?? req.slaBreachedAt ?? new Date()`
  - `excessMs = Math.max(0, x.getTime() - new Date(req.receivedAt).getTime() - slaMinutes * 60_000)` (логическое превышение SLA — время сверх нормы)
  - Альтернативно, если продукт хочет "время от получения до x" (как в тексте issue) — считать `(x - receivedAt)` напрямую. **Уточнить в ходе ревью**: судя по названию колонки "Превышение SLA", имеется в виду именно excess над SLA.
- Добавить live-refresh: если есть open unanswered breaches, обновлять `now` через `setInterval` каждые 30s (или перевычислять на каждый re-render через `Date.now()` в memo-deps с mount-time tick).
- Adaptive units (`backend/src/bot/utils/format.ts` или создать `frontend/src/lib/format-duration.ts` если нет общего): `< 1 h → m`, `< 24 h → h m`, `< 7 d → d h`, `≥ 7 d → w d`. Проверить, нет ли уже `formatDuration` во frontend — скорее всего есть, расширить его.
- Warning-иконка при `excess > slaMinutes * 2` (или настроенный threshold): визуально усилить badge на странице (yellow/red escalation).
- Обновить рендер ячейки `frontend/src/app/violations/page.tsx:425-428`.

**TDD.**
- Backend unit: `timer.service` writing `slaBreachedAt` when marking breach.
- Backend contract: `sla.getRequests` output includes `slaBreachedAt`.
- Frontend unit: `formatExcess` function — таблица кейсов `(receivedAt, responseAt, slaBreachedAt, now, slaMinutes)` → expected string (`'+5m'`, `'+2h 15m'`, `'+3d 4h'`).
- E2E: создать искусственный breach в тестовом окружении, убедиться что страница показывает реалистичное значение и обновляется по тику.

**Verification.** `npm run type-check`, `npm run build`, backend тесты, frontend unit тест `format-duration`, E2E `violations.spec.ts`. В dev — seed нескольких breached requests (с и без ответа) через существующие diagnostic-скрипты (`backend/src/scripts/e2e-sla-diagnostic.ts`), проверить UI.

**Branch/PR.** `fix/gh-290-sla-excess` → ОДИН PR в `main` (миграция + backend + frontend коммитами внутри одной ветки, чтобы миграция прилетела атомарно с potребителями). Сообщение: `fix(sla): correct /violations excess calculation with slaBreachedAt persistence (gh-290)`.

## Critical files reference

| # | Layer | Path | Line(s) |
|---|-------|------|---------|
| 291 | backend | `backend/src/bot/handlers/survey.handler.ts` | 137–142 |
| 289 | frontend | `frontend/src/components/chats/AccountantSelect.tsx` | 239–247 |
| 289 | context | `frontend/src/components/chats/InvitationModal.tsx` | 164 |
| 289 | context | `frontend/src/components/ui/popover.tsx` | 22 |
| 290 | schema | `backend/prisma/schema.prisma` | model ClientRequest ~290–340 |
| 290 | backend | `backend/src/services/sla/timer.service.ts` | 722 |
| 290 | backend | `backend/src/queues/sla-timer.worker.ts` | 183 |
| 290 | backend | `backend/src/bot/handlers/accountant.handler.ts` | 74 |
| 290 | backend | `backend/src/api/trpc/routers/sla.ts` | 141, 211 |
| 290 | frontend | `frontend/src/app/violations/page.tsx` | 172–200, 425–428 |

## Reusable utilities to check before writing new code

- `cn()` + `twMerge` — `frontend/src/lib/utils.ts` (уже подтверждено, tailwind-merge активен).
- `formatDuration` — проверить существует ли во frontend (используется на `violations/page.tsx:418, 427`) — **расширить** для adaptive units, не писать новую.
- `escapeHtml` / bot formatting — `backend/src/bot/services/format.service.ts` (для #291, если Markdown parse_mode потребует экранирования).
- `withAuditTrail` — `backend/src/lib/prisma.ts` (не нужен для этого batch — нет записи client request fields).
- Migration template — см. `backend/prisma/migrations/` и memory "use manual SQL files when prisma migrate dev fails with shadow DB errors".

## Library/docs checks (Context7) during execute phase

- Prisma 7 — migrations, driver adapter, enum caveat (проверить тюторь в Prisma 7 docs).
- Telegraf 4.16 — `ctx.editMessageText` behaviour with `parse_mode: 'Markdown'` (для #291).
- Radix Popover — portal/z-index rules (для #289 валидация).
- Vitest — mock Telegraf ctx (для #291 тест).

## Verification checklist (end-to-end)

Для каждой задачи перед PR:

1. `npm run type-check` — pass.
2. `npm run build` (backend + frontend) — pass.
3. Relevant unit/contract tests — pass.
4. Ручной прогон в dev-окружении:
   - #291: Отправить опрос через `/survey send` (или через диагностический скрипт), нажать рейтинг, убедиться, что сообщение без звёзд.
   - #289: `/chats` → "Добавить чат" → открыть AccountantSelect → убедиться, что выпадающий список выше модалки, кликабелен, ESC закрывает.
   - #290: Seed breached request, открыть `/violations`, убедиться, что `Превышение SLA` показывает реальный delta и обновляется во времени; проверить adaptive units на >1h, >1d значениях.
5. `bd close <task-id> --reason "Fixed: ..."` после PR merged.
6. `gh issue close <number> --comment "Fixed in <sha>..."` с описанием root cause и ссылкой на PR.
7. `bd close <epic-id> --reason "Batch done"` когда все три закрыты.

## Rollback strategy

- #291: revert коммит.
- #289: revert коммит (изолированный CSS-class change).
- #290: миграция обратимая — добавили nullable колонку и индекс; rollback = `ALTER TABLE ... DROP COLUMN sla_breached_at;` + revert кода. Backend/frontend не крашнутся, если колонка вернётся к `null` (поле уже nullable).

## Session close protocol

Beads зафиксировать при каждом закрытии таска; перед каждым PR прогнать pre-commit hooks (`lint-staged`, `commitlint`), `bd export -o .beads/issues.jsonl` и закоммитить. После merge — `/push` не нужен (работает из feature-branch через PR).
