# Запуск /process-logs — проверка production и исправление ошибок

## Context

Скилл `/process-logs` v1.1.0 создан и закоммичен. Пользователь хочет запустить его впервые — проверить работу скилла и заодно исправить все найденные ошибки.

## План выполнения

### Step 0: Production Health Snapshot
1. SSH → `docker ps` — проверить здоровье контейнеров
2. SSH → Prometheus API `/api/v1/alerts` — проверить firing alerts
3. SSH → `/metrics` endpoint — проверить ключевые метрики (circuit breaker, error rates)
4. Сформировать сводку

### Step 1: Fetch New Errors
1. Supabase MCP → SQL запрос error_logs WHERE status = 'new' GROUP BY fingerprint
2. Если пусто — отчёт "нет новых ошибок" и стоп

### Step 1.5: Auto-Ignore Known Patterns
1. Пройтись по 10 noise-паттернам (Redis, BullMQ, Telegram и т.д.)
2. UPDATE matching error_logs SET status = 'ignored'
3. Отчёт по auto-ignored

### Step 2: Analyze & Prioritize
1. Классифицировать домен каждой ошибки
2. Рассчитать priority score (severity + impact + frequency)
3. Ранжированная таблица

### Step 3: Create Beads & Fix
1. Создать epic
2. Для каждой ошибки: Beads task → gather context → fix → verify → commit → close
3. Использовать субагентов для medium+ сложности

### Step 4: Summary Report
Итоговая таблица с результатами всех шагов
