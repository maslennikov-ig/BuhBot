# Code Review: Accountant Role v2

Date: 2026-03-05
Reviewer: code-reviewer agent
Branch: feat/accountant-role
Scope: All 22 files listed in review request (modified + new)

---

## Summary

This v2 review focuses on regressions from fixes applied after v1, remaining unfixed issues, security vulnerabilities, logic errors, and consistency gaps. All 22 files were read in full.

**Overall assessment:** The previous review's critical issues (C-01 scoping, C-02 onboarding check) have been addressed. However, several new bugs were introduced during the fixes, and some issues from v1 remain partially resolved or misresolved.

**Issue counts:**
- CRITICAL: 2
- HIGH: 4
- MEDIUM: 4
- LOW: 3

---

## Issues

### CRITICAL-01: `messages.listByChat` - Manager Access Denied Due to Incorrect Authorization Order

**File:** `backend/src/api/trpc/routers/messages.ts:153-164`
**Severity:** CRITICAL
**Category:** Security / Logic

**Description:**
`requireChatAccess` (line 153) is called before the manager-scoping check (lines 156-163). The function `requireChatAccess` at `authorization.ts:31-41` passes only for `admin` role or when `chat.assignedAccountantId === user.id`. A manager whose ID does not match the chat's `assignedAccountantId` will receive a FORBIDDEN error at line 153 and never reach the manager-scoping check on line 156.

The result is a double failure:
1. Legitimate managers are incorrectly blocked from chats in their managed scope.
2. The manager-scope guard on lines 156-163 is dead code for non-admin managers.

**Current code:**
```typescript
requireChatAccess(ctx.user, chat);   // Line 153: throws FORBIDDEN for managers

// For managers, enforce scoping to their assigned accountants' chats
if (ctx.user.role === 'manager') {   // Line 156: never reached
  const scopedChatIds = await getScopedChatIds(ctx.prisma, ctx.user.id, ctx.user.role);
  if (scopedChatIds !== null && !scopedChatIds.includes(BigInt(input.chatId))) {
    throw new TRPCError({ code: 'FORBIDDEN', ... });
  }
}
```

**Fix:** Replace the combination with the existing `requireChatAccessWithScoping` helper, consistent with how `chats.getById` and `chats.getByIdWithMessages` handle this:

```typescript
const scopedIds = await getScopedChatIds(ctx.prisma, ctx.user.id, ctx.user.role);
requireChatAccessWithScoping(ctx.user, BigInt(input.chatId), scopedIds);
```

---

### CRITICAL-02: `sla.getRequestById` - No Authorization Check

**File:** `backend/src/api/trpc/routers/sla.ts:562-582`
**Severity:** CRITICAL
**Category:** Security

**Description:**
`sla.getRequestById` uses `authedProcedure` and fetches any request by UUID with no role-based scoping or ownership check. Any authenticated user (including an observer or accountant assigned to different chats) can read the full content of any client request, including `messageText`, `clientUsername`, assignment info, and SLA data.

This contradicts the scoping applied to `sla.getRequests` (lines 516-527) where `getScopedChatIds` is applied.

**Current code:**
```typescript
getRequestById: authedProcedure
  .input(GetRequestByIdInput)
  .output(RequestOutput)
  .query(async ({ ctx, input }) => {
    const request = await ctx.prisma.clientRequest.findUnique({
      where: { id: input.requestId },
      include: { chat: true, assignedUser: true },
    });
    if (!request) { throw NOT_FOUND; }
    return formatRequestOutput(request, request.chat, request.assignedUser);
  }),
```

**Fix:** Apply scoped access check after fetching:
```typescript
const scopedChatIds = await getScopedChatIds(ctx.prisma, ctx.user.id, ctx.user.role);
if (scopedChatIds !== null && !scopedChatIds.includes(request.chatId)) {
  throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied.' });
}
```

---

### HIGH-01: `requests.getById` and `requests.getHistory` and `requests.getThread` - Manager Scoping Gap

**File:** `backend/src/api/trpc/routers/requests.ts:302-311, 571-585, 621-634`
**Severity:** HIGH
**Category:** Security

