# Append-Only Message Store: Telegram как источник правды

## Контекст

**Проблема**: Веб-панель BuhBot показывает сообщения, которые НЕ совпадают с реальным чатом Telegram. На скриншоте: в Telegram видны "Test", "Test 2 (edited)", "Test 3", "Test 4", "Test 5", а на сайте -- `@testuser 07:33 "Тестовое сообщение для проверки Winston logger fix"` (другой пользователь, другой текст, другое время).

**Корневые причины** (выявлено анализом кода):

1. **Timestamp из БД, а не из Telegram** -- `ChatMessage.createdAt` использует `@default(now())` (время сервера), а не `ctx.message.date` (время Telegram). При лаге сервера время не совпадает.
2. **Upsert вместо insert** -- `message.handler.ts:153` использует `prisma.chatMessage.upsert()`. Паттерн перезаписи, а не добавления.
3. **Нет обработки редактирования** -- ноль хэндлеров для `edited_message`. Отредактированные сообщения навсегда хранятся в исходном виде.
4. **Захватываются только текстовые сообщения** -- фото, документы, стикеры, голосовые -- невидимы на сайте.
5. **Собственные сообщения бота не логируются** -- FAQ-ответы, подтверждения файлов видны в Telegram, но отсутствуют в БД.
6. **Нет real-time обновлений** -- фронтенд не делает polling (в отличие от дашборда с 30-секундным polling).

**Запрос пользователя**: "Правда живёт в чате. Фиксировать сообщения оттуда. Никогда не перезаписывать данные в базе. Добавлять, не обновлять. Показывать последнее как актуальное, но держать историю."

---

## Фаза 1: Исправить целостность данных (P0)

### 1.1 Миграция схемы: добавить `telegramDate`, `editVersion`, поля для типов

**Файл**: Новая миграция `backend/prisma/migrations/YYYYMMDD_append_only_messages/migration.sql`

Изменения в таблице `chat_messages`:

| Колонка | Тип | Назначение |
|---------|-----|------------|
| `telegram_date` | `TIMESTAMPTZ(6) NOT NULL` | Авторитетная метка времени из Telegram |
| `edit_version` | `INTEGER NOT NULL DEFAULT 0` | 0 = оригинал, 1+ = редакции |
| `message_type` | `VARCHAR(20) NOT NULL DEFAULT 'text'` | text, photo, document, sticker, voice, video |
| `media_file_id` | `VARCHAR(255)` | Telegram file_id для медиа |
| `media_file_name` | `VARCHAR(255)` | Имя файла |
| `caption` | `TEXT` | Подпись к медиа |
| `is_bot_outgoing` | `BOOLEAN NOT NULL DEFAULT false` | Исходящее сообщение бота |
| `deleted_at` | `TIMESTAMPTZ(6)` | Мягкое удаление |

Ключевое изменение constraint:
```sql
-- УБРАТЬ старый unique: (chat_id, message_id)
-- ДОБАВИТЬ новый: (chat_id, message_id, edit_version)
-- Это позволяет хранить N версий одного сообщения
```

Backfill: `UPDATE chat_messages SET telegram_date = created_at` (аппроксимация для существующих данных).

Новые индексы: `(chat_id, telegram_date DESC)`, `(chat_id, message_id, edit_version DESC)`.

**Файл**: `backend/prisma/schema.prisma` -- обновить модель `ChatMessage` (строки 685-713)

### 1.2 Заменить upsert на insert (append-only)

**Файл**: `backend/src/bot/handlers/message.handler.ts` (строки 152-176)

```
БЫЛО:  prisma.chatMessage.upsert({ where: unique_chat_message, create: {...}, update: {isAccountant} })
СТАЛО: prisma.chatMessage.createMany({ data: [{...}], skipDuplicates: true })
```

- `skipDuplicates: true` = `ON CONFLICT DO NOTHING` в PostgreSQL
- Добавить `telegramDate: new Date(ctx.message.date * 1000)` -- время ИЗ Telegram
- `editVersion: 0` для оригинальных сообщений

### 1.3 Переключить пагинацию на `telegramDate`

**Файл**: `backend/src/api/trpc/routers/messages.ts` (строки 117-174)

- Курсорная пагинация: `createdAt` -> `telegramDate`
- Добавить фильтр: `deletedAt: null` (исключить мягко удалённые)
- Расширить output schema: добавить `telegramDate`, `editVersion`, `messageType`, `caption`, `isBotOutgoing`
- Сортировка: `orderBy: { telegramDate: 'desc' }`

### 1.4 Обновить response.handler.ts

**Файл**: `backend/src/bot/handlers/response.handler.ts` (строки 376-384)

`updateMany` для установки `resolvedRequestId` -- это легитимное обновление метаданных (не контента). Добавить фильтр `editVersion: 0` чтобы всегда целить в оригинал.

### 1.5 Обновить chat-event.handler.ts (миграция групп)

**Файл**: `backend/src/bot/handlers/chat-event.handler.ts` (строки 229-241)

Обработка конфликтов при миграции группы -> супергруппы с учётом нового triple-unique `(chatId, messageId, editVersion)`.

---

## Фаза 2: Поддержка редактирования сообщений

### 2.1 Новый хэндлер `edited_message`

**Файл**: Новый `backend/src/bot/handlers/edit.handler.ts`

