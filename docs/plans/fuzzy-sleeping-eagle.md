# Plan: Исправление багов и улучшение настроек чата/менеджеров

## Context

Тестер (@Dahgoth) сообщил о нескольких проблемах:
1. **Баг**: последние сообщения @Dahgoth показываются как "клиент" хотя он настроен как accountant
2. **Баг**: "отсутствует история сообщений от других пользователей" (опровергнуто — сообщения @Annushka3313 есть в БД, это UX-вопрос со скроллом)
3. **Фича**: отсутствует страница управления глобальными менеджерами (форма есть, но с ручным вводом Telegram ID)
4. **Фича**: поле "Менеджеры для SLA уведомлений (Telegram ID)" → переименовать + заменить текстовый ввод на dropdown пользователей
5. **Фича**: модальное окно для пользователей без Telegram ID с возможностью отправки через бота

## Расследование бага isAccountant

**Данные из БД:**
- Chat -5097032083: `accountant_usernames=["dahgoth"]`, `accountant_telegram_ids=[869709142]`, `assigned_accountant_id` → User с `telegram_id=869709142`
- Сообщения 259-264 (16:02-16:06): `is_accountant = true` (верно)
- Сообщение 271 v0 (17:19:00): `is_accountant = false` (БАГ)
- Сообщение 271 v1 (17:19:32): `is_accountant = false` (скопировано из v0 через `edit.handler.ts:103`)
- Chat `updated_at = 09:07` — настройки НЕ менялись между корректными и ошибочными сообщениями

**Корневая причина**: `isAccountantForChat()` в `response.handler.ts:207-216` имеет catch-all, который при ЛЮБОЙ ошибке (включая транзиентные DB-ошибки) молча возвращает `{isAccountant: false}`. Транзиентная ошибка Prisma привела к тому, что сообщение было записано с неверным флагом.

---

## Задачи

### B1. Исправить catch-all в isAccountantForChat

**Файлы:**
- `backend/src/bot/handlers/response.handler.ts:207-216`
- `backend/src/bot/handlers/message.handler.ts:119`

**Изменения:**
1. В `isAccountantForChat()` (response.handler.ts) — заменить `return { isAccountant: false }` на `throw error` в catch-блоке. Добавить в лог пометку о том, что ошибка пробрасывается.
2. В `message.handler.ts:119` — обернуть вызов `isAccountantForChat()` в отдельный try/catch:
   - catch: логировать `logger.warn('[TRANSIENT_ERROR] isAccountantForChat failed, defaulting to false')`, использовать `{ isAccountant: false, accountantId: null }` как fallback
   - Это сохраняет текущее поведение (сообщение всё равно записывается), но делает ошибку видимой в мониторинге
3. В `response.handler.ts` вызов `isAccountantForChat` (около строки 284) уже внутри try/catch — пробросится до него, залогируется как error. Безопасно.

### B2. Data fix — исправить is_accountant для message 271

SQL через MCP supabase:
```sql
UPDATE chat_messages
SET is_accountant = true
WHERE chat_id = -5097032083
  AND message_id = 271;
```

### F1. Расширить user.list — добавить telegramId, telegramUsername

**Файл:** `backend/src/api/trpc/routers/user.ts:171-186`

- Добавить в `select`: `telegramId: true`, `telegramUsername: true`
- В return: маппинг `telegramId` через `safeNumberFromBigInt()` из `backend/src/utils/bigint.ts` (уже используется в messages.ts, chats.ts)
- `telegramUsername` — строка, маппинг не нужен

### F2. Переименовать label поля SLA менеджеров

**Файл:** `frontend/src/components/chats/ChatSettingsForm.tsx:411-412`

Изменить: `"Менеджеры для SLA уведомлений (Telegram ID)"` → `"Менеджеры для SLA уведомлений"`

### F3. Создать компонент ManagerMultiSelect

**Новый файл:** `frontend/src/components/chats/ManagerMultiSelect.tsx`

Multi-select dropdown с chips для выбора пользователей.

**Props:**
```typescript
type Props = {
  value: string[];              // telegram ID строки (текущий формат хранения)
  onChange: (value: string[]) => void;
  disabled?: boolean;
};
```

**Поведение:**
- Fetches users: `trpc.user.list.useQuery({ role: ['manager', 'admin'] })`
- Reverse-mapping при загрузке: `value.map(id => users.find(u => String(u.telegramId) === id))`
- Chips: имя пользователя + иконка статуса Telegram (зеленая галка / желтый треугольник / красный X для orphaned ID)
- Dropdown с поиском (паттерн из `AccountantSelect.tsx`)
- При выборе пользователя БЕЗ telegramId → открывает TelegramAuthModal (state: `pendingUser`)
- При выборе пользователя С telegramId → добавляет `String(user.telegramId)` в value

**Паттерны для переиспользования:**
- `AccountantSelect.tsx` — dropdown с поиском, click outside, keyboard
- `AccountantUsernamesInput.tsx` — chips с иконками статуса, removable

### F4. Создать компонент TelegramAuthModal

**Новый файл:** `frontend/src/components/chats/TelegramAuthModal.tsx`

Dialog для верификации и привязки Telegram-аккаунта пользователя.

**Props:**
```typescript
type Props = {
  open: boolean;
  user: { id: string; name: string } | null;
  onClose: () => void;
  onSuccess: (telegramId: string) => void;
};
```

