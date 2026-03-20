# Code Review: Privacy Mode Diagnostics & Admin Rights

**Branch:** `fix/buh-4el-privacy-mode-diagnostics`
**Date:** 2026-02-24
**Reviewer:** Code Review Agent (claude-sonnet-4-6)
**Issue:** buh-4el
**Files Reviewed:** 6

---

## Summary

This PR adds runtime diagnostics for Privacy Mode issues in Telegram supergroups. The changes span:

1. `/diagnose` command — shows chat health (Privacy Mode state, bot admin status, DB registration, 24h message count).
2. `setMyDefaultAdministratorRights` on startup — suggests minimal admin rights when the bot is added via link.
3. `groupLink` field in `createInvitation` — `t.me/bot?startgroup=TOKEN&admin=manage_chat` URL for adding the bot as admin.
4. Proactive Privacy Mode warning in `chat-event.handler.ts` on `my_chat_member` (bot added as member).
5. Admin check after `/connect` in `invitation.handler.ts` — warns if Privacy Mode is on and bot is not admin.
6. `Number(chatId)` → `chatId.toString()` fix in `exportChatInviteLink`.
7. Frontend `InvitationModal` — new "Код" tab shows `groupLink` as the primary action, `/connect` command as fallback.

Overall the implementation is solid. The API calls are correct, the `bigint` precision fix is important, and the UX improvements are well-executed. Several issues were found, ranging from a security concern in `/diagnose` to correctness issues with the deep link format and verdict logic.

---

## Critical Issues (P0)

### CR-1: `/diagnose` exposes internal system state to any group member

**File:** `backend/src/bot/handlers/system.handler.ts:61–149`
**Severity:** P0 — Security

**Description:**
The `/diagnose` command replies with SLA status, monitoring status, DB registration state, and 24-hour message counts to anyone who types it in a group chat. There is no authorization check — any chat member (including clients) can query internal bot configuration details.

```typescript
// Current — no access control
bot.command('diagnose', async (ctx: BotContext) => {
  // ...
  const diagnosticMessage =
    `Диагностика чата ${chatId}:\n\n` +
    `В базе данных: ${chatRecord ? 'Да' : 'Нет'}\n` +
    `SLA: ${chatRecord?.slaEnabled ? 'Вкл' : 'Выкл'}\n` +
    `Мониторинг: ${chatRecord?.monitoringEnabled ? 'Вкл' : 'Выкл'}\n` +
    `Сообщений за 24ч: ${messageCount}\n\n` +
    `Вердикт: ${verdict}`;
```

This leaks:
- That the firm uses a monitoring system (competitive intelligence for the client).
- Whether SLA is active on their chat (pricing/tier information).
- Whether monitoring is enabled (clients could avoid monitored windows).
- Message activity counts.

**Suggested fix:** Gate the command behind an admin check. Use `getChatMember` for the invoking user and only proceed if their status is `administrator` or `creator`. Alternatively, restrict the command to private chats only (DM with the bot) where only the firm's staff would interact.

```typescript
// Option A: private chat only
if (ctx.chat?.type !== 'private') {
  await ctx.reply('Команда /diagnose доступна только в личном чате с ботом.');
  return;
}

// Option B: group admin check
const invokerMember = await ctx.telegram.getChatMember(chatId, ctx.from!.id);
if (!['administrator', 'creator'].includes(invokerMember.status)) {
  await ctx.reply('Команда /diagnose доступна только администраторам группы.');
  return;
}
```

Note: Option B still exposes SLA/monitoring info to group admins, who are presumably client-side. Option A is preferable for a client-facing bot.

---

## Important Issues (P1)

### CR-2: `startgroup` deep link format — `admin` parameter value is incorrect

**File:** `backend/src/api/trpc/routers/chats.ts:831`
**Severity:** P1 — Correctness

**Description:**
The generated `groupLink` uses:

```
https://t.me/${botUsername}?startgroup=${token}&admin=manage_chat
```

According to the Telegram deep linking specification for `startgroup` with admin promotion, the `admin` parameter must be a `+`-separated list of specific right names. The correct right name for manage_chat access is `manage_chat`. However, the full list of valid values that Telegram recognizes for the `admin` query parameter are documented on `core.telegram.org/bots/features#chat-and-channel-invite-links` and are: `change_info`, `post_messages`, `edit_messages`, `delete_messages`, `invite_users`, `restrict_members`, `pin_messages`, `promote_members`, `manage_video_chats`, `anonymous`, `manage_chat`.