**Description:**
For `getById`, `getHistory`, and `getThread`, the authorization check `if (!['admin', 'manager'].includes(ctx.user.role))` explicitly skips all checks for managers. This means a manager can read any request from any chat in the system, not just chats within their managed accountants' scope.

`requests.list` correctly applies `getScopedChatIds`, but the single-item and history endpoints do not enforce the same constraint for managers.

**Current code (getById):**
```typescript
if (!['admin', 'manager'].includes(ctx.user.role)) {
  const chat = await ctx.prisma.chat.findFirst({ ... });
  if (chat) { requireChatAccess(ctx.user, chat); }
}
// Managers pass through without any check
```

**Fix:** Use `requireChatAccessWithScoping` for all roles:
```typescript
const scopedChatIds = await getScopedChatIds(ctx.prisma, ctx.user.id, ctx.user.role);
if (scopedChatIds !== null && !scopedChatIds.includes(request.chatId)) {
  throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied.' });
}
```

The same pattern applies to `getHistory` and `getThread` (get the `chatId` from the request first, then scope-check it).

---

### HIGH-02: `AccountantSelect.tsx` - Invalid API Call with Array Role

**File:** `frontend/src/components/chats/AccountantSelect.tsx:64-66`
**Severity:** HIGH
**Category:** Logic / Type Safety

**Description:**
The component calls `trpc.user.list.useQuery({ role: ['manager', 'admin', 'accountant'] })` passing an array for the `role` parameter. The `auth.listUsers` procedure defines `role: UserRoleSchema.optional()` which accepts a single enum value, not an array. This will cause a Zod validation error at runtime, breaking the accountant selection dropdown entirely.

The comment on line 63 also shows conceptual confusion: "assume 'manager' and 'admin' roles are for accountants" - these are not accountant roles.

**Current code:**
```typescript
const { data: fetchedUsers, isLoading } = trpc.user.list.useQuery(
  { role: ['manager', 'admin', 'accountant'] },
  { enabled: !providedAccountants }
);
```

**Fix:** Either make separate queries or, preferably, call the endpoint without a role filter and filter client-side to only `accountant` role (since managers assigning chats should only select accountants):
```typescript
const { data: fetchedUsers, isLoading } = trpc.auth.listUsers.useQuery(
  { role: 'accountant' },
  { enabled: !providedAccountants }
);
```

Note: The procedure is at `auth.listUsers` not `user.list`.

---

### HIGH-03: `chats.delete` - Doc/Code Mismatch Allows Manager Soft-Delete

**File:** `backend/src/api/trpc/routers/chats.ts:1062-1070`
**Severity:** HIGH
**Category:** Security

**Description:**
The JSDoc comment says `@authorization Admins only` but the procedure uses `managerProcedure`, which allows both admins and managers. Soft-deleting a chat is a destructive, audit-sensitive operation. If it should be admin-only per the documented intent, this is a privilege escalation issue.

**Current code:**
```typescript
/**
 * @authorization Admins only
 */
delete: managerProcedure   // Allows managers too
```

**Fix:** If the intended behavior is admin-only, change to `adminProcedure`:
```typescript
delete: adminProcedure
```
If managers are intended to soft-delete chats, update the JSDoc comment to reflect this.

---

### HIGH-04: `notificationPref.override` - No Validation That Target User Is An Accountant

**File:** `backend/src/api/trpc/routers/notificationPref.ts:209-251`
**Severity:** HIGH
**Category:** Security

**Description:**
The `override` mutation (for managers to lock preferences of their managed accountants) checks only whether a `UserManager` relation exists for the `(managerId, userId)` pair. It does not verify that the target user has the `accountant` role. A `UserManager` record could theoretically exist pointing to a user of any role. More importantly, an admin calling `override` (which is a `managerProcedure`) skips the relationship check entirely (line 211: `if (ctx.user.role !== 'admin')`), allowing an admin to set locked preferences for any user, including other admins and managers, without any validation of the target user's identity.

