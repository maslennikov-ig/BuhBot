# Phase 4: Business Logic Flow Analysis

**Date:** 2026-02-16  
**Auditor:** Security Audit Phase 4  
**Scope:** Business Workflow Integrity Analysis

---

## Executive Summary

This phase analyzes key business workflows for state machine integrity, idempotency, atomicity, timeout handling, and resource cleanup. The system demonstrates strong transactional design with proper use of database transactions, but several areas require attention for edge cases and potential race conditions.

| Workflow | State Machine | Idempotency | Atomicity | Timeouts | Cleanup |
|----------|-------------|-------------|-----------|----------|---------|
| SLA Timer | ✅ Strong | ⚠️ Partial | ✅ Good | ⚠️ Risk | ✅ Good |
| Survey | ✅ Strong | ✅ Good | ✅ Good | ⚠️ Risk | ✅ Good |
| Feedback | ✅ Strong | ✅ Good | ✅ Good | ⚠️ Risk | ✅ Good |
| Alert Callback | ✅ Strong | ⚠️ Partial | ⚠️ Partial | ⚠️ Risk | ⚠️ Partial |
| Invitation | ✅ Strong | ✅ Good | ✅ Good | ✅ Good | ✅ Good |
| Classification | ⚠️ Partial | ✅ Good | ⚠️ Partial | ⚠️ Risk | ✅ Good |
| Data Retention | N/A | N/A | ⚠️ Partial | ⚠️ Risk | ✅ Good |

---

## 1. SLA Timer Workflow

**Files:** [`message.handler.ts`](src/bot/handlers/message.handler.ts) → [`sla-timer.worker.ts`](src/queues/sla-timer.worker.ts) → [`alert.worker.ts`](src/queues/alert.worker.ts)

### Flow Analysis

```
Client Message → Classification → Request Created → Timer Started
                                                        ↓
                                              [SLA Threshold Reached]
                                                        ↓
                                              Check Status (pending?)
                                                        ↓
                                              Update to 'escalated' + Create Alert
                                                        ↓
                                              Queue Manager Notification
```

### State Machine Integrity ✅

**Valid Transitions (from request.service.ts:34-42):**
- `pending` → `in_progress`, `escalated`, `answered`, `closed`
- `escalated` → `in_progress`, `answered`, `closed`

The SLA timer worker correctly checks if request is still `pending` before marking as breached (line 64 in sla-timer.worker.ts):

```typescript
if (request.status === 'answered') {
  logger.info('Request already answered, SLA check skipped', {...});
  return;
}
```

**Issue Found:** No validation for `in_progress` status - if accountant started working but didn't fully resolve, timer still fires.

### Idempotency ⚠️

**Deduplication present (message.handler.ts:266-290):**
- Uses content hash with 5-minute window
- Checks `pending` and `in_progress` statuses

**Gaps:**
- No idempotency key for SLA timer jobs - if job is retried after partial execution, could create duplicate alerts
- The `processSlaTimer` function re-throws errors to trigger retry (line 208), but alert creation happens inside transaction that could partially complete

### Atomicity ✅

**Strong transaction handling (sla-timer.worker.ts:78-114):**
```typescript
const alert = await prisma.$transaction(async (tx) => {
  // Step 1: Update request status
  await tx.clientRequest.update({...});
  // Step 2: Create SLA alert
  const alert = await tx.slaAlert.create({...});
  return alert;
});
```

Both operations succeed or fail together.

### Timeouts ⚠️

**Risk:** BullMQ default timeout is 30 minutes. If database is slow, job could be stuck.

**Mitigation present:** Rate limiting configured (slaRateLimitMax: 10, slaRateLimitDuration: 1000)

### Resource Cleanup ✅

- Alerts properly linked to requests via foreign key
- No orphaned timer jobs if request deleted (checks existence first)

---

## 2. Survey Workflow

**Files:** [`survey.handler.ts`](src/bot/handlers/survey.handler.ts) → [`survey.worker.ts`](src/queues/survey.worker.ts) → [`survey.service.ts`](src/services/feedback/survey.service.ts)

### Flow Analysis

