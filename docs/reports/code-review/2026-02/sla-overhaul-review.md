# Code Review: SLA Notification System Overhaul
## Date: 2026-02-26
## Reviewer: code-reviewer agent
## Branch: fix/sla-notification-managers
## Commits reviewed: 0cac6be, 778d205, d67a49f (3 commits, 18 files, +745/-118)

---

## Summary

The SLA Notification System Overhaul is a well-structured 5-phase refactor that introduces
two-tier escalation, SLA warning alerts, input validation improvements, and user verification
indicators. The overall architecture is sound. The DRY consolidation of recipient resolution
into `getRecipientsByLevel` is a significant improvement.

Seven issues were identified: one critical (dead code path causing incorrect message format),
two important (missing idempotency guard, removed error handler), and four minor (wall-clock
vs working-hours inconsistency, stub UI code, duplicate DB query, missing test coverage).

---

## Critical Issues (must fix)

### [CR-001] `formatWarningMessage` is defined but never called - warning notifications use the wrong message format

**File:** `backend/src/services/alerts/format.service.ts:361`, `backend/src/queues/alert.worker.ts:191`

`formatWarningMessage` was added in Phase 3 with a `remainingMinutes` field to show
"Осталось: X мин из Y мин" to accountants. However, `alert.worker.ts` dispatches all
`queueAlert` jobs (including `alertType: 'warning'`) through `formatAlertMessage`, which
uses the breach template and shows elapsed time only - never the remaining time.

The call chain is:
```
sla-timer.worker.ts → queueAlert({alertType:'warning'}) → alert.worker.ts:191 → formatAlertMessage(alertType)
```

`formatWarningMessage` in `format.service.ts` is exported but has zero callers. The warning
message accountants receive shows "ПРЕДУПРЕЖДЕНИЕ SLA" in the header (correct) but shows
elapsed time without the "Осталось: X мин" line that was the whole point of the function.

**Fix:** In `alert.worker.ts`, branch on `alertType` when formatting:
```typescript
formattedMessage = alertType === 'warning'
  ? formatWarningMessage({
      clientUsername: request.clientUsername,
      messagePreview: request.messageText.slice(0, messagePreviewLength),
      minutesElapsed: request.slaAlerts[0]?.minutesElapsed ?? 0,
      threshold: request.chat?.slaThresholdMinutes ?? 60,
      remainingMinutes: Math.max(0, (request.chat?.slaThresholdMinutes ?? 60) - (request.slaAlerts[0]?.minutesElapsed ?? 0)),
      chatTitle: request.chat?.title ?? null,
    })
  : formatAlertMessage(messageData);
```

---

## Important Issues (should fix)

### [CR-002] Warning alert creation lacks idempotency guard - duplicate SlaAlert rows on job retry

**File:** `backend/src/queues/sla-timer.worker.ts:96-103`

The breach path uses `prisma.$transaction` and the `createAlert` function in
`alert.service.ts` has an explicit idempotency check at line 96 (findFirst by requestId +
alertType + escalationLevel + resolvedAction=null). The warning path bypasses `createAlert`
entirely and calls `prisma.slaAlert.create` directly with no pre-existence check.

If the warning job fails after creating the `SlaAlert` but before `queueAlert` returns
(network timeout, Redis unavailable), BullMQ will retry the job. The retry creates a second
`SlaAlert` row for `alertType='warning'` at `escalationLevel=0`, and then queues a second
delivery to accountants.

**Fix:** Add the same idempotency guard that `createAlert` uses:
```typescript
// At the start of the warning block, before prisma.slaAlert.create:
const existingWarning = await prisma.slaAlert.findFirst({
  where: { requestId, alertType: 'warning', escalationLevel: 0, resolvedAction: null },
});
if (existingWarning) {
  logger.info('Warning alert already exists, skipping duplicate', { requestId });
  return;
}
```