This same gap exists in `adminOverride`: it verifies the user exists (line 267-271) but does not reject overriding preferences of other admins or managers (which would be a policy violation in most multi-admin setups).

**Fix (for `override`):** Add a role check on the target user within the non-admin path:
```typescript
const targetUser = await ctx.prisma.user.findUnique({
  where: { id: input.userId },
  select: { role: true },
});
if (!targetUser || targetUser.role !== 'accountant') {
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'Можно управлять только настройками бухгалтеров',
  });
}
```

---

### MEDIUM-01: `userManager.reassign` - Non-Atomic Branch When `existingNew` Found

**File:** `backend/src/api/trpc/routers/userManager.ts:199-215`
**Severity:** MEDIUM
**Category:** Logic

**Description:**
When the new assignment already exists (`existingNew` is truthy), the code executes `deleteMany` outside of a transaction. If this delete fails midway, or if a concurrent request modifies the records between the `findUnique` check and the `deleteMany`, the state is inconsistent. The `else` branch correctly uses `$transaction`, but the first branch does not.

**Current code:**
```typescript
if (existingNew) {
  // Just remove old link; new one already exists
  await ctx.prisma.userManager.deleteMany({
    where: { managerId: input.oldManagerId, accountantId: input.accountantId },
  });
} else {
  await ctx.prisma.$transaction([...]);
}
```

**Fix:** Wrap the first branch in a transaction as well:
```typescript
await ctx.prisma.$transaction([
  ctx.prisma.userManager.deleteMany({
    where: { managerId: input.oldManagerId, accountantId: input.accountantId },
  }),
]);
```

---

### MEDIUM-02: `accountant.handler.ts` `/notifications` - Role Check Missing

**File:** `backend/src/bot/handlers/accountant.handler.ts:281-344`
**Severity:** MEDIUM
**Category:** Security / Consistency

**Description:**
The `/notifications` command handler does NOT check `user.role !== 'accountant'` before proceeding, unlike `/mystats` (line 65), `/mychats` (line 158), and `/newchat` (line 231). This means any role that has a linked Telegram account (e.g., a manager or observer) can view their notification preferences via `/notifications`. While not a severe information leak (they see their own prefs), it is an inconsistency that could expose manager preferences to unintended channels.

**Current code:**
```typescript
bot.command('notifications', async (ctx: BotContext) => {
  // ...
  const user = await findUserByTelegramId(ctx.from.id);
  if (!user) { await ctx.reply('...'); return; }
  // Missing: if (user.role !== 'accountant') check
  // Proceeds for any role
```

**Fix:** Add role check:
```typescript
if (user.role !== 'accountant') {
  await ctx.reply('Эта команда доступна только для бухгалтеров.');
  return;
}
```

---

### MEDIUM-03: `scoping.ts` - Observer Fallthrough Returns Own-Assigned Chats (Correct But Undocumented)

**File:** `backend/src/api/trpc/helpers/scoping.ts:61-70`
**Severity:** MEDIUM
**Category:** Consistency / Documentation

**Description:**
The final `else` branch handles both `accountant` AND `observer` roles, returning only chats where `assignedAccountantId === userId`. For observers this means only chats where the observer's user ID is assigned as the accountant - which is likely an empty list in practice, since observers are typically not assigned to chats as accountants. This may be correct behavior, but it is undocumented and could cause confusion when debugging access issues for observers.

The comment on line 61 says "Accountant/Observer" but it does not explain why observers would have `assignedAccountantId` matching their ID.

**Fix:** Add a clarifying comment and consider whether observers should have access to all chats (read-only) or truly no chats. If observers should see all chats:
```typescript
// Observer: same as accountant scoping (only own assigned chats)
// Note: observers are usually not assigned as accountants, so this typically returns []
// If observers should have unrestricted read access, return null here instead.
```

---

### MEDIUM-04: `auth.createUser` - Supabase Auth Created But DB Transaction Can Fail

**File:** `backend/src/api/trpc/routers/auth.ts:392-458`
**Severity:** MEDIUM
**Category:** Logic

