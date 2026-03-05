# Code Review: Accountant Role Implementation

| Field          | Value                                     |
| -------------- | ----------------------------------------- |
| **Branch**     | `feat/accountant-role`                    |
| **PRD**        | `docs/PRD-Accountant-Role.md`             |
| **Reviewer**   | AI Code Review Agent                      |
| **Date**       | 2026-03-05                                |
| **Status**     | Review Complete                           |

---

## Summary

The Accountant Role implementation covers the core requirements from the PRD across 4 phases: Schema Migration, API Layer, Manager Scoping, and New Features. The overall code quality is good, with well-structured routers, proper Prisma schema design, and consistent error handling patterns. However, the review identified several critical and high-severity issues, primarily around incomplete manager scoping coverage, missing PRD-mandated checks, and inconsistent middleware usage.

### What Was Done Well

- Clean, well-documented Prisma schema additions with proper indexes, unique constraints, and FK cascades.
- The `getScopedChatIds()` helper (`backend/src/api/trpc/helpers/scoping.ts`) is a good centralized approach for role-based data filtering.
- Transaction usage in `auth.ts:createUser` for atomic creation of user + manager assignments + verification token.
- Verification flow in `invitation.handler.ts:processVerification` is thorough with proper duplicate checks and TelegramAccount upsert.
- Deactivation flow has good prerequisite checks (orphan accountant detection, assigned chat validation).
- Bot handler error handling is consistent with try/catch and user-friendly Russian error messages.
- Migration SQL is clean, additive, and uses `IF NOT EXISTS` for the enum value.

---

## Issues

### CRITICAL

#### C-01: Manager Scoping NOT Applied to Multiple PRD-Mandated Routers

**Files affected:**
- `/home/me/code/bobabuh/backend/src/api/trpc/routers/analytics.ts`
- `/home/me/code/bobabuh/backend/src/api/trpc/routers/sla.ts`
- `/home/me/code/bobabuh/backend/src/api/trpc/routers/feedback.ts`
- `/home/me/code/bobabuh/backend/src/api/trpc/routers/messages.ts`

**Description:** The PRD (Section 7.3, Section 13.3 AC-018, and Section 10 API Changes table) explicitly lists the following routers as requiring manager scoping:

| Router       | Procedures                                                      |
| ------------ | --------------------------------------------------------------- |
| `analytics`  | `slaCompliance`, `feedbackSummary`, `accountantPerformance`     |
| `sla`        | `getRequests`, `getActiveTimers`                                |
| `feedback`   | `getAggregates`, `getAll`, `exportCsv`                          |
| `messages`   | `listByChat`                                                    |

None of these routers import or use `getScopedChatIds`. This means:
- Managers can see analytics/feedback/SLA data for ALL chats, not just their group's chats.
- Accountants calling these endpoints (if accessible via `authedProcedure`) can see data outside their assigned chats.
- This violates PRD acceptance criteria AC-014 through AC-018.

**Recommendation:** Apply `getScopedChatIds` to all listed routers following the same pattern used in `requests.ts` and `alert.ts`.

---

#### C-02: Missing `isOnboardingComplete` Check Before Chat Assignment

**File:** `/home/me/code/bobabuh/backend/src/api/trpc/routers/chats.ts` (line 362, `update` mutation)

**Description:** PRD Section 12 (EC-16) and Acceptance Criteria AC-025 state:

> "An unverified accountant (`isOnboardingComplete = false`) cannot be assigned to a chat."

The `chats.update` mutation accepts `assignedAccountantId` without checking whether the target user has `isOnboardingComplete === true`. An unverified accountant can be assigned to chats, which violates the PRD.

**Recommendation:** Add validation in the `update` mutation:

```typescript
if (input.assignedAccountantId) {
  const accountant = await tx.user.findUnique({
    where: { id: input.assignedAccountantId },
    select: { isOnboardingComplete: true, role: true },
  });
  if (accountant?.role === 'accountant' && !accountant.isOnboardingComplete) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Бухгалтер не прошел верификацию Telegram. Назначение невозможно.',
    });
  }
}
```

---

### HIGH

#### H-01: `isManager` Middleware Missing `isActive` Check

**File:** `/home/me/code/bobabuh/backend/src/api/trpc/trpc.ts` (lines 101-122)

**Description:** The `isAuthed` middleware (line 73) and `isAccountant` middleware (line 142) both check `ctx.user.isActive === false` and throw FORBIDDEN. However, the `isManager` middleware (lines 101-122) and `isAdmin` middleware (lines 175-196) do NOT check `isActive`. This means a deactivated manager or admin can still call `managerProcedure` and `adminProcedure` endpoints.

**Recommendation:** Add the `isActive` check to both `isManager` and `isAdmin` middlewares:

```typescript
if (ctx.user.isActive === false) {
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'Your account is deactivated.',
  });
}
```

Alternatively, chain `isAuthed` before `isManager`/`isAdmin` so the check is inherited. Currently `managerProcedure = publicProcedure.use(isManager)` -- it skips the `isAuthed` middleware entirely.

---

#### H-02: `managerProcedure` and `adminProcedure` Do Not Chain Through `isAuthed`

**File:** `/home/me/code/bobabuh/backend/src/api/trpc/trpc.ts` (lines 221, 244)

**Description:** The procedure chain is:
```
authedProcedure = publicProcedure.use(isAuthed)
managerProcedure = publicProcedure.use(isManager)   // <-- skips isAuthed
adminProcedure = publicProcedure.use(isAdmin)        // <-- skips isAuthed
accountantProcedure = publicProcedure.use(isAccountant) // <-- skips isAuthed
```

This is pre-existing but the accountant role exacerbates it because `isActive` is now a critical check. The `isManager` middleware duplicates the null-user check but does NOT duplicate the `isActive` check. This means `managerProcedure` and `adminProcedure` routes allow deactivated users.

**Recommendation:** Either:
1. Chain: `managerProcedure = authedProcedure.use(isManager)` (preferred), or
2. Add `isActive` check to all middleware stacks.

---

#### H-03: `chats.list` Scoping Uses `assignedAccountantId` Instead of `getScopedChatIds`

**File:** `/home/me/code/bobabuh/backend/src/api/trpc/routers/chats.ts` (lines 87-89)

**Description:** The `chats.list` procedure scopes accountants and observers by setting `where.assignedAccountantId = ctx.user.id`. This is correct for accountants and observers but does NOT apply manager scoping. A manager without any `UserManager` records sees ALL chats. The PRD requires managers to see only chats assigned to their group of accountants.

The `getScopedChatIds` helper already handles this correctly (it returns group-scoped chat IDs for managers). It should be used here instead of the direct `assignedAccountantId` filter.

**Recommendation:** Replace lines 87-89 with:

```typescript
const scopedChatIds = await getScopedChatIds(ctx.prisma, ctx.user.id, ctx.user.role);
if (scopedChatIds !== null) {
  where.id = { in: scopedChatIds };
}
```

---

#### H-04: `chats.getById` Does Not Apply Manager Scoping

**File:** `/home/me/code/bobabuh/backend/src/api/trpc/routers/chats.ts` (line 221)

**Description:** `requireChatAccess()` allows admin and manager roles unconditionally. A manager can view any chat's details, not just chats in their group. The PRD (AC-016) states: "A manager cannot see or modify chats belonging to another manager's group."

**Recommendation:** Update `requireChatAccess()` or add scoping check before calling it for managers:

```typescript
if (ctx.user.role === 'manager') {
  const scopedChatIds = await getScopedChatIds(ctx.prisma, ctx.user.id, ctx.user.role);
  if (scopedChatIds !== null && !scopedChatIds.includes(chat.id)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied.' });
  }
}
```