A single value `manage_chat` is syntactically valid. However, there are two concerns:

1. The `admin` parameter triggers Telegram to propose promoting the bot to admin with those rights. If the parameter is present but the value does not match any known right, Telegram silently ignores it and uses no suggested rights (the promotion prompt may not appear at all, or defaults may be used). Testing has shown that `manage_chat` alone is accepted.

2. More critically: the token embedded in `startgroup` is handled by the bot's `bot.start()` handler (via the `startgroup` payload). However, the current `processInvitation` function is called from `bot.start()` which fires for **private** `/start` commands — not for `startgroup` group-join events. When a user uses the `startgroup` link, Telegram sends a `/start` command to the **group** (not the bot's private chat). This means the bot must handle `/start` in groups (which Telegraf does route to `bot.start()`), but the `processInvitation` function receives `chatType = 'group'` or `'supergroup'` rather than `'private'`. This path is likely working correctly already since `bot.start()` fires in both contexts.

The actual issue: the `admin` parameter in `startgroup` links is **not** the same as the field names in `setMyDefaultAdministratorRights`. For `startgroup` links, the documented values on core.telegram.org are the snake_case names used in chat member rights. The value `manage_chat` is correct per the Telegram Bot API documentation for `ChatAdministratorRights.can_manage_chat`. The link format is correct for requesting the `can_manage_chat` right.

**Verdict on CR-2:** The format is correct (`manage_chat` is valid). This is a verification, not a bug. However, the comment in the code ("Telegram will propose these when the bot is added as admin via t.me link with &admin= parameter") slightly mischaracterizes the relationship between `setMyDefaultAdministratorRights` and the `&admin=` parameter. They are independent mechanisms:
- `setMyDefaultAdministratorRights` sets defaults for when the bot is promoted via the Telegram UI.
- `&admin=manage_chat` in the URL directly requests specific rights for this particular add-via-link flow.

The comment should be clarified to avoid confusion.

**Suggested fix:** Update the comment in `webhook.ts:93–94`:

```typescript
// Set suggested admin rights for groups. These are shown to users when
// promoting the bot through Telegram's admin UI (independent of &admin= links).
```

### CR-3: `/diagnose` verdict logic misses `group` chat type for Privacy Mode

**File:** `backend/src/bot/handlers/system.handler.ts:103–110`
**Severity:** P1 — Correctness / Missed edge case

**Description:**
The verdict for Privacy Mode problems only checks for `chatType === 'supergroup'`:

```typescript
if (privacyModeOn && memberStatus !== 'administrator' && chatType === 'supergroup') {
  verdict = 'ПРОБЛЕМА: Privacy Mode включён, бот НЕ администратор. Бот не видит обычные сообщения в supergroup...';
} else if (privacyModeOn && memberStatus === 'administrator') {
  verdict = 'OK: Privacy Mode включён, но бот — администратор. Сообщения должны приходить.';
} else {
  verdict = 'OK: Privacy Mode выключен. Бот видит все сообщения.';
}
```

When `privacyModeOn` is true and `chatType === 'group'` (standard non-supergroup) and the bot is not admin, the code falls through to `'OK: Privacy Mode выключен...'` — which is a **false positive**. Privacy Mode also applies to regular groups (not just supergroups). The Telegram docs state Privacy Mode is on by default and affects all group types.

**Suggested fix:**

```typescript
if (privacyModeOn && memberStatus !== 'administrator' && memberStatus !== 'creator') {
  if (chatType === 'supergroup' || chatType === 'group') {
    verdict = 'ПРОБЛЕМА: Privacy Mode включён, бот НЕ администратор. Бот не видит обычные сообщения. Решение: назначьте бота администратором.';
  } else {
    verdict = 'OK: Личный чат, Privacy Mode не применяется.';
  }
} else if (privacyModeOn && (memberStatus === 'administrator' || memberStatus === 'creator')) {
  verdict = 'OK: Privacy Mode включён, но бот — администратор. Сообщения должны приходить.';
} else {
  verdict = 'OK: Privacy Mode выключен. Бот видит все сообщения.';
}
```

### CR-4: Privacy Mode warning in `invitation.handler.ts` fires for `group` type even if bot is already admin

