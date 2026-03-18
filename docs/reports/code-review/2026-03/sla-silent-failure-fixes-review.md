# Code Review: SLA Silent Failure Fixes

**Date:** 2026-03-18
**Commit:** `34bed6f fix(sla): handle classification/timer failures, webhook dedup, resolve errors`
**Branch:** `fix/sla-notifications-accountant-timezone`
**Reviewer:** Code Review Agent (Opus 4.6)
**Severity Ratings:** Critical | Important | Suggestion

---

## Summary

This commit addresses three bugs in the SLA monitoring pipeline:

1. **BUG 1 (CRITICAL):** Classification/timer errors silently killed the entire message pipeline, preventing ClientRequest creation and SLA timer starts.
2. **BUG 2 (HIGH):** Telegram webhook retries could create duplicate `ClientRequest` records due to missing unique constraint on `(chatId, messageId)`.
3. **BUG 3 (HIGH):** The resolve button in `alert-callback.handler.ts` had weak error handling -- auth failures, already-resolved requests, and Prisma "Record not found" errors all produced the same generic error message.

**Changed files (7):**
- `backend/src/bot/handlers/message.handler.ts`
- `backend/src/bot/handlers/alert-callback.handler.ts`
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260318100000_unique_client_request_message/migration.sql`
- `backend/src/services/classifier/types.ts`
- `backend/src/api/trpc/routers/sla.ts`
- `.beads/issues.jsonl`

**Overall Assessment:** The fixes are well-targeted, defensive, and follow existing codebase patterns. The classification fallback design (defaulting to REQUEST on error) is a sound product decision. The layered dedup approach (application-level check + DB unique constraint + P2002 catch) is thorough. A few issues are noted below.

---

## What Was Done Well

1. **Classification fallback strategy is correct.** Defaulting to `REQUEST` on classification failure ensures SLA timers always start. A false positive (non-request tracked as request) is far safer than a false negative (real request silently dropped). The confidence score of `0` makes these easy to identify and filter in analytics.

2. **Defense-in-depth dedup.** Three layers protect against duplicate ClientRequests:
   - Application-level `findFirst` by `(chatId, messageId)` (fast-path, avoids unnecessary work)
   - Database-level `@@unique([chatId, messageId])` constraint (hard guarantee)
   - `P2002` catch block (graceful handling of the race window between findFirst and create)

3. **Proper span management.** Both the classification and SLA timer catch blocks correctly set span status to error (`code: 2`) and the `finally` blocks still call `span.end()`. This preserves OpenTelemetry trace integrity.

4. **Separation of auth failure from missing request.** In `alert-callback.handler.ts`, the `!request` and `!isAuthorized` checks are now separate code paths with distinct logging, making production debugging much easier.

5. **Pre-transaction status check.** The `request.status === 'answered'` guard before the `$transaction` in the resolve handler prevents unnecessary DB writes and provides a clear user-facing message.

6. **tRPC output mapping.** The `sla.ts` router correctly maps `'error-fallback'` to `'keyword-fallback'` in the output schema, preventing schema validation errors from the `ClassificationSourceSchema` enum which only knows `'openrouter' | 'keyword-fallback'`.

---

## Issues Found

### Important (Should Fix)

#### I-1: Misleading "SLA timer started" log after timer failure

**File:** `backend/src/bot/handlers/message.handler.ts`, lines 479-484

The `logger.info('SLA timer started for request', ...)` statement is **outside** the try/catch block and executes unconditionally after the timer catch block. If `startSlaTimer` threw an error, this log line still fires, producing a misleading INFO log that claims the timer started when it actually failed.

```typescript
// Line 464-477: try/catch/finally for startSlaTimer
try {
  await startSlaTimer(request.id, String(chatId), thresholdMinutes);
} catch (timerError) {
  // ... error logged ...
} finally {
  slaSpan.end();
}

