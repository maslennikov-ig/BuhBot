# Research: SLA Monitoring System

**Branch**: `002-sla-monitoring`
**Date**: 2025-11-22
**Status**: Completed

## R1: BullMQ Patterns для отложенных задач с рабочим временем

### Decision

Использовать комбинацию delayed jobs + job schedulers с динамическим расчётом delay.

### Rationale

BullMQ поддерживает:

1. **Delayed Jobs** (`delay` option) - задержка в миллисекундах
2. **Job Schedulers** (`upsertJobScheduler`) - cron-like повторение
3. **Dynamic Rescheduling** (`moveToDelayed`) - перенос во время обработки

Для SLA таймера оптимально:

- При получении сообщения: вычислить delay до breach time (с учётом рабочих часов)
- Если сообщение вне рабочего времени: отложить до начала рабочего дня
- При ответе бухгалтера: удалить job из очереди

### Implementation Pattern

```typescript
// При создании SLA таймера
const delayMs = calculateWorkingHoursDelay(receivedAt, slaThresholdMinutes, workingSchedule);
await slaQueue.add('sla-timer', { requestId }, { delay: delayMs, jobId: `sla-${requestId}` });

// При ответе бухгалтера - удаление job
await slaQueue.remove(`sla-${requestId}`);

// Эскалация каждые 30 минут (max 5 раз)
await alertQueue.add(
  'escalation',
  { alertId, count: 1 },
  {
    delay: 30 * 60 * 1000,
    attempts: 5,
    backoff: { type: 'fixed', delay: 30 * 60 * 1000 },
  }
);
```

### Alternatives Considered

- **Cron jobs**: Отвергнуто - требует polling, менее эффективно
- **setTimeout in process**: Отвергнуто - не выживает рестарт
- **Database-based scheduler**: Отвергнуто - BullMQ уже в стеке

---

## R2: OpenRouter API - Rate Limits, Pricing, Fallback

### Decision

Использовать OpenRouter API с fallback на keyword-based классификацию.

### Rationale

OpenRouter предоставляет:

- Доступ к множеству моделей (GPT-4 Turbo, Claude 3.5, Russian LLMs)
- Credit-based система с гибким ценообразованием
- Rate limits зависят от модели и плана

### Rate Limits

- Стандартные лимиты: ~60 requests/min для большинства моделей
- DDoS protection включена
- При превышении возвращается 429 Too Many Requests

### Pricing Strategy

Для минимизации затрат (<0.50 RUB/сообщение):

- Использовать дешёвые модели для классификации (GPT-3.5 Turbo, Claude Instant)
- Кешировать результаты для идентичных сообщений
- Batch requests где возможно

### Fallback Strategy

```typescript
async function classifyMessage(text: string): Promise<SpamFilterResult> {
  // 1. Check cache
  const cached = await getFromCache(hashMessage(text));
  if (cached) return cached;

  // 2. Try OpenRouter
  try {
    const result = await openRouterClassify(text);
    if (result.confidence >= 0.7) {
      await setCache(hashMessage(text), result);
      return result;
    }
  } catch (error) {
    if (error.status === 429) {
      // Rate limited - use fallback
    }
  }

  // 3. Fallback to keywords
  return keywordClassify(text);
}
```

### Alternatives Considered

- **OpenAI Direct**: Отвергнуто - OpenRouter даёт больше гибкости по моделям
- **Local LLM**: Отвергнуто - требует GPU, сложность деплоя
- **Only Keywords**: Отвергнуто - недостаточная точность

---

## R3: Telegram Inline Buttons для алертов менеджеру

### Decision

Использовать Telegraf `Markup.inlineKeyboard` с callback actions.

### Rationale

Telegraf предоставляет простой API для:

- Создания inline keyboards с кнопками
- Обработки callback queries через `bot.action()`
- Pattern matching для динамических callback data

### Implementation Pattern

```typescript
import { Markup } from 'telegraf';

// Отправка алерта с кнопками
async function sendSlaAlert(managerId: string, alert: SlaAlert) {
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.url('Открыть чат', `tg://resolve?domain=${chatUsername}`),
      Markup.button.callback('Уведомить бухгалтера', `notify_${alert.requestId}`),
    ],
    [Markup.button.callback('Отметить решённым', `resolve_${alert.id}`)],
  ]);

  await bot.telegram.sendMessage(managerId, formatAlertMessage(alert), {
    parse_mode: 'HTML',
    ...keyboard,
  });
}

// Обработчики кнопок
bot.action(/^notify_(.+)$/, async (ctx) => {
  const requestId = ctx.match[1];
  await notifyAccountant(requestId);
  await ctx.answerCbQuery('Бухгалтер уведомлён');
  await ctx.editMessageReplyMarkup(undefined); // Убрать кнопки
});

