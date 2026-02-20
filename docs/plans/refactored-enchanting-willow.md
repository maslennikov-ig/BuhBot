# Plan: Fix Production 500 Errors, Missing Logs, Missing NEXT_PUBLIC_BOT_NAME

## Context

Тестер (Сергей Соловьёв) сообщил о трёх критических проблемах на проде (`buhbot.aidevteam.ru`):

1. **Все tRPC-запросы возвращают 500** - страницы не загружаются (Алерты SLA, Аналитика и т.д.)
2. **Системные логи пропали после 16 января 2026** - раздел "Системные логи" пуст
3. **"Bot name not configured (NEXT_PUBLIC_BOT_NAME missing)"** - в Настройках

Скриншот DevTools подтверждает: `chats.list`, `analytics.getDashboard`, `alert.getAlertStats`, `notification.getUnreadCount` - все 500.

---

## Phase 1: SSH Remote Diagnostics (ПЕРВЫЙ ШАГ)

Подключаемся к VDS (`185.200.177.180`) и собираем данные:

```bash
# 1. Статус контейнеров
ssh buhbot@185.200.177.180 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.CreatedAt}}"'

# 2. Health endpoint
ssh buhbot@185.200.177.180 'curl -s http://localhost:3000/health'

# 3. Логи backend (последние 200 строк) — ищем ошибки Prisma/DB/SSL
ssh buhbot@185.200.177.180 'docker logs buhbot-bot-backend --tail 200 2>&1'

# 4. Фильтр по ошибкам
ssh buhbot@185.200.177.180 'docker logs buhbot-bot-backend --tail 500 2>&1 | grep -iE "prisma|database|ssl|connect|error|ECONN|self.signed|500"'

# 5. Дата создания образа (последний деплой)
ssh buhbot@185.200.177.180 'docker inspect buhbot-bot-backend --format="{{.Created}}"'

# 6. Env переменные в контейнере (без секретов)
ssh buhbot@185.200.177.180 'docker exec buhbot-bot-backend env | grep -E "DATABASE_URL|DIRECT_URL|NODE_ENV|LOG_LEVEL|LOGGING" | sed "s/=.*@/=***@/"'

# 7. Prisma generated client внутри контейнера
ssh buhbot@185.200.177.180 'docker exec buhbot-bot-backend ls -la node_modules/.prisma/client/ 2>&1 | head -10'

# 8. Тест подключения к БД
ssh buhbot@185.200.177.180 "docker exec buhbot-bot-backend node -e \"const pg=require('pg');const p=new pg.Pool({connectionString:process.env.DIRECT_URL||process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});p.query('SELECT 1').then(r=>console.log('DB OK')).catch(e=>console.error('DB FAIL',e.message)).finally(()=>p.end())\""

# 9. Frontend env
ssh buhbot@185.200.177.180 'docker exec buhbot-frontend env | grep NEXT_PUBLIC'
```

**Таблица диагностики — какой результат = какое действие:**

| Симптом в логах | Причина | Действие |
|----------------|---------|----------|
| `self signed certificate` | SSL конфликт (sslmode + ssl option) | Убрать `sslmode` из DATABASE_URL на сервере |
| `PrismaClientInitializationError` | Prisma client не сгенерирован | Пересобрать backend image |
| `relation "xxx" does not exist` | Миграции не применены | Применить миграции |
| Image created > 1 week ago | Контейнер устарел | Rebuild + redeploy |
| `ECONNREFUSED` | БД недоступна | Проверить Supabase статус |
| `DB OK` (тест ОК) но 500 | Ошибка в Prisma layer | Проверить generated client |

---

## Phase 2: Code Fixes

### Task 1: Add `NEXT_PUBLIC_BOT_NAME` to env.example (P0)

**Проблема:** `NEXT_PUBLIC_BOT_NAME` не задана ни в одном `.env` файле. В `docker-compose.yml:68` передаётся как build arg `${NEXT_PUBLIC_BOT_NAME}`, но значение пустое. Next.js инлайнит `NEXT_PUBLIC_*` при build time.