---

#### H-05: `getScopedChatIds` Uses Type Cast `(prisma as PrismaClient)` for Transaction Client

**File:** `/home/me/code/bobabuh/backend/src/api/trpc/helpers/scoping.ts` (lines 37, 45, 57)

**Description:** The function accepts `PrismaClient | PrismaTransactionClient` but then casts back to `PrismaClient` with `(prisma as PrismaClient)` when calling `userManager.findMany()` and `chat.findMany()`. The `PrismaTransactionClient` type (extracted from `$transaction`) may have a different shape depending on Prisma 7 driver adapter mode. If this function is called within a transaction, the cast may cause it to execute queries outside the transaction boundary.

**Recommendation:** Use the `prisma` parameter directly without casting. Both `PrismaClient` and `PrismaTransactionClient` expose the same model delegates. If TypeScript complains, use a shared interface or `Omit<PrismaClient, '$connect' | '$disconnect' | ...>`.

---

### MEDIUM

#### M-01: Verification Token Returned in `createUser` API Response

**File:** `/home/me/code/bobabuh/backend/src/api/trpc/routers/auth.ts` (lines 463-470)

**Description:** The `createUser` output includes `verificationToken: z.string().nullable()`. This token is a security-sensitive credential used for Telegram identity linking. Returning it in the API response means:
1. It appears in network logs and browser DevTools.
2. An admin user's compromised session could be used to link arbitrary Telegram accounts.

The PRD (Section 7.6) expects the token to be sent directly to the accountant via Telegram bot, not returned in the HTTP response.

**Recommendation:** Either:
1. Remove `verificationToken` from the output and send it via the bot directly in the `createUser` mutation.
2. If it must be displayed in the admin UI, add a warning and ensure the token is single-use (already implemented) and short-lived.

---

#### M-02: `/mystats` and `/mychats` Commands Not Role-Gated

**File:** `/home/me/code/bobabuh/backend/src/bot/handlers/accountant.handler.ts` (lines 52-135, 140-202)

**Description:** The `/mystats` and `/mychats` commands check if the user exists in the system but do NOT check if the user has the `accountant` role. A manager or observer with a linked Telegram account can also run these commands. While this is mostly harmless (they would see their own stats), it is inconsistent with `/newchat` which correctly checks `user.role !== 'accountant'` (line 220).

**Recommendation:** Add a role check for consistency, or document that these commands are intentionally available to all verified users.

---

#### M-03: `notifications` Bot Command Missing `chat_linked` Type Label

**File:** `/home/me/code/bobabuh/backend/src/bot/handlers/accountant.handler.ts` (lines 296-301)

**Description:** The `typeLabel` map at line 296 defines labels for 4 notification types but the `NOTIFICATION_TYPES` constant in `notificationPref.ts` defines 5 types including `chat_linked`. If a user has a `chat_linked` preference stored, the bot command will display the raw key instead of a human-readable label.

**Recommendation:** Add `chat_linked: 'Подключение чата'` to the `typeLabel` map.

---

#### M-04: `accountantProcedure` Used Inconsistently for Alert Reading

**File:** `/home/me/code/bobabuh/backend/src/api/trpc/routers/alerts.ts` (line 36)

**Description:** `listUnacknowledged` uses `accountantProcedure` (admin + manager + accountant), but `acknowledge` still uses `managerProcedure` (admin + manager only). This is correct per PRD. However, the `alert.ts` router uses `authedProcedure` for read operations (`getAlerts`, `getActiveAlerts`, `getAlertStats`, `getActiveAlertCount`), which means observers can also see alerts. Per the RBAC matrix, observer alert access should be scoped to assigned chats. The scoping helper handles this, but the inconsistency between `authedProcedure` (includes observer) and `accountantProcedure` (excludes observer) for essentially the same kind of data is confusing.

