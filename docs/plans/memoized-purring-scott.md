# План: Исправление RBAC, меню, уведомлений и настроек чата

## Контекст

Тестеры (Сергей Соловьёв IT, 16.03.2026) выявили критические проблемы в Telegram-боте BuhBot:

1. Кнопки онбординга бухгалтера показываются только один раз и не перевызываются
2. Кнопка «Установить пароль» не работает (не отправляет ссылку)
3. RBAC: команды бухгалтеров недоступны менеджерам/админам — нет иерархии ролей
4. Публичные меню: версия неверна, кнопки-плейсхолдеры, утечка внутренних данных
5. Настройки чата: менеджер не отображается, нельзя задать несколько, уведомления в чат заблокированы
6. Уведомления: неправильная маршрутизация (все бухгалтеры вместо одного, эскалация неверная)

---

## Фаза 1: RBAC — иерархия ролей (CRITICAL)

**Проблема**: Команды `/mystats`, `/mychats`, `/newchat`, `/notifications` проверяют `user.role !== 'accountant'` строго — менеджеры и админы заблокированы.

**Требуемая иерархия**: `admin > manager > accountant > observer`

### 1.1 Создать утилиту ролей

**Новый файл**: `backend/src/bot/utils/roles.ts`

```typescript
const ROLE_LEVEL = { observer: 0, accountant: 1, manager: 2, admin: 3 };

export function hasMinRole(userRole: string, minRole: UserRole): boolean {
  return (ROLE_LEVEL[userRole] ?? -1) >= (ROLE_LEVEL[minRole] ?? Infinity);
}
```

### 1.2 Создать middleware requireRole

**Новый файл**: `backend/src/bot/middleware/require-role.ts`

- `requireRole(minRole)` — ищет пользователя по `telegramId`, проверяет `hasMinRole`, прикрепляет `ctx.state.user`
- `requireAuth()` — только аутентификация, без проверки роли

### 1.3 Заменить проверки ролей в accountant.handler.ts

**Файл**: `backend/src/bot/handlers/accountant.handler.ts`

Заменить 5 мест с `user.role !== 'accountant'` (строки 64, 155, 227, 291, 388):

```typescript
// БЫЛО:
bot.command('mystats', async (ctx) => {
  const user = await findUserByTelegramId(ctx.from.id);
  if (user.role !== 'accountant') { ... }
});

// СТАЛО:
bot.command('mystats', requireRole('accountant'), async (ctx) => {
  const user = ctx.state.user!; // уже проверен middleware
});
```

**Исключение**: `request_password_email` callback оставить со строгой проверкой `role === 'accountant'` — менеджерам/админам пароль бота не нужен (у них веб-доступ).

### 1.4 Обновить экспорты middleware

**Файл**: `backend/src/bot/middleware/index.ts` — добавить `export { requireRole, requireAuth }`

---

## Фаза 2: Онбординг бухгалтера — повторный вызов кнопок и пароль

**Проблема 1**: Кнопки «Личный кабинет» и «Установить пароль» появляются только после верификации (одноразово).
**Проблема 2**: Кнопка «Установить пароль» по отзыву тестера «не делает ничего».

### 2.1 Добавить команду `/account` для повторного вызова

**Файл**: `backend/src/bot/handlers/accountant.handler.ts`

Добавить новый обработчик с `requireRole('accountant')`:

```typescript
bot.command('account', requireRole('accountant'), async (ctx) => {
  await ctx.reply('⚙️ Управление аккаунтом', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🌐 Личный кабинет', url: `${env.FRONTEND_URL}/settings/profile` }],
        [{ text: '🔑 Установить/сменить пароль', callback_data: 'request_password_email' }],
      ],
    },
  });
});
```

### 2.2 Диагностика кнопки «Установить пароль»

**Файл**: `backend/src/bot/handlers/accountant.handler.ts` (строки 349-460)

Callback `request_password_email` уже реализован: генерирует Supabase recovery-ссылку, отправляет её в Telegram-сообщении (автоудаление через 5 мин). Проблемы для проверки:

- Redis cooldown (5 мин) может блокировать повторные нажатия — убедиться, что ошибка понятна пользователю
- Проверить что `supabase.auth.admin.generateLink({ type: 'recovery' })` работает — может не работать если email не подтверждён в Supabase Auth
- Проверить что `user.role !== 'accountant'` блокирует менеджеров/админов которые тестировали кнопку (фиксится Фазой 1 — но для этой кнопки оставляем строгую проверку)
- Добавить более информативные сообщения об ошибках (cooldown timer, email не найден)

