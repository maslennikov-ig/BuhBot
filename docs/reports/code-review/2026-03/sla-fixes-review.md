# Code Review: SLA Notifications -- assignedTo, Deterministic Ordering, Timezone

**Date**: 2026-03-18
**Scope**: Branch `fix/sla-notifications-accountant-timezone` vs `main` (1 commit)
**Files**: 5 | **Changes**: +21 / -12

## Summary

|              | Critical | High | Medium | Low |
| ------------ | -------- | ---- | ------ | --- |
| Issues       | 0        | 1    | 2      | 2   |
| Improvements | --       | --   | 1      | 2   |

**Verdict**: APPROVE WITH COMMENTS (0 Critical, 1 High -- performance/correctness concern in chats.ts, no blockers)

All five fixes are well-motivated, correctly target real bugs, and align with the existing codebase patterns. The changes are small, focused, and safe. One performance issue (triple user lookup) should be addressed as a follow-up.

---

## What Was Done Well

1. **Correct root-cause analysis for BUG 1**: Adding `assignedTo: chat.assignedAccountantId ?? null` at ClientRequest creation time (line 389 in `message.handler.ts`) ensures the assignment is captured at request creation, matching the pattern already used in `backend/src/api/trpc/routers/sla.ts:322` (`createData.assignedTo = chat.assignedAccountantId`). The `?? null` fallback is correct because `assignedAccountantId` is `String? @db.Uuid` in the Prisma schema (nullable).

2. **Deterministic ordering in BUG 2**: Moving assigned-accountant resolution before the username-based user lookup loop in `chats.ts` is the right approach. The `orderedIds` array explicitly places the assigned accountant at `[0]` and deduplicates via identity comparison, which is correct for `bigint` since all values come from the same Prisma query and JavaScript maintains reference equality for `BigInt()` values from a `Set`.

3. **Timezone fix in BUG 3**: Adding `timeZone: 'Europe/Moscow'` to `Intl.DateTimeFormat` is correct. The SLA page displays server-side timestamps (`receivedAt`, `responseAt`) which are stored in UTC. Without the `timeZone` option, the browser uses the local timezone, which would display incorrect times for users outside Moscow. This aligns with the project's `defaultTimezone: 'Europe/Moscow'` in `config.service.ts`.

4. **UX text update in UX 4**: The updated description for the accountantUsernames field is more accurate -- it now correctly communicates that the assigned accountant is auto-added, reducing user confusion.

5. **Data migration is safe**: The backfill migration is idempotent (`assigned_to IS NULL` guard), targets only existing data, and uses a simple join. It will not touch requests that already have an assignment (e.g., those created via the `sla.createRequest` tRPC procedure).

---

## Issues

### High (P1)

#### 1. Triple `tx.user.findUnique` for the same `assignedAccountantId` in `chats.ts` update

- **File**: `backend/src/api/trpc/routers/chats.ts` lines 484, 526, 552
- **Problem**: When `input.assignedAccountantId` is provided, the code now performs **three separate** `tx.user.findUnique()` queries for the same user within the same transaction:
  1. Line 484: `select: { isOnboardingComplete, isActive, fullName }` -- validation
  2. Line 526: `select: { telegramUsername }` -- auto-add to usernames
  3. Line 552 (NEW): `select: { telegramId }` -- resolve Telegram ID for `[0]` position

  All three queries hit the same row. While PostgreSQL caches the row in buffer pool, this still means three round-trips through the Prisma driver adapter within a `FOR UPDATE` locked transaction, increasing lock hold time unnecessarily.

- **Impact**: Under concurrent chat updates (e.g., two managers saving settings simultaneously), the longer lock hold time increases contention risk. The 5-second `lock_timeout` (line 414) mitigates deadlock, but reducing round-trips is still worthwhile.

- **Fix**: Consolidate into a single query at line 484 that selects all needed fields:

  ```typescript
  const assignee = await tx.user.findUnique({
    where: { id: input.assignedAccountantId },
    select: {
      isOnboardingComplete: true,
      isActive: true,
      fullName: true,
      telegramUsername: true,
      telegramId: true,
    },
  });
  ```

  Then reuse `assignee.telegramUsername` at line 526 and `assignee.telegramId` at line 552 instead of re-querying. This is a refactoring-safe change since all three lookups are within the same transaction and the row is locked.

  **Note**: This is a pre-existing issue (two lookups existed before this PR); the PR adds a third. Recommend fixing all three in a follow-up commit.

### Medium (P2)

#### 2. No test coverage for the new `assignedTo` field in message handler

