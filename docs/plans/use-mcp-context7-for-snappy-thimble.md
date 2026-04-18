# Plan — Process GitHub Issues (gh-292, gh-293, gh-294)

## Context

Локальный код обновлён до `main` (v0.31.0). Открытых GitHub issues — 7, из них 4 помечены `[HOLD]` в заголовке (#295, #296, #297, #298) — пропускаются. Три активных enhancement (все `priority: low`, label `needs-attention`, созданы 2026-04-11, человеческих комментариев нет) требуют реализации:

- **#293** — на странице `/violations` сообщение клиента обрезается до 100 символов, доступен только нативный `title`-tooltip. Оператору нужен способ читать полный текст без потери контекста триажа. Backend уже возвращает полный `messageText` — это чисто фронтенд-работа.
- **#292** — планирование опросов жёстко привязано к кварталам. Нужны произвольные даты + cooldown-политика, чтобы один и тот же чат не бомбили опросами. Рассылка идёт через BullMQ-воркер `survey.worker.ts` — это authoritative dispatch path, cooldown должен enforce-иться там.
- **#294** — текущее голосование в Telegram-опросах однократное: первый голос закрывает участие для всех остальных. Реальная модель: несколько пользователей могут голосовать, менять голос, отзывать; нужна полная история транзиций + эффективное состояние (latest `active` vote per user).

Порядок: **gh-293 → gh-294 → gh-292**. Сначала Dialog (gh-293) — он переиспользуется в UI истории голосов (gh-294). gh-292 независим, идёт последним.

Подход: на каждую issue — отдельная feature-ветка от свежего `main`, Beads-эпик + sub-tasks, реализация с TDD, `/push` после каждой (создаёт PR в `main`). Context7 — для shadcn Dialog, Radix Dialog a11y, Prisma transactions, Telegraf callback patterns, date-fns-tz, zod discriminated unions.

## Execution Order

### Phase 0 — Beads setup + branches

1. `bd create --type=epic --title="Process GitHub Issues 2026-04-18 (gh-292/293/294)" --priority=2` → parent epic.
2. Для каждой issue: `bd create --type=feature --priority=3 --external-ref=gh-<N> --deps parent:<epic-id>` + sub-tasks по фазам плана.
3. Ветки создаются на этапе реализации: `git checkout main && git pull && git checkout -b feat/gh-<N>-<slug>`.

### Phase 1 — gh-293: Full message viewer Dialog (~40-80 LOC, без миграции)

**UI pattern**: shadcn `Dialog` (Radix-based modal) — focus trap, ESC, aria-labelledby из коробки.

**Файлы**:
- `frontend/src/app/violations/page.tsx` — заменить обрезанный `<div title>` на `<MessageViewerDialog trigger={...} request={req} />`. Пробросить `messageText` и `chatId` через `sortableViolations` (сейчас `ViolatedRequest` их теряет).
- `frontend/src/components/ui/dialog.tsx` — **NEW**, shadcn primitive (установить через shadcn CLI). Добавить JSDoc-контракт по z-index по образцу `popover.tsx`.
- `frontend/src/components/violations/MessageViewerDialog.tsx` — **NEW**. Метаданные (chat link → `/chats/{chatId}`, client, timestamps, SLA excess badge) + `<pre className="whitespace-pre-wrap break-words max-h-[60vh] overflow-auto" tabIndex={0}>` для тела.
- `frontend/src/components/violations/__tests__/MessageViewerDialog.test.tsx` — **NEW**, стиль по `AccountantSelect.zindex.test.tsx`. Кейсы: short/long/empty message, keyboard a11y (Tab/Enter/ESC + return-focus), aria-labelledby, metadata rendering.

**Context7 queries**: `/shadcn-ui/ui` → Dialog install + DialogTitle requirement; `@radix-ui/react-dialog` → focus trap, onEscapeKeyDown, aria wiring.

**A11y checklist**: aria-label триггера включает username, DialogTitle обязателен, ESC + overlay close, return-focus, tabIndex=0 на scrollable `<pre>`.

**Verification**: `cd frontend && npm run type-check`; `npm test -- MessageViewerDialog violations`; `npm run dev` → ручной проход keyboard-only на `/violations`.

**Commit**: `feat(violations): full message viewer dialog on rows (gh-293)` → `/push` → PR.

### Phase 2 — gh-294: Multi-user voting + vote history (~400-600 LOC, миграция)

**Product assumptions**: закрытие только по timeout или manual close; effective vote = latest `state='active'` per user; concurrency через upsert по `(deliveryId, telegramUserId)` + append `SurveyVoteHistory` в одной Prisma `$transaction`; `FeedbackResponse` не трогаем (back-compat, просто перестаём писать новые данные).

**Schema** (`backend/prisma/schema.prisma`, миграция `20260418_multi_user_survey_votes`):
- `SurveyVote`: `id uuid, deliveryId FK, telegramUserId BigInt, username String?, rating Int, comment String?, state enum(active|removed), createdAt, updatedAt` + `@@unique([deliveryId, telegramUserId])`.
- `SurveyVoteHistory` (append-only): `id, voteId FK cascade, deliveryId, telegramUserId, action enum(create|update|remove), oldRating Int?, newRating Int?, username String?, changedAt` + `@@index([deliveryId, changedAt])`.
- Новые enum: `SurveyVoteState`, `SurveyVoteAction`. Соблюдать `@db.Uuid`, `@db.Timestamptz(6)`, `@@schema("public")`.

**Service** — **NEW** `backend/src/services/feedback/vote.service.ts`:
- `submitVote({ deliveryId, telegramUserId, rating, username, comment? })` — load delivery+survey; reject если `survey.status` не в (`active|sending`) или `delivery.expiresAt < now()`; transaction: findUnique → upsert → append history.
- `removeVote({ deliveryId, telegramUserId })` — set state=removed + append history action=remove.
- `aggregateSurvey(deliveryId)` — count/avg/distribution по state=active only.
- `getVoteHistory(deliveryId)` — сортировка по changedAt asc.

**Bot handler** (`backend/src/bot/handlers/survey.handler.ts`):
- Удалить гейт `delivery.status === 'responded'` (строки 122-126).
- Заменить `recordResponse` (строка 135) на `submitVote({ deliveryId, telegramUserId: BigInt(ctx.from!.id), rating, username: ctx.from!.username })`.
- Новая action-регулярка `^survey:remove:([^:]+)$`.
- После голосования — `editMessageReplyMarkup` с per-user клавиатурой (✅ на текущем active rating + кнопка "Отозвать"). Генерация per-callback, кэш не нужен.
- `awaitingComment` Map — ключ `${chatId}:${telegramUserId}` вместо только `chatId`.

**tRPC** (`backend/src/api/trpc/routers/survey.ts`):
- `survey.results` → через `aggregateSurvey`.
- `survey.voteHistory` (`managerProcedure`): input `{ deliveryId: uuid }`.
- `survey.close` (`managerProcedure`): обёртка над `closeSurvey`.
- `z.bigint()` для `telegramUserId` через superjson.

**Frontend** (`frontend/src/app/settings/survey/[id]/survey-detail-content.tsx`):
- Секция результатов — через `survey.results`.
- Per-delivery drill-down модалка "История голосов" — **переиспользовать Dialog из gh-293**. Таблица: timestamp, user, action, old → new.

**Context7 queries**: `/prisma/docs` — composite unique upsert, `$transaction`, BigInt, enum migrations; `/telegraf/telegraf` — `editMessageReplyMarkup`, callback regex; `/colinhacks/zod` — `z.bigint()`.

**Tests**:
- Unit `vote.service.test.ts` — submit/update/remove/aggregate-ignores-removed.
- Integration — 10 параллельных `submitVote` для одного `(delivery, user)` = 1 row + N history rows; 10 разных users concurrent = 10 vote rows.
- `survey.handler.test.ts` — два user'а, remove flow, post-close rejection.
- Race: expiry одновременно с vote — vote fails clean.

**Verification**: `cd backend && npm run type-check && npm test -- vote.service survey.handler`; `cd frontend && npm run type-check && npm run build`; мануальный тест с двумя Telegram-аккаунтами + `prisma studio`.

**Commits** (на ветке `feat/gh-294-multi-user-votes`):
1. `feat(surveys): multi-user vote schema (gh-294)`
2. `feat(surveys): vote service with audit history (gh-294)`
3. `refactor(surveys): multi-user bot handler with remove (gh-294)`
4. `feat(surveys): tRPC voteHistory, close, aggregated results (gh-294)`
5. `feat(surveys): vote history UI drill-down (gh-294)`

### Phase 3 — gh-292: Custom date ranges + cooldown (~200-300 LOC, миграция)

**Product assumptions**: cooldown 24h/chat (configurable), max range 90 дней (configurable), TZ хранится UTC, отображается Europe/Moscow, cooldown-skip = `SurveyDelivery.status='failed' + skipReason`.

**Настройки**: проверено — `SystemConfig` не существует, используем существующий singleton `GlobalSettings` (id="default") где уже `surveyValidityDays/ReminderDay/QuarterDay`.

**Schema** (`backend/prisma/schema.prisma`, миграция `add_custom_survey_ranges_and_cooldown`):
- `FeedbackSurvey`: `quarter String?` (nullable), `startDate DateTime? @db.Timestamptz(6)`, `endDate DateTime? @db.Timestamptz(6)`, `@@index([startDate, endDate])`.
- `SurveyDelivery`: `skipReason String?`.
- `Chat`: `lastSurveySentAt DateTime? @db.Timestamptz(6)`, `@@index([lastSurveySentAt])`.
- `GlobalSettings`: `surveyCooldownHours Int @default(24)`, `surveyMaxRangeDays Int @default(90)`.
- Backfill SQL: `UPDATE feedback_surveys SET start_date=scheduled_at, end_date=expires_at WHERE start_date IS NULL;` + `chats.last_survey_sent_at` из max `survey_deliveries.delivered_at`.

**Service** (`backend/src/services/feedback/survey.service.ts`):
- `createCampaign({ startDate, endDate, validityDays? })` — canonical path. Валидации: `endDate > startDate`, `(endDate-startDate) ≤ surveyMaxRangeDays`, overlap-check с `scheduled|sending|active` кампаниями.
- `createQuarterlyCampaign` — тонкая обёртка, деривит range из квартала.
- `canSendSurveyToChat(chatId, cooldownHours)` → `{ allowed, reason?, nextEligibleAt? }` через `Chat.lastSurveySentAt`.
- `getSurveyCooldownHours()` — читает GlobalSettings.

**Worker** (`backend/src/queues/survey.worker.ts`, в `processSurveyDelivery` перед `bot.telegram.sendMessage`):
- `canSendSurveyToChat(chatId)` — если blocked: update `SurveyDelivery { status:'failed', skipReason:'cooldown: next eligible ...' }`, log audit, `return` без throw (не ретраить).
- При успехе: в одной транзакции с `updateDeliveryStatus('delivered')` выставить `Chat.lastSurveySentAt = new Date()` — защита от гонки между параллельными рассылками.

**tRPC** (`backend/src/api/trpc/routers/survey.ts`):
```ts
z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('quarter'), quarter: ..., scheduledFor: z.date().optional() }),
  z.object({ mode: z.literal('range'), startDate: z.date(), endDate: z.date(), scheduledFor: z.date().optional() }),
]).refine(...)
```
- `TRPCError('PRECONDITION_FAILED', { cause: { kind:'COOLDOWN', nextEligibleAt } })` при конфликтах.
- Новый `survey.getCooldownStatus({ chatId })` для UI preview.

**Frontend** (`frontend/src/app/settings/survey/survey-list-content.tsx`, модалка строки 110-210):
- Добавить `mode: 'quarter' | 'range'` + toggle (радио/табы).
- Range mode: shadcn `calendar` + `popover`, range mode из `react-day-picker` (уже установлен). Эталон — `frontend/src/components/settings/HolidayCalendar.tsx`. Форматирование через `date-fns-tz` → Europe/Moscow.
- Маппинг `PRECONDITION_FAILED` → inline error с `nextEligibleAt` в Moscow time.
- Список опросов — показывать range когда `quarter` null.
- `frontend/src/app/settings/survey/settings/survey-settings-content.tsx` — редакторы `surveyCooldownHours` и `surveyMaxRangeDays`.

**Context7 queries**: `/prisma/docs` — nullable migration + backfill, Timestamptz; `/date-fns/date-fns-tz` — zoned formatting, range diff; `/colinhacks/zod` — `discriminatedUnion` + `refine`; `/shadcn-ui/ui` — Calendar range picker.

**Tests**:
- `survey.service.test.ts` — range boundaries (0d, 91d), overlap detection, quarter wrapper parity.
- `survey.worker.test.ts` — cooldown hit (no Telegram call) / miss, атомарное `lastSurveySentAt`, Europe/Moscow DST boundary (последнее воскресенье октября).
- Integration: 2 кампании на один чат в 24h window → второй delivery → `status=failed, skipReason LIKE 'cooldown:%'`, Telegram mock вызван ровно 1 раз.

**Verification**: `prisma migrate diff` dry-run → `prisma migrate dev --name add_custom_survey_ranges_and_cooldown`; type-check backend + frontend; unit + integration tests.

**Commits** (на ветке `feat/gh-292-survey-ranges`):
1. `feat(surveys): add startDate/endDate + cooldown fields (gh-292)`
2. `feat(surveys): canSendSurveyToChat + createCampaign service (gh-292)`
3. `feat(surveys): enforce cooldown in delivery worker (gh-292)`
4. `feat(surveys): tRPC discriminated union for custom ranges (gh-292)`
5. `feat(surveys): custom date-range UI with cooldown errors (gh-292)`

## Critical Files

**Frontend** (gh-293, gh-294 UI, gh-292 UI):
- `frontend/src/app/violations/page.tsx`
- `frontend/src/components/ui/dialog.tsx` (NEW)
- `frontend/src/components/violations/MessageViewerDialog.tsx` (NEW)
- `frontend/src/app/settings/survey/[id]/survey-detail-content.tsx`
- `frontend/src/app/settings/survey/survey-list-content.tsx`
- `frontend/src/app/settings/survey/settings/survey-settings-content.tsx`
- `frontend/src/components/settings/HolidayCalendar.tsx` (референс)
- `frontend/src/components/ui/popover.tsx` (референс z-index контракта)

**Backend**:
- `backend/prisma/schema.prisma`
- `backend/src/services/feedback/survey.service.ts`
- `backend/src/services/feedback/vote.service.ts` (NEW)
- `backend/src/bot/handlers/survey.handler.ts`
- `backend/src/queues/survey.worker.ts`
- `backend/src/api/trpc/routers/survey.ts`

## Existing Utilities to Reuse

- `ConfirmDialog` (`frontend/src/components/ui/ConfirmDialog.tsx`) — для стиля, но gh-293 использует Radix Dialog для a11y.
- Radix z-index контракт из `popover.tsx` (gh-289 fix).
- `RequestHistory` pattern (`schema.prisma:351-368`) — эталон audit trail для `SurveyVoteHistory`.
- `withAuditTrail()` Prisma extension — референс, не обязательно применять к SurveyVote.
- `HolidayCalendar.tsx` — эталон range picker на react-day-picker.
- `escapeHtml()` из `format.service.ts` — для любых Telegram HTML.
- `authedProcedure / managerProcedure / adminProcedure` из `backend/src/api/trpc/trpc.ts`.
- BullMQ survey queue (`backend/src/queues/survey.queue.ts`) — существующая инфраструктура.

## End-to-End Verification

После каждой фазы:
1. `cd backend && npm run type-check && npm run build` — чисто.
2. `cd frontend && npm run type-check && npm run build` — чисто.
3. Соответствующие unit + integration тесты проходят.
4. `/push` → feature branch + PR → ждём CI green → (merge делает пользователь).
5. После merge: `gh issue close <N> --comment "Fixed in PR #<P>. ..."` + `bd close <task>`.

**Финальная проверка после всех трёх merges**:
- Release Please создаст release PR с CHANGELOG.
- Ручная E2E проверка на staging: открыть /violations → dialog; провести голосование с 2 Telegram-аккаунтов; создать опрос с произвольным диапазоном и проверить блокировку повторной рассылки < 24h.

## Out of Scope

- Кнопка "Копировать" в MessageViewerDialog (gh-293 follow-up).
- Пагинация очень длинных сообщений (gh-293 follow-up).
- Проекция `FeedbackResponse` из latest `SurveyVote` (gh-294 follow-up).
- HOLD-issues #295/#296/#297/#298 — пользователь сознательно отложил, не трогаем.
