# SLA Notification System Overhaul (#210 + tester feedback)

## Context

Тестер Сергей обнаружил критический баг (#210): SLA-уведомления не доставляются при настроенных бухгалтерах. Дополнительно выявил системные проблемы:

1. **Сломан базовый функционал**: `accountantTelegramIds` игнорируется в цепочке нотификаций
2. **Путаница ролей**: в системе admin/manager/observer, но нет роли "бухгалтер" — непонятно кто есть кто
3. **Нет лимитов**: можно добавить 2000 @username без проверки
4. **Реактивная модель**: не ответил → штраф. Должна быть: напомнили → забил → эскалация до менеджера
5. **Нет верификации**: добавленный @username не подтверждает согласие на участие

## Architecture Overview

```
ТЕКУЩАЯ МОДЕЛЬ (сломана):
  SLA breach → getManagerIds() → managerTelegramIds > globalManagerIds → отправка
  (accountantTelegramIds игнорируется)

ЦЕЛЕВАЯ МОДЕЛЬ (двухуровневая):
  80% SLA → WARNING → бухгалтерам ("ответьте клиенту!")
  100% SLA → BREACH Level 1 → бухгалтерам ("SLA нарушен")
  +30 мин → ESCALATION Level 2+ → менеджерам + бухгалтерам ("бухгалтер не ответил")
```

---

## Phase 1: Core Bug Fix + DRY (уже на ветке)

> Ветка `fix/sla-notification-managers` содержит рабочую реализацию. Нужен только DRY-рефакторинг.

### Task 1.1: DRY sla-timer.worker.ts
**Исполнитель**: сам
**Файл**: `backend/src/queues/sla-timer.worker.ts`
Заменить inline fallback (строки 155-175) на `getManagerIds()` из config.service.

### Task 1.2: DRY alert.service.ts
**Исполнитель**: сам
**Файл**: `backend/src/services/alerts/alert.service.ts`
Заменить `getManagerIdsForChat()` (строки 496-527) — делегировать `getManagerIds()` из config.service. Паттерн как в escalation.service.ts.

### Task 1.3: Verify & commit Phase 1
**Исполнитель**: сам
Type-check + build + tests → commit: `fix(sla): add accountant fallback to notification chain (#210)`

**Закрывает**: #210, #211, #212, #213, #214

---

## Phase 2: Input Validation & UX Clarity

### Task 2.1: Лимит массивов accountantUsernames и managerTelegramIds
**Исполнитель**: сам
**Файл**: `backend/src/api/trpc/routers/chats.ts` (строка 331-346)

```typescript
// Было:
accountantUsernames: z.array(z.string()...).default([])
managerTelegramIds: z.array(z.string()...).optional()

// Станет:
accountantUsernames: z.array(z.string()...).max(20, 'Максимум 20 бухгалтеров').default([])
managerTelegramIds: z.array(z.string()...).max(20, 'Максимум 20 менеджеров').optional()
```

### Task 2.2: Строгая валидация @username — только зарегистрированные пользователи
**Исполнитель**: sla-backend-specialist
**Файлы**: `backend/src/api/trpc/routers/chats.ts`

Текущее поведение: неизвестные @username сохраняются + warning.
Новое поведение: неизвестные @username → error (не сохраняются). Причина: без telegramId уведомления невозможны.

```typescript
// Строки 504-508 в chats.ts — изменить с warning на error:
if (unverified.length > 0) {
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: `Пользователи не найдены в системе: ${unverified.map(u => `@${u}`).join(', ')}. ` +
      'Они должны быть зарегистрированы в панели администратора и привязать Telegram.',
  });
}
```

Также: проверять что у найденного User есть `telegramId` (не null). Без telegramId бот не может отправить PM.

### Task 2.3: Улучшение UI-лейблов для ясности ролей
**Исполнитель**: сам
**Файлы**: `frontend/src/components/chats/ChatSettingsForm.tsx`

Изменить лейблы:
- "Бухгалтеры (@username)" → "Ответственные бухгалтеры (@username)" + description: "Получают первичные SLA-уведомления. Если не ответят — эскалация до менеджеров."
- "Менеджеры для SLA уведомлений (Telegram ID)" → "Менеджеры эскалации (Telegram ID)" + description: "Получают уведомления если бухгалтеры не ответили. Если не заданы — используются глобальные менеджеры."

---

## Phase 3: SLA Warning (превентивная модель)

> Сейчас: не ответил → штраф. Нужно: предупредили → не ответил → штраф.

### Task 3.1: Prisma migration — slaWarningPercent
**Исполнитель**: sla-backend-specialist
**Файл**: `backend/prisma/schema.prisma` (модель GlobalSettings)

```prisma
slaWarningPercent Int @default(80) @map("sla_warning_percent")
```

Одна колонка, безопасная миграция с default. Значение 0 = warnings отключены.

### Task 3.2: config.service — slaWarningPercent
**Исполнитель**: sla-backend-specialist
**Файл**: `backend/src/config/config.service.ts`
- Добавить `slaWarningPercent: number` в `CachedGlobalSettings` и `DEFAULTS` (80)
- Маппинг в `getGlobalSettings()`
- Новый getter: `getSlaWarningPercent(): Promise<number>`

### Task 3.3: setup.ts — расширить SlaTimerJobData + scheduling helper
**Исполнитель**: sla-backend-specialist
**Файл**: `backend/src/queues/setup.ts`

```typescript
// Расширить интерфейс:
export interface SlaTimerJobData {
  requestId: string;
  chatId: string;
  threshold: number;
  type?: 'warning' | 'breach'; // NEW, default 'breach' для обратной совместимости
}

// Новые функции:
export async function scheduleSlaWarning(requestId, chatId, thresholdMinutes, delayMs) {
  // jobId = `sla-warning-${requestId}` (отдельный от breach)
}
export async function cancelSlaWarning(requestId): Promise<boolean> {
  // Отмена по jobId `sla-warning-${requestId}`
}
```

### Task 3.4: timer.service — планирование warning + breach
**Исполнитель**: sla-backend-specialist
**Файл**: `backend/src/services/sla/timer.service.ts`

В `startSlaTimer()` (строка 232) после `scheduleSlaCheck()`:
```typescript
const warningPercent = (await getGlobalSettings()).slaWarningPercent;
if (warningPercent > 0 && warningPercent < 100) {
  const warningThreshold = Math.floor(thresholdMinutes * warningPercent / 100);
  const warningDelayMs = calculateDelayUntilBreach(request.receivedAt, warningThreshold, schedule);
  if (warningDelayMs > 0) {
    await scheduleSlaWarning(requestId, chatId, thresholdMinutes, warningDelayMs);
  }
}
```

В `stopSlaTimer()` (строка 321) добавить `cancelSlaWarning(requestId)`.

### Task 3.5: sla-timer.worker — обработка warning jobs
**Исполнитель**: sla-backend-specialist
**Файл**: `backend/src/queues/sla-timer.worker.ts`

В начале `processSlaTimer()`:
```typescript
const jobType = job.data.type ?? 'breach';

if (jobType === 'warning') {
  // 1. Проверить что request ещё pending
  // 2. НЕ менять статус на 'escalated', НЕ ставить slaBreached=true
  // 3. Создать SlaAlert с alertType='warning', escalationLevel=0
  // 4. Получатели: getRecipientsByLevel(..., 1) = бухгалтеры
  // 5. Отправить через queueAlert()
  return;
}
// ... существующая логика breach без изменений
```

### Task 3.6: format.service — formatWarningMessage
**Исполнитель**: sla-backend-specialist
**Файл**: `backend/src/services/alerts/format.service.ts`

Новая функция:
```typescript
export function formatWarningMessage(data: {
  clientUsername: string | null;
  messagePreview: string;
  minutesElapsed: number;
  threshold: number;
  remainingMinutes: number;
  chatTitle: string | null;
}): string
// "⚠️ ПРЕДУПРЕЖДЕНИЕ: Приближается порог SLA
//  Клиент @user в чате "Название" ждёт ответа 48 мин.
//  Осталось: 12 мин из 60 мин. Пожалуйста, ответьте!"
```

### Task 3.7: Settings UI — slaWarningPercent
**Исполнитель**: сам
**Файлы**:
- `backend/src/api/trpc/routers/settings.ts` — добавить поле в input/output
- `frontend/src/components/settings/SlaManagerSettingsForm.tsx` — input для %

---

## Phase 4: Two-Tier Escalation

> Level 1 → бухгалтерам. Level 2+ → менеджерам + бухгалтерам.

### Task 4.1: config.service — getRecipientsByLevel()
**Исполнитель**: sla-backend-specialist
**Файл**: `backend/src/config/config.service.ts`

```typescript
/**
 * Two-tier recipient resolution.
 * Level 1: accountants (falls back to managers if no accountants)
 * Level 2+: managers + accountants (both)
 */
export async function getRecipientsByLevel(
  chatManagerIds?: string[] | null,
  accountantTelegramIds?: bigint[] | null,
  escalationLevel: number = 1
): Promise<{ recipients: string[]; tier: 'accountant' | 'manager' | 'both' | 'fallback' }>
```

Логика:
- Level 1 + есть бухгалтеры → tier='accountant', recipients=[accountants]
- Level 1 + нет бухгалтеров → tier='fallback', recipients=[managers or global]
- Level 2+ → tier='both', recipients=dedupe([managers/global, accountants])

**Важно**: Сохранить `getManagerIds()` с пометкой `@deprecated` для feedback/alert.service.ts (низкие оценки → всегда одноуровневый алерт).

### Task 4.2: sla-timer.worker — использовать getRecipientsByLevel
**Исполнитель**: sla-backend-specialist
**Файл**: `backend/src/queues/sla-timer.worker.ts`

Заменить `getManagerIds()` на `getRecipientsByLevel()` для breach-алертов (level=1).

### Task 4.3: escalation.service — level-aware recipients
**Исполнитель**: sla-backend-specialist
**Файл**: `backend/src/services/alerts/escalation.service.ts`

Обновить `getManagerIdsForChat()` → `getRecipientsForChat(chatId, escalationLevel)`:
```typescript
async function getRecipientsForChat(chatId: bigint, level: number) {
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    select: { managerTelegramIds: true, accountantTelegramIds: true },
  });
  return getRecipientsByLevel(chat?.managerTelegramIds, chat?.accountantTelegramIds, level);
}
```

### Task 4.4: alert.service — передавать escalationLevel
**Исполнитель**: sla-backend-specialist
**Файл**: `backend/src/services/alerts/alert.service.ts`

В `createAlert()`: передать `escalationLevel` в `getManagerIdsForChat()`.

### Task 4.5: format.service — контекст эскалации в сообщении
**Исполнитель**: сам
**Файл**: `backend/src/services/alerts/format.service.ts`

При `escalationLevel >= 2` добавить строку:
```
⬆️ Эскалация: бухгалтеры не ответили вовремя
```

---

## Phase 5: User Verification (облегчённая версия)

> Полная верификация через бота — отдельный epic. Сейчас: базовые проверки.

### Task 5.1: Проверка telegramId при назначении
**Исполнитель**: sla-backend-specialist
**Файл**: `backend/src/api/trpc/routers/chats.ts`

При добавлении @username проверять:
1. User с таким `telegramUsername` существует в таблице `users` → иначе ERROR
2. У User есть `telegramId` (не null) → иначе WARNING: "Пользователь @username не привязал Telegram. Уведомления не будут доставлены."
3. Логировать: кто когда кого добавил (audit trail)

### Task 5.2: Frontend — показывать статус верификации
**Исполнитель**: сам
**Файл**: `frontend/src/components/chats/AccountantUsernamesInput.tsx`

Визуальная индикация:
- Зелёный чекмарк: username найден + telegramId привязан
- Жёлтый warning: username найден, но telegramId не привязан
- Красный X: username не найден в системе (если Task 2.2 не блокирует submit)

---

## Dependency Graph

```
Phase 1 (core fix + DRY) ────────┐
  Tasks 1.1, 1.2, 1.3            │
                                  ├──→ Phase 2 (validation + UX)
                                  │      Tasks 2.1, 2.2, 2.3
                                  │
                                  ├──→ Phase 3 (SLA warning)
                                  │      Tasks 3.1→3.2→3.3→3.4→3.5→3.6→3.7
                                  │                                    │
                                  └──→ Phase 4 (two-tier escalation) ←─┘
                                         Tasks 4.1→4.2→4.3→4.4→4.5
                                                        │
                                  Phase 5 (verification) ←─ (after Phase 2.2)
                                    Tasks 5.1→5.2
```

**Параллельно**: Phase 2 || Phase 3 (после Phase 1)
**Последовательно**: Phase 4 после Phase 3 (общие файлы: config.service, sla-timer.worker)
**Phase 5**: после Phase 2.2 (зависит от строгой валидации username)

---

## Agent Assignment

| Task | Исполнитель | Тип |
|------|-------------|-----|
| 1.1, 1.2, 1.3 | Сам (main) | Простой DRY-рефакторинг |
| 2.1 | Сам (main) | Однострочное изменение (.max) |
| 2.2 | sla-backend-specialist | Бизнес-логика валидации |
| 2.3 | Сам (main) | Правка лейблов UI |
| 3.1-3.6 | sla-backend-specialist | Полная реализация warning system |
| 3.7 | Сам (main) | Settings UI поле |
| 4.1-4.4 | sla-backend-specialist | Двухуровневая эскалация |
| 4.5 | Сам (main) | Правка format строки |
| 5.1 | sla-backend-specialist | Валидация telegramId |
| 5.2 | Сам (main) | UI индикаторы верификации |

---

## Critical Files (all phases)

| Файл | Фазы |
|------|-------|
| `backend/src/config/config.service.ts` | 1, 3, 4 |
| `backend/src/queues/sla-timer.worker.ts` | 1, 3, 4 |
| `backend/src/queues/setup.ts` | 3 |
| `backend/src/services/sla/timer.service.ts` | 3 |
| `backend/src/services/alerts/alert.service.ts` | 1, 4 |
| `backend/src/services/alerts/escalation.service.ts` | 4 |
| `backend/src/services/alerts/format.service.ts` | 3, 4 |
| `backend/src/services/feedback/alert.service.ts` | (без изменений, deprecated getManagerIds) |
| `backend/src/api/trpc/routers/chats.ts` | 2 |
| `backend/src/api/trpc/routers/settings.ts` | 3 |
| `backend/prisma/schema.prisma` | 3 |
| `frontend/.../ChatSettingsForm.tsx` | 2 |
| `frontend/.../AccountantUsernamesInput.tsx` | 5 |
| `frontend/.../SlaManagerSettingsForm.tsx` | 3 |

---

## Verification

### Per Phase
- **Phase 1**: `npm run type-check && npm run build && npm test` → commit
- **Phase 2**: Попробовать добавить 21 username → должен быть error. Добавить несуществующий → error.
- **Phase 3**: Создать тест-запрос, проверить что warning приходит на 80%, breach на 100%
- **Phase 4**: Проверить что Level 1 → бухгалтерам, Level 2 → менеджерам + бухгалтерам
- **Phase 5**: Попробовать добавить @username без telegramId → warning/error

### End-to-End
1. Настроить чат: 2 бухгалтера (@username), 1 менеджер (Telegram ID), SLA=10 мин
2. Отправить клиентское сообщение
3. На 8-й минуте: WARNING бухгалтерам (проверить Telegram PM)
4. На 10-й минуте: BREACH бухгалтерам
5. На 40-й минуте: ESCALATION менеджеру + бухгалтерам
6. Ответить от бухгалтера → все таймеры отменяются

---

## Backward Compatibility

| Сценарий | Текущее | Новое |
|----------|---------|-------|
| Чат без бухгалтеров/менеджеров (только global) | Все уровни → global | Без изменений |
| Чат с бухгалтерами, без менеджеров | Сейчас не работает (#210) | Warning+L1 → бухгалтерам; L2+ → global + бухгалтерам |
| Чат с менеджерами, без бухгалтеров | Все уровни → менеджерам | L1 → менеджерам (fallback); L2+ → менеджерам |
| Чат с бухгалтерами И менеджерами | Все уровни → менеджерам (override) | L1 → бухгалтерам; L2+ → менеджерам + бухгалтерам |

Ключевое изменение: при наличии бухгалтеров, первичные уведомления идут ИМ, эскалация — менеджерам. Это то, что просил тестер.

## Prisma Migration

Одна безопасная миграция:
```sql
ALTER TABLE "public"."global_settings"
ADD COLUMN "sla_warning_percent" INTEGER NOT NULL DEFAULT 80;
```
