# План: исправление багов опросов (gh-313 / gh-294) + E2E-промт для агента

## Context

Пользователь репортит два бага на production (`buhbot.aidevteam.ru`) после feature-ветки `feat/gh-313-targeted-survey-audience` (3 коммита ahead of main, PR ещё не создан):

**Баг A — chats.list 400 Bad Request** ([#313 comment 4277009667](https://github.com/maslennikov-ig/BuhBot/issues/313#issuecomment-4277009667))
При создании опроса → «Выбрать чаты» фронт шлёт `GET /api/trpc/chats.list?input={"limit":500,"offset":0}` и получает `400`. UI показывает «Нет доступных чатов».

Причина (verified): в code-review M1 (коммит `bef695d`) лимит на фронте подняли со 100 → 500 в `frontend/src/app/settings/survey/survey-list-content.tsx:183-185`, но **Zod-схему на бэке не обновили** — `backend/src/api/trpc/routers/chats.ts:53` всё ещё `z.number().int().min(1).max(100)`, поэтому 500 не проходит валидацию → `BAD_REQUEST`.

**Баг B — опросы показывают «Ошибка»** ([#294 comment 4277016473](https://github.com/maslennikov-ig/BuhBot/issues/294#issuecomment-4277016473))
На страницах `settings/survey/<id>` все доставки красные со статусом «Ошибка», хотя в DevTools чисто.

Причина (verified через `supabase execute_sql` на prod):
```
status=failed  has_skip=true   → 8 строк (все доставки обоих примеров)
status=delivered / responded   → 10 строк без skip_reason
```
Все `failed`-строки имеют `skip_reason = 'cooldown: next eligible …'`. Это не реальная ошибка отправки в Telegram — это **мисклассификация cooldown-skip'а как failure** в `backend/src/queues/survey.worker.ts:160-181` (`status: 'failed'` при блокировке антиспам-кулдауна gh-292). UI `frontend/src/app/settings/survey/[id]/survey-detail-content.tsx:112-116` рендерит `failed` как красную «Ошибка».

Намерение: внести оба фикса в текущую ветку, создать PR в `main`, после мерджа Release Please и Deploy to Production выкатят в prod. Плюс — отдельный MD-файл-промт, который Игорь сможет передать E2E-агенту для полной ручной/автоматизированной валидации.

---

## Critical files to modify

| Файл | Роль |
|---|---|
| `backend/src/api/trpc/routers/chats.ts:53` | Zod-схема `chats.list`: поднять `max(100)` → `max(500)` |
| `backend/prisma/schema.prisma:556` (`DeliveryStatus` enum) | добавить значение `skipped` |
| `backend/prisma/migrations/<timestamp>_add_skipped_delivery_status/migration.sql` | новая миграция: `ALTER TYPE`, + backfill `UPDATE survey_deliveries SET status='skipped' WHERE status='failed' AND skip_reason LIKE 'cooldown:%'` (в транзакции) |
| `backend/src/queues/survey.worker.ts:132, 166, JSDoc` | cooldown-гейт пишет `status: 'skipped'` (не `'failed'`), обновить JSDoc |
| `backend/src/queues/__tests__/survey.worker.cooldown.test.ts` | обновить ожидаемый `status` в тестах |
| `frontend/src/app/settings/survey/[id]/survey-detail-content.tsx:39, 83-117, 119-127` | `DeliveryStatus` type + config + filter options — добавить `skipped` (нейтрально-серый с подписью «Пропущен (cooldown)») |
| `frontend/src/app/settings/survey/[id]/__tests__/*.test.tsx` (если есть) | snapshot/unit — учесть новый статус |
| `docs/agents/e2e-survey-smoke-test.md` | **новый файл**: промт-инструкция для E2E-агента |

Reuse existing utilities — не создавать новое:
- `canSendSurveyToChat()` / `getSurveyCooldownHours()` уже есть, их не трогаем.
- `DeliveryStatusBadge` уже есть — только расширить конфиг.
- Zod `chatIdStringSchema` — shared schema уже вынесена в `bef695d` (`backend/src/api/trpc/schemas/*` или утилита), новую не создавать.

---

## Approach (TDD-порядок, коммитим по шагам)

### Шаг 1. Fix A — поднять лимит `chats.list`
1. Тест RED: добавить тест-кейс в contract/unit-тесты `chats.ts` (или `tRPC` contract test) — запрос с `limit: 500` должен пройти.
2. GREEN: `backend/src/api/trpc/routers/chats.ts:53` → `limit: z.number().int().min(1).max(500).default(50)`. Обновить JSDoc на строках 41-42.
3. Commit: `fix(chats): raise list limit to 500 to match frontend picker (gh-313)`.

### Шаг 2. Fix B — корректная классификация cooldown-skip
1. **Миграция**: `npx prisma migrate dev --name add_skipped_delivery_status` в `backend/`. Prisma сгенерирует `ALTER TYPE "DeliveryStatus" ADD VALUE 'skipped'`. В сгенерированный файл вручную добавить транзакцию с backfill:
   ```sql
   BEGIN;
   ALTER TYPE "public"."DeliveryStatus" ADD VALUE IF NOT EXISTS 'skipped';
   COMMIT;

   -- отдельной миграцией после коммита типа (требование PostgreSQL):
   BEGIN;
   UPDATE "public"."survey_deliveries"
   SET "status" = 'skipped'
   WHERE "status" = 'failed' AND "skip_reason" LIKE 'cooldown:%';
   COMMIT;
   ```
   ⚠️ PostgreSQL не позволяет использовать новый enum-value в той же транзакции, где он добавлен → **две отдельные миграции** (или `COMMIT` между `ALTER TYPE` и `UPDATE`).
2. Обновить `schema.prisma`: добавить `skipped` в enum `DeliveryStatus`.
3. **Тест RED**: обновить `survey.worker.cooldown.test.ts` — мокнуть cooldown-блок, ожидать `status: 'skipped'`. Запустить → упадёт.
4. **GREEN**: `survey.worker.ts:166` → `status: 'skipped'`; JSDoc на строке 132 → `writes status='skipped'`.
5. Commit: `fix(surveys): mark cooldown-blocked deliveries as 'skipped' not 'failed' (gh-294)`.

### Шаг 3. Fix B — UI
1. `survey-detail-content.tsx`:
   - `type DeliveryStatus` → добавить `'skipped'`.
   - `deliveryStatusConfig.skipped` → `{ label: 'Пропущен', color: 'var(--buh-foreground-muted)', bgColor: 'var(--buh-surface-elevated)' }`.
   - `deliveryStatusFilterOptions` → добавить `{ value: 'skipped', label: 'Пропущены' }`.
   - Если в колонке таблицы отображается причина — показывать `skipReason` в tooltip или второй строкой для `skipped`.
2. Обновить tRPC output-схему `survey.ts` если там ещё `z.enum([...])` без `skipped`.
3. Commit: `fix(surveys): add 'skipped' delivery status to UI (gh-294)`.

### Шаг 4. E2E-промт для агента
Создать `docs/agents/e2e-survey-smoke-test.md` — самодостаточный промт, который Игорь передаст Claude-агенту для **полной E2E-валидации** после деплоя.

Содержимое файла (скелет):
```markdown
# E2E smoke test: Surveys (gh-313 + gh-294 post-deploy)

## Context (агенту)
Протестировать полный flow опросов на production `https://buhbot.aidevteam.ru`
после выкатки фикса chats.list limit + skipped-статуса. Цель — убедиться, что
баги #313 и #294 действительно устранены, и что никаких регрессий нет
в существующих сценариях.

## Инструменты
- Playwright MCP (`mcp__playwright__browser_*`)
- Supabase MCP (`mcp__supabase__execute_sql`) для проверки БД
- Credentials: см. e2e/.env.example / e2e/fixtures/index.ts (admin@test.com)

## Чек-лист (отметить каждый пункт)

### A. chats.list (баг #313)
1. Login как admin, переход на /settings/survey.
2. Click «Создать опрос» → выбрать radio «Выбрать чаты».
3. **Ожидаемо**: список чатов грузится без 400 в Network tab.
4. Сделать скриншот `artifacts/01-chat-picker-loaded.png`.
5. Network → найти запрос `chats.list?batch=1&input=...limit:500...` → status 200.
6. Если ≥500 чатов — баннер truncation виден; иначе — полный список.

### B. skipped-статус (баг #294)
1. Открыть существующий опрос `/settings/survey/d1667780-3f16-48cb-900a-762de1669ec7`.
2. **Ожидаемо**: строки со skip_reason отображаются серым «Пропущен»,
   НЕ красным «Ошибка».
3. Скриншот `artifacts/02-skipped-status.png`.
4. Фильтр статуса → выбрать «Пропущены» → видны только skipped-строки.
5. Supabase query: `SELECT count(*) FROM survey_deliveries WHERE status='skipped'`
   → должно быть ≥8 (backfill).

### C. Полный happy-path (регрессия)
1. Создать новый опрос audience=all, immediate=true, quarter=current.
2. Дождаться status=active в списке (poll 15s, timeout 2 min).
3. Открыть детальную страницу — доставки пошли (status=pending/delivered).
4. **Не ждём реальной отправки в Telegram** — верифицируем только UI и БД.

### D. audience=specific_chats (gh-313 happy path)
1. Создать опрос → «Выбрать чаты» → выбрать 2 конкретных чата.
2. Submit → созданный опрос в списке.
3. В БД: SELECT audience_type, audience_chat_ids → 'specific_chats' + 2 элемента.
4. Доставки созданы только для этих 2 чатов.

### E. audience=segments (gh-313 happy path)
1. Создать сегмент (если нет), добавить туда чат.
2. Создать опрос → «Сегменты» → выбрать сегмент → submit.
3. Верифицировать: audience_type=segments + audience_segment_ids содержит id.

### F. Негативные кейсы
1. Попытка создать опрос audience=specific_chats с пустым списком → UI блокирует submit.
2. Попытка зарегаться как не-admin и зайти на /settings/survey → redirect/403.

## Критерии успеха
- Все A-F выполнены без ручных правок.
- Скриншоты сохранены в artifacts/.
- Отчёт: кол-во пройденных/упавших шагов + причины.

## Формат отчёта
Markdown-файл `docs/reports/e2e/<date>-survey-smoke.md` со структурой:
- Executive summary (PASS/FAIL)
- Per-step results с скриншотами
- Bugs discovered (если есть) → создать `bd create -t bug` для каждого.
```

Commit: `docs(e2e): add survey smoke test prompt for E2E agent (gh-313, gh-294)`.

### Шаг 5. PR + merge + deploy
1. `/push` после каждого шага (backend/fix-A, backend/fix-B migration+worker, frontend/fix-B, docs/e2e).
2. После последнего коммита — `gh pr create` в `main` (если ещё нет).
3. Ждать зелёный CI, squash-merge → Release Please PR → merge → Deploy to Production (GH Actions).
4. Post-deploy — запустить E2E-промт из шага 4.

---

## Verification

### Локально перед пушем
```bash
# Backend
cd backend
npm run type-check
npm run test -- survey.worker.cooldown
npm run test -- chats

# Frontend
cd ../frontend
npm run type-check
npm run build

# Prisma
cd ../backend
npx prisma validate
npx prisma migrate dev --name add_skipped_delivery_status --create-only  # review SQL
```

### На production после деплоя
1. **Fix A**: открыть `/survey` → «Создать опрос» → «Выбрать чаты» → список грузится без 400 в DevTools.
2. **Fix B**: открыть `/settings/survey/d1667780-3f16-48cb-900a-762de1669ec7` → доставки серые «Пропущен», не красные «Ошибка».
3. **БД-проверка** через `supabase.execute_sql`:
   ```sql
   SELECT status, count(*) FROM public.survey_deliveries GROUP BY status;
   -- ожидаемо: skipped >= 8, failed только с error_message != null
   ```
4. Запустить E2E-агента с промтом `docs/agents/e2e-survey-smoke-test.md`.

---

## Risks & mitigations

- **Prisma enum ALTER TYPE не поддерживает rollback** — если что-то пойдёт не так, новая миграция с `ALTER TYPE ... RENAME VALUE` или точечный UPDATE обратно в `failed`. Backfill делаем отдельной миграцией (не в одной транзакции с `ALTER TYPE`).
- **Старые «failed»-строки с реальной Telegram-ошибкой** могут попасть под backfill если у них тоже есть `skip_reason LIKE 'cooldown:%'` — но по данным prod таких нет (все 8 строк действительно cooldown-skip). Условие WHERE точно фильтрует.
- **500 чатов всё ещё мало для крупных тенантов** — уже есть truncation warning (PR #320 M1). Дальнейшее решение — пагинация/поиск — отдельный тикет, не блокер.
- **Сломать существующих пользователей** с кэшированным фронтом на статике, не знающим про `skipped` — fallback в JSX: если `deliveryStatusConfig[status]` undefined, рендерить нейтральный бейдж.

---

## Out of scope

- Перевод `failed` статуса с реальными Telegram-ошибками (NFR #294 про таксономию failures) — не трогаем, только cooldown-skip.
- `retry failed` / `cancel pending` UI-actions из спека #313 — не реализуем сейчас, отдельный тикет.
- Multi-segment picker (сейчас single-select) — документировано в PR #320 code-review, отдельный тикет.