**Recommendation:** Standardize on one approach. If observers should see scoped alerts (per RBAC matrix), then `authedProcedure` + `getScopedChatIds` is correct for `alert.ts`. The `alerts.ts` router should also use `authedProcedure` instead of `accountantProcedure` for consistency, or document why the legacy alerts router excludes observers.

---

#### M-05: `notificationPref.override` Does Not Verify Admin Bypass

**File:** `/home/me/code/bobabuh/backend/src/api/trpc/routers/notificationPref.ts` (lines 209-248)

**Description:** The `override` procedure uses `managerProcedure` and checks that the caller manages the target accountant. However, if an admin calls `override`, the `userManager` check will fail because admins may not have explicit `UserManager` records. Admins should use `adminOverride` instead, but this is not enforced or documented in the error message.

The current behavior: Admin calls `override` -> `managerProcedure` passes (admin is allowed) -> `userManager.findUnique` returns null -> throws FORBIDDEN "You don't manage this accountant."

**Recommendation:** Either:
1. Add an admin bypass in the `override` procedure: `if (ctx.user.role === 'admin') { /* skip check */ }`
2. Clearly document that admins must use `adminOverride`.

---

#### M-06: `reassign` Does Not Check for Duplicate Assignment to New Manager

**File:** `/home/me/code/bobabuh/backend/src/api/trpc/routers/userManager.ts` (lines 199-212)

**Description:** The `reassign` procedure deletes the old manager link and creates a new one in a batch transaction. However, if the accountant is already assigned to the `newManagerId` (through a separate assignment), the `create` will fail with a unique constraint violation (`unique_manager_accountant`), producing an unhandled Prisma error instead of a user-friendly message.

**Recommendation:** Add a duplicate check or use `upsert` to handle this case gracefully.

---

#### M-07: Manager Scoping Performance -- N+1 Query Pattern

**File:** `/home/me/code/bobabuh/backend/src/api/trpc/helpers/scoping.ts` (lines 37-53)

**Description:** For every request that uses `getScopedChatIds`, the manager path executes TWO queries:
1. `userManager.findMany` to get accountant IDs
2. `chat.findMany` to get chat IDs assigned to those accountants

This runs on EVERY procedure call that uses scoping (requests.list, alerts.listUnacknowledged, alert.getAlerts, etc.). For frequently-called dashboard endpoints like `getActiveAlertCount`, this adds unnecessary latency.

**Recommendation:** Consider caching the scoped chat IDs per request (e.g., in the tRPC context) or using a single raw SQL query with a JOIN.

---

### LOW

#### L-01: `deleteUser` Does Not Clean Up `UserManager` Records

**File:** `/home/me/code/bobabuh/backend/src/api/trpc/routers/auth.ts` (lines 483-534)

**Description:** When deleting a user, the procedure unassigns chats and deletes the TelegramAccount, but does not explicitly delete `UserManager` records. The FK has `ON DELETE CASCADE` so this is handled at the DB level, but it would be clearer to include it in the application logic for documentation purposes.

**Impact:** Low -- CASCADE handles it. But if a different DB engine is used in the future without CASCADE support, this would leave orphaned records.

---

#### L-02: Frontend `AccountantSelect` Uses `trpc.user.list` with Array Role Filter

**File:** `/home/me/code/bobabuh/frontend/src/components/chats/AccountantSelect.tsx` (line 65)

**Description:** The component calls `trpc.user.list.useQuery({ role: ['manager', 'admin', 'accountant'] })`. The `user.list` endpoint accepts `role` as either a single string or an array. This works, but including `manager` and `admin` in a dropdown labeled "select accountant" is semantically confusing and may show non-accountant users in the assignment dropdown.

**Recommendation:** Filter by `role: ['accountant']` only, or rename the component to reflect that it selects any user, not just accountants.

---

#### L-03: `newchat` Bot Command Uses Short Token Format

**File:** `/home/me/code/bobabuh/backend/src/bot/handlers/accountant.handler.ts` (lines 231-232)

