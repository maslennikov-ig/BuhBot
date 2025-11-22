# Quickstart: SLA Monitoring System

**Branch**: `002-sla-monitoring`
**Date**: 2025-11-22

## Prerequisites

Перед началом работы убедитесь, что:

1. **Infrastructure Phase 1 завершена** (v0.1.16)
   - VDS сервер настроен
   - Supabase проект создан
   - Redis запущен
   - Docker Compose работает

2. **Environment Variables**:
   ```bash
   # Backend (.env)
   DATABASE_URL="postgresql://..."
   DIRECT_URL="postgresql://..."
   SUPABASE_URL="https://xxx.supabase.co"
   SUPABASE_ANON_KEY="eyJ..."
   SUPABASE_SERVICE_ROLE_KEY="eyJ..."
   TELEGRAM_BOT_TOKEN="123456:ABC..."
   OPENROUTER_API_KEY="sk-or-..."
   REDIS_URL="redis://localhost:6379"
   ```

## Quick Start (Development)

### 1. Clone and Setup

```bash
# Убедитесь что вы на правильной ветке
git checkout 002-sla-monitoring

# Установка зависимостей
cd backend && pnpm install
cd ../frontend && pnpm install
```

### 2. Database Migration

```bash
cd backend

# Генерация Prisma Client
pnpm prisma generate

# Применение миграций (если есть)
pnpm prisma migrate dev

# Проверка схемы
pnpm prisma studio
```

### 3. Start Services

```bash
# Terminal 1: Backend + Bot
cd backend
pnpm dev

# Terminal 2: Frontend
cd frontend
pnpm dev

# Terminal 3: Redis (если локально)
redis-server
```

### 4. Verify Installation

```bash
# Health check
curl http://localhost:3001/health

# Bot webhook info
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

## Key Endpoints

### Backend API (tRPC)
- Base URL: `http://localhost:3001/trpc`

| Procedure | Type | Description |
|-----------|------|-------------|
| `sla.createRequest` | mutation | Создать запрос клиента |
| `sla.classifyMessage` | mutation | Классифицировать сообщение |
| `sla.startTimer` | mutation | Запустить SLA таймер |
| `sla.stopTimer` | mutation | Остановить SLA таймер |
| `sla.getRequests` | query | Список запросов |
| `chat.getChats` | query | Список чатов |
| `chat.updateChat` | mutation | Обновить настройки чата |
| `alert.getAlerts` | query | Список алертов |
| `alert.resolveAlert` | mutation | Закрыть алерт |
| `analytics.getDashboard` | query | Данные dashboard |
| `settings.getGlobalSettings` | query | Глобальные настройки |

### Frontend (Admin Panel)
- URL: `http://localhost:3000`

| Route | Description |
|-------|-------------|
| `/` | Redirect to dashboard |
| `/dashboard` | Main SLA dashboard |
| `/chats` | Chat management |
| `/chats/[id]` | Chat details & settings |
| `/accountants` | Accountant performance |
| `/alerts` | Active alerts |
| `/settings` | Global settings |
| `/settings/holidays` | Holiday calendar |

## Development Workflow

### 1. Working with Bot

```typescript
// backend/src/bot/handlers/message.handler.ts

import { Context } from 'telegraf';
import { classifyMessage, startSlaTimer } from '../services/sla';

export async function handleMessage(ctx: Context) {
  const message = ctx.message;
  if (!message || !('text' in message)) return;

  // 1. Classify message
  const classification = await classifyMessage(message.text);

  if (classification.classification === 'REQUEST') {
    // 2. Create request record
    const request = await createClientRequest({
      chatId: ctx.chat.id.toString(),
      messageId: message.message_id.toString(),
      messageText: message.text,
      clientUsername: message.from?.username,
      classification: classification.classification,
      classificationScore: classification.confidence,
    });

    // 3. Start SLA timer
    await startSlaTimer(request.id);
  }
}
```

### 2. Working with SLA Timer