### 2.3 Добавить `/account` в меню верификации

**Файл**: `backend/src/bot/handlers/invitation.handler.ts` (строки 422-441)

Добавить упоминание `/account` в сообщении успешной верификации:

```
/account — управление аккаунтом и пароль
```

---

## Фаза 3: Публичные меню, команды, версия

### 3.1 Исправить отображение версии

**Файл**: `backend/src/bot/handlers/system.handler.ts` (строка 23)

Текущий путь: `path.join(__dirname, '../../../package.json')` → читает `backend/package.json` (0.14.8).
Нужно: `path.join(__dirname, '../../../../package.json')` → root `package.json` (0.26.0).

Реализация с fallback:
```typescript
const rootPath = path.join(__dirname, '../../../../package.json');
const backendPath = path.join(__dirname, '../../../package.json');

for (const p of [rootPath, backendPath]) {
  try { BOT_VERSION = JSON.parse(readFileSync(p, 'utf-8')).version; break; }
  catch { /* next */ }
}
```

### 3.2 Ограничить `/info` для авторизованных

**Файл**: `backend/src/bot/handlers/system.handler.ts` (строка 41)

Добавить `requireAuth()` middleware. Убрать `NODE_ENV` из ответа (внутренние данные):

```typescript
bot.command('info', requireAuth(), async (ctx) => {
  const user = ctx.state.user!;
  const msg = `🤖 *BuhBot Info*\n🔹 *Версия:* ${BOT_VERSION}\n🔹 *Ваша роль:* ${user.role}`;
  await ctx.reply(msg, { parse_mode: 'Markdown' });
});
```

### 3.3 Сделать `/help` контекстным по роли

**Файл**: `backend/src/bot/handlers/invitation.handler.ts`

Перебрать команды в `/help` по роли пользователя:
- **Неавторизованные**: `/start`, `/help`, `/connect`, `/menu`
- **accountant+**: + `/mystats`, `/mychats`, `/newchat`, `/notifications`, `/account`, `/template`
- **manager+**: + `/diagnose`
- **admin+**: + `/info`

### 3.4 Обновить Telegram command menu по контексту

**Файл**: `backend/src/bot/webhook.ts` (строки 22-28)

Использовать Telegram Bot API `setMyCommands` с `scope`:

```typescript
// Default (публичные):
await bot.telegram.setMyCommands([
  { command: 'start', description: 'Начать работу с ботом' },
  { command: 'menu', description: 'Открыть меню' },
  { command: 'help', description: 'Помощь' },
  { command: 'connect', description: 'Подключить чат (код)' },
]);

// Private chats (включая команды бухгалтера):
await bot.telegram.setMyCommands([
  { command: 'start', description: 'Начать работу с ботом' },
  { command: 'menu', description: 'Открыть меню' },
  { command: 'help', description: 'Помощь' },
  { command: 'mystats', description: 'Моя статистика' },
  { command: 'mychats', description: 'Мои чаты' },
  { command: 'newchat', description: 'Создать приглашение' },
  { command: 'notifications', description: 'Настройки уведомлений' },
  { command: 'account', description: 'Управление аккаунтом' },
  { command: 'info', description: 'Информация о боте' },
], { scope: { type: 'all_private_chats' } });

// Group chats:
await bot.telegram.setMyCommands([
  { command: 'connect', description: 'Подключить чат (код)' },
  { command: 'diagnose', description: 'Диагностика' },
  { command: 'template', description: 'Шаблоны ответов' },
  { command: 'help', description: 'Помощь' },
], { scope: { type: 'all_group_chats' } });
```

### 3.5 Реализовать кнопку «Связаться с бухгалтером»

**Файл**: `backend/src/bot/handlers/menu.handler.ts` (строки 110-138)

Вместо плейсхолдера — реальное уведомление ответственному бухгалтеру:

```typescript
bot.action(MENU_CALLBACKS.CONTACT, async (ctx) => {
  const chatId = ctx.chat?.id;
  // 1. Найти чат в БД
  const chat = await prisma.chat.findFirst({ where: { telegramChatId: BigInt(chatId) } });
  // 2. Определить ответственного бухгалтера
  const accountantTgId = chat?.accountantTelegramIds?.[0];
  // 3. Отправить уведомление в ЛС бухгалтеру
  if (accountantTgId) {
    await bot.telegram.sendMessage(accountantTgId,
      `📩 Клиент просит связаться!\n💬 Чат: ${chat.title}`,
      { reply_markup: { inline_keyboard: [[{ text: '💬 Открыть чат', url: chatUrl }]] } }
    );
    await ctx.reply('✅ Запрос отправлен бухгалтеру. Ожидайте ответа.');
  } else {
    await ctx.reply('⚠️ Ответственный бухгалтер не назначен.');
  }
});
```

### 3.6 Обновить плейсхолдер «Статус документов»

**Файл**: `backend/src/bot/keyboards/client-menu.keyboard.ts`

Изменить текст ответа `DOC_STATUS_RESPONSE` на честное сообщение: `'🔧 Функция в разработке.'`

---

## Фаза 4: Настройки чата — менеджеры и отображение

### 4.1 Исправить отображение текущих менеджеров

**Файл**: `frontend/src/components/chats/ChatDetailsContent.tsx` (строки 357-363)

**Root cause**: `managerTelegramIds` не передаётся в `initialData` формы — форма всегда стартует с `[]`:

```typescript
// БЫЛО:
initialData={{
  slaEnabled: chat.slaEnabled,
  slaThresholdMinutes: chat.slaThresholdMinutes,
  assignedAccountantId: chat.assignedAccountantId,
  accountantUsernames: chat.accountantUsernames ?? [],
  notifyInChatOnBreach: chat.notifyInChatOnBreach ?? false,
}}

// СТАЛО — добавить managerTelegramIds:
initialData={{
  slaEnabled: chat.slaEnabled,
  slaThresholdMinutes: chat.slaThresholdMinutes,
  assignedAccountantId: chat.assignedAccountantId,
  accountantUsernames: chat.accountantUsernames ?? [],
  notifyInChatOnBreach: chat.notifyInChatOnBreach ?? false,
  managerTelegramIds: chat.managerTelegramIds ?? [],
}}
```

### 4.2 Улучшить UX мульти-выбора менеджеров

**Файл**: `frontend/src/components/chats/ManagerMultiSelect.tsx` (строка 178)

Не закрывать dropdown после выбора менеджера (чтобы можно было добавить несколько без переоткрытия):

```typescript
// БЫЛО: setIsOpen(false) при каждом выборе
// СТАЛО: оставлять открытым, очищать только поиск
const handleSelect = (user) => {
  if (user.telegramId != null) {
    onChange([...value, String(user.telegramId)]);
    setSearchQuery(''); // очистить поиск, но НЕ закрывать
  } else {
    onSelectUserWithoutTelegram?.(user);
    setIsOpen(false); // закрыть только для модала авторизации
    setSearchQuery('');
  }
};
```

---

## Фаза 5: Уведомления — перепроектирование маршрутизации

### 5.1 Изменить маршрутизацию уведомлений

**Файл**: `backend/src/config/config.service.ts` (строки 230-262)

**БЫЛО**: Level 1 → ВСЕ бухгалтеры, Level 2+ → бухгалтеры + менеджеры.
**СТАЛО**: Level 1 → ОДИН ответственный бухгалтер, Level 2+ → ТОЛЬКО менеджеры.

```typescript
export async function getRecipientsByLevel(
  chatManagerIds?: string[] | null,
  accountantTelegramIds?: bigint[] | null,
  escalationLevel: number = 1
): Promise<{ recipients: string[]; tier: 'accountant' | 'manager' | 'fallback' }> {
  const managerIds = await getManagerIds(chatManagerIds);

  if (escalationLevel <= 1) {
    // Level 1: только ПЕРВЫЙ (ответственный) бухгалтер
    const primaryAccountant = accountantTelegramIds?.[0];
    if (primaryAccountant) {
      return { recipients: [String(primaryAccountant)], tier: 'accountant' };
    }
    // Fallback на менеджеров если бухгалтер не назначен
    if (managerIds.length > 0) {
      return { recipients: managerIds, tier: 'fallback' };
    }
    return { recipients: [], tier: 'fallback' };
  }

  // Level 2+: только менеджеры (НЕ включая бухгалтера повторно)
  if (managerIds.length > 0) {
    return { recipients: managerIds, tier: 'manager' };
  }
  return { recipients: [], tier: 'fallback' };
}
```