```
Survey Created → Scheduled → Started (delivery records created)
                                           ↓
                            [For each client]
                              Survey Delivery Job
                                    ↓
                            Message Sent → Status: 'delivered'
                                    ↓
                            Schedule Reminder (2 days)
                                    ↓
                            [If no response]
                              Reminder Job → Status: 'reminded'
                                    ↓
                            Schedule Manager Notification (5 days)
                                    ↓
                            Manager Notification → Status: 'expired'
```

### State Machine Integrity ✅

**Survey Status Flow (survey.service.ts:86-124):**
- `scheduled` → `sending` → `active` → `closed`/`expired`

**Delivery Status Flow:**
- `pending` → `delivered`/`failed`
- `delivered` → `reminded` → `expired`/`responded`

Worker checks status before each action (survey.worker.ts:225-240, 314-329).

### Idempotency ✅

**Survey delivery (survey.worker.ts:128-203):**
- Uses delivery ID as idempotency key
- On retry after partial success, re-sends message but updates counts properly

**Response recording (survey.service.ts:405-442):**
- Transaction includes status check: `delivery.status === 'responded'`
- Double-response attempt throws error handled gracefully

### Atomicity ✅

**Survey start (survey.service.ts:217-233):**
```typescript
await prisma.$transaction([
  prisma.surveyDelivery.createMany({...}),
  prisma.feedbackSurvey.update({...})
]);
```

**Response recording (survey.service.ts:406-442):**
- Creates feedback response
- Updates delivery status to 'responded'
- Updates survey response count and average

All in single transaction.

### Timeouts ⚠️

**Risk:** Survey delivery could timeout for large client lists (survey.worker.ts:128-203).

**Mitigation:** Batch processing with configurable concurrency (surveyConcurrency: 5).

### Resource Cleanup ✅

- Delivery records properly cleaned up
- Expired surveys handled via status transition

---

## 3. Feedback Submission

**Files:** [`survey.handler.ts:120`](src/bot/handlers/survey.handler.ts:120) → [`survey.service.ts:383`](src/services/feedback/survey.service.ts:383)

### Flow Analysis

```
User clicks rating button → Callback received
        ↓
Validate delivery exists + not responded
        ↓
Transaction: Create feedback + Update delivery + Update survey stats
        ↓
Update UI message
        ↓
[Optional] Collect comment (10 min timeout)
```

### State Machine Integrity ✅

**Checks in recordResponse (survey.service.ts:393-403):**
```typescript
if (!delivery) {
  throw new Error(`Delivery ${deliveryId} not found`);
}
if (delivery.status === 'responded') {
  throw new Error('Already responded to this survey');
}
if (delivery.survey.status !== 'active' && delivery.survey.status !== 'sending') {
  throw new Error('Survey is no longer accepting responses');
}
```

### Idempotency ✅

- Status check prevents duplicate responses
- Transaction ensures atomicity

### Atomicity ✅

**Full transaction (survey.service.ts:406-442):**
```typescript
const result = await prisma.$transaction(async (tx) => {
  const feedback = await tx.feedbackResponse.create({...});
  await tx.surveyDelivery.update({ where: { id: deliveryId }, data: { status: 'responded' }});
  await tx.feedbackSurvey.update({ where: { id: delivery.surveyId }, data: { responseCount: { increment: 1 }}});
  // Recalculate average...
});
```

### Timeouts ⚠️

**Comment collection (survey.handler.ts:42, 134-140):**
- In-memory Map with 10-minute timeout
- **Risk:** Server restart loses pending comments
- **Risk:** No cleanup if user doesn't respond - Map grows indefinitely

### Resource Cleanup ⚠️

**Issue:** The `awaitingComment` Map is never cleaned up on server restart. Stale entries could accumulate.

---

## 4. Alert Callback Workflow

**Files:** [`alert-callback.handler.ts`](src/bot/handlers/alert-callback.handler.ts)

### Flow Analysis

```
Manager receives alert with buttons
        ↓
[Option A] Click "Notify Accountant"
        ↓
Find alert → Get accountant → Send DM → Fallback to group mention
        ↓
[Option B] Click "Resolve"
        ↓
Verify not already resolved → Update alert → Cancel escalations → Update request status
```