**Файл:** `frontend/.env.example`

```diff
+# Telegram Bot username (without @) for Login Widget
+# Get from: BotFather -> your bot -> username
+NEXT_PUBLIC_BOT_NAME=top_buhbot
```

Bot username: `top_buhbot` (подтверждено в `docs/РУКОВОДСТВО_ПО_ТЕСТИРОВАНИЮ.md:39`)

### Task 2: Fix logging variable name mismatch (P1)

**Проблема:** `docker-compose.prod.yml:29` задаёт `LOGGING_LEVEL=warn`, но `backend/src/utils/logger.ts` читает `process.env.LOG_LEVEL`. Переменная игнорируется.

**Файл:** `infrastructure/docker-compose.prod.yml:29`

```diff
-      - LOGGING_LEVEL=warn
+      - LOG_LEVEL=warn
```

### Task 3: Fix 500 errors (P0 — зависит от диагностики)

Действие определяется результатами Phase 1. Наиболее вероятные сценарии:

**A) Контейнер устарел** (rebuild + redeploy)
- Коммит `3cbbf45` (сегодня) убрал `sslmode` из URL validation
- Если не задеплоено — старый код может отвергать DATABASE_URL

**B) SSL конфликт** — `sslmode=require` в URL + `ssl: { rejectUnauthorized: false }` в pg Pool
- Файл: `backend/src/lib/prisma.ts:139`
- Если на сервере в `.env` есть `sslmode=require` в DATABASE_URL — убрать

**C) Миграции** — если новые таблицы/колонки не созданы
- Выполнить `npx prisma migrate deploy` в контейнере

**D) Дополнительно:** исправить комментарий в `lib/prisma.ts:102-106` — обе ветки одинаковые, комментарий врёт:
```typescript
// Обе ветки идентичны: env.DIRECT_URL || env.DATABASE_URL
const connectionString = isDev
  ? env.DIRECT_URL || env.DATABASE_URL   // dev: prefer DIRECT_URL
  : env.DIRECT_URL || env.DATABASE_URL;  // prod: same
```

---

## Phase 3: Deployment

После фиксов + диагностики:

```bash
# 1. Коммит и push
git add frontend/.env.example infrastructure/docker-compose.prod.yml
git commit -m "fix(config): add NEXT_PUBLIC_BOT_NAME, fix LOG_LEVEL var name"
git push

# 2. На VDS — pull + rebuild + redeploy
ssh buhbot@185.200.177.180 'cd /opt/buhbot && git pull'
ssh buhbot@185.200.177.180 'cd /opt/buhbot/infrastructure && NEXT_PUBLIC_BOT_NAME=top_buhbot docker compose -f docker-compose.yml -f docker-compose.prod.yml build bot-backend frontend'
ssh buhbot@185.200.177.180 'cd /opt/buhbot/infrastructure && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d bot-backend frontend'
```

---

## Verification

1. `curl -s https://buhbot.aidevteam.ru/health` — `{"status":"ok","database":true,"redis":true}`
2. Открыть admin panel — страницы загружаются без 500
3. Настройки — "Bot name not configured" пропало
4. Системные логи — записи появляются
5. `docker logs buhbot-bot-backend --tail 50` — без ошибок

---

## Critical Files

| Файл | Что меняем |
|------|-----------|
| `frontend/.env.example` | Добавить `NEXT_PUBLIC_BOT_NAME=top_buhbot` |
| `infrastructure/docker-compose.prod.yml:29` | `LOGGING_LEVEL` -> `LOG_LEVEL` |
| `backend/src/lib/prisma.ts:104-106` | Исправить комментарий (обе ветки одинаковы) |
| `backend/src/lib/prisma.ts:139` | SSL config — ревью после диагностики |
| `backend/Dockerfile:66` | Верификация что `.prisma` copy работает |