// Line 479-484: THIS RUNS EVEN AFTER FAILURE
logger.info('SLA timer started for request', {
  requestId: request.id,
  chatId,
  thresholdMinutes,
  service: 'message-handler',
});
```

**Recommendation:** Move the success log inside the `try` block, after the `await startSlaTimer(...)` call, or guard it with a flag.

---

#### I-2: Migration dedup logic does not handle identical `received_at` timestamps

**File:** `backend/prisma/migrations/20260318100000_unique_client_request_message/migration.sql`, lines 1-6

The dedup DELETE uses `a.received_at > b.received_at` to decide which row to keep. If two duplicate rows have the **exact same** `received_at` value (plausible for webhook retries processed in the same millisecond), neither row is deleted (the condition `a.received_at > b.received_at` is false in both directions). Then the `ADD CONSTRAINT UNIQUE` statement on line 10 fails, and the entire migration rolls back.

```sql
DELETE FROM "public"."client_requests" a
USING "public"."client_requests" b
WHERE a."chat_id" = b."chat_id"
  AND a."message_id" = b."message_id"
  AND a."received_at" > b."received_at";
```

**Recommendation:** Add a tiebreaker. Use `ctid` (PostgreSQL physical row ID) or the `id` column (UUID, lexicographic ordering) as a secondary comparison:

```sql
DELETE FROM "public"."client_requests" a
USING "public"."client_requests" b
WHERE a."chat_id" = b."chat_id"
  AND a."message_id" = b."message_id"
  AND (a."received_at" > b."received_at"
       OR (a."received_at" = b."received_at" AND a."id" > b."id"));
```

**Severity note:** If there are currently zero actual duplicates in production, this is a latent issue. If there are duplicates with identical timestamps, the migration will fail on deploy. Worth verifying against production data.

---

#### I-3: Cascading deletes from migration dedup may silently remove SLA alerts and request history

**File:** `backend/prisma/migrations/20260318100000_unique_client_request_message/migration.sql`

The Prisma schema defines `onDelete: Cascade` on:
- `SlaAlert.request` (FK to ClientRequest)
- `RequestHistory.request` (FK to ClientRequest)
- `ClassificationCorrection.request` (FK to ClientRequest)

When the migration's DELETE removes duplicate `ClientRequest` rows, any linked `SlaAlert`, `RequestHistory`, and `ClassificationCorrection` rows are **silently cascade-deleted**. This is likely the intended behavior (orphaned data for duplicate rows is noise), but it should be explicitly documented in the migration comment and verified that no active/unresolved alerts are attached to the rows being removed.

**Recommendation:** Add a comment to the migration noting the cascade behavior. Optionally, add a pre-migration diagnostic query:

```sql
-- Diagnostic: check for SLA alerts linked to duplicate requests that will be deleted
-- SELECT a.id, count(sa.id) as alert_count
-- FROM "public"."client_requests" a
-- JOIN "public"."client_requests" b ON a."chat_id" = b."chat_id" AND a."message_id" = b."message_id" AND a."received_at" > b."received_at"
-- LEFT JOIN "public"."sla_alerts" sa ON sa."request_id" = a."id"
-- GROUP BY a.id HAVING count(sa.id) > 0;
```

---

#### I-4: `!request` check sends misleading authorization error message to user

**File:** `backend/src/bot/handlers/alert-callback.handler.ts`, lines 411-413

When `request` is `null` (the ClientRequest was deleted between the alert lookup and the request lookup), the user sees the message "No permissions for this action" ("Net prav dlya etogo deystviya"). This is misleading -- the actual problem is that the request no longer exists, not that the user lacks permissions.

```typescript
if (!request) {
  await ctx.answerCbQuery('Нет прав для этого действия');  // Wrong message
  return;
}
```

**Recommendation:** Use a more accurate message:

```typescript
if (!request) {
  await ctx.answerCbQuery('Запрос не найден');
  return;
}
```

---

### Suggestions (Nice to Have)

#### S-1: The `findFirst` for messageId dedup could use `findUnique` instead

**File:** `backend/src/bot/handlers/message.handler.ts`, lines 309-312

Since there is now a `@@unique([chatId, messageId])` constraint on `ClientRequest`, the `findFirst` query on line 309 could be replaced with `findUnique` using the named constraint. This is marginally more efficient (Prisma skips the LIMIT 1 and uses a direct index lookup) and communicates intent more clearly.

```typescript
// Current:
const existingByMessageId = await prisma.clientRequest.findFirst({
  where: { chatId: BigInt(chatId), messageId: BigInt(messageId) },
  select: { id: true },
});