### State Machine Integrity ✅

**Resolve checks (alert-callback.handler.ts:316-324):**
```typescript
if (alert.resolvedAction !== null) {
  logger.info('Alert already resolved', {...});
  await ctx.answerCbQuery('Уже отмечено как решённое');
  return;
}
```

### Idempotency ⚠️

**Partial coverage:**
- Resolve action checks for existing resolution
- No idempotency key for notification sending
- If DM fails after alert resolved, retry could cause duplicate notifications

### Atomicity ⚠️

**Issue:** Multi-step operations without full transaction (alert-callback.handler.ts:326-347):

```typescript
// Step 1: Resolve alert
await resolveAlert(alertId, 'mark_resolved', userId);

// Step 2: Cancel escalations
await cancelEscalation(alertId);
await cancelAllEscalations(alert.requestId);

// Step 3: Update request status
await prisma.clientRequest.update({...});
```

**Risk:** If step 3 fails, alert is resolved but request status not updated.

### Timeouts ⚠️

**Risk:** Multiple Telegram API calls in loop (lines 207-230) without timeout handling.

### Resource Cleanup ⚠️

**Missing:** Escalation jobs may remain in queue if cancellation fails.

---

## 5. Chat Invitation Workflow

**Files:** [`invitation.handler.ts`](src/bot/handlers/invitation.handler.ts)

### Flow Analysis

```
User sends /start <token> or /connect <token>
        ↓
Validate token format (regex 8-64 alphanumeric)
        ↓
Transaction:
  1. Find invitation (validate exists, not used, not expired)
  2. Upsert chat with invitation details
  3. Mark invitation as used
        ↓
Reply with success/failure
```

### State Machine Integrity ✅

**Validation (invitation.handler.ts:185-195):**
```typescript
if (!invitation) {
  throw new Error('INVALID_TOKEN');
}
if (invitation.isUsed) {
  throw new Error('ALREADY_USED');
}
if (invitation.expiresAt < new Date()) {
  throw new Error('EXPIRED');
}
```

### Idempotency ✅

**Strong:** Transaction prevents double-use (invitation.handler.ts:178-261):
```typescript
await prisma.$transaction(async (tx) => {
  // Check and use invitation atomically
  await tx.chatInvitation.update({
    where: { id: invitation.id },
    data: { isUsed: true, usedAt: new Date() }
  });
}, { timeout: 10000 });
```

### Atomicity ✅

Full transaction wraps all database operations.

### Timeouts ✅

Transaction has 10-second timeout (line 259).

### Resource Cleanup ✅

- Invitation properly marked as used
- Chat created/updated in same transaction

---

## 6. Request Classification

**Files:** [`message.handler.ts`](src/bot/handlers/message.handler.ts) → [`classifier.service.ts`](src/services/classifier/classifier.service.ts)

### Flow Analysis

```
Incoming message → Check monitoring enabled
        ↓
Check if accountant (skip if yes)
        ↓
Classify: Cache? → AI? → Keywords?
        ↓
If REQUEST/CLARIFICATION:
  - Check deduplication (5 min window)
  - Create ClientRequest
  - Start SLA timer (if REQUEST)
```

### State Machine Integrity ⚠️

**Potential issue (message.handler.ts:255-264):**
- Only `REQUEST` and `CLARIFICATION` create ClientRequest
- No validation that classification result is valid enum value

**Deduplication check (message.handler.ts:275):**
```typescript
status: { in: ['pending', 'in_progress'] }
```

**Gap:** Doesn't check `escalated` status - duplicate could create new request when one is escalated.

### Idempotency ✅

- Content hash deduplication with 5-minute window
- Composite unique constraint on chatId + messageId for ChatMessage

### Atomicity ⚠️

**Issue (message.handler.ts:330-385):**

```typescript
// Create ClientRequest
const request = await prisma.clientRequest.create({...});

// Start SLA timer (outside transaction)
await startSlaTimer(request.id, String(chatId), thresholdMinutes);
```

**Risk:** If SLA timer job fails to queue, request exists but no timer started. No rollback.

