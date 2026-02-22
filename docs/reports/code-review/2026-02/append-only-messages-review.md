# Code Review: Append-Only Message Store (buh-kwi)

**PR**: #197
**Date**: 2026-02-22
**Reviewer**: Claude Code (automated)
**Files reviewed**: 11
**Context7**: Prisma docs (/prisma/docs), Telegraf (/telegraf/telegraf)

---

## Summary

В целом реализация append-only хранилища сообщений выполнена грамотно: правильно используются
`createMany + skipDuplicates`, DISTINCT ON в сыром SQL безопасен (параметризован через `Prisma.sql`),
модель данных продуманна, индексы покрывают ключевые запросы. Тем не менее выявлен ряд
проблем — от критического нарушения append-only контракта до race condition в edit.handler и
потенциальных N+1 запросов в chat-event мигратоире.

**Оценка**: 3.5 / 5. Архитектура правильная, реализация местами требует доработки.

---

## Critical Issues (P0)

### P0-1: Нарушение append-only контракта в response.handler.ts

**Файл**: `backend/src/bot/handlers/response.handler.ts:376–385`

**Описание**: `updateMany` мутирует существующую строку `chatMessage`, присваивая
`resolvedRequestId`. Это прямо нарушает append-only архитектуру: строка с `editVersion=0`
изменяется после создания.

```typescript
// ТЕКУЩИЙ КОД — нарушает append-only
await prisma.chatMessage.updateMany({
  where: {
    chatId: BigInt(chatId),
    messageId: BigInt(messageId),
    editVersion: 0,
  },
  data: {
    resolvedRequestId: requestToResolve.id,
  },
});
```

**Предлагаемое решение**: Убрать `resolvedRequestId` из `ChatMessage` и хранить эту связь
исключительно в `ClientRequest.responseMessageId` (внешний ключ в обратную сторону).
Если двунаправленная связь необходима — допустимо оставить поле как исключение из append-only
с явной пометкой в схеме и комментарием в коде, объясняющим почему это поле — единственный
допустимый мутируемый столбец. Тогда хотя бы добавить `@db.Uuid` constraint-check в schema
и запись в ADR.

```typescript
// ВАРИАНТ 1: убрать updateMany, читать связь через ClientRequest
// В ClientRequest уже есть responseMessageId / resolutionMessageId

// ВАРИАНТ 2: явное исключение с документацией
// В schema.prisma:
// resolvedRequestId String? @map("resolved_request_id") @db.Uuid
// /// EXCEPTION: this is the only mutable column in an otherwise append-only model.
// /// Updated once when accountant resolves a request; never changed afterwards.
```

**Риск**: Если доверять данным как неизменяемым (аудит, replay), мутация нарушает эту гарантию.
При двойном срабатывании response handler (retry, Telegram дубликат) `resolvedRequestId`
может быть перезаписан другим запросом.

---

### P0-2: Race condition в edit.handler.ts — потеря версий при параллельных правках

**Файл**: `backend/src/bot/handlers/edit.handler.ts:27–76`