bot.action(/^resolve_(.+)$/, async (ctx) => {
  const alertId = ctx.match[1];
  await resolveAlert(alertId, ctx.from.id);
  await ctx.answerCbQuery('Алерт закрыт');
  await ctx.editMessageText('✅ Алерт закрыт');
});
```

### Deep Link Format

```
tg://resolve?domain=chatusername  // Для личных чатов/групп
https://t.me/chatusername         // Web версия
```

### Alternatives Considered

- **Reply Keyboard**: Отвергнуто - не подходит для одноразовых действий
- **Bot Commands**: Отвергнуто - менее удобно для UX

---

## R4: Working Hours Calculation с учётом праздников

### Decision

Реализовать кастомный калькулятор рабочего времени с поддержкой праздников.

### Rationale

Нужно учитывать:

- Рабочие дни (по умолчанию Пн-Пт)
- Рабочие часы (по умолчанию 9:00-18:00 Moscow)
- Российские праздники (федеральные)
- Per-chat override (включая 24/7 режим)

### Implementation Pattern

```typescript
interface WorkingSchedule {
  timezone: string; // "Europe/Moscow"
  workingDays: number[]; // [1,2,3,4,5] = Mon-Fri
  startTime: string; // "09:00"
  endTime: string; // "18:00"
  holidays: Date[]; // Праздничные дни
  is24x7: boolean; // 24/7 режим
}

function calculateWorkingMinutes(start: Date, end: Date, schedule: WorkingSchedule): number {
  if (schedule.is24x7) {
    return differenceInMinutes(end, start);
  }

  let totalMinutes = 0;
  let current = start;

  while (current < end) {
    if (isWorkingTime(current, schedule)) {
      totalMinutes++;
    }
    current = addMinutes(current, 1);
  }

  return totalMinutes;
}

function isWorkingTime(date: Date, schedule: WorkingSchedule): boolean {
  const zonedDate = toZonedTime(date, schedule.timezone);

  // Check holiday
  if (schedule.holidays.some((h) => isSameDay(h, zonedDate))) {
    return false;
  }

  // Check working day
  const dayOfWeek = getDay(zonedDate); // 0=Sun, 1=Mon, ...
  if (!schedule.workingDays.includes(dayOfWeek === 0 ? 7 : dayOfWeek)) {
    return false;
  }

  // Check working hours
  const time = format(zonedDate, 'HH:mm');
  return time >= schedule.startTime && time < schedule.endTime;
}

function getNextWorkingTime(from: Date, schedule: WorkingSchedule): Date {
  let current = from;
  while (!isWorkingTime(current, schedule)) {
    current = addMinutes(current, 1);
  }
  return current;
}
```

### Russian Federal Holidays (2025)

```typescript
const RUSSIAN_HOLIDAYS_2025 = [
  // Новогодние праздники
  '2025-01-01',
  '2025-01-02',
  '2025-01-03',
  '2025-01-04',
  '2025-01-05',
  '2025-01-06',
  '2025-01-07',
  '2025-01-08',
  // День защитника Отечества
  '2025-02-23',
  // Международный женский день
  '2025-03-08',
  // Праздник Весны и Труда
  '2025-05-01',
  // День Победы
  '2025-05-09',
  // День России
  '2025-06-12',
  // День народного единства
  '2025-11-04',
];
```

### Edge Cases

- **Сообщение в 17:55 пятницы, ответ в 9:05 понедельника** = 10 минут SLA (5 + 5)
- **Сообщение в выходной** = таймер стартует в следующий рабочий день
- **Праздник посреди недели** = день пропускается

### Libraries

- `date-fns` - манипуляции с датами
- `date-fns-tz` - timezone support

### Alternatives Considered

- **Luxon**: Отвергнуто - date-fns уже используется в проекте
- **External API для праздников**: Отвергнуто - слишком простая логика для внешней зависимости

---

## Дополнительные находки

### Message Classification Categories

Из Phase-1-Technical-Prompt.md:

**REQUEST (запрос)** - стартует SLA:

- Вопросы: "Где мой счёт?", "Когда будет готов?"
- Документы: "Нужна справка 2-НДФЛ"
- Проблемы: "Не могу оплатить"

**SPAM** - игнорируется:

- Благодарности: "Спасибо", "Ок", "Хорошо"
- Emoji: "👍"
- Подтверждения: "Договорились"

**GRATITUDE** - отдельная категория для аналитики

**CLARIFICATION** - уточнение к предыдущему запросу

### Performance Requirements (из spec)

- SLA таймер стартует < 5 секунд
- AI классификация < 2 секунды
- Алерт отправляется < 60 секунд после breach

### Data Retention

- 3 года хранения (из clarifications)

---

## Summary

| Research                    | Status      | Decision                                         |
| --------------------------- | ----------- | ------------------------------------------------ |
| R1: BullMQ delayed jobs     | ✅ Complete | Delayed jobs + dynamic delay calculation         |
| R2: OpenRouter API          | ✅ Complete | OpenRouter + keyword fallback + caching          |
| R3: Telegram inline buttons | ✅ Complete | Telegraf Markup.inlineKeyboard + action handlers |
| R4: Working hours           | ✅ Complete | Custom calculator + date-fns + federal holidays  |

**Next Step**: Phase 1 - data-model.md, contracts/, quickstart.md
