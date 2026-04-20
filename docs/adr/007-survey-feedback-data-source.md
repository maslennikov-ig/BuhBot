# ADR-007: Source of truth для survey feedback (surveyVote vs feedbackResponse)

## Статус

Принято

## Дата

2026-04-20

## Контекст

В проекте существуют **две таблицы** для хранения ответов на опросы:

| Таблица | Появилась | Семантика | Текущее использование |
|---|---|---|---|
| `feedback_responses` (`FeedbackResponse`) | Оригинальная модель quarterly-surveys | **Один ответ на delivery**, unique по `delivery_id` | Legacy. Только historical data до gh-294 merge |
| `survey_votes` + `survey_vote_history` (`SurveyVote`, `SurveyVoteHistory`) | gh-294 / PR #304 (multi-user voting, 2026-04) | **Множество голосов на delivery** по разным `telegram_user_id`, изменяемые, с историей | Canonical. Все новые голоса после merge PR #304 |

### Проблема, описанная в issue #324

Write-path мигрировал: `backend/src/bot/handlers/survey.handler.ts:185-190` вызывает `submitVote(...)` → `surveyVote`. Legacy `recordResponse(...)` (пишущий в `feedbackResponse`) больше не вызывается из бота.

Но read-path `/feedback` остался на legacy:
- `backend/src/services/feedback/analytics.service.ts:134-300` — читает `feedbackResponse` для `getAggregates`, `getTrendData`, `getRecentComments`
- `backend/src/api/trpc/routers/feedback.ts:62-576` — `getAll`, `exportCsv`, `getById`, `getAggregates` scoped/unscoped — все бьют `feedbackResponse`

В результате **все новые голоса после gh-294 невидимы на `/feedback`**. Фронт дополнительно маскирует пустое состояние `mockAggregatesData` / `mockFeedbackEntries` (строки 216-240), скрывая bug.

### Декомпозиция различий между моделями

1. **Ключевая структура**
   - `FeedbackResponse.deliveryId` — `UNIQUE` (один ответ на одно отправление).
   - `SurveyVote.(deliveryId, telegramUserId)` — `UNIQUE` составной ключ (N ответов от разных юзеров в одной группе).
2. **Chat reference**
   - `FeedbackResponse.chatId` — прямое FK.
   - `SurveyVote` получает `chatId` только через `SurveyDelivery.chatId`.
3. **Timestamp semantics**
   - `FeedbackResponse.submittedAt` — момент первичного ответа (immutable).
   - `SurveyVote.createdAt` — первичный голос; `SurveyVote.updatedAt` — последний re-vote (ре-голосование сдвигает).
4. **История изменений**
   - `FeedbackResponse` — нет; ответ immutable.
   - `SurveyVote` + `SurveyVoteHistory` — каждое изменение (create/update/remove) логируется.
5. **State machine**
   - `FeedbackResponse` — всегда активно (удаление = hard delete).
   - `SurveyVote.state ∈ {active, removed}` — soft delete через `state='removed'`.

### Рассмотренные альтернативы

1. **Pure cutover (читать только `surveyVote`).** Отклонено: теряем всю исторически собранную feedback-аналитику до gh-294 (кварталы 2025-Q1..Q4 и 2026-Q1).
2. **One-time backfill `feedbackResponse ← surveyVote`.** Отклонено: (а) риск порчи historical данных при ошибке скрипта (irreversible); (б) две source-of-truth для write — путь к drift'у; (в) не поддерживает multi-vote семантику (`FeedbackResponse` unique по delivery).
3. **UNION ALL в read-only слое (обе таблицы, merge in-memory).** **Принято.** Zero data loss, reversible, не требует DB-миграции, не задевает write-path, поддерживает семантику обеих моделей без потерь.

## Решение

### 1. Canonical write model

- `SurveyVote` + `SurveyVoteHistory` — **единственный** write target для новых голосов.
- `feedbackResponse` **deprecated for writes**. Код `recordResponse(...)` в `backend/src/services/feedback/survey.service.ts:816-824` и tRPC mutation `feedback.submitRating` (`feedback.ts:170-242`) помечаются `@deprecated`. Не удаляются в этом PR (внешние клиенты могут зависеть), но новые фичи **не должны** их звать. Удаление — отдельным тикетом не раньше чем через 2 квартала.

### 2. Canonical read model

`/feedback` APIs возвращают **UNION** двух источников:

```
items = (feedbackResponse) ∪ (surveyVote WHERE state='active')
  ordered by submittedAt DESC
  filtered by user scoping
  paginated in-memory
```

Реализация — `Promise.all([findMany, findMany])` + merge/sort в JS. Prisma не поддерживает UNION нативно; `$queryRaw` отложено до масштаба >10k строк на клиента.

### 3. Aggregation semantics

