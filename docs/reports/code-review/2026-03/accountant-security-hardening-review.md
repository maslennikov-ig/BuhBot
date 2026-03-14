---
report_type: code-review
generated: 2026-03-13T12:00:00Z
version: 2026-03-13
status: partial
agent: code-reviewer
branch: feat/telegram-first-accountant-onboarding
base: main
commit: 4b27b30
files_reviewed: 4
issues_found: 9
critical_count: 0
high_count: 3
medium_count: 4
low_count: 2
---

# Code Review: Accountant Security Hardening

**Branch**: `feat/telegram-first-accountant-onboarding`
**Commit**: `4b27b30 feat(auth): implement Telegram-first onboarding for accountant role`
**Generated**: 2026-03-13
**Status**: PARTIAL — no blocking issues, three items should be addressed before merge
**Files Reviewed**: 4

---

## Executive Summary

This PR implements Telegram-first onboarding for the accountant role and hardens access control on analytics/feedback endpoints. The overall approach is sound: accountants are created without sending an email invite, instead receiving a Telegram deep-link for identity verification. The role-guard tightening (`authedProcedure` → `managerProcedure`) is a correct security improvement.

No critical issues were found. Three high-priority items need attention: an observer role regression introduced by the procedure upgrade, an in-memory rate-limit cooldown that resets on redeploy, and an unresolved security exposure window when `deleteMessage` fails silently without logging.

---

## Files Changed

```
backend/src/api/trpc/routers/analytics.ts  (+8 -8)
backend/src/api/trpc/routers/feedback.ts   (+2 -2)
backend/src/api/trpc/routers/auth.ts       (+103 -52)
backend/src/bot/handlers/accountant.handler.ts (+103 -1)
```

---

## Detailed Findings

### High Priority

#### H-01: Observer role loses access to analytics procedures (regression)

**Files**: `analytics.ts`, `feedback.ts`
**Category**: Security / Correctness

Before this PR, `slaCompliance`, `feedbackSummary`, `getResponseTimeHistory`, `getResponseTimeDistribution`, and `feedback.getAggregates` were on `authedProcedure`, meaning observers (read-only staff) could call them. After this PR they are on `managerProcedure`, which is defined as:

```typescript
// trpc.ts:103
if (!ctx.user || !['admin', 'manager'].includes(ctx.user.role)) {
  throw new TRPCError({ code: 'FORBIDDEN', ... });
}
```

The `observer` role is not in that list. The analytics page (`frontend/src/app/analytics/page.tsx`) and the SLA page (`frontend/src/app/sla/page.tsx`) use `useRoleGuard(['accountant'])`, which denies only accountants — observers are still allowed to navigate to these pages, but every tRPC query will now return `FORBIDDEN`. The dashboard also calls `slaCompliance` indirectly through the dashboard data pipeline.

If observers are intentionally being denied analytics access as part of this PR's scope, the `useRoleGuard` call on those pages must also be updated to include `'observer'`. If observers should still be allowed to read analytics, these procedures should remain on `authedProcedure` (or a new `observerProcedure` that includes the observer role, in addition to the accountant tightening). Currently there is a mismatch between what the frontend renders and what the backend permits.

**Recommendation**: Clarify the intended access matrix. If the goal is manager-and-above only, add `'observer'` to the `deniedRoles` array on the affected frontend pages. If observers should still read aggregates, use `accountantProcedure` (which covers admin + manager + accountant but not observer) or `authedProcedure` and rely on `getScopedChatIds` for data isolation.

---

#### H-02: In-memory rate-limit cooldown resets on process restart

**File**: `backend/src/bot/handlers/accountant.handler.ts:344`
**Category**: Security

```typescript
const passwordRequestCooldown = new Map<number, number>();
const PASSWORD_COOLDOWN_MS = 5 * 60 * 1000;
```

This map lives in Node.js process memory. A process restart (redeploy, crash, container restart) clears it entirely, allowing an attacker who triggers a restart to immediately re-request password recovery links without any cooldown. With the Docker-based deployment on VDS, rolling restarts happen during every deployment.

In addition, the map is never pruned. Over a long uptime with many users, it accumulates entries indefinitely (one entry per user ID, never removed after cooldown expiry).

**Recommendation**:

Option A (minimal): After the cooldown window expires, delete the entry to avoid unbounded growth:

```typescript
if (lastRequest && Date.now() - lastRequest < PASSWORD_COOLDOWN_MS) {
  // ... rate limit response
} else {
  // Clean up expired entry
  if (lastRequest) passwordRequestCooldown.delete(ctx.from.id);
}
```

