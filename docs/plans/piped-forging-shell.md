# План: унификация /feedback на surveyVote (gh-324 / buh-s71c)

## Context

После gh-294 PR #304 голосование в опросах мигрировало на `surveyVote` + `surveyVoteHistory` (multi-user voting с историей). Но read-path страницы `/feedback` (аналитика, таблица, экспорт) остался на legacy `feedbackResponse`. В итоге новые голоса НЕ видны в UI менеджера, а на проде фронт дополнительно маскирует пустое состояние mock-данными (`frontend/src/app/feedback/feedback-content.tsx:216-240`), скрывая bug.

Issue: https://github.com/maslennikov-ig/BuhBot/issues/324
Beads: `buh-s71c` (P1, in_progress)
Branch: `fix/gh-324-feedback-survey-vote-read-path`

Цель: `/feedback` должен показывать и исторические (legacy) ответы, и все новые голоса, без двойного счёта, со scoping-правами и без silent-mock.

## Strategy: UNION ALL in-memory

Читаем оба источника параллельно через `Promise.all`, объединяем в памяти, сортируем. **Никакого backfill** (riск порчи legacy-таблицы, два source of truth для write). Pure cutover отвергнут — теряем ~месяц исторических ответов.

Dedup не требуется: legacy бот писал ТОЛЬКО в `feedbackResponse`, новый бот (после PR #304 merge) ТОЛЬКО в `surveyVote`. Хронологические периоды write не пересекаются. Для страховки — invariant-тест: запрос «есть ли deliveryId одновременно и в feedback_responses, и в survey_votes(active)?» должен возвращать 0 строк.

Prisma не поддерживает UNION нативно — используем `Promise.all([findMany legacy, findMany votes])` с последующим merge/sort в JS. Для /feedback-объёмов (<10k строк на клиента) это <10ms overhead. Если вырастет — отдельным тикетом перевести в `$queryRaw UNION ALL`.

## Critical files to modify

| Файл | Изменения |
|---|---|
| `backend/src/services/feedback/analytics.service.ts` | Добавить helpers `fetchUnifiedRatings`, `fetchUnifiedEntries`, `fetchUnifiedComments`. Переписать `getAggregates`, `getTrendData`, `getRecentComments` поверх них. |
| `backend/src/api/trpc/routers/feedback.ts` | `getAggregates` (unscoped+scoped), `getAll`, `getById`, `exportCsv` — заменить прямые `prisma.feedbackResponse.findMany` на helpers. `submitRating` → `@deprecated` JSDoc + warn-log, НЕ удалять. |
| `backend/src/services/feedback/__tests__/analytics.service.test.ts` | Расширить — legacy-only, vote-only, mixed, removed, multi-user, scoping, date-bounds, dedup-invariant, trend quarters. |
| `backend/src/api/trpc/routers/__tests__/feedback.test.ts` | Регрессия на router-уровне. |
| `frontend/src/app/feedback/feedback-content.tsx` | Удалить `mockAggregatesData` / `mockFeedbackEntries` (строки ~21-101) и fallback-логику (строки ~216-249). Добавить proper empty states: `totalResponses === 0` → «Ещё нет отзывов», таблица пустая → «Ответов не получено». |
| `docs/adr/0012-survey-feedback-data-source.md` (NEW) | ADR фиксирует: write-canonical = `surveyVote`, read = `feedbackResponse ∪ surveyVote(active)`, aggregation semantics (latest-active vote per (delivery, user)), future path — backfill+drop в отдельной эпопее. |

## Reusable utilities (не создавать заново)

- `aggregateSurvey(surveyId)` — `backend/src/services/feedback/vote.service.ts:341-374` — уже агрегирует `surveyVote` по `state='active'`, паттерн для копирования.
- `getScopedChatIds(prisma, userId, role)` — `backend/src/api/trpc/helpers/scoping.ts` — применяется к обеим веткам UNION.
- Context7: `mcp__context7__query-docs` с `/prisma/prisma` по запросам «findMany include nested relations» и «BigInt serialization tRPC» перед имплементацией.

## SurveyVote → DTO mapping

Фронт-контракт НЕ менять. Поля DTO (`getAll items[i]`):

| DTO поле | Legacy source | Vote source |
|---|---|---|
| `id` | `response.id` | `vote.id` (голый UUID) |
| `chatId` | `response.chatId.toString()` | `vote.delivery.chatId.toString()` |
| `chatTitle` | `response.chat.title` | `vote.delivery.chat.title` |
| `clientUsername` | `response.clientUsername` | `vote.username` |
| `accountantUsername` | `response.chat.assignedAccountant.fullName` | `vote.delivery.chat.assignedAccountant.fullName` |
| `rating` | `response.rating` | `vote.rating` |
| `comment` | `response.comment` | `vote.comment` |
| **`submittedAt`** | `response.submittedAt` | **`vote.updatedAt`** (отражает смены голоса; re-vote поднимается вверх сортировки) |
| `surveyId` | `response.surveyId` | `vote.delivery.surveyId` |
| `surveyQuarter` | `response.survey.quarter` | `vote.delivery.survey.quarter` |

ID-префикс не добавляем: UUID-коллизия между таблицами практически невозможна, а префикс ломает backward-compat URL/bookmark.

## Scoping (staff/observer)

Оба leg'а UNION фильтруются через `getScopedChatIds`:
- legacy: `where.chatId = { in: scopedChatIds }`
- votes: `where.delivery = { chatId: { in: scopedChatIds } }` (через relation)

Для admin `scopedChatIds === null` → оба фильтра отсутствуют.

## Paging semantics

`getAll` берёт total по обеим таблицам (`count` + `count`), получает полные result sets (до max `pageSize=100`), сортирует объединённый массив по `submittedAt desc`, отрезает `skip/take`. При росте >10k — отдельный тикет на `$queryRaw UNION ALL` с DB-level offset.

## Tests matrix (12 сценариев)

| # | Сценарий | Файл |
|---|---|---|
| 1 | Legacy-only: regression baseline не сломан | router test |
| 2 | Vote-only (нет legacy): появляется в getAll, getAggregates, exportCsv | router test |
| 3 | Mixed: обе ветки — правильная сортировка desc | router test |
| 4 | `state='removed'` исключён из агрегатов и списка | analytics test |
| 5 | Multi-user per delivery (N разных telegramUserId) → N entries | router test |
| 6 | Re-vote обновляет `updatedAt` — поднимает вверх сортировки | analytics test |
| 7 | Scoping: staff видит только свои чаты в обеих ветках | router test |
| 8 | Date bounds: `submittedAt` legacy vs `updatedAt` votes | analytics test |
| 9 | Dedup invariant: `deliveryId` не пересекается (guardrail) | analytics test |
| 10 | TrendData по кварталам — оба источника | analytics test |
| 11 | exportCsv содержит vote-строки с правильными escapes | router test |
| 12 | Frontend: пустое состояние вместо mock | vitest+RTL test |

## Commit order (атомарно для reviewer)

1. `docs: add ADR-0012 survey feedback data source`
2. `feat(feedback/analytics): add unified read helpers over feedbackResponse ∪ surveyVote`
3. `refactor(feedback router): use unified helpers; deprecate submitRating`
4. `test(feedback): regression + union semantics + scoping + dedup invariant`
5. `refactor(frontend/feedback): remove mock fallback, add empty states`
6. `test(frontend/feedback): empty state, union data render`

## Verification

### Локально
```bash
cd backend
npx prisma validate
npm run type-check
npx vitest run src/services/feedback/__tests__ src/api/trpc/routers/__tests__/feedback.test.ts

cd ../frontend
npm run type-check
npm run build
npm run test -- feedback
```

### На production после deploy
1. Открыть `/feedback` — в таблице видны и legacy-ответы, и новые `surveyVote` после gh-294.
2. Supabase SQL invariant (никаких дублей):
   ```sql
   SELECT fr.delivery_id
   FROM public.feedback_responses fr
   JOIN public.survey_votes sv ON sv.delivery_id = fr.delivery_id AND sv.state = 'active';
   -- ожидаем: 0 строк
   ```
3. Supabase SQL (новые данные видны):
   ```sql
   SELECT count(*) FROM public.survey_votes WHERE state = 'active';
   SELECT count(*) FROM public.feedback_responses;
   -- сумма должна совпасть с count в UI на /feedback (без фильтров по датам)
   ```
4. E2E smoke: отдельный промт `docs/agents/e2e-feedback-unified-read.md` (будет создан как buh-sub — retry-паттерн из gh-313 работы).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Pagination O(N) memory при >10k | `pageSize max 100` уже в router; отдельный тикет при росте |
| UUID collision ломает React keys | Invariant-тест на unique IDs; префикс — только если сломается в будущем |
| `getById` без префикса | Fallback: `feedbackResponse.findUnique` → `surveyVote.findUnique` по голому UUID |
| Breaking для внешних клиентов `submitRating` | Deprecated, warn-log в консоль; удаление — отдельным тикетом позже |
| Performance: UNION добавляет второй DB roundtrip | `Promise.all` — параллельно, net добавка ~1 RTT (~20ms) |
| Dedup инвариант нарушен в будущем | ADR-0012 явно запрещает write в feedbackResponse; CI-тест проверяет в тестовой БД |

## Out of scope

- Удаление legacy `feedbackResponse` таблицы — отдельным тикетом через 1-2 квартала.
- Полное удаление `submitRating` tRPC mutation — ждёт подтверждения что нет внешних клиентов.
- Pagination на DB-level UNION — пока не нужно (объёмы мизерные).
- Редизайн NPS widget / trend chart — в scope только data source, не визуал.

## Estimate

~700 строк diff (backend ~390, frontend ~90, tests ~300, ADR ~120). 6-9 часов работы + E2E smoke.