- **File**: `backend/src/bot/handlers/__tests__/message.handler.test.ts`
- **Problem**: The existing tests for the message handler simulate the handler logic manually (not via the actual handler registration). None of the test cases include `assignedTo` in the `clientRequest.create` call data or assert that the field is populated from `chat.assignedAccountantId`. The test at line 140 creates a `ClientRequest` without the `assignedTo` field.
- **Impact**: The fix works at runtime but there is no regression guard. If someone refactors the handler and removes the `assignedTo` line, no test will fail.
- **Fix**: Update the REQUEST creation test (line 95) to include `assignedAccountantId` in the mock chat object and verify it appears in the `create` call:

  ```typescript
  // Mock chat with assigned accountant
  vi.mocked(mockPrisma.chat.findUnique).mockResolvedValue({
    id: BigInt(123),
    slaEnabled: true,
    monitoringEnabled: true,
    slaThresholdMinutes: 60,
    assignedAccountantId: 'acc-uuid-123',
  });

  // ... in the assertion:
  expect(mockPrisma.clientRequest.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        assignedTo: 'acc-uuid-123',
      }),
    })
  );
  ```

#### 3. No test coverage for deterministic ordering in chats.ts update

- **File**: `backend/src/api/trpc/routers/__tests__/chats.test.ts`
- **Problem**: The chats.test.ts file does not test the `accountantTelegramIds` ordering logic at all. The deterministic ordering (assigned accountant at `[0]`) is the core fix of BUG 2, but there is no test to verify it. This is particularly important because the ordering affects SLA notifications -- `getRecipientsByLevel` at `config.service.ts:244` uses `(accountantTelegramIds ?? [])[0]` for Level 1 alerts, and `sla-timer.worker.ts:136` uses `accountantIds[0]` for warnings.
- **Impact**: Same as above -- no regression guard for a critical ordering guarantee.
- **Fix**: Add an integration-style test that verifies when both `assignedAccountantId` and additional `accountantUsernames` are provided, the resulting `accountantTelegramIds` array has the assigned accountant's Telegram ID at index 0.

### Low (P3)

#### 4. Hardcoded timezone string in frontend SLA page

- **File**: `frontend/src/app/sla/page.tsx` line 52
- **Problem**: The timezone `'Europe/Moscow'` is hardcoded. The backend has this value configurable via `GlobalSettings.defaultTimezone` and `config.service.ts`. If the timezone is ever changed in GlobalSettings, the frontend SLA page will still display Moscow time.
- **Impact**: Low -- the project explicitly targets Russian accounting firms and the timezone is unlikely to change. But for consistency, it would be better to pass the timezone from the backend or define a shared constant.
- **Fix**: Either (a) fetch the timezone from the settings tRPC query already on the page (the `statsQuery` could include it), or (b) define a `DEFAULT_TIMEZONE` constant in a shared frontend config file and use it in both this page and any other timezone-dependent formatting.

#### 5. Migration file does not include a transaction wrapper

- **File**: `backend/prisma/migrations/20260318000000_backfill_assigned_to/migration.sql`
- **Problem**: The SQL migration runs as a single UPDATE statement, which is inherently atomic. However, Prisma migrations run each `.sql` file as a single transaction by default, so this is not actually a problem. Noting for documentation completeness.
- **Impact**: None -- Prisma handles the transaction wrapper.
- **Status**: Informational only, no action needed.

---

## Improvements (Optional)

### Medium

#### A. Consider adding `assignedTo` logging in message handler

The `ClientRequest created` log at line 398 does not include the `assignedTo` value. Adding it would improve debugging when investigating why a specific accountant received (or did not receive) an SLA notification:

```typescript
logger.info('ClientRequest created', {
  requestId: request.id,
  chatId,
  messageId,
  classification: classification.classification,
  assignedTo: chat.assignedAccountantId ?? null,
  service: 'message-handler',
});
```

### Low

#### B. JavaScript `Set` iteration order note

The BUG 2 fix relies on `Set` iteration order being insertion order, which is guaranteed by the ECMAScript specification (ECMA-262, 23.2.3.8). The code at lines 609-617 in `chats.ts` iterates the `telegramIdSet` and skips the `assignedAccountantTelegramId` to build `orderedIds`. This is correct but could benefit from a brief comment explaining why insertion order matters, since the `Set` is used for deduplication but the final ordering is built manually.

#### C. `assignedAccountantId` field in `Chat` can be stale at message creation time

When a message arrives in `message.handler.ts`, the code reads `chat.assignedAccountantId` from the `prisma.chat.findUnique()` result (line 86). If the admin changes the assigned accountant between the message arrival and the ClientRequest creation (a few milliseconds later), the request gets the old assignment. This is an inherent TOCTOU race condition, but it is extremely unlikely in practice and the impact is limited (the request gets assigned to the previous accountant). The backfill migration also only fills `NULL` values, so it does not retroactively fix reassignments. This is acceptable behavior -- noting for awareness only.

---

## File-by-File Analysis

### `backend/src/bot/handlers/message.handler.ts` (BUG 1)