**Тип `'both'` удалён** — проверить все ссылки:
- `backend/src/services/alerts/escalation.service.ts` (строка 53) — обновить тип
- `backend/src/config/__tests__/config.service.test.ts` — обновить тесты

### 5.2 Обновить SLA timer worker для единичного бухгалтера

**Файл**: `backend/src/queues/sla-timer.worker.ts` (строки 128-133)

Warning-уведомление тоже отправлять только первому/ответственному бухгалтеру:
```typescript
const accountantIds = request.chat?.accountantTelegramIds ?? [];
const recipientIds = accountantIds.length > 0
  ? [String(accountantIds[0])]  // только ответственный
  : await getManagerIds(request.chat?.managerTelegramIds);
```

### 5.3 Упростить UX настроек уведомлений

**Файл**: `frontend/src/components/chats/ChatSettingsForm.tsx`

1. **Убрать поле `AccountantUsernamesInput`** (ручной ввод @username бухгалтеров) — бекенд автоматически заполняет `accountantUsernames` из `assignedAccountantId`
2. **Переименовать лейблы**:
   - «Ответственный бухгалтер» → «Ответственный бухгалтер (получает первичные уведомления)»
   - «Менеджеры» → «Менеджеры для эскалации (получают при отсутствии ответа)»
3. **Добавить предупреждение о пересечении ролей**: если `assignedAccountantId` пользователь также есть в `managerTelegramIds`, показать alert: «Этот сотрудник назначен и бухгалтером, и менеджером — будет получать уведомления обоих уровней»

### 5.4 Добавить раздельные предупреждения о пробелах

Вместо одного общего «нет получателей»:
- «SLA включён, но не назначен ответственный бухгалтер (Level 1)»
- «SLA включён, но не назначены менеджеры для эскалации (Level 2+)»

---

## Фаза 6: Уведомления в служебный чат (вместо клиентского)

### 6.1 Добавить поле `internalChatId` в GlobalSettings

**Файл**: `backend/prisma/schema.prisma`

```prisma
model GlobalSettings {
  // ... existing fields ...
  internalChatId  BigInt?  @map("internal_chat_id")  // Служебный чат для SLA-уведомлений
}
```

Миграция: `npx prisma migrate dev --name add-internal-chat-id`

### 6.2 Заменить `notifyInChatOnBreach` на `notifyInInternalChat`

**Файл**: `backend/src/queues/sla-timer.worker.ts` (строки 210-238)

Вместо отправки breach-уведомления в клиентский чат → отправлять в `globalSettings.internalChatId`:

```typescript
if (globalSettings.internalChatId) {
  await bot.telegram.sendMessage(
    String(globalSettings.internalChatId),
    formatBreachInternalNotification(request, chat),
    { parse_mode: 'HTML' }
  );
}
```

### 6.3 Обновить UI настроек

**Файл**: `frontend/src/components/settings/SlaManagerSettingsForm.tsx`

- Убрать `notifyInChatOnBreach` из настроек каждого чата
- Добавить в глобальные настройки SLA: поле «Служебный чат для уведомлений (Telegram Chat ID)»
- Бекенд: убрать `isProduction()` блокировку из `chats.ts`, перенести логику в глобальные настройки

### 6.4 Настройка per-chat `notifyInChatOnBreach`

**Файл**: `frontend/src/components/chats/ChatSettingsForm.tsx`

- Скрыть переключатель `notifyInChatOnBreach` из настроек чата (заменён глобальным `internalChatId`)
- Оставить поле в Zod-схеме как `optional().default(false)` для backward compatibility

---

## Фаза 7: SLA-кнопки — исправление view_feedback

### 7.1 Добавить обработчик `view_feedback_` callback

**Файл**: `backend/src/bot/handlers/alert-callback.handler.ts`

Кнопка «Посмотреть отзыв» (`view_feedback_{feedbackId}`) из `alert.keyboard.ts` не имеет обработчика. Добавить:

```typescript
bot.action(/^view_feedback_(.+)$/, async (ctx) => {
  const feedbackId = ctx.match[1];
  const feedback = await prisma.feedbackResponse.findUnique({
    where: { id: feedbackId },
    include: { chat: { select: { title: true } } },
  });
  if (!feedback) { await ctx.answerCbQuery('Отзыв не найден'); return; }
  // Авторизация: только менеджеры чата или глобальные
  // Показать: оценка, комментарий, дата, чат
  await ctx.reply(`📋 Оценка: ${feedback.rating}/5\n💬 ${feedback.comment || 'Без комментария'}`);
});
```