```typescript
// backend/src/services/sla/timer.service.ts

import { Queue } from 'bullmq';
import { calculateWorkingHoursDelay } from './working-hours';

const slaQueue = new Queue('sla-timers', { connection: redis });

export async function startSlaTimer(requestId: string) {
  const request = await getRequest(requestId);
  const chat = await getChat(request.chatId);
  const schedule = await getWorkingSchedule(chat.id);

  // Calculate delay until SLA breach
  const delayMs = calculateWorkingHoursDelay(
    new Date(),
    chat.slaThresholdMinutes,
    schedule
  );

  await slaQueue.add(
    'check-breach',
    { requestId },
    { delay: delayMs, jobId: `sla-${requestId}` }
  );
}

export async function stopSlaTimer(requestId: string) {
  await slaQueue.remove(`sla-${requestId}`);
}
```

### 3. Working with Alerts

```typescript
// backend/src/services/alert/send.service.ts

import { Markup } from 'telegraf';

export async function sendManagerAlert(alert: SlaAlert) {
  const request = await getRequest(alert.requestId);
  const chat = await getChat(request.chatId);

  const message = formatAlertMessage(alert, request, chat);

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.url('Открыть чат', `https://t.me/${chat.telegramChatId}`),
      Markup.button.callback('Уведомить', `notify_${alert.id}`)
    ],
    [Markup.button.callback('Закрыть', `resolve_${alert.id}`)]
  ]);

  await bot.telegram.sendMessage(
    alert.managerTelegramId,
    message,
    { parse_mode: 'HTML', ...keyboard }
  );
}
```

## Testing

### Unit Tests

```bash
cd backend
pnpm test

# С coverage
pnpm test:coverage

# Конкретный файл
pnpm test src/services/sla/working-hours.test.ts
```

### Integration Tests

```bash
# Start test database
docker compose -f docker-compose.test.yml up -d

# Run integration tests
pnpm test:integration
```

### Manual Testing

1. **Message Classification**:
   ```bash
   curl -X POST http://localhost:3001/trpc/sla.classifyMessage \
     -H "Content-Type: application/json" \
     -d '{"messageText": "Где мой счёт?"}'
   ```

2. **Create Test Request**:
   ```bash
   curl -X POST http://localhost:3001/trpc/sla.createRequest \
     -H "Content-Type: application/json" \
     -d '{"chatId": "123", "messageId": "456", "messageText": "Тестовый запрос"}'
   ```

## Deployment

### Docker Compose

```bash
# Build
docker compose build

# Deploy
docker compose up -d

# Logs
docker compose logs -f backend
```

### Health Checks

```bash
# Backend health
curl http://localhost:3001/health

# Redis
redis-cli ping

# Database
psql $DATABASE_URL -c "SELECT 1"
```

## Troubleshooting

### Common Issues

1. **Bot не получает сообщения**
   ```bash
   # Проверить webhook
   curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"

   # Установить webhook
   curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=https://your-domain.com/webhook"
   ```

2. **SLA таймер не срабатывает**
   ```bash
   # Проверить очередь BullMQ
   redis-cli KEYS "bull:sla-timers:*"

   # Проверить delayed jobs
   redis-cli ZRANGE "bull:sla-timers:delayed" 0 -1
   ```

3. **AI классификация медленная**
   - Проверить OPENROUTER_API_KEY
   - Проверить rate limits
   - Включить keyword fallback

4. **Алерты не доставляются**
   - Проверить manager Telegram ID в настройках
   - Проверить что бот может писать менеджеру (нужен /start)

## Next Steps

После завершения настройки:

1. Запустить `/speckit.tasks` для генерации задач
2. Начать реализацию User Story 1 (Request Tracking)
3. Тестировать на dev окружении
4. Deploy на staging

## Related Documentation

- [spec.md](./spec.md) - Feature specification
- [plan.md](./plan.md) - Implementation plan
- [research.md](./research.md) - Research findings
- [data-model.md](./data-model.md) - Database schema
- [contracts/](./contracts/) - tRPC API contracts