Option B (preferred): Store cooldown state in Redis with a TTL, consistent with the project's existing use of Redis/BullMQ. This survives restarts and scales horizontally.

```typescript
const cooldownKey = `pw_cooldown:${ctx.from.id}`;
const lastRequest = await redis.get(cooldownKey);
if (lastRequest) { ... }
await redis.set(cooldownKey, Date.now().toString(), 'PX', PASSWORD_COOLDOWN_MS);
```

---

#### H-03: Silent `deleteMessage` failure loses security benefit without logging

**File**: `backend/src/bot/handlers/accountant.handler.ts:420-429`
**Category**: Security / Observability

```typescript
setTimeout(
  async () => {
    try {
      await ctx.telegram.deleteMessage(sentMsg.chat.id, sentMsg.message_id);
    } catch {
      // Message may have been deleted by user already
    }
  },
  5 * 60 * 1000
);
```

The auto-delete is a good security measure to reduce the window during which a password recovery link is visible in chat history. However the catch block is completely silent. If `deleteMessage` fails for a reason other than "message already deleted" (e.g., bot lacks permissions, Telegram API error, rate limit), the sensitive recovery link stays in the chat indefinitely with no visibility into the failure.

The comment "Message may have been deleted by user already" is only one of several possible failure reasons. Telegram's Bot API returns distinct error codes: `message to delete not found` (expected, safe), `bot was kicked`, `not enough rights to delete`, etc. The current code treats all of them identically.

Furthermore, the `setTimeout` callback uses an `async` function, so any unhandled rejection inside it will result in an unhandled promise rejection at the Node.js process level (or be silently swallowed depending on Node.js version and the unhandled rejection mode configured in this project).

**Recommendation**: Distinguish expected vs. unexpected failures, and log unexpected ones:

```typescript
setTimeout(() => {
  ctx.telegram.deleteMessage(sentMsg.chat.id, sentMsg.message_id).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    // Expected: message already deleted by user
    if (!msg.includes('message to delete not found')) {
      logger.warn('Failed to auto-delete password recovery message', {
        chatId: sentMsg.chat.id,
        messageId: sentMsg.message_id,
        error: msg,
        service: 'accountant-handler',
      });
    }
  });
}, 5 * 60 * 1000);
```

Note: using `.catch()` on the returned promise directly (rather than `async () => { try/catch }`) is the correct Telegraf pattern for fire-and-forget operations inside `setTimeout`, as confirmed by the Telegraf documentation — it avoids wrapping the callback in `async` and producing an unhandled promise rejection if the outer `try/catch` is not reached.

---

### Medium Priority

#### M-01: JSDoc on `getAggregates` says "all authenticated users" but procedure says "managers only"

**File**: `backend/src/api/trpc/routers/feedback.ts:57-61`
**Category**: Documentation / Correctness

```typescript
/**
 * Available to all authenticated users (managers, accountants, observers).
 * Returns anonymized data without client-identifying information.
 *
 * @authorization All authenticated users   ← stale
 */
getAggregates: managerProcedure             ← actual
```

The comment was copied from the old `authedProcedure` version and never updated. This creates confusion for future developers about the intended access policy.

**Recommendation**: Update the JSDoc block to say `@authorization Managers and admins only`.

---

#### M-02: Duplicate Supabase user creation path in `createUser` (production accountant branch)

**File**: `backend/src/api/trpc/routers/auth.ts:528-622`
**Category**: Code Quality / Maintainability

The production `createUser` path for accountants (lines 528–622) is structurally almost identical to the DEV_MODE path (lines 438–490). Both paths:

1. Create a `User` record
2. Create `UserManager` records if `managerIds` provided
3. Create a `VerificationToken` record
4. Build a `verificationLink` from `BOT_USERNAME`

The two branches differ only in how the Supabase Auth record is created (`createUser` vs. direct DB insert) and the cleanup-on-failure logic. If the token generation logic needs to change (e.g., different expiry, additional fields), both branches must be updated in sync.

**Recommendation**: Extract the shared DB transaction logic into a private helper:

```typescript
async function createAccountantDbRecords(
  tx: PrismaTransactionClient,
  userId: string,
  email: string,
  fullName: string,
  role: string,
  managerIds: string[] | undefined,
  isOnboardingComplete: boolean,
): Promise<{ tokenValue: string }>
```

This is not a correctness bug but will become a maintenance liability as the onboarding flow evolves.

---

#### M-03: `verificationLink` can be `undefined` in the accountant production path despite having guarded `BOT_USERNAME`

**File**: `backend/src/api/trpc/routers/auth.ts:598-603`
**Category**: Code Quality / TypeScript