**Description:** `generateToken(16)` produces a 16-character hex string. The `chats.createInvitation` procedure uses `randomBytes(16).toString('base64url')` which produces 22 characters with higher entropy. The inconsistency is minor but reduces the security margin for bot-created tokens.

**Recommendation:** Use `randomBytes(16).toString('base64url')` for consistency with the web-created tokens.

---

#### L-04: Accountant Handler Not Exported from `bot/index.ts` for Testing

**File:** `/home/me/code/bobabuh/backend/src/bot/index.ts`

**Description:** The file exports `registerAccountantHandler` in the import but does not re-export it at the bottom of the file where other handlers are explicitly re-exported for testing (lines 134-145). The `registerSystemHandler` is also missing from the re-exports.

**Recommendation:** Add `export { registerAccountantHandler };` and `export { registerSystemHandler };` to the re-exports section.

---

#### L-05: `deactivateUser` Checks Assigned Chats Only for Accountant Role

**File:** `/home/me/code/bobabuh/backend/src/api/trpc/routers/auth.ts` (lines 592-596)

**Description:** The deactivation check for assigned chats is role-gated to `user.role === 'accountant'`, but `assignedAccountantId` can reference any user role (admin, manager, observer). If a manager or observer is assigned as an accountant on chats, deactivating them would leave those chats with a deactivated `assignedAccountantId`.

**Recommendation:** Check for assigned chats regardless of role, or at least for `['accountant', 'observer']` roles.

---

## PRD Compliance Summary

| PRD Requirement                    | Status        | Notes                                                         |
| ---------------------------------- | ------------- | ------------------------------------------------------------- |
| Accountant role in enum            | Complete      | Schema + migration                                            |
| `isActive` field on User           | Complete      | Schema + migration + middleware (partial -- see H-01)         |
| Manager-Accountant M:N model       | Complete      | `UserManager` table + router                                  |
| Manager scoping (all routers)      | **Partial**   | Missing: analytics, sla, feedback, messages, chats.list (C-01, H-03) |
| Accountant scoping                 | Complete      | Via `getScopedChatIds` and `assignedAccountantId` filter      |
| Telegram verification flow         | Complete      | `processVerification` in invitation handler                   |
| Bot commands (/mystats, /mychats)  | Complete      | `accountant.handler.ts`                                       |
| Bot command /newchat               | Complete      | Self-service chat invitation                                  |
| Notification preferences           | Complete      | Full CRUD with override hierarchy                             |
| Deactivation flow                  | Complete      | With orphan detection and prerequisite checks                 |
| Reactivation flow                  | Complete      | Simple reactivation                                           |
| isOnboardingComplete gate          | **Missing**   | Not enforced on chat assignment (C-02)                        |
| Observer role unchanged            | Complete      | No regressions observed                                       |
| Frontend AccountantSelect update   | Complete      | Added 'accountant' to role filter                             |

---

## Action Items (Priority Order)

1. **[CRITICAL] C-01**: Apply `getScopedChatIds` to `analytics.ts`, `sla.ts`, `feedback.ts`, `messages.ts`
2. **[CRITICAL] C-02**: Add `isOnboardingComplete` check in `chats.update` before assigning accountant
3. **[HIGH] H-01 + H-02**: Fix `isActive` check gap in `isManager`/`isAdmin` middlewares (or chain through `isAuthed`)
4. **[HIGH] H-03**: Replace direct `assignedAccountantId` filter with `getScopedChatIds` in `chats.list`
5. **[HIGH] H-04**: Add manager scoping to `chats.getById` via updated `requireChatAccess`
6. **[HIGH] H-05**: Remove unsafe `PrismaClient` cast in `getScopedChatIds`
7. **[MEDIUM] M-01 through M-07**: Address as follow-up tasks
8. **[LOW] L-01 through L-05**: Address at team's convenience
