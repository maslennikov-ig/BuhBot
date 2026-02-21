# Plan: Доработка issue #185 — оставшиеся 2 момента

## Context

GitHub issue [#185](https://github.com/maslennikov-ig/BuhBot/issues/185) описывает 5 проблем с отображением сообщений в Web UI. Три основных (RC1, RC2, RC3) и два вторичных (S1, S2) исправлены в коммите `56aa3ba`, но с недоработками:

1. **RC3**: Миграция записей при Group→Supergroup использует `Promise.all` вместо `prisma.$transaction` — нет атомарности, при сбое данные могут оказаться частично мигрированы.
2. **S1**: `chats.list` не фильтрует disabled/migrated чаты — пользователь видит их в списке без объяснения.

## Task 1: Обернуть миграцию RC3 в `$transaction`

**Файл:** `backend/src/bot/handlers/chat-event.handler.ts` (строки 173-276)

**Что сделать:**
- Заменить текущую конструкцию (upsert нового чата → `Promise.all` updateMany → update старого чата) на единый `prisma.$transaction([...])`.
- Все 8 операций (upsert + 6 updateMany + update старого чата) должны быть внутри транзакции.
- Убрать внутренний try/catch для миграции записей (транзакция сама откатится при ошибке).
- Логирование результатов переместить после успешной транзакции.

**Текущий код (упрощённо):**
```typescript
// Строки 173-204: upsert нового чата (ВНЕ транзакции)
await prisma.chat.upsert({ where: { id: BigInt(newChatId) }, ... });

// Строки 207-266: try { Promise.all(6 updateMany) } catch { log }
// Строки 268-276: update старого чата (ВНЕ транзакции)
```

**Целевой код:**
```typescript
const oldId = BigInt(oldChatId);
const newId = BigInt(newChatId);

const results = await prisma.$transaction([
  prisma.chat.upsert({ where: { id: newId }, create: {...}, update: {...} }),
  prisma.chatMessage.updateMany({ where: { chatId: oldId }, data: { chatId: newId } }),
  prisma.clientRequest.updateMany({ where: { chatId: oldId }, data: { chatId: newId } }),
  prisma.workingSchedule.updateMany({ where: { chatId: oldId }, data: { chatId: newId } }),
  prisma.feedbackResponse.updateMany({ where: { chatId: oldId }, data: { chatId: newId } }),
  prisma.surveyDelivery.updateMany({ where: { chatId: oldId }, data: { chatId: newId } }),
  prisma.chatHoliday.updateMany({ where: { chatId: oldId }, data: { chatId: newId } }),
  prisma.chat.update({
    where: { id: oldId },
    data: { monitoringEnabled: false, slaEnabled: false, title: `[MIGRATED] ${oldChat.title || ''}` },
  }),
]);

logger.info('Migration completed atomically', { ... });
```

## Task 2: Добавить фильтрацию disabled/migrated чатов в `chats.list`

**Файл:** `backend/src/api/trpc/routers/chats.ts` (строки 46-135)

**Что сделать:**
- Добавить параметр `includeDisabled: z.boolean().default(false)` в input schema (строка 50).
- Если `includeDisabled === false` (по умолчанию), добавить `where.monitoringEnabled = true` (после строки 88).
- Это скроет `[MIGRATED]` и отключённые чаты из списка по умолчанию, но позволит админу увидеть их через фильтр.

**Изменения:**
```typescript
// Input schema — добавить:
includeDisabled: z.boolean().default(false),

// Query — после observer filter (строка 88):
if (!input.includeDisabled) {
  where.monitoringEnabled = true;
}
```

## Verification

1. `npx tsc --noEmit` — type-check
2. `npm run build` — build
3. Ручная проверка: `chats.list` без `includeDisabled` не возвращает migrated чаты; с `includeDisabled: true` — возвращает.

## Post-completion

- Оставить комментарий в issue #185 о завершённых доработках
- Закрыть issue #185
