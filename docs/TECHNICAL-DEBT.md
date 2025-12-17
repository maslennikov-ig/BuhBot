# Technical Debt Registry

> Документ для отслеживания технического долга проекта BuhBot.
> Обновлено: 2025-12-17

---

## Database (Supabase)

### TD-DB-001: Data Retention Policy
**Priority**: Medium
**Effort**: 2-4 hours
**Source**: Supabase Audit 2025-12-17

**Описание**:
`global_settings.data_retention_years` определён (default: 3), но нет автоматической очистки старых данных.

**Влияние**:
- База будет расти бесконечно
- Увеличение storage costs
- Замедление запросов на больших таблицах

**Решение**:
1. Создать BullMQ job `data-retention-cleanup`
2. Запускать ежедневно в 03:00 UTC
3. Удалять записи старше `data_retention_years`:
   - `client_requests` (старше N лет)
   - `sla_alerts` (старше N лет)
   - `feedback_responses` (старше N лет)
   - `notifications` (старше N лет)

**Таблицы для очистки**:
```sql
DELETE FROM client_requests
WHERE received_at < NOW() - INTERVAL '3 years';

DELETE FROM sla_alerts
WHERE created_at < NOW() - INTERVAL '3 years';

DELETE FROM feedback_responses
WHERE created_at < NOW() - INTERVAL '3 years';

DELETE FROM notifications
WHERE created_at < NOW() - INTERVAL '3 years';
```

---

### TD-DB-002: VACUUM ANALYZE Scheduling
**Priority**: Low
**Effort**: 1 hour
**Source**: Supabase Audit 2025-12-17

**Описание**:
Нет периодического запуска VACUUM ANALYZE для предотвращения table bloat.

**Влияние**:
- Dead tuples накапливаются
- Деградация производительности со временем
- Увеличение storage

**Решение**:
1. Включить `pg_cron` extension в Supabase
2. Создать scheduled job:
```sql
SELECT cron.schedule(
  'vacuum-analyze-public',
  '0 4 * * 0',  -- Every Sunday at 04:00 UTC
  'VACUUM ANALYZE'
);
```

**Альтернатива**: Supabase автоматически запускает autovacuum, но для агрессивных workloads может потребоваться ручной контроль.

---

### TD-DB-003: Working Schedules Default Data
**Priority**: Medium
**Effort**: 30 min
**Source**: Supabase Audit 2025-12-17

**Описание**:
Таблица `working_schedules` пустая. Нет дефолтных рабочих часов для новых чатов.

**Влияние**:
- SLA расчёты могут падать если working hours не настроены
- Новые чаты требуют ручной настройки

**Решение**:
1. Создать seed данные для стандартных рабочих часов (Пн-Пт 09:00-18:00 MSK)
2. Или: автоматически создавать schedule при создании чата

**Seed SQL**:
```sql
-- Default working schedule template (to be copied for each chat)
-- This is a reference, actual implementation should create per-chat schedules

-- Example for chat_id = 1:
INSERT INTO working_schedules (chat_id, day_of_week, start_time, end_time, is_working_day)
VALUES
  (1, 1, '09:00', '18:00', true),  -- Monday
  (1, 2, '09:00', '18:00', true),  -- Tuesday
  (1, 3, '09:00', '18:00', true),  -- Wednesday
  (1, 4, '09:00', '18:00', true),  -- Thursday
  (1, 5, '09:00', '18:00', true),  -- Friday
  (1, 6, '09:00', '18:00', false), -- Saturday
  (1, 0, '09:00', '18:00', false); -- Sunday
```

**Рекомендация**: Добавить в `chat.service.ts` автоматическое создание default schedule при `createChat()`.

---

### TD-DB-004: OAuth Tables RLS Investigation
**Priority**: Low
**Effort**: 1-2 hours (research)
**Source**: Supabase Audit 2025-12-17

**Описание**:
OAuth таблицы в `auth` схеме не имеют RLS:
- `auth.oauth_authorizations`
- `auth.oauth_client_states`
- `auth.oauth_clients`
- `auth.oauth_consents`

**Влияние**:
- Возможно управляется Supabase Auth service
- Требует исследования документации

**Решение**:
1. Изучить Supabase Auth документацию
2. Проверить, нужен ли RLS для OAuth tables
3. Если да — создать политики

**Ссылки**:
- https://supabase.com/docs/guides/auth/row-level-security

---

## Backend

### TD-BE-001: Classification Cache Cleanup
**Priority**: Low
**Effort**: 1 hour
**Source**: Schema design

**Описание**:
Таблица `classification_cache` имеет поле `expires_at`, но нет job для очистки expired записей.

**Решение**:
Добавить в data-retention job или отдельный cleanup:
```sql
DELETE FROM classification_cache
WHERE expires_at < NOW();
```

---

### TD-BE-002: Prisma Migration Sync
**Priority**: Low
**Effort**: 30 min
**Source**: Supabase Audit 2025-12-17

**Описание**:
Локальные миграции могут рассинхронизироваться с production БД.

**Решение**:
1. Периодически запускать `prisma migrate diff`
2. Добавить CI check для migration drift

---

## Frontend

*Нет текущего технического долга.*

---

## Infrastructure

### TD-INFRA-001: Monitoring Alerts for DB Health
**Priority**: Medium
**Effort**: 2-3 hours
**Source**: Best practices

**Описание**:
Нет алертов на:
- Table bloat (dead tuples > 10%)
- Long-running queries (> 30s)
- Connection pool exhaustion

**Решение**:
1. Настроить Prometheus metrics через Supabase
2. Добавить Grafana dashboards
3. Настроить Telegram alerts

---

## Completed Items

### 2025-12-17: Supabase Audit Fixes
- [x] Created missing tables (global_holidays, chat_holidays, classification_cache)
- [x] Removed duplicate FK constraint on telegram_accounts
- [x] Enabled RLS on contact_requests, feedback_surveys, survey_deliveries, global_settings
- [x] Removed deprecated index idx_client_requests_is_spam
- [x] Created composite indexes on chat_messages
- [x] Created composite index on client_requests (chat_id, received_at)
- [x] Removed duplicate index chat_invitations_token_idx

---

## Legend

| Priority | Description |
|----------|-------------|
| Critical | Blocking production, security risk |
| High | Should fix before next release |
| Medium | Plan for next sprint |
| Low | Nice to have, backlog |

| Effort | Time |
|--------|------|
| 30 min | Quick fix |
| 1-2 hours | Small task |
| 2-4 hours | Medium task |
| 1+ days | Large task |
