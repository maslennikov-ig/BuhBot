# Мониторинг ошибок: соединить существующие компоненты

## Context

После инцидента с 6 непримененными миграциями (тестер увидел ошибки раньше нас) выявлены дыры в мониторинге. При этом 90% инфраструктуры УЖЕ построено, но компоненты не соединены между собой:

- `errorCaptureService` пишет ошибки в БД — но error handler в `index.ts` его НЕ вызывает
- `TelegramAlertService` умеет слать алерты — но НИКТО его не триггерит при runtime-ошибках
- `metrics.ts` имеет 20+ метрик — но счётчика HTTP-ошибок нет (Grafana панель ссылается на `bot_errors_total` которого не существует)
- `github-deploy.sh` делает health-check — но `prisma migrate deploy` не запускает
- `/health` проверяет `SELECT 1` — но не ловит рассинхронизацию схемы

**Подход**: 4 точечных изменения (~60 строк), которые соединяют существующие компоненты.

## Изменения

### 1. Подключить error handler к errorCaptureService и Telegram

**Файл**: `backend/src/index.ts` (строки 152-168)

Текущий error handler только логирует и возвращает 500. Нужно добавить:
- Вызов `errorCaptureService.captureError()` (уже существует в `services/logging/error-capture.service.ts:123`)
- Вызов `getAlertService().sendCritical()` для критичных ошибок (уже существует в `services/telegram-alerts.ts:388`)
- Инкремент Prometheus-счётчика `httpErrorsTotal` (добавим в шаге 2)

```typescript
// В error handler (index.ts:152-168) добавить:
import { errorCaptureService } from './services/logging/error-capture.service.js';
import { getAlertService } from './services/telegram-alerts.js';
import { httpErrorsTotal } from './utils/metrics.js';

app.use((err: Error, req, res, _next) => {
  // Существующее логирование...

  // NEW: Prometheus counter
  httpErrorsTotal.inc({ method: req.method, path: req.route?.path ?? req.path });

  // NEW: Capture to error_log table
  errorCaptureService.captureError({
    level: 'error',
    message: err.message,
    stack: err.stack,
    service: 'express',
    metadata: { path: req.path, method: req.method },
  });

  // NEW: Telegram alert for Prisma/DB errors
  if (err.name === 'PrismaClientKnownRequestError' || err.name === 'PrismaClientUnknownRequestError') {
    getAlertService()?.sendCritical(
      'Database Error',
      err.message,
      { path: req.path, errorName: err.name }
    );
  }

  // Существующий res.status(500)...
});
```

### 2. Добавить `httpErrorsTotal` counter в metrics.ts

**Файл**: `backend/src/utils/metrics.ts`

Grafana dashboard (`bot-performance.json:492`) уже ссылается на метрику ошибок, но она не определена.

```typescript
export const httpErrorsTotal = new Counter({
  name: 'http_errors_total',
  help: 'Total HTTP 500 errors',
  labelNames: ['method', 'path'] as const,
  registers: [register],
});
```

~5 строк. Панель в Grafana нужно будет обновить на новое имя `http_errors_total` (или назвать `bot_errors_total` чтобы совпало с существующим дашбордом).

### 3. Добавить schema probe в health endpoint

**Файл**: `backend/src/api/health.ts`

Добавить третью проверку `checkSchema()` которая делает запрос, затрагивающий колонку из последней миграции. Если запрос падает с "column does not exist" — health возвращает `down`.

```typescript
async function checkSchema(timeoutMs = 5000): Promise<CheckResult> {
  const start = Date.now();
  try {
    // Query touching columns from recent migrations
    await Promise.race([
      prisma.$queryRaw`SELECT deleted_at, is_migrated FROM chats LIMIT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs)),
    ]);
    return { status: 'ok', latency_ms: Date.now() - start };
  } catch (error) {
    return {
      status: 'down',
      latency_ms: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
```

В `healthHandler` добавить `schema` в параллельные проверки и в `determineHealthStatus`:
- schema down → overall `down`

~20 строк. Uptime Kuma уже пингует `/health` и шлёт в Telegram при падении — автоматически подхватит.

### 4. Добавить `prisma migrate deploy` в деплой-скрипт

**Файл**: `infrastructure/scripts/github-deploy.sh`

После `deploy_services()` (строка 378) и до `wait_for_health_checks()` (строка 384):

```bash
run_migrations() {
  log_info "Running Prisma migrations..."
  if docker exec buhbot-bot-backend npx prisma migrate deploy 2>&1; then
    log_success "Migrations applied successfully"
  else
    log_error "Migration failed!"
    rollback
    exit 1
  fi
}
```

В `main()` вызвать `run_migrations` после `deploy_services`:

```bash
deploy_services || { log_error "Deploy failed"; rollback; exit 1; }
run_migrations    # NEW
wait_for_health_checks || { log_error "Health checks failed"; rollback; exit 1; }
```

~15 строк. Если миграция падает — автоматический откат.

## Критические файлы

| Файл | Что меняем | Строк |
|------|-----------|-------|
| `backend/src/index.ts` (строки 152-168) | Wire error handler → capture + alert + metric | ~15 |
| `backend/src/utils/metrics.ts` | Добавить `httpErrorsTotal` counter | ~5 |
| `backend/src/api/health.ts` | Добавить `checkSchema()` probe | ~20 |
| `infrastructure/scripts/github-deploy.sh` (строка 378) | Добавить `run_migrations()` | ~15 |
| `infrastructure/monitoring/grafana/dashboards/bot-performance.json` (строка 492) | Обновить имя метрики ошибок | ~1 |

## Что НЕ меняем (уже работает)

- `error-capture.service.ts` — fingerprinting и дедупликация ✓
- `telegram-alerts.ts` — форматирование и отправка ✓
- `metrics.ts` — все остальные метрики ✓
- Uptime Kuma — мониторинг `/health` каждые 5 мин ✓
- Docker health checks — `curl /health` каждые 30с ✓

## Верификация

```bash
# 1. Тесты
cd backend && pnpm test

# 2. Type check
cd backend && pnpm type-check

# 3. Ручная проверка health с schema probe
curl http://localhost:3000/health
# Ожидаем: {"status":"ok","checks":{"database":...,"redis":...,"schema":...}}

# 4. Проверка метрик
curl http://localhost:3000/metrics | grep http_errors_total
# Ожидаем: http_errors_total{method="...",path="..."} 0

# 5. Проверка deploy script (dry run)
bash -n infrastructure/scripts/github-deploy.sh
```

## Результат

После этих 4 изменений цепочка обнаружения ошибок:

```
Schema drift → health endpoint returns "down"
            → Docker marks container unhealthy (30s)
            → Uptime Kuma detects (5 min)
            → Telegram alert автоматически

Runtime 500  → Prometheus counter http_errors_total
            → error_log table (с дедупликацией)
            → Telegram alert (для Prisma ошибок)
            → Grafana панель показывает error rate

Deploy       → prisma migrate deploy (автоматически)
            → Если упало → rollback
            → Если ОК → health check → продолжить
```