---

## Порядок реализации и зависимости

```
Фаза 1 (RBAC)           ← Фундамент, делается первой
  1.1 → 1.2 → 1.3 → 1.4

Фаза 2 (Онбординг)      ← Зависит от Фазы 1 (requireRole)
  2.1 → 2.2 → 2.3

Фаза 3 (Меню/команды)   ← Зависит от Фазы 1 (requireAuth, hasMinRole)
  3.1, 3.2, 3.6          ← Параллельно (независимы)
  3.3, 3.4               ← После 3.1-3.2
  3.5                     ← Независимо (можно параллельно)

Фаза 4 (Настройки чата)  ← Независима (фронтенд)
  4.1 → 4.2              ← Параллельно

Фаза 5 (Уведомления)     ← Независима (бекенд)
  5.1 → 5.2 → 5.3 → 5.4

Фаза 6 (Служебный чат)   ← После Фазы 5
  6.1 → 6.2 → 6.3 → 6.4

Фаза 7 (SLA кнопки)      ← Независима
  7.1
```

**Параллельные потоки**:
- Поток A: Фаза 1 → 2 → 3
- Поток B: Фаза 4 (фронтенд, независимый)
- Поток C: Фаза 5 → 6 (уведомления)
- Поток D: Фаза 7 (изолированный фикс)

---

## Ключевые файлы

| Файл | Фаза | Действие |
|------|-------|----------|
| `backend/src/bot/utils/roles.ts` | 1.1 | CREATE |
| `backend/src/bot/middleware/require-role.ts` | 1.2 | CREATE |
| `backend/src/bot/handlers/accountant.handler.ts` | 1.3, 2.1 | MODIFY |
| `backend/src/bot/handlers/system.handler.ts` | 3.1, 3.2 | MODIFY |
| `backend/src/bot/handlers/invitation.handler.ts` | 2.3, 3.3 | MODIFY |
| `backend/src/bot/webhook.ts` | 3.4 | MODIFY |
| `backend/src/bot/handlers/menu.handler.ts` | 3.5 | MODIFY |
| `backend/src/bot/keyboards/client-menu.keyboard.ts` | 3.6 | MODIFY |
| `frontend/src/components/chats/ChatDetailsContent.tsx` | 4.1 | MODIFY |
| `frontend/src/components/chats/ManagerMultiSelect.tsx` | 4.2 | MODIFY |
| `backend/src/config/config.service.ts` | 5.1 | MODIFY |
| `backend/src/queues/sla-timer.worker.ts` | 5.2, 6.2 | MODIFY |
| `frontend/src/components/chats/ChatSettingsForm.tsx` | 5.3, 5.4, 6.4 | MODIFY |
| `backend/prisma/schema.prisma` | 6.1 | MODIFY |
| `frontend/src/components/settings/SlaManagerSettingsForm.tsx` | 6.3 | MODIFY |
| `backend/src/bot/handlers/alert-callback.handler.ts` | 7.1 | MODIFY |
| `backend/src/config/__tests__/config.service.test.ts` | 5.1 | MODIFY |
| `backend/src/services/alerts/escalation.service.ts` | 5.1 | MODIFY (тип) |

---

## Верификация

### Автоматическая
- `npm run typecheck` — проверка типов после каждой фазы
- `npm run test` — запуск тестов, особенно `config.service.test.ts`
- `npm run build` — сборка без ошибок

### Ручное тестирование
1. **RBAC**: Зайти как менеджер → `/mystats`, `/mychats` должны работать
2. **Онбординг**: `/account` показывает кнопки, «Установить пароль» генерирует ссылку
3. **Версия**: `/info` показывает 0.26.0, недоступна неавторизованным
4. **Меню**: В private чате видны команды бухгалтера, в группе — групповые команды
5. **«Связаться с бухгалтером»**: нажатие отправляет уведомление в ЛС бухгалтеру
6. **Менеджеры**: открыть настройки чата → текущие менеджеры отображаются, можно добавить нескольких
7. **Уведомления**: SLA breach → Level 1 одному бухгалтеру, Level 2 → всем менеджерам
8. **Служебный чат**: при настроенном `internalChatId` — SLA-уведомления идут туда
9. **view_feedback**: кнопка «Посмотреть отзыв» в алерте о низкой оценке — показывает детали
10. **Edge case**: пользователь назначен и бухгалтером и менеджером — получает оба уведомления, UI предупреждает