// Suggested:
const existingByMessageId = await prisma.clientRequest.findUnique({
  where: {
    unique_request_per_message: {
      chatId: BigInt(chatId),
      messageId: BigInt(messageId),
    },
  },
  select: { id: true },
});
```

---

#### S-2: Classification fallback model stored in DB as 'error-fallback' -- schema comment is outdated

**File:** `backend/prisma/schema.prisma`, line 303

The schema comment says `// 'openrouter', 'keyword-fallback'` but now `'error-fallback'` and `'cache'` are also valid values. Since this is a `String?` column (no DB-level enum), it works correctly, but the comment is stale.

```prisma
classificationModel String?  @map("classification_model") // 'openrouter', 'keyword-fallback'
```

**Recommendation:** Update to:

```prisma
classificationModel String?  @map("classification_model") // 'openrouter', 'keyword-fallback', 'cache', 'error-fallback'
```

---

#### S-3: No test coverage for new error-handling paths

The existing test file (`backend/src/bot/handlers/__tests__/message.handler.test.ts`) does not cover any of the new scenarios:
- Classification failure with REQUEST fallback
- Timer start failure (graceful degradation)
- P2002 unique constraint catch
- Webhook retry dedup (`findFirst` by messageId)

Similarly, there are no tests for the alert-callback resolve handler at all (`alert-callback.handler.test.ts` does not exist).

**Recommendation:** Add test cases for:
1. `classifyMessage` throwing -> verify fallback classification is `REQUEST` with `model: 'error-fallback'`
2. `startSlaTimer` throwing -> verify ClientRequest is still created, error is logged
3. `prisma.clientRequest.create` throwing `P2002` -> verify silent return (no re-throw)
4. Existing `ClientRequest` with same `messageId` -> verify early return

---

#### S-4: Consider adding a metric/alert for classification fallback events

When classification falls back to `'error-fallback'`, it means the AI classification service is down. Since there is already a `prom-client` setup (per CLAUDE.md), adding a counter metric (e.g., `sla_classification_fallback_total`) would enable Grafana alerting when the classifier starts failing, rather than relying on log analysis.

---

#### S-5: The `answerCbQuery` in the outer catch block of the resolve handler could itself throw

**File:** `backend/src/bot/handlers/alert-callback.handler.ts`, lines 508-512

If the original error was a Telegram API timeout, calling `ctx.answerCbQuery(userMsg)` in the catch block could also throw (callback query expired, 30-second limit). This would mask the original error. A defensive try-catch around `answerCbQuery` in the catch block would prevent this.

This is a pre-existing pattern throughout the file (the notify handler has the same issue at line 347), so it is not introduced by this commit, but worth noting.

---

## Migration Safety Assessment

| Concern | Assessment |
|---|---|
| **Table locking** | `ADD CONSTRAINT UNIQUE` acquires a `SHARE ROW EXCLUSIVE` lock on the table. For a small-to-medium `client_requests` table, this should be fast (sub-second). For tables with >1M rows, consider `CREATE UNIQUE INDEX CONCURRENTLY` + `ADD CONSTRAINT USING INDEX` instead. |
| **Data loss** | The DELETE statement removes duplicate rows. Cascade-deletes will remove linked SLA alerts, request history, and classification corrections for those rows. This is acceptable if duplicates are garbage data. |
| **Rollback** | The migration is not wrapped in an explicit transaction. Prisma runs each migration file in an implicit transaction by default. If the UNIQUE constraint fails (e.g., due to identical `received_at` as noted in I-2), the DELETE also rolls back. No partial state. |
| **Idempotency** | Running the migration twice would fail (constraint already exists). Standard for Prisma migrations -- they track applied state. |

---

## Type Safety Check

TypeScript compilation passes cleanly (`tsc --noEmit` returns 0 with no errors). The `'error-fallback' as const` assertion in the catch block correctly narrows the type to be compatible with `ClassificationSource`.

---

## Verdict

The fixes are solid and address real production risks. The three-layer dedup approach is particularly well-designed.

**Must address before merge:**
- I-2 (migration dedup tiebreaker) -- only if production data could have duplicates with identical timestamps. Verify against production before deciding.

**Should address (can be follow-up):**
- I-1 (misleading success log after timer failure) -- low effort fix, high value for production debugging
- I-4 (wrong user message for missing request) -- one-line fix

**Can defer:**
- I-3 (cascade documentation) -- documentation only
- S-1 through S-5 -- improvements, not blockers