**File:** `backend/src/bot/handlers/invitation.handler.ts:278–305`
**Severity:** P1 — Correctness

**Description:**
The post-`/connect` admin check uses `chatType !== 'private'` to decide whether to check, but the warning message says "бот не видит обычные сообщения в **supergroup**-чатах" — which is misleading for `group` type chats. More importantly, if Privacy Mode is ON and `chatType === 'group'`, the warning is correct; but the warning message specifically says "supergroup" when it should cover both group types.

Additionally, the same block calls `getChatMember` passing `chatId.toString()` — which is correct for the `bigint` case. This part is fine.

**Suggested fix:** Update the message text to not say "supergroup" specifically:

```typescript
'Без прав админа бот не видит обычные сообщения в групповых чатах.\n\n' +
```

The same applies to the identical message in `chat-event.handler.ts:85–91`.

### CR-5: `BOT_USERNAME` in `chats.ts` reads from `process.env` directly, bypassing validated `env`

**File:** `backend/src/api/trpc/routers/chats.ts:819`
**Severity:** P1 — Consistency / Maintainability

**Description:**
The rest of the backend reads configuration through the Zod-validated `env` module (`import env from '../../../config/env.js'`). The `createInvitation` mutation reads `BOT_USERNAME` directly from `process.env['BOT_USERNAME']`, bypassing this validation layer:

```typescript
const botUsername = process.env['BOT_USERNAME'];
if (!botUsername) {
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'BOT_USERNAME environment variable is not configured',
  });
}
```

The `env.ts` already has `BOT_USERNAME` defined as `z.string().optional()` (line 104). Using `process.env` directly means:
1. The runtime check duplicates the env validation pattern.
2. If `BOT_USERNAME` is ever renamed in `env.ts`, this line will not be caught by TypeScript.
3. In tests, mocking `env` will not affect this code path.

**Suggested fix:**

```typescript
import env from '../../../config/env.js';

// ...

const botUsername = env.BOT_USERNAME;
if (!botUsername) {
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'BOT_USERNAME environment variable is not configured',
  });
}
```

---

## Improvements (P2)

### CR-6: `/diagnose` calls `getMe()` on every invocation — should be cached

**File:** `backend/src/bot/handlers/system.handler.ts:71`
**Severity:** P2 — Performance

**Description:**
`ctx.telegram.getMe()` makes a Telegram Bot API network call. Privacy Mode status (`can_read_all_group_messages`) is a static property of the bot token — it only changes when the bot owner modifies BotFather settings. Calling `getMe()` on every `/diagnose` invocation is unnecessary network overhead.

The `webhook.ts` already calls `getMe()` at startup and logs the result. A module-level cached value would be cleaner.

**Suggested fix:** Expose a cached `botInfo` from `bot.ts` or a shared service module, populated once at startup:

```typescript
// In a shared bot-info module or bot.ts
let cachedBotInfo: Awaited<ReturnType<typeof bot.telegram.getMe>> | null = null;

export async function getBotInfo() {
  if (!cachedBotInfo) {
    cachedBotInfo = await bot.telegram.getMe();
  }
  return cachedBotInfo;
}
```

This affects all three locations calling `getMe()`: `webhook.ts`, `system.handler.ts`, `invitation.handler.ts`, and `chat-event.handler.ts`.

### CR-7: Duplicate Privacy Mode warning message string across three files

**File:** `backend/src/bot/handlers/invitation.handler.ts:281–289`, `backend/src/bot/handlers/chat-event.handler.ts:85–91`
**Severity:** P2 — DRY / Maintainability

**Description:**
The admin-rights warning message is copy-pasted verbatim in two handler files. If the message needs to change (e.g., to fix the "supergroup" wording from CR-4), it must be updated in multiple places.

```typescript
// Identical in invitation.handler.ts and chat-event.handler.ts
'⚠️ Для корректной работы боту нужны права администратора.\n\n' +
  'Без прав админа бот не видит обычные сообщения в supergroup-чатах.\n\n' +
  'Как исправить:\n' +
  '1. Откройте настройки группы\n' +
  '2. Перейдите в «Администраторы»\n' +
  `3. Назначьте @${botInfo.username} администратором\n` +
  '4. Достаточно минимальных прав (только «Управление чатом»)'
```

**Suggested fix:** Extract to a shared helper, e.g., in `backend/src/bot/messages.ts`:

```typescript
export function privacyModeWarning(botUsername: string | undefined): string {
  const username = botUsername ? `@${botUsername}` : 'бота';
  return (
    '⚠️ Для корректной работы боту нужны права администратора.\n\n' +
    'Без прав админа бот не видит обычные сообщения в групповых чатах.\n\n' +
    'Как исправить:\n' +
    '1. Откройте настройки группы\n' +
    '2. Перейдите в «Администраторы»\n' +
    `3. Назначьте ${username} администратором\n` +
    '4. Достаточно минимальных прав (только «Управление чатом»)'
  );
}
```

This also handles the `botInfo.username` potentially being `undefined` (see CR-9).

### CR-8: `setMyDefaultAdministratorRights` is only called in `setupWebhook`, not in `launchPolling`

**File:** `backend/src/bot/webhook.ts:94–119`, `backend/src/bot/webhook.ts:224–251`
**Severity:** P2 — Correctness in dev environments

**Description:**
The `setMyDefaultAdministratorRights` call and Privacy Mode startup check are both inside `setupWebhook`, which is only called in production (webhook mode). In development, `launchPolling` is used, and these startup actions are skipped. This means:

1. Developers testing the `groupLink` flow locally will not have the suggested admin rights configured.
2. The Privacy Mode startup warning will not appear in dev logs, making it harder to catch during development.

`launchPolling` already sets bot commands — it should also set default admin rights.

**Suggested fix:** Extract both calls into a shared `configureBotDefaults()` function called from both `setupWebhook` and `launchPolling`:

```typescript
async function configureBotDefaults(): Promise<void> {
  await setDefaultAdminRights();
  await checkPrivacyMode();
}
```

### CR-9: `botInfo.username` may be `undefined` — not guarded before string interpolation

**File:** `backend/src/bot/handlers/invitation.handler.ts:287`, `backend/src/bot/handlers/chat-event.handler.ts:91`
**Severity:** P2 — Potential runtime issue

**Description:**
The Telegram Bot API's `User` type has `username` as an optional field. For bots, `username` is always set — but TypeScript types it as `string | undefined`. The template literal `@${botInfo.username}` silently renders as `@undefined` if it is somehow absent:

```typescript
`3. Назначьте @${botInfo.username} администратором\n`
// Could render: "3. Назначьте @undefined администратором"
```

**Suggested fix:** Guard the interpolation:

```typescript
`3. Назначьте ${botInfo.username ? '@' + botInfo.username : 'бота'} администратором\n`
```

Or use the shared helper from CR-7 which already handles this.

### CR-10: `/diagnose` is registered in command list but the error response doesn't restart usefully

**File:** `backend/src/bot/handlers/system.handler.ts:147`
**Severity:** P2 — UX

**Description:**
On error, `/diagnose` replies with "Ошибка при диагностике." but provides no actionable guidance. Since the command is diagnostic by nature, users trying to resolve a problem would be confused by a generic error message.

**Suggested fix:**

```typescript
await ctx.reply(
  'Ошибка при диагностике. Возможно, бот не имеет прав на получение информации о чате. ' +
  'Попробуйте назначить бота администратором и повторите команду.'
);
```

### CR-11: Frontend `copyToClipboard` has a `type` discriminant that doesn't cover `'groupLink'`

**File:** `frontend/src/components/chats/InvitationModal.tsx:130–145`
**Severity:** P2 — Bug (state inconsistency)

**Description:**
The `copyToClipboard` function uses a `type: 'link' | 'command'` discriminant to set the "copied" state:

```typescript
const copyToClipboard = async (text: string, type: 'link' | 'command') => {
  // ...
  if (type === 'link') {
    setCopiedLink(true);    // Sets deepLink copy state
    setTimeout(() => setCopiedLink(false), 2000);
  } else {
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2000);
  }
};
```

The group link copy button calls:

```typescript
onClick={() => {
  copyToClipboard(generatedGroupLink, 'link');  // <-- sets copiedLink, not copiedGroupLink
  setCopiedGroupLink(true);
  setTimeout(() => setCopiedGroupLink(false), 2000);
}}
```

This is a bug: passing `'link'` to `copyToClipboard` sets `copiedLink` (which controls the checkmark icon on the *private deep link* in Tab 1), **and** the inline `setCopiedGroupLink(true)` sets the group link state. The result is that copying the group link also briefly flashes the checkmark on the Tab 1 private link.