### [CR-003] Removed try/catch in `getRecipientsForChat` - DB errors now propagate unhandled to escalation scheduler

**File:** `backend/src/services/alerts/escalation.service.ts:50-63`

The original `getManagerIdsForChat` function had a try/catch that logged the error and
returned `[]` (safe degradation), allowing the escalation to be skipped gracefully. The
replacement `getRecipientsForChat` has no error handling around the `prisma.chat.findFirst`
call. A transient DB error will now propagate to `scheduleNextEscalation`, where it is
caught at line 219 and re-thrown, ultimately failing the alert worker job and triggering
BullMQ retries.

This is a behavioral regression: a temporary DB hiccup that was previously absorbed silently
now causes alert job retry storms.

**Fix:** Wrap with try/catch to match the original contract:
```typescript
async function getRecipientsForChat(chatId: bigint, escalationLevel: number) {
  try {
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, deletedAt: null },
      select: { managerTelegramIds: true, accountantTelegramIds: true },
    });
    return getRecipientsByLevel(chat?.managerTelegramIds, chat?.accountantTelegramIds, escalationLevel);
  } catch (error) {
    logger.error('Failed to get recipients for chat', {
      chatId: String(chatId),
      error: error instanceof Error ? error.message : String(error),
      service: 'escalation',
    });
    return { recipients: [] as string[], tier: 'fallback' as const };
  }
}
```

---

## Minor Issues (nice to fix)

### [CR-004] `remainingMinutes` in warning alert uses wall-clock time, not working hours

**File:** `backend/src/queues/sla-timer.worker.ts:92-93`

```typescript
const minutesElapsed = Math.round((Date.now() - receivedAt.getTime()) / 60000);
const remainingMinutes = Math.max(0, threshold - minutesElapsed);
```

`threshold` is the SLA in working minutes, but `minutesElapsed` here is wall-clock minutes.
For a chat with business hours 9:00-18:00 and a 60-minute SLA: if a request arrives at
17:30, the warning fires at 80% working time = 48 working minutes (next morning ~9:48).
When the job fires at 9:48, `Date.now() - receivedAt` = ~16 wall-clock hours, making
`minutesElapsed` ~960 and `remainingMinutes` = 0 (wrong: should show ~12 working minutes).

This only affects the warning message text (via `formatWarningMessage` once CR-001 is fixed).
The warning fires at the correct time; it's only the displayed remaining minutes that would
be misleading. As a future improvement, this should use `calculateWorkingMinutes` from
`time-utils`, but as a medium-effort change it is acceptable to defer.

**Note:** This issue only becomes visible after CR-001 is resolved.

### [CR-005] Stub "Restore Chat" button in `ChatDetailsContent` renders a non-functional UI element

**File:** `frontend/src/components/chats/ChatDetailsContent.tsx:176-180`

```typescript
// TODO: Replace with trpc.chats.restore.useMutation when backend procedure is implemented
const restoreMutation = { isPending: false, mutate: (_input: { id: number }) => {} };
const handleRestore = () => {
  restoreMutation.mutate({ id: chatId });
  void refetch();
};
```

The "Восстановить чат" button is rendered and clickable for any deleted chat, but
`restoreMutation.mutate` is a no-op. Clicking it will call `refetch()` without having
restored anything, and the chat will continue to show the deleted-state UI. A user
attempting to restore a chat gets no feedback, no error, and no result.

**Fix (short term):** Hide the button or render it as disabled with tooltip "Coming soon"
until the backend `trpc.chats.restore` procedure is implemented. The `refetch` call after
a no-op is misleading and should also be removed for now.

### [CR-006] Double `globalSettings` query within the same transaction in `chats.ts` update mutation

**File:** `backend/src/api/trpc/routers/chats.ts:428` and `chats.ts:454`

The `updateSettings` mutation queries `tx.globalSettings.findUnique` twice in the same
transaction: once at line 428-432 (for the enable-SLA guard) and again at line 454-458
(for the SLA-active monitoring warn). Both queries select only `globalManagerIds`. The
second read is guaranteed to return the same data since it is in the same transaction.