- **NPS / average / distribution**: считаются на объединённом наборе `rating`-значений.
- **Multi-vote семантика**: `SurveyVote` хранит последний активный голос каждого `(delivery, user)`. Re-vote **не** даёт второй подсчёт — предыдущий голос state='active' обновляется, не создаётся новый. `SurveyVoteHistory` хранит цепочку для аудита, но **не** участвует в агрегатах.
- **`state='removed'`**: исключается из всех агрегатов и listings.
- **Scoping**: `getScopedChatIds(...)` применяется к обеим ветвям UNION:
  - `feedbackResponse.chatId IN scopedChatIds`
  - `surveyVote.delivery.chatId IN scopedChatIds`

### 4. DTO mapping

Shape DTO для `feedback.getAll.items[i]` **не меняется** (фронт привязан):

| Поле | Legacy source | Vote source |
|---|---|---|
| `id` | `response.id` | `vote.id` |
| `chatId` | `response.chatId` | `vote.delivery.chatId` |
| `chatTitle` | `response.chat.title` | `vote.delivery.chat.title` |
| `clientUsername` | `response.clientUsername` | `vote.username` |
| `accountantUsername` | `response.chat.assignedAccountant.fullName` | `vote.delivery.chat.assignedAccountant.fullName` |
| `rating` | `response.rating` | `vote.rating` |
| `comment` | `response.comment` | `vote.comment` |
| `submittedAt` | `response.submittedAt` | `vote.updatedAt` (re-vote поднимает запись вверх) |
| `surveyId` | `response.surveyId` | `vote.delivery.surveyId` |
| `surveyQuarter` | `response.survey.quarter` | `vote.delivery.survey.quarter` |

ID-префикс (`fr_` / `sv_`) **не добавляется**: UUID-коллизия пренебрежима, префикс ломает backward-compat URL/bookmark.

### 5. Dedup

**Не требуется.** Write-periods не пересекаются:
- До merge PR #304 (gh-294) бот писал ТОЛЬКО в `feedback_responses`.
- После merge — ТОЛЬКО в `survey_votes`.

Для страховки — CI-инвариант в тестах:
```sql
SELECT fr.delivery_id
FROM feedback_responses fr
JOIN survey_votes sv ON sv.delivery_id = fr.delivery_id AND sv.state = 'active';
-- ожидается 0 строк навсегда
```

Если инвариант когда-либо нарушится — это индикатор что кто-то вернул write в `feedback_responses`. Нужно срочно править.

## Последствия

### Положительные

- Все новые голоса становятся видны на `/feedback` моментально, без DB-миграции.
- Write-path имеет **один** канонический источник (`surveyVote`), проще reasoning.
- Historical данные сохраняются — менеджеры видят полную картину с момента gh-292.
- Откат тривиален: revert PR возвращает legacy-чтение без потерь.

### Отрицательные

- Два `findMany` вместо одного — +1 DB roundtrip (~20ms при параллельном `Promise.all`).
- Pagination O(N) памяти после in-memory merge. Ограничено `pageSize max 100` уже в роутере; при росте объёмов >10k строк на клиента — отдельный тикет на `$queryRaw UNION ALL` с DB-offset.
- Две модели для поддержки: разработчики должны помнить что read = union, write = `surveyVote`.

### Риски и митигация

| Риск | Митигация |
|---|---|
| Кто-то в будущем вернёт write в `feedback_responses` → dedup сломается | CI-инвариант (см. п.5). ADR запрещает явно. |
| UUID-коллизия между таблицами → React key-collision | Юнит-тест на unique IDs. Префикс добавить, если риск материализуется. |
| `submitRating` удалят без замены → внешние клиенты сломаются | Deprecated, warn-log в консоль. Полное удаление — отдельный тикет с поиском вызовов. |
| In-memory UNION не тянет при масштабе | `pageSize max 100`. При росте — `$queryRaw UNION ALL`. Отдельный тикет. |

## Будущая работа

1. **Q3+ 2026**: one-shot backfill `feedbackResponse → surveyVote` (legacy-данные конвертируем в surveyVote с синтетическим `telegramUserId`). После backfill read-path упрощается до `surveyVote` only.
2. Удаление `feedbackResponse` таблицы — после backfill и подтверждения что никто её не читает ≥3 месяца.
3. Полное удаление `submitRating` tRPC-мутации — после аудита внешних клиентов.

## Связи

- Issue: [#324](https://github.com/maslennikov-ig/BuhBot/issues/324)
- Related features: [#292](https://github.com/maslennikov-ig/BuhBot/issues/292) (custom date ranges), [#294](https://github.com/maslennikov-ig/BuhBot/issues/294) (multi-user voting), [#313](https://github.com/maslennikov-ig/BuhBot/issues/313) (targeted audience)
- Previous ADR by chronology: [ADR-006](./006-opentelemetry-prisma-vulnerability-remediation.md)
- Beads: `buh-s71c`
- PR: (будет заполнено после создания)