**Description:**
`supabase.auth.admin.inviteUserByEmail` is called at line 393 and creates the user in Supabase Auth outside of the Prisma transaction that follows (line 419). If the Prisma transaction fails (e.g., duplicate email in the `users` table, FK violation, connection error), the Supabase Auth user is created but the local DB record is not. This leaves the system in a split-brain state: the user can authenticate via Supabase but has no profile in the local database.

There is no rollback or cleanup of the Supabase Auth user on transaction failure.

**Fix:** Add a cleanup step in the catch block:
```typescript
try {
  const newUser = await ctx.prisma.$transaction(async (tx) => { ... });
  return { ... };
} catch (dbError) {
  // Attempt to delete the Supabase Auth user to prevent split-brain state
  try {
    await supabase.auth.admin.deleteUser(authData.user.id);
  } catch (cleanupError) {
    logger.error('Failed to clean up Supabase Auth user after DB transaction failure', {
      supabaseUserId: authData.user.id,
      error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
    });
  }
  throw dbError;
}
```

---

### LOW-01: `trpc.ts` - `accountantProcedure` Exported But JSDoc Comment Misplaced

**File:** `backend/src/api/trpc/trpc.ts:208-217`
**Severity:** LOW
**Category:** Style

**Description:**
The JSDoc comment for `accountantProcedure` (lines 209-216) is placed after the `adminProcedure`'s closing JSDoc comment block but before `accountantProcedure`'s export. The JSDoc for `adminProcedure` was split: its opening comment block (lines 208-213) was replaced by `accountantProcedure`'s doc, leaving `adminProcedure` without documentation. The comment block on line 208 says "Admin procedure" but documents `accountantProcedure`.

```typescript
/**
 * Admin procedure (requires admin role only)   <-- says admin procedure
 * ...
 */
export const accountantProcedure = authedProcedure.use(isAccountant);  // actually accountant

export const adminProcedure = authedProcedure.use(isAdmin);  // no JSDoc
```

**Fix:** Correct the JSDoc ordering so each export has its own correct comment.

---

### LOW-02: `invitation.handler.ts` - Verification Token Not Rate-Limited

**File:** `backend/src/bot/handlers/invitation.handler.ts:343-459`
**Severity:** LOW
**Category:** Security

**Description:**
The `/start verify_<token>` handler has no rate limiting. An attacker who somehow obtains a partially-known token format could brute-force verification tokens. The tokens are generated with `randomBytes(16).toString('base64url')` (22 characters), providing ~128 bits of entropy, which makes brute force computationally infeasible. However, there is no throttling at the handler level for malformed or invalid token attempts - each attempt hits the database.

**Fix:** Consider adding per-Telegram-user rate limiting (e.g., max 10 verification attempts per hour) using a Redis counter, similar to the in-memory rate limiter in `messages.ts`.

---

### LOW-03: `accountant.handler.ts` `/mystats` - N+1 Query Pattern

**File:** `backend/src/bot/handlers/accountant.handler.ts:76-110`
**Severity:** LOW
**Category:** Performance

**Description:**
`/mystats` executes two separate database queries: first `chat.count` (line 77) and then `clientRequest.findMany` (line 82). The requests query could be combined with a `_count` aggregate or the chat count could be derived from the requests data if `chatId` were included. This is a minor N+1 at the handler level.

For the typical number of chats per accountant this is not a performance concern, but it can be consolidated:

```typescript
const [assignedChatsCount, requests] = await Promise.all([
  prisma.chat.count({ where: { assignedAccountantId: user.id, deletedAt: null } }),
  prisma.clientRequest.findMany({ ... }),
]);
```

Note: The queries are currently sequential, not parallel. `Promise.all` should be used here.

---

## Passed Checks

The following items were verified and found correct in this review:

1. **Middleware chain is correct:** `managerProcedure = authedProcedure.use(isManager)` means `isAuthed` (which checks `isActive`) always runs before `isManager` and `isAdmin`. The v1 H-01 (isManager missing isActive check) was a false positive - the chain guarantees isActive is checked first.