**Fix:** Hoist the query before the two conditional blocks and reuse the result:
```typescript
const globalSettings = await tx.globalSettings.findUnique({
  where: { id: 'default' },
  select: { globalManagerIds: true },
});
const globalManagers = globalSettings?.globalManagerIds || [];
// ... use globalManagers in both checks
```

### [CR-007] No backend tests cover the new warning scheduling, getRecipientsByLevel, or strict username validation

**Files:**
- `backend/src/services/sla/__tests__/timer.service.test.ts` - no tests for `scheduleSlaWarning` call or `warningPercent=0` branch
- `backend/src/queues/__tests__/sla-timer.worker.test.ts` - no tests for `type='warning'` job path
- `backend/src/api/trpc/routers/__tests__/chats.test.ts` - no tests for the new `throw` on unverified usernames or `managerTelegramIds.max(20)`

The frontend test file (`ChatSettingsForm.test.tsx`) was updated with new cases for the
warning banner, which is good. The backend is missing coverage for three new behaviors that
carry real risk: the warning job path, the two-tier recipient resolution, and the breaking
change from warn-to-throw for unverified usernames (which changes the API contract for
any client relying on the warning response).

---

## Positive Observations

- **Excellent DRY refactoring.** All four duplicate `getManagerIds` implementations
  (sla-timer.worker, alert.service, escalation.service, feedback/alert.service) were
  consolidated into a single authoritative `getRecipientsByLevel` in config.service. This
  is the right approach and eliminates a class of future inconsistency bugs.

- **Backward compatibility via optional `type` field.** Using `type?: 'warning' | 'breach'`
  with `?? 'breach'` default in `SlaTimerJobData` (setup.ts:36) means existing queued jobs
  without the `type` field continue to work as breach jobs. Clean migration path.

- **Correct use of `prisma.chat.findFirst` with `deletedAt: null` filter** in both
  `alert.service.ts` and `escalation.service.ts`. Previously these used `findUnique` which
  would return soft-deleted chats. The gh-209 fix is applied consistently.

- **`cancelSlaWarning` is fully defensive.** It wraps everything in try/catch and returns
  a boolean, so failures are logged but don't propagate. This is the right pattern for
  cancel-style operations that should never block the main flow (timer.service.ts:367).

- **`getRecipientsByLevel` deduplicates with `Set`.** Level 2+ recipients use
  `[...new Set([...managerIds, ...accountantIds])]` to prevent sending duplicate Telegram
  messages when a manager is also listed as accountant. Solid defensive programming.

- **Input validation hardening in chats.ts.** Adding `.max(20)` to both
  `accountantUsernames` and `managerTelegramIds` arrays prevents unbounded list growth.
  The switch from warn-to-throw for unverified usernames makes the API honest: callers now
  know immediately when a username doesn't exist rather than silently storing it and
  failing at delivery time.

- **AccountantUsernamesInput verification badges.** The three-state UI (green/yellow/red)
  with `useMemo` for the lookup map is well-implemented. The `verificationMap` caches
  case-insensitive lookups efficiently. The conditional Tailwind classes for chip background
  color provide clear visual feedback without extra DOM elements.

- **Settings cache invalidation is wired up.** `slaWarningPercent` flows correctly through
  the cache: it is stored in `CachedGlobalSettings`, populated in `getGlobalSettings`,
  cleared by `invalidateSettingsCache`, and the settings router calls `invalidateSettingsCache`
  after update (line 362). The 5-minute TTL is the same for both frontend and backend,
  preventing stale-config windows.

- **Warning job is not scheduled when `warningDelayMs <= 0`.** The guard at
  `timer.service.ts:252` prevents scheduling a warning that should have already fired
  (e.g., when SLA is restarted for a request that is already past the 80% mark). This
  prevents spurious late warnings.