**Suggested fix:** Either extend the `type` discriminant:

```typescript
const copyToClipboard = async (text: string, type: 'link' | 'groupLink' | 'command') => {
  // ...
  if (type === 'link') { setCopiedLink(true); ... }
  else if (type === 'groupLink') { setCopiedGroupLink(true); ... }
  else { setCopiedCommand(true); ... }
};

// Usage:
onClick={() => copyToClipboard(generatedGroupLink, 'groupLink')}
```

Or simplify by passing a setter:

```typescript
const copyToClipboard = async (text: string, onCopied: () => void) => {
  await navigator.clipboard.writeText(text);
  onCopied();
  toast.success('Скопировано в буфер обмена');
};
```

---

## Minor / Style (P3)

### CR-12: `for_channels` vs `forChannels` — API field name mismatch comment

**File:** `backend/src/bot/webhook.ts:108`
**Severity:** P3 — Style / Clarity

**Description:**
The Telegraf API for `setMyDefaultAdministratorRights` accepts `for_channels` (snake_case) as confirmed by the Telegraf.js docs (the underlying Telegram Bot API uses `for_channels` in the raw payload). The code uses `for_channels: false` which is correct. However, the Telegraf TypeScript types may expect `forChannels` (camelCase) in the `extra` parameter. This should be verified at compile time — if TypeScript is not complaining, the framework is handling the conversion. Worth a comment to make it explicit.

**Note:** Context7 docs for Telegraf show both `forChannels` (as `extra` property) and `for_channels` (as the raw API field). Telegraf handles the snake_case → camelCase transformation internally. The current usage with `for_channels` at the top level (not inside `extra`) matches how `bot.telegram.setMyDefaultAdministratorRights()` is actually called in Telegraf 4.x, where the parameters object is the direct API payload. This is correct.

### CR-13: `/diagnose` available in private chats shows confusing message

**File:** `backend/src/bot/handlers/system.handler.ts:65–68`
**Severity:** P3 — UX

**Description:**
When `/diagnose` is called in a private chat, it replies "Команда доступна только в групповых чатах." but then continues executing because the `return` is in the right place. The message is accurate, but the check is:

```typescript
if (!chatId) {
  await ctx.reply('Команда доступна только в групповых чатах.');
  return;
}
```

`ctx.chat?.id` is never `null` in a private chat — it will always have the user's numeric ID. So this guard never fires in practice. `/diagnose` in a private chat will run the full diagnostic on the private chat (which will always show "Privacy Mode не применяется" type results that are meaningless in private context).

**Suggested fix:** Check for chat type instead:

```typescript
const chatType = ctx.chat?.type;
if (!chatId || chatType === 'private') {
  await ctx.reply('Команда /diagnose предназначена для групповых чатов.');
  return;
}
```

### CR-14: `launchPolling` sets only `/menu` command, missing `/diagnose` and others

**File:** `backend/src/bot/webhook.ts:234`
**Severity:** P3 — Inconsistency

**Description:**
`setupWebhook` registers all 5 bot commands including `/diagnose`. `launchPolling` only registers `/menu`. This causes the command list in BotFather to be incomplete when running in polling mode (development).

**Suggested fix:** Extract the command list to a constant and reuse:

```typescript
const BOT_COMMANDS = [
  { command: 'start', description: 'Начать работу с ботом' },
  { command: 'menu', description: 'Открыть меню' },
  { command: 'help', description: 'Помощь' },
  { command: 'connect', description: 'Подключить чат (код)' },
  { command: 'diagnose', description: 'Диагностика получения сообщений' },
];

// Both setupWebhook and launchPolling use BOT_COMMANDS
await bot.telegram.setMyCommands(BOT_COMMANDS);
```

### CR-15: Frontend Tab 2 description inaccurate about "права администратора"

**File:** `frontend/src/components/chats/InvitationModal.tsx:287`
**Severity:** P3 — UX / Accuracy

**Description:**
The description for Tab 2 ("Код") says:

> "Ссылка добавит бота в группу с правами на чтение сообщений"

However, `?startgroup=TOKEN&admin=manage_chat` requests the bot be added as an administrator. Telegram will prompt the user to promote the bot and *suggest* the `manage_chat` right — but the user can modify or cancel this. The description slightly overpromises by implying rights are automatically granted.

**Suggested fix:**

