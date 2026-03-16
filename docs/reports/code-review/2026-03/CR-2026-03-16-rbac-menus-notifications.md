# Code Review: RBAC Hierarchy, Menus, Notifications, and Chat Settings

**Date**: 2026-03-16
**Scope**: Branch `feat/telegram-first-accountant-onboarding` vs `main` (10 commits)
**Files**: 39 (code only) | **Changes**: +1242 / -422

## Summary

|              | Critical | High | Medium | Low |
| ------------ | -------- | ---- | ------ | --- |
| Issues       | 1        | 3    | 4      | 2   |
| Improvements | --       | 2    | 2      | 1   |

**Verdict**: NEEDS WORK (1 Critical + 3 High issues)

## Issues

### Critical (P0)

#### 1. Markdown injection in view_feedback callback -- user content not escaped

- **File**: `backend/src/bot/handlers/alert-callback.handler.ts:530-544`
- **Problem**: The `view_feedback` handler interpolates `feedback.comment`, `feedback.chat.title`, and `feedback.clientUsername` directly into a Markdown-formatted message without escaping. These are user-controlled values. A comment containing `*bold*`, `_italic_`, `` `code` ``, `[link](http://evil.com)` or unbalanced `*` / `_` characters will either break the message (Telegram API returns 400 on malformed Markdown) or inject formatting. The codebase already has `escapeHtml()` from `format.service.ts` and uses it consistently in other alert handlers -- this handler does not.
- **Impact**: (1) A client can craft a comment that crashes the callback, causing a silent failure with no feedback shown. (2) A crafted comment could inject a clickable `[phishing link](url)` rendered as legitimate text in the manager's Telegram chat. This is a content injection / phishing vector.
- **Fix**: Either switch to `parse_mode: 'HTML'` and use the existing `escapeHtml()`, or escape Markdown special characters. HTML is recommended for consistency with other alert handlers:

```typescript
import { escapeHtml, truncateText } from '../../services/alerts/format.service.js';

// ...inside the handler:
const chatTitle = escapeHtml(feedback.chat?.title ?? 'Неизвестный чат');
const commentText = feedback.comment
  ? `\n<b>Комментарий:</b> ${escapeHtml(feedback.comment)}`
  : '\nБез комментария';
const clientText = feedback.clientUsername
  ? `\nКлиент: @${escapeHtml(feedback.clientUsername)}`
  : '';

// ... build message with HTML tags instead of Markdown *bold* ...
await ctx.reply(message, { parse_mode: 'HTML' });
```

### High (P1)

#### 2. `request_password_email` callback has no auth guard -- any Telegram user can trigger it

- **File**: `backend/src/bot/handlers/accountant.handler.ts:328`
- **Problem**: The `/account` command correctly uses `requireRole('accountant')` middleware, but the `bot.action('request_password_email', ...)` callback handler has NO middleware guard. It performs a manual `findUserByTelegramId` + role check inside the handler body (line 357-368), but this is after the Redis cooldown key is already set (line 338). This means: (a) an unauthenticated user spamming the callback button can consume Redis keys (minor DoS); (b) a manager or admin who somehow obtains the callback button (e.g., from a forwarded message) would be rate-limited but then rejected at line 365, which is confusing UX.
- **Impact**: Rate-limit key pollution for non-accountant users. The role check itself works (no actual bypass), but it should be moved before the cooldown check, or better, use `requireRole` middleware.
- **Fix**: Telegraf `bot.action()` does not natively support the same middleware chaining as `bot.command()`. Restructure to check auth first:

```typescript
bot.action('request_password_email', async (ctx: BotContext) => {
  if (!ctx.from) return;

  const user = await findUserByTelegramId(ctx.from.id);
  if (!user) {
    await ctx.answerCbQuery('Вы не привязаны к системе BuhBot.');
    return;
  }
  if (user.role !== 'accountant') {
    await ctx.answerCbQuery('Эта функция доступна только для бухгалтеров.');
    return;
  }

  // THEN check cooldown
  const cooldownKey = `cooldown:password_request:${ctx.from.id}`;
  // ... rest of handler
```

#### 3. `internalChatId` input has no numeric validation -- BigInt conversion will throw on invalid input

