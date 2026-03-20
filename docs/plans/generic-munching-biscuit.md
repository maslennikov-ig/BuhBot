# Fix: Messages from supergroup -1003476024757 not appearing on website

## Context

User reported that messages from Telegram supergroup ID -1003476024757 don't appear on the website admin panel. Other groups (including regular group -5210015914 and new supergroup -1003780005667) work correctly. The problem existed even BEFORE the chat was deleted and reconnected from the admin panel.

Key facts from investigation:
- Bot is NOT admin in the problematic chat, but also NOT admin in the working regular group -5210015914
- Messages worked before Feb 17 (when many security/bug fix commits were deployed)
- Bot Privacy Mode is likely OFF (regular group works without admin)
- /connect command IS received and processed (bot replies "Chat connected")
- Regular text messages ("Проверка", "Добавили ответственных") don't appear on website
- Website shows "Нет сообщений" (API returns empty, not error), meaning authorization passes
- Delete+reconnect works for other supergroups

Root cause is NOT confirmed and requires server-side diagnostics. Two main hypotheses:

**Hypothesis A**: Bot is not receiving regular messages from this specific chat (Telegram-side issue). Evidence: even before admin deletion, Dahgoth's messages never appeared.

**Hypothesis B**: Messages ARE stored but query doesn't return them (data issue or code regression from Feb 17 changes). Between Feb 14-17, many changes were deployed: security fixes, schema improvements, auth checks, message dedup updates.

## Plan

### Step 0: Server-side diagnostics (MUST DO FIRST)

Query the production database to determine root cause:

```sql
-- Check if messages exist for this chat
SELECT COUNT(*) FROM public.chat_messages WHERE chat_id = -1003476024757;

-- Check if chat record exists and its state
SELECT id, chat_type, title, sla_enabled, monitoring_enabled, assigned_accountant_id, created_at
FROM public.chats WHERE id = -1003476024757;

-- Check latest messages (if any)
SELECT message_id, username, message_text, telegram_date, edit_version, deleted_at
FROM public.chat_messages
WHERE chat_id = -1003476024757
ORDER BY telegram_date DESC LIMIT 10;
```

Also check server logs:
```bash
ssh buhbot@185.200.177.180
docker logs buhbot-backend --since="2026-02-22T17:00:00" 2>&1 | grep -i "1003476024757"
```

If messages count = 0 → Hypothesis A (bot not receiving). Fix: check Telegram permissions.
If messages count > 0 → Hypothesis B (query/display issue). Fix: debug the SQL query.

### Step 1: Add `/diagnose` command for runtime chat diagnostics

**File**: `backend/src/bot/handlers/system.handler.ts`

Add a `/diagnose` command that checks:
1. Privacy Mode status via `ctx.telegram.getMe()` (`can_read_all_group_messages`)
2. Bot member status in chat via `ctx.telegram.getChatMember(chatId, botId)`
3. Chat registration in DB (exists, monitoringEnabled, slaEnabled)
4. Message count in last 24h
5. Overall verdict with actionable recommendation

Also:
- Add `prisma` import to system.handler.ts (from `../../lib/prisma.js`)
- Register `/diagnose` in bot commands list in `backend/src/bot/webhook.ts:83-88`
- Add `/diagnose` to help text in `backend/src/bot/handlers/invitation.handler.ts:127`

### Step 2: Add bot admin check after /connect

**File**: `backend/src/bot/handlers/invitation.handler.ts`

After the success reply (line 264-266), check if bot can read all group messages. If Privacy Mode is ON and bot is not admin, warn the user in Russian to promote the bot to admin.

- Non-blocking: wrapped in try/catch, doesn't fail /connect flow
- Use `chatId.toString()` for Telegram API calls (not `Number(chatId)`)

### Step 3: Fix `Number(chatId)` precision issue

**File**: `backend/src/bot/handlers/invitation.handler.ts:209`

```
- inviteLink = await ctx.telegram.exportChatInviteLink(Number(chatId));
+ inviteLink = await ctx.telegram.exportChatInviteLink(chatId.toString());
```

Telegraf accepts `string` for chat IDs. Avoids potential precision loss for future large IDs.

### Step 4: Add proactive warning in chat-event handler

**File**: `backend/src/bot/handlers/chat-event.handler.ts`

When bot is added to a group as regular member (not admin) and Privacy Mode is ON, send a warning about needing admin rights.

### Step 5: Add startup Privacy Mode log warning

**File**: `backend/src/bot/webhook.ts`

On startup, call `getMe()` and log a warning if `can_read_all_group_messages` is false. Surfaces the issue in production logs immediately.

## Critical files

- `backend/src/bot/handlers/system.handler.ts` — Step 1 (/diagnose command)
- `backend/src/bot/handlers/invitation.handler.ts` — Steps 2, 3 (admin check, Number fix)
- `backend/src/bot/handlers/chat-event.handler.ts` — Step 4 (proactive warning)
- `backend/src/bot/webhook.ts` — Steps 1, 5 (register command, startup check)
- `backend/src/lib/prisma.ts` — reuse existing prisma singleton
- `backend/src/api/trpc/authorization.ts` — reference for auth pattern

## Existing utilities to reuse

- `prisma` from `backend/src/lib/prisma.ts` — DB access in system handler
- `safeNumberFromBigInt` from `backend/src/utils/bigint.ts` — if needed
- `sanitizeChatTitle` from `backend/src/bot/handlers/chat-event.handler.ts` — pattern reference
- `logMediaMessage` from `backend/src/bot/utils/log-media-message.ts` — pattern for bot outgoing

## Verification

1. Run diagnostic SQL queries (Step 0) to confirm root cause
2. Deploy and run `/diagnose` in chat -1003476024757
3. Based on diagnosis:
   - If bot not receiving → promote bot to admin in chat, verify messages appear
   - If data issue → investigate query, fix and re-test
4. Test /connect on a new group where bot is NOT admin → verify warning appears
5. Run `pnpm type-check && pnpm build` for regression check
6. Test `/diagnose` in working chat to verify healthy output