> "Ссылка откроет диалог добавления бота в группу с предложением прав администратора"

Also, the hint text at line 362–364 says "бот будет добавлен с правами администратора для чтения сообщений" — this is similarly overstated since it depends on the user confirming the admin promotion.

---

## Positive Observations

1. **Correct `bigint` precision fix** (`Number(chatId)` → `chatId.toString()` in `exportChatInviteLink`): This is an important correctness fix. Telegram chat IDs for supergroups are large negative integers that exceed `Number.MAX_SAFE_INTEGER` (2^53-1). Using `Number()` on a `bigint` that is too large produces an incorrect value; `toString()` preserves precision.

2. **Non-blocking privacy check after `/connect`**: The admin-rights warning is wrapped in a try-catch and does not block the successful `/connect` response. This is the correct pattern — a diagnostic check failure should not invalidate a successful registration.

3. **Graceful degradation in `setMyDefaultAdministratorRights`**: The startup call is wrapped in a try-catch that only warns rather than throwing, ensuring a single Telegram API hiccup at startup does not prevent the bot from starting.

4. **`setMyDefaultAdministratorRights` field coverage**: The rights object includes all known fields from the `ChatAdministratorRights` type as verified against the Telegram Bot API docs (including `can_manage_topics`, `can_pin_messages`). Newer fields added in later API versions (`can_post_stories`, `can_edit_stories`, `can_delete_stories`, `can_manage_direct_messages`) are absent but are optional and not relevant to group bots.

5. **Transaction safety in `processInvitation`**: The invitation token is consumed within a DB transaction, preventing double-use race conditions.

6. **DB diagnostic data in `/diagnose`**: Querying both `chatRecord` and `messageCount` provides useful operational context — the 24h message count is particularly helpful for diagnosing silent failures where the bot is connected but not receiving messages.

7. **Frontend state management is clean**: The new `generatedGroupLink`/`copiedGroupLink` state is properly initialized, reset on close, and populated from the tRPC mutation response. The overall component structure remains readable.

8. **The `startgroup` link format is correct**: `https://t.me/{botUsername}?startgroup={token}&admin=manage_chat` is the correct Telegram deep link format for adding a bot to a group with suggested admin rights. The `manage_chat` value matches the `can_manage_chat` right in `ChatAdministratorRights`.

---

## Issue Summary

| ID    | Severity | File | Description |
|-------|----------|------|-------------|
| CR-1  | P0 | `system.handler.ts` | `/diagnose` exposes SLA/monitoring state to any chat member |
| CR-2  | P1 | `chats.ts` | `admin` param comment is misleading (format is actually correct) |
| CR-3  | P1 | `system.handler.ts` | Verdict logic misses `group` chat type for Privacy Mode |
| CR-4  | P1 | `invitation.handler.ts`, `chat-event.handler.ts` | Warning message says "supergroup" but applies to all groups |
| CR-5  | P1 | `chats.ts` | `BOT_USERNAME` read from `process.env` instead of validated `env` |
| CR-6  | P2 | `system.handler.ts` | `getMe()` called on every `/diagnose` — should be cached |
| CR-7  | P2 | `invitation.handler.ts`, `chat-event.handler.ts` | Duplicate warning message string |
| CR-8  | P2 | `webhook.ts` | Startup config (admin rights, privacy check) missing in `launchPolling` |
| CR-9  | P2 | `invitation.handler.ts`, `chat-event.handler.ts` | `botInfo.username` is `string | undefined`, not guarded |
| CR-10 | P2 | `system.handler.ts` | `/diagnose` error message not actionable |
| CR-11 | P2 | `InvitationModal.tsx` | `copyToClipboard('link')` fires `copiedLink` state for group link copy |
| CR-12 | P3 | `webhook.ts` | `for_channels` snake_case comment clarification |
| CR-13 | P3 | `system.handler.ts` | `/diagnose` private chat guard never fires (`chatId` always present) |
| CR-14 | P3 | `webhook.ts` | `launchPolling` missing `/diagnose` in bot command list |
| CR-15 | P3 | `InvitationModal.tsx` | Tab 2 description overstates that admin rights will be granted |

**Must fix before merge:** CR-1, CR-3, CR-11
**Should fix before merge:** CR-4, CR-5
**Can follow up:** CR-2, CR-6, CR-7, CR-8, CR-9, CR-10, CR-12, CR-13, CR-14, CR-15