- **File**: `backend/src/api/trpc/routers/settings.ts:362`
- **Problem**: The `internalChatId` input is typed as `z.string().nullable().optional()` with no format validation. When a non-numeric string (e.g., `"abc"`, `"not-a-number"`) is submitted, `BigInt(rawInternalChatId)` on line 362 throws a `SyntaxError: Cannot convert abc to a BigInt`, which becomes an unhandled 500 error.
- **Impact**: Admin submitting an invalid chat ID gets an unhelpful server error instead of a validation message. The unhandled error also pollutes error logs.
- **Fix**: Add a regex validation to the Zod schema:

```typescript
internalChatId: z
  .string()
  .regex(/^-?\d+$/, 'Telegram Chat ID должен быть числом')
  .nullable()
  .optional(),
```

Or wrap the `BigInt()` call in try/catch and throw a `TRPCError({ code: 'BAD_REQUEST' })`.

#### 4. SLA timer test suite references removed `notifyInChatOnBreach` field -- tests are stale

- **File**: `backend/src/queues/__tests__/sla-timer.worker.test.ts:85-167`
- **Problem**: The test suite `describe('notifyInChatOnBreach behavior')` contains 3 tests that still reference the old `notifyInChatOnBreach` per-chat field, which was replaced by the global `internalChatId` mechanism. These tests are testing the OLD logic that no longer exists in `sla-timer.worker.ts`. They test mock objects directly rather than calling the worker function, so they still pass -- but they no longer validate the actual behavior.
- **Impact**: False confidence in test coverage. The new `internalChatId` code path in `sla-timer.worker.ts` (lines 206-237) has zero test coverage.
- **Fix**: Rewrite the test suite to test the new behavior: (a) when `getGlobalSettings().internalChatId` is set, breach notifications go to that chat; (b) when it is null, no in-chat notification is sent. Delete or update the `notifyInChatOnBreach` tests.

### Medium (P2)

#### 5. `ChatSettingsForm` still sends `notifyInChatOnBreach` in mutation payload despite removing UI toggle

- **File**: `frontend/src/components/chats/ChatSettingsForm.tsx:188`
- **Problem**: The `notifyInChatOnBreach` toggle UI was removed from the form, but: (a) the Zod schema still includes `notifyInChatOnBreach: z.boolean()` (line 78); (b) the default value is `false` (line 93); (c) the `onSubmit` handler still sends it in the mutation (line 188); (d) the `initialData` prop type still accepts it (line 56); (e) the `ChatDetailsContent.tsx` still passes it (line 362). This means every form save now silently overwrites `notifyInChatOnBreach` to `false` regardless of its current DB value.
- **Impact**: If any chat has `notifyInChatOnBreach: true` in the DB (from before this change), editing any other setting on that chat will silently reset it to `false`. While the field is deprecated, the backend still accepts and stores it. This is a sneaky data-loss scenario.
- **Fix**: Either (a) remove `notifyInChatOnBreach` from the form schema, default values, `onSubmit` payload, and `initialData` prop entirely; or (b) pass through the current value from `initialData` without allowing user modification. Option (a) is cleaner since the field is deprecated.

#### 6. `menu:contact` callback sends notification to BigInt accountant ID without error handling for blocked/deactivated bots

- **File**: `backend/src/bot/handlers/menu.handler.ts:160-163`
- **Problem**: `bot.telegram.sendMessage(String(accountantTgId), ...)` sends a DM to the accountant. If the accountant has blocked the bot or their Telegram account is deactivated, this throws a Telegraf error (403 Forbidden or 400 Bad Request). The outer try/catch catches it but sends a generic error to the client. The client sees "an error occurred" instead of a more helpful message like "accountant is unreachable."
- **Impact**: Poor UX for the client. The accountant's contact request silently fails with no indication of why.
- **Fix**: Catch the specific Telegraf error for blocked/deactivated users:

```typescript
try {
  await bot.telegram.sendMessage(String(accountantTgId), ...);
  await ctx.reply('Запрос отправлен бухгалтеру.');
} catch (sendError) {
  const errMsg = sendError instanceof Error ? sendError.message : '';
  if (errMsg.includes('bot was blocked') || errMsg.includes('user is deactivated')) {
    await ctx.reply('Бухгалтер временно недоступен. Попробуйте позже.');
    logger.warn('Accountant blocked bot or deactivated', { ... });
  } else {
    throw sendError; // re-throw for outer catch
  }
}
```