| Aspect           | Status |
| ---------------- | ------ |
| Correctness      | OK     |
| Type safety      | OK -- `assignedAccountantId` is `String?`, `assignedTo` is `String? @db.Uuid`, compatible |
| Pattern match    | OK -- matches `sla.ts:322` pattern |
| Test coverage    | MISSING (P2 issue #2) |

**Change**: Line 389 adds `assignedTo: chat.assignedAccountantId ?? null`.
**Verdict**: Correct and minimal. The `?? null` is necessary because Prisma's `String?` can be `undefined` from the query result, but `assignedTo` in the create data expects `string | null`.

### `backend/src/api/trpc/routers/chats.ts` (BUG 2)

| Aspect           | Status |
| ---------------- | ------ |
| Correctness      | OK     |
| Type safety      | OK     |
| Pattern match    | OK -- uses existing `Set<bigint>` deduplication pattern |
| Performance      | CONCERN (P1 issue #1) |
| Test coverage    | MISSING (P2 issue #3) |

**Change**: Moves assigned-accountant Telegram ID resolution before the username loop; builds `orderedIds` array with assigned accountant at `[0]`.
**Verdict**: The ordering logic is correct. The `bigint` comparison at line 614 (`id !== assignedAccountantTelegramId`) works because `bigint` uses value equality in JavaScript. The deduplication via `Set.add()` before iteration ensures no duplicates.

### `frontend/src/app/sla/page.tsx` (BUG 3)

| Aspect           | Status |
| ---------------- | ------ |
| Correctness      | OK     |
| Impact           | Low risk |
| Consistency      | MINOR (P3 issue #4 -- hardcoded timezone) |

**Change**: Line 52 adds `timeZone: 'Europe/Moscow'`.
**Verdict**: Correct fix. Without this, dates are formatted in the browser's local timezone, which may not be Moscow.

### `frontend/src/components/chats/ChatSettingsForm.tsx` (UX 4)

| Aspect           | Status |
| ---------------- | ------ |
| Correctness      | OK     |
| i18n             | OK -- Russian text consistent with rest of UI |

**Change**: Lines 356-357 update the `FormDescription` text.
**Verdict**: Pure UX copy change, no logic impact.

### `backend/prisma/migrations/20260318000000_backfill_assigned_to/migration.sql` (DATA MIGRATION)

| Aspect           | Status |
| ---------------- | ------ |
| Correctness      | OK     |
| Idempotency      | OK -- `assigned_to IS NULL` guard |
| Safety           | OK -- UPDATE only, no DDL |
| Performance      | OK for current data volumes |

**Change**: Backfills `client_requests.assigned_to` from `chats.assigned_accountant_id` where NULL.
**Verdict**: Safe, idempotent, and follows existing migration naming conventions. For large datasets (>100K rows), consider batching, but current data volume does not require it.

---

## Cross-Cutting Verification

### Do all consumers of `accountantTelegramIds[0]` now get the assigned accountant?

| Consumer | File | Uses `[0]`? | Correct after fix? |
| --- | --- | --- | --- |
| `getRecipientsByLevel` (L1 breach) | `config.service.ts:244` | Yes | Yes -- reads from `chat.accountantTelegramIds` which is now ordered |
| Warning alert (pre-breach) | `sla-timer.worker.ts:136` | Yes | Yes -- same array |
| Contact accountant (menu) | `menu.handler.ts:140` | Yes | Yes -- same array |
| `getManagerIds` (deprecated) | `config.service.ts:219` | No (iterates all) | N/A |

All three consumers that rely on `[0]` position will now correctly receive the assigned accountant after the deterministic ordering fix in `chats.ts`.

### Does the `assignedTo` field propagate correctly through the system?

| Stage | Source | Field | Status |
| --- | --- | --- | --- |
| Request creation (bot) | `message.handler.ts:389` | `assignedTo = chat.assignedAccountantId` | NEW -- fixed in this PR |
| Request creation (tRPC) | `sla.ts:322` | `assignedTo = chat.assignedAccountantId` | Already existed |
| SLA page display | `sla.ts:233` | Reads `request.assignedTo`, joins User for name | Already existed |
| Alert stats | `alert.ts:818` | Reads `request.assignedTo` | Already existed |
| Backfill (migration) | `migration.sql` | Fills NULL values from chat | NEW -- this PR |

The flow is now consistent: both bot-originated and tRPC-originated requests capture `assignedTo` at creation time.

---

## Conclusion

This PR correctly addresses three bugs, one UX issue, and includes a safe data migration. The changes are minimal and well-targeted. The one High-priority item (triple user lookup) is a performance concern that predates this PR but is worsened by the new code; it should be addressed in a follow-up. The two Medium items (missing test coverage) are standard recommendations that would improve confidence in the ordering guarantee.

**Recommendation**: Approve and merge. Create a follow-up task for:
1. Consolidating the three `tx.user.findUnique` calls in `chats.ts` update
2. Adding test coverage for `assignedTo` in message handler tests
3. Adding test coverage for deterministic `accountantTelegramIds` ordering
