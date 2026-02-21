# Plan: Fix GitHub Issues #184 and #186

## Context

Тестер сообщил о двух взаимосвязанных багах, оба приводят к тому, что Web UI показывает пустые данные:

- **#184**: Страница деталей чата не загружается для supergroup-чатов (BigInt conversion gap)
- **#186**: Страница логов пуста с 16 января 2026 (RLS-политики блокируют INSERT в error_logs)

Взаимосвязь: оба бага — silent failures на уровне БД, оба ведут к пустому UI без ошибок для пользователя.

---

## Task 1: Fix BigInt conversion gaps (gh-184)

**Проблема:** `chats.getById` и `chats.update` получают `input.id` как `z.number()`, но передают его в Prisma-запрос напрямую, без `BigInt()`. Для supergroup с большими отрицательными ID (`-100XXXXXXXXXX`) это приводит к потере точности и NOT_FOUND.

**Файлы и конкретные правки:**

### 1a. `backend/src/api/trpc/routers/chats.ts`

| Строка | Текущий код | Исправление |
|--------|------------|-------------|
| 172 | `where: { id: input.id }` | `where: { id: BigInt(input.id) }` |
| 364 | `where: { id: input.id }` | `where: { id: BigInt(input.id) }` |
| 512 | `where: { id: input.id }` | `where: { id: BigInt(input.id) }` |

Паттерн-референс: строка 361 того же файла уже корректно использует `BigInt(input.id)` в raw SQL.

### 1b. `backend/src/api/trpc/routers/requests.ts`

| Строка | Текущий код | Исправление |
|--------|------------|-------------|
| 117 | `where.chatId = input.chatId` | `where.chatId = BigInt(input.chatId)` (нужен guard: `if (input.chatId !== undefined)`) |

### 1c. Мелкие улучшения (code quality — в том же коммите)

| Файл | Строка | Проблема | Исправление |
|------|--------|----------|-------------|
| `backend/src/api/trpc/routers/alerts.ts` | 88 | `Number(alert.request.chatId)` | `safeNumberFromBigInt(alert.request.chatId)` + import |
| `backend/src/api/trpc/routers/requests.ts` | 643 | `Number(r.parentMessageId)` | `safeNumberFromBigInt(r.parentMessageId)` + import |

**Сложность:** Simple — прямые однострочные правки. Выполнить самостоятельно.

---

## Task 2: Fix RLS on error_logs (gh-186)

**Проблема:** Миграция `20260116000000_add_error_logs` включила RLS с политиками `TO authenticated` / `auth.uid() = admin`. Backend подключается через `pg.Pool` без JWT, `auth.uid()` возвращает NULL — все INSERT блокируются.

**Рекомендуемый подход: Disable RLS** (Option B из issue)

Обоснование:
- `error_logs` — внутренняя системная таблица, не содержит пользовательских данных
- Контроль доступа уже реализован на уровне tRPC (`adminProcedure` в `logs.ts`)
- Все остальные внутренние таблицы (`users`, `chats`, `client_requests` и т.д.) не используют RLS
- Наиболее надёжный fix, не зависит от роли подключения

**Файлы и конкретные правки:**

### 2a. Новая миграция: `backend/prisma/migrations/20260220000000_fix_error_logs_rls/migration.sql`

```sql
-- Fix: Disable RLS on error_logs table (gh-186)
-- error_logs is an internal system table. Access control is enforced
-- at the tRPC layer (adminProcedure). RLS policies required auth.uid()
-- which returns NULL for backend service connections via pg.Pool,
-- blocking all INSERT operations since 2026-01-16.

-- Drop existing policies
DROP POLICY IF EXISTS "Admin users can view error logs" ON "error_logs";
DROP POLICY IF EXISTS "Admin users can modify error logs" ON "error_logs";

-- Disable RLS
ALTER TABLE "error_logs" DISABLE ROW LEVEL SECURITY;
```

### 2b. Применить миграцию

```bash
cd backend && npx prisma migrate deploy
```

**Сложность:** Simple — одна миграция. Выполнить самостоятельно.

---

## Порядок выполнения

1. **Task 1** (BigInt) и **Task 2** (RLS) — независимы, можно параллельно
2. Оба в одном коммите: `fix(backend): resolve BigInt conversion and RLS policy issues (gh-184, gh-186)`

## Beads

Создать 2 задачи:
- `buh-xxx: gh-184: BigInt conversion gaps in chats.getById/update` (priority=1, type=bug)
- `buh-yyy: gh-186: RLS blocks error_logs INSERT` (priority=0, type=bug)
- Без зависимостей между ними

## Верификация

1. `npm run type-check` — должен пройти
2. `npm run build` — должен собраться
3. После деплоя:
   - Открыть Web UI → детали supergroup-чата → должны отображаться сообщения
   - Проверить `error_logs` таблицу — новые записи должны появляться
   - `docker logs buhbot-backend | grep "ErrorCaptureService.*Failed"` — не должно быть новых ошибок

## Не входит в scope

- Интеграционные тесты (issue #184 предлагает, но это отдельная задача)
- Мониторинг logging pipeline (issue #186 предлагает, но это enhancement)
- Замена `z.number()` на `z.string()` для chatId в API (long-term fix из #184 — отдельная задача)