**Описание**: `findFirst` и `createMany` — две отдельные операции без транзакции.
При параллельных правках одного сообщения (Telegram может слать дубликаты update'ов)
оба обработчика прочитают `latestVersion.editVersion = N` и оба вставят версию `N+1`.
Вторая вставка молча проигнорируется (`skipDuplicates: true`), но её текст будет потерян.

```typescript
// ТЕКУЩИЙ КОД — non-atomic read-modify-insert
const latestVersion = await prisma.chatMessage.findFirst({
  where: { chatId: BigInt(chatId), messageId: BigInt(messageId) },
  orderBy: { editVersion: 'desc' },
  ...
});
const nextVersion = (latestVersion?.editVersion ?? -1) + 1;

await prisma.chatMessage.createMany({
  data: [{ ..., editVersion: nextVersion }],
  skipDuplicates: true, // silently swallows the race loser
});
```

**Предлагаемое решение**: Использовать `$executeRaw` с `INSERT ... SELECT` чтобы вычислить
`MAX(edit_version) + 1` атомарно в одном SQL-запросе:

```typescript
await prisma.$executeRaw`
  INSERT INTO "public"."chat_messages" (
    chat_id, message_id, telegram_user_id, username, first_name, last_name,
    message_text, is_accountant, reply_to_message_id,
    telegram_date, edit_version, message_type
  )
  SELECT
    ${BigInt(chatId)},
    ${BigInt(messageId)},
    COALESCE(
      (SELECT telegram_user_id FROM "public"."chat_messages"
       WHERE chat_id = ${BigInt(chatId)} AND message_id = ${BigInt(messageId)}
       ORDER BY edit_version DESC LIMIT 1),
      ${BigInt(ctx.from?.id ?? 0)}
    ),
    ${ctx.from?.username ?? null},
    ${ctx.from?.first_name ?? null},
    ${ctx.from?.last_name ?? null},
    ${newText},
    COALESCE(
      (SELECT is_accountant FROM "public"."chat_messages"
       WHERE chat_id = ${BigInt(chatId)} AND message_id = ${BigInt(messageId)}
       ORDER BY edit_version DESC LIMIT 1),
      false
    ),
    NULL,
    ${new Date(editDate * 1000)},
    COALESCE(
      (SELECT MAX(edit_version) + 1 FROM "public"."chat_messages"
       WHERE chat_id = ${BigInt(chatId)} AND message_id = ${BigInt(messageId)}),
      0
    ),
    'text'
  ON CONFLICT (chat_id, message_id, edit_version) DO NOTHING
`;
```

Альтернатива проще: использовать Prisma-транзакцию с `SERIALIZABLE` уровнем изоляции,
но это снизит пропускную способность при частых правках.

**Риск**: Правка сообщения может потеряться при параллельной доставке. В продакшене
Telegram иногда повторно доставляет одно и то же `edited_message` при нестабильном webhook.

---

## High Priority (P1)

### P1-1: chatId=null не валидируется в file.handler.ts (потенциальный runtime crash)

**Файл**: `backend/src/bot/handlers/file.handler.ts:108, 134–135, 192, 229–230`

**Описание**: `chatId` получается как `ctx.chat?.id` (может быть `undefined`), но затем
используется с non-null assertion `chatId!`. Если `ctx.chat` по какой-то причине отсутствует
(приватное сообщение боту с документом), `BigInt(undefined!)` бросит исключение.

```typescript
const chatId = ctx.chat?.id; // может быть undefined

// Позже без guard:
chatId: BigInt(chatId!),        // строка 135
messageId: BigInt(ctx.message.message_id), // OK
```

**Предлагаемое решение**: Добавить явную guard-проверку сразу после получения `chatId`:

```typescript
export function registerFileHandler(): void {
  bot.on(message('document'), async (ctx: BotContext) => {
    if (!ctx.message || !('document' in ctx.message)) return;
    if (!ctx.chat || !['group', 'supergroup'].includes(ctx.chat.type)) return; // добавить

    const chatId = ctx.chat.id; // теперь number, не undefined
    // ...
  });
}
```

Аналогично для блока `message('photo')`.

**Риск**: Краш обработчика при получении документа в личном чате с ботом. Хотя Telegraf
фильтрует это на уровне подписки на `message('document')`, явная group-проверка
консистентна с остальными хэндлерами и документирует намерение.

---

### P1-2: Pagination cursor содержит потенциальную ловушку дублей при совпадении telegramDate

**Файл**: `backend/src/api/trpc/routers/messages.ts:154–165, 169`

**Описание**: Cursor реализован как `id` сообщения → резолвится в `telegramDate` → затем
`AND telegram_date < ${cursorDate}`. Если несколько сообщений имеют одинаковый `telegramDate`
(пачка сообщений отправлена одновременно, или `date` у Telegram с точностью до секунды),
часть из них будет пропущена при следующей странице.

```typescript
// Резолвинг cursor ID в telegramDate
const cursorMessage = await ctx.prisma.chatMessage.findUnique({
  where: { id: input.cursor },
  select: { telegramDate: true },
});
// ...
const cursorFragment = cursorDate
  ? Prisma.sql`AND telegram_date < ${cursorDate}`  // строгое <, теряет сообщения с == cursorDate
  : Prisma.empty;
```

Telegram использует Unix timestamp с точностью до секунды (`message.date`), поэтому совпадение
временных меток вполне вероятно при активной переписке.

**Предлагаемое решение**: Использовать составной cursor (telegramDate, id) с `<` по паре:

```sql
AND (telegram_date, id::text) < (${cursorDate}, ${cursorId})
```

Или использовать нативную Prisma cursor-pagination по `id` (UUID, монотонный благодаря
`gen_random_uuid()` в PostgreSQL 13+), добавив `ORDER BY id DESC` в sub-query.

---

### P1-3: safeNumberFromBigInt бросает исключение для крупных Telegram ID

**Файл**: `backend/src/api/trpc/routers/messages.ts:200–209`

**Описание**: `safeNumberFromBigInt` бросает `Error` если `bigint > Number.MAX_SAFE_INTEGER`.
Telegram channel ID и super-group ID могут превышать `2^53 - 1`. Это приведёт к 500-ошибке
для тех чатов, чьи ID выходят за пределы safe range.

```typescript
// bigint.ts:13–18 — бросает ошибку
export function safeNumberFromBigInt(value: bigint): number {
  const num = Number(value);
  if (!Number.isSafeInteger(num)) {
    throw new Error(`BigInt ${value} exceeds safe integer range ...`);
  }
  return num;
}

// messages.ts:200 — вызов без обработки исключения в map
chatId: safeNumberFromBigInt(msg.chat_id),      // может бросить
messageId: safeNumberFromBigInt(msg.message_id), // может бросить
```

Исключение будет не перехвачено на уровне `map()`, и tRPC вернёт `INTERNAL_SERVER_ERROR`.

**Предлагаемое решение A (предпочтительное)**: Изменить tRPC output schema с `z.number()`
на `z.string()` для `chatId`, `messageId`, `telegramUserId` и использовать `bigIntToString()`:

```typescript
// output schema
chatId: z.string(),        // BigInt как строка — безопасно для JS клиента
messageId: z.string(),
telegramUserId: z.string(),

// mapping
chatId: msg.chat_id.toString(),
messageId: msg.message_id.toString(),
telegramUserId: msg.telegram_user_id.toString(),
```

**Предлагаемое решение B**: Добавить try/catch вокруг map с fallback:

```typescript
chatId: (() => {
  try {
    return safeNumberFromBigInt(msg.chat_id);
  } catch {
    return Number.MAX_SAFE_INTEGER; // sentinel, не бросает
  }
})(),
```

---

### P1-4: В-memory rate limiter не масштабируется на несколько инстансов

**Файл**: `backend/src/api/trpc/routers/messages.ts:48–87`

**Описание**: `rateLimitMap` — это `Map` в памяти процесса Node.js. При горизонтальном
масштабировании (несколько worker-процессов или pod'ов) каждый инстанс имеет свой лимит,
и один пользователь может отправить `N * 100` запросов в минуту (где N — количество инстансов).

```typescript
// Комментарий в коде сам признаёт проблему:
// In production, consider using Redis for distributed rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
```

Проект уже использует BullMQ + ioredis. Redis-based rate limiting реализуется в 20 строк.

**Предлагаемое решение**: Использовать `ioredis` с `INCR` + `EXPIRE` или `rate-limiter-flexible`
(npm, 2.6M downloads/week, поддерживает Redis):

```typescript
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redis } from '../../../lib/redis.js'; // уже существует для BullMQ

const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl:messages',
  points: 100,
  duration: 60,
});

// В query handler:
try {
  await rateLimiter.consume(ctx.user.id);
} catch {
  throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: '...' });
}
```

**Риск**: Без distributed rate limiting крупные клиенты смогут перегрузить систему
при горизонтальном масштабировании.

---

### P1-5: Нет input validation в edit.handler.ts

**Файл**: `backend/src/bot/handlers/edit.handler.ts:22–24`

**Описание**: В `message.handler.ts` есть `TelegramMessageSchema` с валидацией длины текста
(max 10000 символов). В `edit.handler.ts` такой валидации нет. Теоретически Telegram
ограничивает длину, но валидация на уровне приложения — часть архитектурного контракта.

```typescript
// message.handler.ts — есть валидация
const TelegramMessageSchema = z.object({
  text: z.string().min(1).max(10000),
  ...
});

// edit.handler.ts — валидации нет
const newText = ctx.editedMessage.text; // строка произвольной длины
```

**Предлагаемое решение**: Переиспользовать или вынести `TelegramMessageSchema` в общий
utility-модуль и применить в обоих хэндлерах:

```typescript
// backend/src/bot/utils/telegram-schemas.ts
export const TelegramMessageSchema = z.object({
  text: z.string().min(1).max(10000),
  username: z.string().max(255).optional().nullable(),
  firstName: z.string().max(255).optional().nullable(),
  lastName: z.string().max(255).optional().nullable(),
});
```

---

## Medium Priority (P2)

### P2-1: Дублирование логики createMany в file.handler.ts

**Файл**: `backend/src/bot/handlers/file.handler.ts:131–158, 228–256`

**Описание**: Блок `prisma.chatMessage.createMany` для `document` и `photo` практически
идентичен (12 полей, те же значения по умолчанию). При добавлении нового поля придётся
обновлять в двух местах.

**Предлагаемое решение**: Вынести в общую helper-функцию:

```typescript
// backend/src/bot/utils/log-media-message.ts
export async function logMediaMessage(params: {
  chatId: number;
  messageId: number;
  from: { id?: number; username?: string; first_name?: string; last_name?: string } | undefined;
  date: number;
  messageType: 'document' | 'photo';
  mediaFileId: string;
  mediaFileName: string;
  caption?: string | null;
  isAccountant: boolean;
}): Promise<void> {
  await prisma.chatMessage.createMany({
    data: [{
      chatId: BigInt(params.chatId),
      messageId: BigInt(params.messageId),
      telegramUserId: BigInt(params.from?.id ?? 0),
      username: params.from?.username ?? null,
      firstName: params.from?.first_name ?? null,
      lastName: params.from?.last_name ?? null,
      messageText: params.caption || `[${params.messageType === 'photo' ? 'Фото' : 'Документ'}: ${params.mediaFileName}]`,
      isAccountant: params.isAccountant,
      telegramDate: new Date(params.date * 1000),
      editVersion: 0,
      messageType: params.messageType,
      mediaFileId: params.mediaFileId,
      mediaFileName: params.mediaFileName,
      caption: params.caption ?? null,
    }],
    skipDuplicates: true,
  });
}
```

---

### P2-2: DISTINCT ON не покрывает фильтр deleted_at для редактированных сообщений

**Файл**: `backend/src/api/trpc/routers/messages.ts:176–187`

**Описание**: Запрос фильтрует `deleted_at IS NULL` до `DISTINCT ON`. Это означает, что
если только оригинальная версия (editVersion=0) soft-deleted, а отредактированная (editVersion=1)
— нет, сообщение всё равно появится. Если же soft-deleted последняя версия (editVersion=1),
а не оригинал — сообщение пропадёт корректно. Логика непоследовательна.

```sql
SELECT DISTINCT ON (chat_id, message_id) *
FROM "public"."chat_messages"
WHERE chat_id = ${BigInt(input.chatId)}
  AND deleted_at IS NULL          -- фильтрует по версии, а не по сообщению
ORDER BY chat_id, message_id, edit_version DESC
```

**Предлагаемое решение**: Soft-delete должен применяться к сообщению в целом, а не к версии.
Добавить вложенный sub-select для исключения message_id, у которых любая версия soft-deleted:

```sql
SELECT * FROM (
  SELECT DISTINCT ON (chat_id, message_id) *
  FROM "public"."chat_messages"
  WHERE chat_id = ${BigInt(input.chatId)}
  ORDER BY chat_id, message_id, edit_version DESC
) sub
WHERE deleted_at IS NULL
  ${cursorFragment}
ORDER BY telegram_date DESC
LIMIT ${input.limit + 1}
```

Либо soft-delete хранить только в отдельной таблице `deleted_messages(chat_id, message_id)`.

---

### P2-3: Polling в ChatMessageThread.tsx не сбрасывается при смене chatId

**Файл**: `frontend/src/components/chats/ChatMessageThread.tsx:36–46`

**Описание**: `refetchInterval: 10_000` активен пока компонент смонтирован. При быстрой
навигации между чатами (componentDidMount → chatId изменился) старый poll продолжит работу
до демонта компонента. tRPC `useInfiniteQuery` с `refetchInterval` делает запросы на старый chatId
если React перерисовывает компонент с новым prop'ом до завершения предыдущего интервала.

**Предлагаемое решение**: Добавить `key={chatId}` на компонент в родителе (unmount/remount
при смене chatId), либо явно сбрасывать query при изменении:

```tsx
// В родительском компоненте:
<ChatMessageThread key={selectedChatId} chatId={selectedChatId} />

// ИЛИ в самом компоненте через useEffect:
const prevChatIdRef = React.useRef(chatId);
React.useEffect(() => {
  if (prevChatIdRef.current !== chatId) {
    prevChatIdRef.current = chatId;
    // tRPC invalidate или remove query
  }
}, [chatId]);
```

---

### P2-4: message.handler.ts — комментарий со step 6 пропущен (шаги идут 5→7)

**Файл**: `backend/src/bot/handlers/message.handler.ts:201–222`

**Описание**: Шаги пронумерованы 1–5, затем сразу 7 (step 6 отсутствует). Это не баг,
но создаёт путаницу при чтении кода.

```typescript
// 5. Check monitoringEnabled AFTER logging ...
// ...
// 7. Check if SLA is enabled AFTER logging message (step 6 пропущен)
```

**Предлагаемое решение**: Перенумеровать шаги последовательно или добавить пропущенный шаг.

---

### P2-5: formatTimestamp в file.handler.ts использует локальное время сервера вместо telegramDate

**Файл**: `backend/src/bot/handlers/file.handler.ts:162–163`

**Описание**: В сообщении-подтверждении пользователю показывается `formatTimestamp(new Date())`
— время сервера в момент обработки. Это не согласуется с `telegramDate`, которое записывается
в базу. Могут отличаться на секунды из-за задержки обработки.

```typescript
const timestamp = formatTimestamp(new Date()); // время сервера
// Но в БД:
telegramDate: new Date(ctx.message.date * 1000), // время Telegram
```

**Предлагаемое решение**:

```typescript
const telegramDate = new Date(ctx.message.date * 1000);
const timestamp = formatTimestamp(telegramDate); // консистентно с БД
```

---

### P2-6: Индекс `@@index([createdAt])` не используется ни в одном запросе в PR

**Файл**: `backend/prisma/schema.prisma:724`

**Описание**: Индекс `@@index([createdAt])` на `ChatMessage` создавался для старой логики
(сортировка по серверному времени). В новой архитектуре все запросы используют `telegramDate`.
Индекс по `createdAt` — лишняя нагрузка на write-path (INSERT) без пользы.

```prisma
@@index([createdAt])  // не используется после перехода на telegramDate
@@index([isAccountant])  // используется ли? нет очевидного запроса
```

**Предлагаемое решение**: Удалить `@@index([createdAt])`. Проверить использование
`@@index([isAccountant])` — если нет запроса только по `isAccountant` без `chatId`,
то он тоже не нужен (покрыт составным индексом `idx_chat_messages_chat_accountant_tgdate`).

---

### P2-7: chat-event.handler.ts — N+1 запросов при миграции сообщений

**Файл**: `backend/src/bot/handlers/chat-event.handler.ts:230–244`

**Описание**: При миграции chat ID (triple unique обработка) выполняется `findMany` для
получения всех сообщений `newId`, затем цикл `for (const msg of existingNewMessages)` с
`deleteMany` на каждую итерацию. При большом количестве сообщений — N+1 запросов.

```typescript
const existingNewMessages = await tx.chatMessage.findMany({
  where: { chatId: newId },
  select: { messageId: true, editVersion: true },
});
if (existingNewMessages.length > 0) {
  for (const msg of existingNewMessages) {  // N запросов вместо 1
    await tx.chatMessage.deleteMany({
      where: { chatId: oldId, messageId: msg.messageId, editVersion: msg.editVersion },
    });
  }
}
```

**Предлагаемое решение**: Заменить цикл на один `deleteMany` с `OR`-условием или
`$executeRaw` с `WHERE (message_id, edit_version) IN (...)`:

```typescript
if (existingNewMessages.length > 0) {
  // Один запрос вместо N
  await tx.$executeRaw`
    DELETE FROM "public"."chat_messages"
    WHERE chat_id = ${oldId}
    AND (message_id, edit_version) IN (
      SELECT message_id, edit_version
      FROM "public"."chat_messages"
      WHERE chat_id = ${newId}
    )
  `;
}
```

---

## Low Priority (P3)

### P3-1: isBotOutgoing vs isAccountant — одинаковый аватар на фронтенде

**Файл**: `frontend/src/components/chats/ChatMessageThread.tsx:170–173`

**Описание**: Бот-аккаунтант (`isAccountant=true`) и исходящий бот (`isBotOutgoing=true`)
показывают одинаковую иконку `<Bot />`. Это затрудняет различение системных сообщений
бота от ответов бухгалтера.

```tsx
{message.isBotOutgoing ? (
  <Bot className="h-4 w-4 text-white" />
) : message.isAccountant ? (
  <Bot className="h-4 w-4 text-white" />  // та же иконка
) : (
  <User className="h-4 w-4 text-[var(--buh-foreground-muted)]" />
)}
```

**Предлагаемое решение**: Использовать разные иконки — например, `<MessagesSquare />` или
`<Briefcase />` для бухгалтера, `<Bot />` только для бота.

---

### P3-2: `ctx.from?.id ?? 0` — потенциально невалидный telegramUserId

**Файл**: `backend/src/bot/handlers/edit.handler.ts:63`, `log-outgoing.ts:43`

**Описание**: Если `ctx.from` отсутствует (анонимное сообщение, channel post), `telegramUserId`
записывается как `0`. В будущем это может привести к коллизиям при запросах по `telegramUserId`.

**Предлагаемое решение**: Использовать nullable `telegramUserId` или специальный sentinel
(например, bot's own ID для `log-outgoing.ts`):

```typescript
// log-outgoing.ts: для исходящих используем ID бота из sent.from
telegramUserId: BigInt(sent.from?.id ?? process.env.BOT_TELEGRAM_ID ?? 0),
```

---

### P3-3: `eslint-disable-next-line react-hooks/immutability` — нестандартный комментарий

**Файл**: `frontend/src/components/chats/ChatMessageThread.tsx:140`

**Описание**: Правило `react-hooks/immutability` не является частью стандартного
`eslint-plugin-react-hooks`. Комментарий, скорее всего, не подавляет никакое реальное правило
и является мёртвым кодом. Использование `let currentDate` внутри `map()` — антипаттерн React
(side effect в render-функции).

```tsx
// eslint-disable-next-line react-hooks/immutability
currentDate = messageDate; // мутация переменной внутри JSX map
```

**Предлагаемое решение**: Переместить логику группировки в `useMemo`:

```tsx
const groupedMessages = React.useMemo(() => {
  return messages.reduce<{ date: string; messages: typeof messages }[]>((groups, msg) => {
    const date = formatDate(msg.telegramDate ?? msg.createdAt);
    const lastGroup = groups[groups.length - 1];
    if (!lastGroup || lastGroup.date !== date) {
      groups.push({ date, messages: [msg] });
    } else {
      lastGroup.messages.push(msg);
    }
    return groups;
  }, []);
}, [messages]);
```

---

### P3-4: `message.telegramDate ?? message.createdAt` на фронтенде лишний fallback

**Файл**: `frontend/src/components/chats/ChatMessageThread.tsx:138, 203`

**Описание**: `telegramDate` — NOT NULL поле в схеме (после backfill в миграции).
Fallback на `createdAt` никогда не сработает, но вносит типовую путаницу. Если tRPC
output schema включает `telegramDate: z.date()` без nullable, TypeScript не позволит
`?? createdAt`.

**Предлагаемое решение**: Убрать fallback или добавить его только как type-level guard.

---

### P3-5: Отсутствие тестов для новых handlers (edit.handler, log-outgoing)

**Файл**: все тесты в `backend/src/bot/handlers/__tests__/`

**Описание**: Для `edit.handler.ts` и `log-outgoing.ts` нет ни одного теста. Критические
пути (race condition в edit, ошибка logging в log-outgoing) не покрыты. Тесты для
`message.handler.test.ts` симулируют логику руками, а не тестируют реальный handler.

**Предлагаемое решение**: Добавить unit-тесты как минимум для:
- `edit.handler`: первая правка, повторная правка, правка несуществующего сообщения
- `log-outgoing`: успешный log, ошибка DB не прерывает reply
- `messages router`: pagination cursor с одинаковым telegramDate

---

## Positive Findings

### Что сделано хорошо

1. **SQL Injection защищена**: Все параметры в `$queryRaw` передаются через `Prisma.sql`
   template literal (не через конкатенацию строк). Context7 подтверждает, что это правильный
   паттерн для Prisma. `cursorFragment = Prisma.sql\`AND telegram_date < ${cursorDate}\`` —
   корректно параметризован.

2. **DISTINCT ON семантика верна**: Subquery с `ORDER BY chat_id, message_id, edit_version DESC`
   корректно выбирает последнюю версию каждого сообщения. Внешний ORDER BY по `telegram_date DESC`
   обеспечивает правильный порядок для пользователя.

3. **skipDuplicates = правильная идемпотентность**: `createMany({ skipDuplicates: true })`
   транслируется в `ON CONFLICT DO NOTHING`, что атомарно и безопасно для retry-логики Telegram.

4. **telegramDate как авторитетная метка времени**: Правильное архитектурное решение —
   использовать `ctx.message.date * 1000` вместо `new Date()`. Это гарантирует корректный
   порядок сообщений даже при задержках обработки.

5. **Каскадное удаление через onDelete: Cascade**: `chat.relation(onDelete: Cascade)` гарантирует
   что при удалении Chat все связанные ChatMessage также удаляются без orphan-записей.

6. **editVersion=0 как фильтр в response.handler**: Явный target `editVersion: 0` в updateMany
   — намеренный и правильный выбор (обновлять только оригинальную версию, а не все правки).

7. **Backfill миграция**: Добавление `telegram_date` сначала nullable, backfill из `created_at`,
   затем SET NOT NULL — стандартный zero-downtime подход. Без него ALTER TABLE на большой таблице
   заблокировала бы строки.

8. **Составные индексы покрывают DISTINCT ON запрос**: `idx_chat_messages_chat_msg_version`
   (`chat_id, message_id, edit_version DESC`) напрямую покрывает `ORDER BY` в subquery,
   позволяя PostgreSQL использовать index scan без дополнительной сортировки.

9. **refetchIntervalInBackground: false**: Правильное решение — не тратить запросы когда
   вкладка в фоне. Уменьшает нагрузку на API.

10. **Логирование outgoing через replyAndLog**: Инкапсуляция `ctx.reply + log` в одну функцию
    предотвращает ситуацию, когда разработчик использует `ctx.reply` напрямую и забывает залогировать.

---

## Итого по приоритетам

| Приоритет | Количество | Статус |
|-----------|-----------|--------|
| P0 — Critical | 2 | Обязательно до merge |
| P1 — High | 5 | Желательно до merge |
| P2 — Medium | 7 | Sprint backlog |
| P3 — Low | 5 | Nice to have |

**Рекомендация**: Исправить P0-1 (нарушение append-only) и P0-2 (race condition в edit handler)
до merge в main. P1-3 (BigInt overflow) критичен для чатов с большими Telegram ID — проверить
реальные ID чатов в prod прежде чем считать его P1 а не P0.