#### 7. `useRoleGuard` hook has unstable `deniedRoles` array reference causing unnecessary re-renders and redirects

- **File**: `frontend/src/hooks/useRoleGuard.ts:11-14`
- **Problem**: Every call site passes a new array literal, e.g. `useRoleGuard(['accountant'])`. This creates a new array reference on every render, which is listed as a dependency in the `useEffect`. React sees a new dependency each render and re-runs the effect. While `router.replace('/dashboard')` is idempotent, the effect fires more often than needed.
- **Impact**: Minor performance issue with unnecessary effect re-execution on every render. Could cause flicker during navigation in edge cases.
- **Fix**: Stabilize the dependency. Either use `useMemo` internally or compare by value:

```typescript
export function useRoleGuard(deniedRoles: string[]) {
  const { data: me, isLoading } = trpc.auth.me.useQuery();
  const router = useRouter();
  const deniedRolesKey = deniedRoles.join(',');

  useEffect(() => {
    if (me && deniedRoles.includes(me.role)) {
      router.replace('/dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, deniedRolesKey, router]);
  // ...
}
```

Or better, have callers define the array as a module-level constant.

#### 8. `ChatSettingsForm` test suite has 8+ tests referencing removed `notifyInChatOnBreach` toggle

- **File**: `frontend/src/components/chats/__tests__/ChatSettingsForm.test.tsx:342,399,430,693,720`
- **Problem**: Multiple test cases still test the removed `notifyInChatOnBreach` toggle behavior ("should toggle notifyInChatOnBreach field", "should disable notifyInChatOnBreach toggle when SLA disabled", etc.). Since the toggle was removed from the UI, these tests are either: (a) failing because the UI element no longer exists; or (b) testing behavior that no longer applies.
- **Impact**: Stale tests give false confidence or false failures depending on how they query the DOM.
- **Fix**: Remove or update all tests related to the `notifyInChatOnBreach` toggle. Add tests for the new Level 1/Level 2 warning banners instead.

### Low (P3)

#### 9. `setTimeout` for auto-deleting password message will leak if the bot process restarts

- **File**: `backend/src/bot/handlers/accountant.handler.ts:411-427`
- **Problem**: The auto-delete of the password recovery message uses `setTimeout(5 * 60 * 1000)`. If the bot process restarts within those 5 minutes, the timeout is lost and the sensitive message remains in the chat permanently.
- **Impact**: Low -- the password link itself expires after 1 hour via Supabase, so the exposure window is bounded. But the message containing the link stays visible indefinitely if the timer is lost.
- **Fix**: Consider using BullMQ delayed job for reliability, or accept the risk with a comment documenting the trade-off. The current approach is pragmatic for the 5-minute window.

#### 10. Version resolution in `system.handler.ts` uses fragile relative path traversal

- **File**: `backend/src/bot/handlers/system.handler.ts:33-42`
- **Problem**: The version resolution iterates over two relative paths (`../../../../package.json`, `../../../package.json`) from `__dirname`. The correct path depends on whether the code runs from source (`src/`) or compiled (`dist/`). This is fragile and will silently fall back to `1.0.0` if the directory structure changes.
- **Impact**: `/info` command may show wrong version after build changes. Low risk since it only affects an informational display.
- **Fix**: Consider reading the version from an environment variable injected at build time, or use `import` of `package.json` if module resolution allows it.

## Improvements

### High

#### 1. `notifyInChatOnBreach` field should be fully deprecated with a migration plan