### Timeouts ⚠️

**Risk:** AI classification could hang (classifier.service.ts uses default OpenAI timeout).

**Mitigation:** Circuit breaker pattern implemented (circuit-breaker.ts).

### Resource Cleanup ✅

- Cache entries have TTL
- Classification cache cleaned up via data retention job

---

## 7. Data Retention

**Files:** [`data-retention.job.ts`](src/jobs/data-retention.job.ts)

### Flow Analysis

```
Daily job triggered (3 AM Moscow)
        ↓
Get retention years from settings (default: 3)
        ↓
Calculate cutoff date
        ↓
Loop (batch 1000):
  1. Find client requests older than cutoff
  2. Delete SLA alerts for those requests
  3. Delete feedback responses
  4. Delete client requests
        ↓
Delete orphaned SLA alerts
        ↓
Delete old feedback (not linked)
        ↓
Delete expired classification cache
```

### State Machine Integrity N/A

No state transitions - this is a cleanup job.

### Idempotency N/A

- Uses `deleteMany` which is idempotent
- Batch approach prevents duplicates

### Atomicity ⚠️

**Issue (data-retention.job.ts:134-147):**

```typescript
// Delete SLA alerts first (if not cascaded)
await prisma.slaAlert.deleteMany({ where: { requestId: { in: idsToDelete }}});

// Delete feedback responses
await prisma.feedbackResponse.deleteMany({...});

// Delete the client requests
await prisma.clientRequest.deleteMany({...});
```

**Gap:** If step 2 fails after step 1, alerts already deleted. No transaction.

### Timeouts ⚠️

**Risk:** Large datasets could cause job timeout.

**Mitigation:** Batch processing (1000 records per batch).

### Resource Cleanup ✅

- Proper cascade deletes handled
- Orphaned records cleaned up separately

---

## Issues Summary

### Critical Issues

| ID | Workflow | Issue | Impact |
|----|----------|-------|--------|
| PH4-001 | Alert Callback | Multi-step ops without transaction | Inconsistent state if partial failure |
| PH4-002 | Data Retention | Delete operations not atomic | Orphaned records possible |
| PH4-003 | Comment Collection | In-memory Map not cleaned on restart | Memory leak |

### High Priority Issues

| ID | Workflow | Issue | Impact |
|----|----------|------|--------|
| PH4-004 | SLA Timer | No idempotency key for jobs | Potential duplicate alerts |
| PH4-005 | Classification | SLA timer start outside transaction | Orphaned timer if queuing fails |
| PH4-006 | Survey | In-memory awaitingComment Map grows | Memory leak over time |

### Medium Priority Issues

| ID | Workflow | Issue | Impact |
|----|----------|-------|--------|
| PH4-007 | SLA Timer | Doesn't check `in_progress` status | Timer fires for in-progress requests |
| PH4-008 | Classification | Deduplication doesn't check `escalated` | Duplicate requests possible |
| PH4-009 | Alert Callback | Notification sending lacks idempotency | Duplicate notifications possible |

---

## Recommendations

### Immediate Actions

1. **PH4-001:** Wrap alert callback resolve flow in transaction
2. **PH4-002:** Use database transaction for data retention batch deletes
3. **PH4-003:** Implement TTL-based cleanup for awaitingComment Map

### Short-term Improvements

4. **PH4-004:** Add idempotency key to SLA timer jobs
5. **PH4-005:** Move SLA timer start inside transaction or add compensation logic
6. **PH4-006:** Add periodic cleanup of stale awaitingComment entries

### Long-term Enhancements

7. Consider implementing saga pattern for complex workflows
8. Add distributed locking for critical multi-step operations
9. Implement dead letter queue for failed jobs with manual intervention

---

## Conclusion

The system demonstrates solid business logic design with proper use of database transactions in most critical paths. The main areas requiring attention are:

1. **Atomicity gaps** in alert callback resolution and data retention
2. **Idempotency improvements** needed for background jobs
3. **Resource cleanup** for in-memory data structures

The state machine definitions are well-documented and enforced in most paths, with only minor gaps in deduplication logic.

---

*End of Phase 4 Analysis*