```typescript
const botUsername = env.BOT_USERNAME;   // string | undefined per env schema
if (botUsername) {
  verificationLink = `https://t.me/${botUsername}?start=verify_${result.tokenValue}`;
}
```

The `BOT_USERNAME` is already checked at line 529 with an explicit `PRECONDITION_FAILED` error, so reaching this point means `BOT_USERNAME` is guaranteed to be set. The redundant `if (botUsername)` check introduces a code path where `verificationLink` could be `undefined` even after the guard — confusing to future readers who may not notice the earlier check. TypeScript does not narrow `env.BOT_USERNAME` after the earlier throw because it's in a different block.

**Recommendation**: Assert the value directly after the earlier guard:

```typescript
const botUsername = env.BOT_USERNAME!; // safe: guarded above
verificationLink = `https://t.me/${botUsername}?start=verify_${result.tokenValue}`;
```

Or use a local variable captured before the `try` block:

```typescript
// Checked above; safe to assert
const botUsername = env.BOT_USERNAME as string;
```

---

#### M-04: `getScopedChatIds` is called on `managerProcedure` procedures — it now has dead `accountant` scoping code

**File**: `backend/src/api/trpc/helpers/scoping.ts:69-84`
**Category**: Code Quality

The `getScopedChatIds` helper documents and handles `accountant/observer` roles with a note: "Note: observers are typically not assigned as accountants, so this usually returns []." Now that `slaCompliance`, `feedbackSummary`, `getResponseTimeHistory`, and `getResponseTimeDistribution` are on `managerProcedure`, the `accountant` and `observer` branches in `getScopedChatIds` are dead code for these procedures (neither role can reach them). The manager branch (`role === 'manager'`) remains active for the manager context.

This is not a correctness bug — the scoping helper is also used by other procedures on `authedProcedure` and `accountantProcedure` — but the callers in `analytics.ts` now have unreachable code paths.

**Recommendation**: No immediate action required. If `analytics.ts` procedures are confirmed to be manager-only permanently, add a comment noting that `getScopedChatIds` will only return `null` (admin) or a manager-scoped list for these callers.

---

### Low Priority

#### L-01: `cooldown` feedback message uses integer division rounding incorrectly

**File**: `backend/src/bot/handlers/accountant.handler.ts:356-360`
**Category**: UX / Correctness

```typescript
const remainingSec = Math.ceil((PASSWORD_COOLDOWN_MS - (Date.now() - lastRequest)) / 1000);
await ctx.answerCbQuery(
  `Подождите ${Math.ceil(remainingSec / 60)} мин. перед повторным запросом.`
);
```

`remainingSec` is already in seconds (e.g., 270 seconds = 4.5 minutes). `Math.ceil(270 / 60) = 5`, so the message would say "Wait 5 min." even when only 10 seconds remain (at 9 seconds left: `Math.ceil(9/60) = 1`). This is intentionally conservative, but could be confusing to an accountant who sees "Wait 1 min." when they only need to wait 5 more seconds.

**Recommendation**: Use a more precise message when less than a minute remains:

```typescript
const remainingSec = Math.ceil((PASSWORD_COOLDOWN_MS - (Date.now() - lastRequest)) / 1000);
const remainingMin = Math.ceil(remainingSec / 60);
const waitText = remainingSec < 60 ? `${remainingSec} сек.` : `${remainingMin} мин.`;
await ctx.answerCbQuery(`Подождите ${waitText} перед повторным запросом.`);
```

---

#### L-02: `createUser` JSDoc comment still lists role constraint as `(admin, manager, observer)` without `accountant`

**File**: `backend/src/api/trpc/routers/auth.ts:409`
**Category**: Documentation

```typescript
* @param role - User role (admin, manager, observer)
```

The function now fully supports creating `accountant` role users (the entire new branch handles this case), but the JSDoc parameter comment was not updated to include `accountant`.

**Recommendation**: Update to `@param role - User role (admin, manager, observer, accountant)`.

---

## Security Analysis

### Role Guard Correctness

The `managerProcedure` chain is: `publicProcedure` → `isAuthed` → `isManager`. Both middlewares run on every call. The `isAuthed` middleware correctly checks `ctx.user !== null` and `isActive === true` before `isManager` checks the role array `['admin', 'manager']`. There is no bypass possible via middleware ordering or context mutation between steps.

The `isManager` middleware redundantly checks `!ctx.user` (line 103) after `isAuthed` already guarantees it is non-null. This is defensive but harmless — TypeScript's type narrowing does not propagate across middleware boundaries in tRPC v11.

### Token Generation

`randomBytes(16).toString('base64url')` produces 128 bits of entropy encoded in base64url, yielding a 22-character token. This is cryptographically secure and consistent with the existing `chats.createInvitation` pattern in the codebase. The 7-day expiry is reasonable for an onboarding token.

### Supabase Auth / DB Split-Brain Prevention

The production accountant path correctly uses a `try/catch` around the DB transaction with a compensating delete of the Supabase Auth user on failure. This pattern matches the existing non-accountant branch. One edge case: if `supabase.auth.admin.deleteUser` itself fails during cleanup, the error is logged but the function re-throws `dbError` (not `cleanupError`). This is correct behavior — the caller gets the root cause error.

### Password Link Exposure

The `supabase.auth.admin.generateLink({ type: 'recovery' })` call generates a one-time-use recovery link. The link is valid for 1 hour (Supabase default). The bot sends it as a Telegram message and attempts auto-deletion after 5 minutes. The 5-minute window is appropriate. However, see H-03 for the reliability concern.

The `email_confirm: true` flag in the accountant Supabase user creation is important — it ensures the accountant can immediately use the recovery link without first needing to confirm an email they may not have checked.

---

## Best Practices Validation

### Telegraf (v4.16.x)

The `ctx.telegram.deleteMessage(chatId, messageId)` call is the correct explicit API per Telegraf documentation. The shorthand `ctx.deleteMessage()` only works in message handler context and is not available in `setTimeout` callbacks where `ctx` may be stale. Using `ctx.telegram` (the raw Telegram client) is the appropriate pattern here.

The `ctx.editMessageReplyMarkup({ inline_keyboard: [] })` call correctly disables the "Request password" button after it is used, preventing re-use. The silent catch around it is appropriate since the message may have already been edited.

### TypeScript Patterns

No `any` types were introduced. `authData.user.id` accesses are guarded by explicit null checks at lines 554 and 646 before the `try/catch` transaction blocks. The `asUserRole` cast function is used consistently for DB role strings.

### Error Handling

The production accountant path uses `throw new Error(...)` (not `TRPCError`) for Supabase auth failures (lines 547–551). This is inconsistent with the rest of the file which uses `TRPCError`. Plain `Error` thrown from a tRPC mutation becomes `INTERNAL_SERVER_ERROR` at the client boundary — the client loses the specific error message. The DEV_MODE path has the same pattern (line 437).

This inconsistency pre-exists this PR but was not made worse by it. Recommend a follow-up to standardize: `throw new TRPCError({ code: 'CONFLICT', message: '...' })` for "already registered" errors.

---

## Summary Table

| ID   | Severity | Area               | File                        | Description                                          |
|------|----------|--------------------|-----------------------------|------------------------------------------------------|
| H-01 | High     | Security/Correctness | analytics.ts, feedback.ts  | Observer role loses analytics access (unintended?)   |
| H-02 | High     | Security           | accountant.handler.ts       | Rate-limit cooldown lost on process restart          |
| H-03 | High     | Security/Observability | accountant.handler.ts    | deleteMessage failures are silent, exposure unlogged |
| M-01 | Medium   | Documentation      | feedback.ts                 | Stale JSDoc authorization comment on getAggregates   |
| M-02 | Medium   | Maintainability    | auth.ts                     | Duplicated accountant creation logic in DEV/prod     |
| M-03 | Medium   | TypeScript         | auth.ts                     | Redundant BOT_USERNAME null check after guard        |
| M-04 | Medium   | Code Quality       | analytics.ts, scoping.ts    | Dead accountant/observer code paths in scoping       |
| L-01 | Low      | UX                 | accountant.handler.ts       | Cooldown message rounds up aggressively              |
| L-02 | Low      | Documentation      | auth.ts                     | JSDoc missing `accountant` in role parameter list    |

---

## Next Steps

### Must Address Before Merge

1. **H-01**: Decide and align the observer role access policy. Update either the frontend `useRoleGuard` calls or the procedure guards to be consistent.
2. **H-02**: Move cooldown state to Redis (or at minimum add entry pruning to prevent map growth).
3. **H-03**: Add error-type discrimination and `logger.warn` for unexpected `deleteMessage` failures. Change to `.catch()` pattern instead of `async/try/catch` in `setTimeout`.

### Should Address Before Merge

4. **M-01**: Update JSDoc on `feedback.getAggregates`.
5. **M-03**: Remove redundant `if (botUsername)` guard after the earlier `PRECONDITION_FAILED` throw.

### Can Defer

6. **M-02**: Extract shared DB transaction logic into a helper (tech debt, low risk now).
7. **M-04**: Add clarifying comment in analytics procedures.
8. **L-01**: Improve cooldown remaining-time message.
9. **L-02**: Update `createUser` JSDoc for `accountant` role.