- **File**: `backend/prisma/schema.prisma`, `backend/src/api/trpc/routers/chats.ts:393,523-533`
- **Current**: The field still exists in the Prisma schema, is still accepted in the `updateChatSettings` input, has production-mode guards, and is still stored/returned. The frontend removed the UI but still sends the default value.
- **Recommended**: Create a plan to: (1) stop accepting the field in the API (remove from input schema); (2) add a migration to drop the column; (3) remove all backend references. Until then, at minimum stop sending it from the frontend (see Issue #5).

#### 2. `request_password_email` callback should use `requireRole` middleware via a helper

- **File**: `backend/src/bot/handlers/accountant.handler.ts:328`
- **Current**: Manual auth check inside the callback handler body. Other commands in the same file correctly use `requireRole('accountant')` middleware.
- **Recommended**: Extract the auth check into a reusable callback guard, or restructure the handler to use Telegraf's middleware composition pattern. This would make the security model consistent across commands and callbacks.

### Medium

#### 3. `getRecipientsByLevel` returns empty recipients at Level 2+ with no managers -- silent notification loss

- **File**: `backend/src/config/config.service.ts:256-259`
- **Current**: When there are no managers configured (neither chat-level nor global), Level 2+ returns `{ recipients: [], tier: 'fallback' }`. The caller (escalation service) will silently skip notification delivery, and the SLA breach escalation is effectively lost.
- **Recommended**: Log a warning when Level 2+ escalation produces zero recipients. Consider falling back to the primary accountant at Level 2+ if no managers exist, rather than dropping the notification entirely. This is a design decision that should be documented either way.

#### 4. AdminLayout makes an extra `trpc.auth.me` query -- already available in auth context

- **File**: `frontend/src/components/layout/AdminLayout.tsx:474`
- **Current**: `AdminLayoutContent` adds `trpc.auth.me.useQuery()` for role-based nav filtering. Several page components also call `useRoleGuard` which internally calls `trpc.auth.me.useQuery()`. This results in potentially 2+ `me` queries being created per page load.
- **Recommended**: tRPC React Query deduplicates identical queries in-flight, so this is not an N+1 network issue. However, it creates unnecessary hook overhead. Consider passing the user role down via context or a shared hook that is called once at the layout level.

### Low

#### 5. `createAccountantInTransaction` uses `string` for role parameter instead of `UserRole` enum

- **File**: `backend/src/api/trpc/routers/auth.ts:40`
- **Current**: The helper function accepts `role: string` rather than the `UserRole` union type.
- **Recommended**: Use the `UserRole` type from the Zod schema for type safety:

```typescript
async function createAccountantInTransaction(
  tx: TransactionClient,
  params: {
    // ...
    role: UserRole; // instead of string
  }
)
```

## Positive Patterns

1. **RBAC middleware is well-designed**: The `requireRole` / `requireAuth` middleware pattern with `ctx.state['user']` is clean, DRY, and correctly replaces the previously duplicated auth checks across all 4 accountant commands. The role hierarchy in `roles.ts` with `hasMinRole` is simple and correct.

2. **Atomic user deletion with defense-in-depth**: The `deleteUser` mutation now uses `$transaction([...])` with explicit SET NULL operations alongside the FK-level `onDelete: SetNull`. This belt-and-suspenders approach prevents orphaned records even if FK constraints are misconfigured.

3. **Redis cooldown with fail-open pattern**: The `request_password_email` rate limiting correctly uses atomic `SET NX EX` and degrades gracefully when Redis is unavailable. The fail-open design is appropriate for a non-critical rate limit.

4. **Scoped Telegram bot commands**: The `configureBotDefaults()` function now sets separate command menus for private chats, group chats, and the default scope. This gives users a contextual command autocomplete menu, which is a nice UX improvement.

5. **Notification routing redesign is clean**: The L1-single-accountant / L2-managers-only routing is simpler than the previous "both" logic and correctly eliminates duplicate notifications to the accountant.

## Escalation

The following items warrant attention:

1. **Database schema changes**: Two new migrations (`user_delete_set_null_fk`, `add_internal_chat_id`). The FK migrations are well-structured. The `internal_chat_id` migration is additive (nullable column) and safe.

2. **API contract change**: `getRecipientsByLevel` return type changed from `'accountant' | 'manager' | 'both' | 'fallback'` to `'accountant' | 'manager' | 'fallback'`. The `'both'` tier was removed. All consumers have been updated -- grep confirms no remaining references to `'both'`.

3. **Authorization changes**: Four analytics endpoints moved from `authedProcedure` to `staffProcedure`, and `feedbackRouter.getAggregates` similarly changed. This restricts accountants from seeing SLA analytics and feedback data they previously could access. Verify this is intentional per business requirements.

## Validation

- Type Check (backend): PASS
- Type Check (frontend): PASS
- Build: Not run (type-check sufficient for this review scope)