2. **C-01 (v1) - Analytics, SLA, Feedback, Messages scoping:** `getScopedChatIds` is now imported and applied in all four routers. `analytics.slaCompliance`, `analytics.feedbackSummary`, `analytics.accountantPerformance`, `sla.getRequests`, `sla.getActiveTimers`, `feedback.getAggregates`, and `messages.listByChat` all apply role-based chat scoping.

3. **C-02 (v1) - `isOnboardingComplete` check in `chats.update`:** Lines 486-507 in `chats.ts` correctly validate the assignee's `isActive` and `isOnboardingComplete` before assignment. This check is present.

4. **`userManager.assign` role validation:** Both the manager and accountant roles are validated before creating the UserManager record.

5. **`userManager.listByManager` and `listByAccountant` scope enforcement:** Non-admin managers can only query their own accountants, and non-privileged users can only query their own managers.

6. **`notificationPref.update` locked-pref check:** The `overriddenBy` check correctly prevents accountants from changing manager-locked preferences.

7. **`processVerification` transaction safety:** The verification flow uses a transaction to atomically check token validity, update user, upsert TelegramAccount, and mark token as used. Duplicate Telegram ID check (line 371) is present.

8. **`scoping.ts` manager query:** Correctly includes both managed accountants' chats AND chats directly assigned to the manager (`[...new Set([...accountantIds, userId])]`).

9. **`getScopedChatIds` filters `deletedAt: null`:** Both the manager and accountant/observer paths filter out soft-deleted chats.

10. **`VerificationToken` uniqueness:** Uses `@unique` on `token` field with a DB unique index in the migration.

11. **`auth.deactivateUser` orphan check:** Correctly detects accountants who would have no manager after deactivation (`managedByManagers.length <= 1`).

12. **Migration SQL:** Uses `ADD VALUE IF NOT EXISTS` for the enum, `ALTER TABLE ... ADD COLUMN` is additive and safe for existing rows.

13. **`requireChatAccessWithScoping` BigInt comparison:** Uses `id === chatId` (value equality), which is correct for BigInt in JavaScript (strict equality works for same-typed BigInt values).

14. **`accountant.handler.ts` `/newchat` token generation:** Uses `randomBytes(16)` providing 128-bit entropy, which is cryptographically sufficient.

15. **`chats.update` username validation:** All provided usernames are verified against known users before saving; unrecognized usernames throw `BAD_REQUEST`.

---

## Recommendations

1. **`sla.getRequests` chatId intersection:** The current code at `sla.ts:519-523` handles the case where a user requests a specific chatId outside their scope by returning an empty array (`return { items: [], total: 0, hasMore: false }`). This is functionally correct but silently swallows what might be a misconfigured client. Consider returning a FORBIDDEN error instead to make access violations visible.

2. **Centralise `findUserByTelegramId` helper:** The same pattern (`prisma.user.findFirst({ where: { telegramId: BigInt(telegramId) } })`) appears in `accountant.handler.ts` and likely in other bot handlers. Extract to a shared `bot/utils/user.ts` module to reduce duplication.

3. **`scoping.ts` - Empty result vs null distinction:** When a manager has no managed accountants and no directly assigned chats, `getScopedChatIds` returns `[]`. Callers using `if (scopedChatIds !== null)` then apply `chatId: { in: [] }`, which returns zero results. This is the correct "show nothing" behavior, but it makes debugging harder. Consider logging a debug message when a non-admin user has zero scoped chats.

4. **`auth.createUser` - Missing validation for observer role without managerIds:** Currently `managerIds` is only validated for `accountant` role. If an observer or manager is accidentally created without validation, there are no side effects. This is fine, but worth noting that the `managerIds` field silently has no effect for non-accountant roles.

5. **`verification_tokens` table missing FK to `overridden_by`:** The `notification_preferences.overridden_by` column references a user ID but has no foreign key constraint in the migration (it is nullable, stores the manager UUID). If the manager is deleted, `overridden_by` becomes a dangling reference. The `auth.deleteUser` handler at line 527 does clean up `notificationPreference` records, but only if deleting the accountant - it does not clean up preferences where `overriddenBy = deletedUserId`. Consider adding an FK with `SET NULL` on delete, or handle this in the delete logic.