- `bot.on('edited_message', ...)` -- перехватывать все редактирования
- Найти `MAX(editVersion)` для `(chatId, messageId)`
- Вставить НОВУЮ запись с `editVersion = max + 1` и текстом из `ctx.editedMessage.text`
- `skipDuplicates` на случай дублирования webhook-retry

### 2.2 Регистрация в bot/index.ts

**Файл**: `backend/src/bot/index.ts` (строка 76+) -- добавить `registerEditHandler()` после response handler.

### 2.3 Запрос "только последняя версия" для списка

**Файл**: `backend/src/api/trpc/routers/messages.ts`

Для отображения в ленте нужна только последняя версия каждого сообщения. Подход: `prisma.$queryRaw` с `DISTINCT ON (chat_id, message_id)` и `ORDER BY edit_version DESC`.

### 2.4 Индикатор редактирования на фронтенде

**Файл**: `frontend/src/components/chats/ChatMessageThread.tsx`

Показать "(ред.)" рядом с временем, если `editVersion > 0`.

---

## Фаза 3: Расширение покрытия типов сообщений

### 3.1 Логирование нетекстовых сообщений

**Файл**: `backend/src/bot/handlers/file.handler.ts`

Добавить `createMany` в ChatMessage ПЕРЕД отправкой подтверждения. Заполнять `messageType`, `mediaFileId`, `mediaFileName`, `caption`.

### 3.2 Логирование исходящих сообщений бота

**Файл**: Новая утилита `backend/src/bot/utils/log-outgoing.ts`

Обёртка `replyAndLog(ctx, text, extra)`: вызывает `ctx.reply()`, затем логирует ответ бота в ChatMessage с `isBotOutgoing: true`. Постепенная миграция хэндлеров на эту утилиту.

### 3.3 Фронтенд: рендер разных типов сообщений

**Файл**: `frontend/src/components/chats/ChatMessageThread.tsx`

Иконки для типов: photo, document, sticker. Для текста -- как сейчас. Для медиа -- `[Документ: filename]` с иконкой.

---

## Фаза 4: Фронтенд real-time

### 4.1 Polling каждые 10 секунд

**Файл**: `frontend/src/components/chats/ChatMessageThread.tsx` (строка 27)

```typescript
refetchInterval: 10_000,
refetchIntervalInBackground: false,
```

### 4.2 Использовать `telegramDate` для отображения времени

**Файл**: `frontend/src/components/chats/ChatMessageThread.tsx`

Заменить `message.createdAt` на `message.telegramDate` в `formatTime()` и `formatDate()`.

---

## Порядок реализации

```
Фаза 1 (одним деплоем):
  1.1 Миграция схемы
  1.2 Insert вместо upsert
  1.3 Пагинация по telegramDate
  1.4 Response handler
  1.5 Chat migration handler
  → деплой + верификация

Фаза 2 (второй деплой):
  2.1 Edit handler
  2.2 Регистрация
  2.3 DISTINCT ON запрос
  2.4 Индикатор на фронте
  → деплой + верификация

Фаза 3 (третий деплой):
  3.1 Нетекстовые сообщения
  3.2 Исходящие бота
  3.3 Рендер типов
  → деплой + верификация

Фаза 4 (четвёртый деплой):
  4.1 Polling
  4.2 telegramDate в UI
  → деплой + верификация
```

---

## Ключевые файлы

| Файл | Изменение |
|------|-----------|
| `backend/prisma/schema.prisma:685-713` | Новые поля, новый unique constraint |
| `backend/src/bot/handlers/message.handler.ts:152-176` | upsert -> createMany + telegramDate |
| `backend/src/api/trpc/routers/messages.ts:59-174` | Пагинация по telegramDate, расширение schema |
| `frontend/src/components/chats/ChatMessageThread.tsx:22-37` | Polling, telegramDate, edit indicator |
| `backend/src/bot/handlers/response.handler.ts:376-384` | Фильтр editVersion: 0 |
| `backend/src/bot/handlers/chat-event.handler.ts:229-241` | Triple unique обработка |
| `backend/src/bot/index.ts:76+` | Регистрация edit handler |
| `backend/src/bot/handlers/file.handler.ts` | Логирование медиа в ChatMessage |
| **Новый**: `backend/src/bot/handlers/edit.handler.ts` | Хэндлер edited_message |
| **Новый**: `backend/src/bot/utils/log-outgoing.ts` | Утилита replyAndLog |

## Верификация

1. **Миграция**: `npx prisma migrate dev` -- убедиться что миграция проходит без ошибок
2. **Type-check**: `pnpm type-check` в backend и frontend
3. **Тест в чате**: Отправить сообщение в тестовый Telegram-чат -> проверить что оно появилось на сайте с правильным текстом, пользователем и временем
4. **Тест редактирования**: Отредактировать сообщение в Telegram -> проверить что на сайте показан новый текст с пометкой "(ред.)"
5. **Тест polling**: Отправить сообщение -> убедиться что оно появляется на сайте в течение ~10 секунд без ручного обновления
6. **Тест медиа**: Отправить фото/документ в чат -> проверить что на сайте есть запись
7. **Тест пагинации**: Проверить что прокрутка вверх загружает старые сообщения в правильном хронологическом порядке