**UI состояния:**
1. **Initial**: "Пользователь X не привязал Telegram", поле ввода @username, кнопка "Проверить и отправить"
2. **Loading**: спиннер
3. **Success**: "Аккаунт @username привязан, уведомление отправлено", кнопка "Готово" → `onSuccess(telegramId)`
4. **Error not_found**: "Пользователь не найден в истории сообщений чата" + инструкция
5. **Error bot_blocked**: "Бот не может отправить сообщение" + инструкция "начать диалог с ботом" + сброс выбора

При cancel/close без success → выбор пользователя сбрасывается (не добавляется в список).

### F5. Backend — процедура user.verifyTelegramUsername

**Файл:** `backend/src/api/trpc/routers/user.ts`

Новая процедура с `managerProcedure`:

**Input:** `{ userId: string (UUID), username: string }`

**Логика:**
1. Проверить существование пользователя в User table
2. Нормализовать username (убрать @, toLowerCase)
3. Искать telegram_user_id в `chat_messages` по username (case-insensitive):
   ```typescript
   prisma.chatMessage.findFirst({
     where: { username: { equals: normalizedUsername, mode: 'insensitive' } },
     select: { telegramUserId: true },
     orderBy: { telegramDate: 'desc' },  // НЕ createdAt — его нет в Prisma schema
   })
   ```
4. Если не найден → return `{ success: false, error: 'user_not_found_in_messages' }`
5. Попытаться отправить сообщение через `bot.telegram.sendMessage(telegramUserId, authMessage)`
   - Import: `import { bot } from '../../bot/bot.js'`
6. Если 403 → return `{ success: false, error: 'bot_blocked' }`
7. Если успешно → обновить `User.telegramId` и `User.telegramUsername`, return `{ success: true, telegramId }`

### F6. Заменить Input на ManagerMultiSelect в ChatSettingsForm

**Файл:** `frontend/src/components/chats/ChatSettingsForm.tsx:400-436`

- Импортировать `ManagerMultiSelect`
- Заменить `<Input>` на `<ManagerMultiSelect value={field.value ?? []} onChange={field.onChange} disabled={!slaEnabled} />`
- Zod-схема `managerTelegramIds: z.array(z.string()).optional()` — без изменений
- Логика onSubmit — без изменений (отправляет массив строк)

### F7. Заменить Input на ManagerMultiSelect в SlaManagerSettingsForm

**Файл:** `frontend/src/components/settings/SlaManagerSettingsForm.tsx`

- Изменить schema: `z.object({ ids: z.string() })` → `z.object({ ids: z.array(z.string()) })`
- defaultValues: `{ ids: '' }` → `{ ids: [] as string[] }`
- useEffect: `form.reset({ ids: settings.globalManagerIds })` (без `.join`)
- onSubmit: убрать split/filter, передавать `data.ids` напрямую
- Заменить `<Input>` на `<ManagerMultiSelect value={field.value} onChange={field.onChange} />`

---

## Порядок выполнения

```
B1 (fix catch-all)     ──┐
B2 (data fix SQL)      ──┤── Backend параллельно
F1 (user.list extend)  ──┤
F5 (verifyTelegramUsername) ─┘
                          │
                          ▼
F2 (rename label)      ──┐
F3 (ManagerMultiSelect)──┤── Frontend (F3+F4 параллельно)
F4 (TelegramAuthModal) ──┘
                          │
                          ▼
F6 (wire ChatSettingsForm) ──┐── Wire-up (последовательно)
F7 (wire SlaManagerSettingsForm)─┘
```

## Ключевые файлы

| Файл | Действие |
|------|----------|
| `backend/src/bot/handlers/response.handler.ts` | Edit: re-throw вместо silent return |
| `backend/src/bot/handlers/message.handler.ts` | Edit: обёртка try/catch с warning log |
| `backend/src/api/trpc/routers/user.ts` | Edit: extend list + new verifyTelegramUsername |
| `backend/src/utils/bigint.ts` | Reuse: safeNumberFromBigInt |
| `frontend/src/components/chats/ManagerMultiSelect.tsx` | New: multi-select dropdown |
| `frontend/src/components/chats/TelegramAuthModal.tsx` | New: dialog для верификации |
| `frontend/src/components/chats/ChatSettingsForm.tsx` | Edit: replace Input + rename label |
| `frontend/src/components/settings/SlaManagerSettingsForm.tsx` | Edit: replace Input + refactor schema |
| `frontend/src/components/chats/AccountantSelect.tsx` | Reuse: паттерн dropdown |
| `frontend/src/components/chats/AccountantUsernamesInput.tsx` | Reuse: паттерн chips |

## Что НЕ меняется

- **DB schema** — миграции не нужны, хранение `managerTelegramIds: String[]` остаётся
- **config.service.ts** — `getRecipientsByLevel()` использует telegram IDs как строки, без изменений
- **SLA notification system** — без изменений
- **edit.handler.ts** — копирование `is_accountant` из prev version — корректное поведение (баг был на этапе записи v0)

## Верификация

1. `pnpm run type-check` — проверка типов после каждого шага
2. `pnpm run build` — сборка перед коммитом
3. DB query: `SELECT is_accountant FROM chat_messages WHERE chat_id = -5097032083 AND message_id = 271` — должен быть `true` после B2
4. UI test: открыть настройки чата → поле "Менеджеры для SLA уведомлений" должно быть dropdown
5. UI test: выбрать пользователя без telegramId → должен появиться модал
6. UI test: глобальные настройки → "Менеджеры SLA уведомлений" должен быть dropdown
7. `pnpm run test` — запуск существующих тестов
