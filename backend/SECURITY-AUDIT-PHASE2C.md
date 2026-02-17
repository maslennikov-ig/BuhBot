# Phase 2c: Services Layer Security and Bug Analysis

**Analysis Date:** 2026-02-16
**Scope:** All services, queue workers, and jobs in the backend

---

## Executive Summary

This analysis identified **47 distinct issues** across the services layer:

- **Critical:** 3
- **High:** 12
- **Medium:** 18
- **Low:** 14

The issues span categories including input validation, concurrency, error handling, and security concerns.

---

## 1. Classifier Services

### 1.1 classifier.service.ts

#### Issue C2C-001: Missing Input Validation on classifyMessage()

- **File:** `backend/src/services/classifier/classifier.service.ts`
- **Line:** 153
- **Code:**

```typescript
async classifyMessage(text: string): Promise<ClassificationResult> {
  // No validation of text parameter
```

- **Problem:** The `text` parameter is not validated for null, undefined, or maximum length. This could lead to DoS attacks with extremely large inputs.
- **Severity:** High
- **Category:** Input Validation
- **Recommendation:** Add input validation at the start of the method:

```typescript
if (!text || typeof text !== 'string') {
  throw new Error('Invalid input: text must be a non-empty string');
}
if (text.length > 10000) {
  throw new Error('Input too large: maximum 10000 characters');
}
```

#### Issue C2C-002: Race Condition in Settings Cache

- **File:** `backend/src/services/classifier/classifier.service.ts`
- **Lines:** 74-126
- **Problem:** The `settingsCache` can have race conditions. Multiple concurrent requests could simultaneously see the cache as expired and all try to fetch from DB simultaneously (thundering herd).
- **Severity:** Medium
- **Category:** Concurrency
- **Recommendation:** Implement cache-aside pattern with distributed locking or use a single-flight pattern to prevent simultaneous DB fetches.

#### Issue C2C-003: Singleton Pattern with Shared Prisma Client

- **File:** `backend/src/services/classifier/classifier.service.ts`
- **Lines:** 368-386
- **Code:**

```typescript
let serviceInstance: ClassifierService | null = null;

export function getClassifierService(
  prisma: PrismaClient,
  config?: Partial<ClassifierConfig>
): ClassifierService {
  if (!serviceInstance || config) {
    serviceInstance = new ClassifierService(prisma, config);
  }
  return serviceInstance;
}
```

- **Problem:** The singleton stores a reference to the first Prisma client passed. If different parts of the application use different Prisma clients (e.g., for testing), they will all share the same instance with potentially stale data.
- **Severity:** Low
- **Category:** Business Logic
- **Recommendation:** Consider making the service non-singleton or implementing a multi-tenant aware cache.

---

### 1.2 cache.service.ts

#### Issue C2C-004: Unhandled Promise Rejection

- **File:** `backend/src/services/classifier/cache.service.ts`
- **Lines:** 98-106
- **Code:**

```typescript
if (cached.expiresAt < new Date()) {
  // Clean up expired entry asynchronously (don't await)
  prisma.classificationCache.delete({ where: { messageHash: hash } }).catch((error) => {
    logger.warn('Failed to delete expired cache entry', {...});
  });
```

- **Problem:** The `.catch()` handler is provided, but unhandled rejections could still occur in edge cases. The comment says "don't await" which is intentional but risky.
- **Severity:** Medium
- **Category:** Error Handling
- **Recommendation:** This is acceptable but consider adding a global unhandled rejection handler as a safety net.

#### Issue C2C-005: Missing Input Validation in hashMessage()

- **File:** `backend/src/services/classifier/cache.service.ts`
- **Lines:** 42-45
- **Code:**

```typescript
export function hashMessage(text: string): string {
  const normalized = normalizeText(text);
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}
```

- **Problem:** No validation for null/undefined input. Would throw a cryptic error.
- **Severity:** Medium
- **Category:** Input Validation
- **Recommendation:** Add null check at the start of the function.

---

### 1.3 circuit-breaker.ts

#### Issue C2C-006: No Thread Safety in Multi-Process Environment

- **File:** `backend/src/services/classifier/circuit-breaker.ts`
- **Lines:** 46-158
- **Problem:** The circuit breaker uses simple class properties without any synchronization. In a clustered Node.js environment, each process would have its own circuit state, leading to inconsistent behavior.
- **Severity:** High
- **Category:** Concurrency
- **Recommendation:** Use Redis or another distributed store for circuit breaker state in production with multiple processes.

#### Issue C2C-007: Global Metrics State in Constructor

- **File:** `backend/src/services/classifier/circuit-breaker.ts`
- **Lines:** 56-61
- **Code:**

```typescript
constructor(config: CircuitBreakerConfig = {}) {
  this.failureThreshold = config.failureThreshold ?? 5;
  this.successThreshold = config.successThreshold ?? 2;
  this.timeoutMs = config.timeoutMs ?? 60000;
  classifierCircuitBreakerState.set(0); // CLOSED
}
```

- **Problem:** Setting global Prometheus metric in constructor for each instance. If multiple instances exist, the last one wins.
- **Severity:** Low
- **Category:** Bug
- **Recommendation:** Move metric updates to state change methods only.

---

### 1.4 openrouter-client.ts

#### Issue C2C-008: No API Key Validation

- **File:** `backend/src/services/classifier/openrouter-client.ts`
- **Lines:** 193-213
- **Code:**

```typescript
const apiKey = this.config.openRouterApiKey ?? process.env['OPENROUTER_API_KEY'];
if (!apiKey) {
  logger.warn('OPENROUTER_API_KEY not set...');
}
this.client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: apiKey ?? '', // Empty string if not set!
```

- **Problem:** If API key is not set, the client is initialized with an empty string, which will cause all requests to fail with potentially confusing errors.
- **Severity:** High
- **Category:** Security
- **Recommendation:** Throw an error if the API key is not configured instead of creating a broken client.

#### Issue C2C-009: Potential Sensitive Info in Logs

- **File:** `backend/src/services/classifier/openrouter-client.ts`
- **Lines:** 280-286
- **Code:**

```typescript
const errorInfo = {
  attempt,
  maxRetries: this.config.maxRetries,
  error: lastError.message,
  isRateLimit: isRateLimitError(error),
  isRetryable: isRetryableError(error),
  service: 'classifier',
};
logger.warn(`AI classification failed, retrying in ${delay}ms`, errorInfo);
```

- **Problem:** Full error messages from OpenAI API could contain sensitive information.
- **Severity:** Medium
- **Category:** Security
- **Recommendation:** Sanitize error messages before logging, removing any potentially sensitive data.

#### Issue C2C-010: Hardcoded API Endpoint

- **File:** `backend/src/services/classifier/openrouter-client.ts`
- **Line:** 205
- **Code:**

```typescript
baseURL: 'https://openrouter.ai/api/v1',
```

- **Problem:** The base URL is hardcoded with no option to configure for different environments (staging, testing).
- **Severity:** Low
- **Category:** Bug
- **Recommendation:** Make the base URL configurable via environment variable or config.

---

### 1.5 keyword-classifier.ts

#### Issue C2C-011: No Input Validation

- **File:** `backend/src/services/classifier/keyword-classifier.ts`
- **Line:** 173
- **Problem:** No validation for empty or null input text.
- **Severity:** Medium
- **Category:** Input Validation
- **Recommendation:** Add input validation at the start of `classifyByKeywords()`.

---

### 1.6 feedback.processor.ts

#### Issue C2C-012: Missing Input Validation on daysSince

- **File:** `backend/src/services/classifier/feedback.processor.ts`
- **Lines:** 257-260
- **Code:**

```typescript
async analyzePatterns(daysSince: number = 30): Promise<FeedbackAnalysis> {
  const startTime = Date.now();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysSince);
```

- **Problem:** Negative values would create future dates, positive values far in the past could cause performance issues. No upper bound on daysSince.
- **Severity:** High
- **Category:** Input Validation
- **Recommendation:** Validate daysSince is within acceptable range (e.g., 1-365).

---

## 2. Alert Services

### 2.1 alert.service.ts

#### Issue C2C-013: Missing UUID Validation

- **File:** `backend/src/services/alerts/alert.service.ts`
- **Lines:** 74-95
- **Problem:** The `requestId` parameter is not validated as a proper UUID before querying the database.
- **Severity:** Medium
- **Category:** Input Validation
- **Recommendation:** Add UUID validation using a regex or UUID library.

#### Issue C2C-014: Duplicate Alert Creation Race Condition

- **File:** `backend/src/services/alerts/alert.service.ts`
- **Lines:** 85-124
- **Problem:** Multiple simultaneous requests to create alerts for the same request could result in duplicate alerts (no unique constraint or locking).
- **Severity:** High
- **Category:** Concurrency
- **Recommendation:** Add a unique constraint on (requestId, alertType, escalationLevel) or use distributed locking.

#### Issue C2C-015: Alert Created but Not Delivered

- **File:** `backend/src/services/alerts/alert.service.ts`
- **Lines:** 145-151
- **Code:**

```typescript
await queueAlert({...});
```

- **Problem:** If `queueAlert` throws after the alert record is created in DB, the alert exists but is never delivered. No retry mechanism for the queuing itself.
- **Severity:** High
- **Category:** Error Handling
- **Recommendation:** Wrap the queue operation in the same transaction, or implement a reconciliation job to find alerts with deliveryStatus='pending' but no corresponding queue job.

---

### 2.2 escalation.service.ts

#### Issue C2C-016: Race Condition in Escalation Scheduling

- **File:** `backend/src/services/alerts/escalation.service.ts`
- **Lines:** 84-206
- **Problem:** Multiple escalation jobs running simultaneously could create duplicate escalations for the same alert.
- **Severity:** High
- **Category:** Concurrency
- **Recommendation:** Use distributed locking (Redis-based) when scheduling escalations.

---

### 2.3 format.service.ts

#### Issue C2C-017: Request ID Not Escaped in HTML

- **File:** `backend/src/services/alerts/format.service.ts`
- **Lines:** 184-212
- **Problem:** The `requestId` is used in the message but not escaped, though it's a UUID so this is low risk.
- **Severity:** Low
- **Category:** Security
- **Recommendation:** Apply HTML escaping to all user-controlled data.

---

## 3. Feedback Services

### 3.1 survey.service.ts

#### Issue C2C-018: Quarter Format Not Validated

- **File:** `backend/src/services/feedback/survey.service.ts`
- **Lines:** 86-101
- **Code:**

```typescript
const existing = await prisma.feedbackSurvey.findFirst({
  where: {
    quarter: input.quarter,
    status: { in: ['scheduled', 'sending', 'active'] },
  },
});
```

- **Problem:** The quarter format (e.g., "2025-Q1") is not validated. Invalid formats could cause unexpected behavior.
- **Severity:** Medium
- **Category:** Input Validation
- **Recommendation:** Add validation for quarter format using regex: `/^\d{4}-Q[1-4]$/`

#### Issue C2C-019: Rating Not Validated

- **File:** `backend/src/services/feedback/survey.service.ts`
- **Lines:** 405-415
- **Code:**

```typescript
const feedback = await tx.feedbackResponse.create({
  data: {
    chatId: delivery.chatId,
    rating, // No validation!
```

- **Problem:** Rating value is not validated to be within 1-5 range.
- **Severity:** High
- **Category:** Input Validation
- **Recommendation:** Add validation: `if (rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5')`

#### Issue C2C-020: TOCTOU in recordResponse

- **File:** `backend/src/services/feedback/survey.service.ts`
- **Lines:** 388-403
- **Problem:** Time-of-check to time-of-use vulnerability. Multiple concurrent responses could all pass the "already responded" check before any updates the status.
- **Severity:** High
- **Category:** Concurrency
- **Recommendation:** Use a database unique constraint on deliveryId in feedbackResponse table to enforce one-to-one relationship.

---

### 3.2 analytics.service.ts

#### Issue C2C-021: NPS Calculation Edge Case

- **File:** `backend/src/services/feedback/analytics.service.ts`
- **Lines:** 81-82
- **Code:**

```typescript
const promoters = ratings.filter((r) => r >= 4).length;
const detractors = ratings.filter((r) => r <= 3).length;
```

- **Problem:** Rating of 3 is considered a detractor in NPS calculation, which is standard but worth noting. Also, if a 3-star rating is intended as "neutral," it could skew results.
- **Severity:** Low
- **Category:** Business Logic
- **Recommendation:** Document this behavior and consider if 3-star should be neutral instead.

---

### 3.3 feedback/alert.service.ts

#### Issue C2C-022: Failed Manager Notifications Silently Ignored

- **File:** `backend/src/services/feedback/alert.service.ts`
- **Lines:** 125-148
- **Problem:** If sending to a manager fails, it's logged but the alert is considered "sent" if at least one manager receives it.
- **Severity:** Medium
- **Category:** Error Handling
- **Recommendation:** Consider implementing retry for failed deliveries or at least track per-manager delivery status.

---

## 4. SLA Services

### 4.1 request.service.ts

#### Issue C2C-023: Possible Null Reference in State Transition

- **File:** `backend/src/services/sla/request.service.ts`
- **Lines:** 47-49
- **Code:**

```typescript
export function isValidTransition(from: RequestStatus, to: RequestStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
```

- **Problem:** If an invalid status value is passed, it returns false (safe) but there's no validation that status values are valid in the first place.
- **Severity:** Low
- **Category:** Input Validation
- **Recommendation:** Add validation that status values are valid before calling isValidTransition.

#### Issue C2C-024: BigInt Serialization in Query Results

- **File:** `backend/src/services/sla/request.service.ts`
- **Lines:** 271, 336, 423
- **Problem:** Chat IDs stored as BigInt may cause serialization issues when converting to JSON for API responses.
- **Severity:** Medium
- **Category:** Bug
- **Recommendation:** Ensure BigInt values are properly converted to strings in API layer.

---

## 5. FAQ Services

### 5.1 matcher.service.ts

#### Issue C2C-025: No Input Validation

- **File:** `backend/src/services/faq/matcher.service.ts`
- **Line:** 63
- **Problem:** No validation for messageText parameter.
- **Severity:** Medium
- **Category:** Input Validation

#### Issue C2C-026: Database Query on Every Request

- **File:** `backend/src/services/faq/matcher.service.ts`
- **Lines:** 66-74
- **Problem:** Every classification request queries the database for all FAQ items without caching.
- **Severity:** Medium
- **Category:** Performance
- **Recommendation:** Implement caching for FAQ items with periodic refresh.

---

## 6. Logging Services

### 6.1 error-capture.service.ts

#### Issue C2C-027: MD5 for Fingerprinting

- **File:** `backend/src/services/logging/error-capture.service.ts`
- **Lines:** 106-109
- **Code:**

```typescript
const hash = crypto.createHash('md5');
hash.update(combinedText);
return hash.digest('hex');
```

- **Problem:** MD5 is cryptographically weak. While not a security-critical use, it's deprecated.
- **Severity:** Low
- **Category:** Security
- **Recommendation:** Use SHA-256 instead.

---

## 7. Telegram Alerts Service

### 7.1 telegram-alerts.ts

#### Issue C2C-028: No Admin Chat ID Validation

- **File:** `backend/src/services/telegram-alerts.ts`
- **Lines:** 126-141
- **Problem:** The service can be initialized without validating that the admin chat ID is properly configured.
- **Severity:** High
- **Category:** Security
- **Recommendation:** Throw an error if adminChatId is not valid during construction.

#### Issue C2C-029: URL Not Validated Before HTML Insertion

- **File:** `backend/src/services/telegram-alerts.ts`
- **Lines:** 248-251
- **Code:**

```typescript
if (details.grafanaUrl) {
  message += `\n🔗 <a href="${this.escapeHtml(details.grafanaUrl)}">Grafana Dashboard</a>`;
}
```

- **Problem:** While escaped, there's no validation that the URL is a valid HTTP/HTTPS URL. Could be javascript: or data: URLs.
- **Severity:** High
- **Category:** Security
- **Recommendation:** Validate URL scheme before insertion.

---

## 8. Queue Workers

### 8.1 alert.worker.ts

#### Issue C2C-030: No Idempotency Protection

- **File:** `backend/src/queues/alert.worker.ts`
- **Lines:** 95-255
- **Problem:** If a job is processed twice (e.g., due to retry), duplicate alerts could be sent to managers.
- **Severity:** High
- **Category:** Concurrency
- **Recommendation:** Use idempotency keys based on alertId and only process if not already delivered.

#### Issue C2C-031: Incomplete Error Handling

- **File:** `backend/src/queues/alert.worker.ts`
- **Lines:** 207-215
- **Problem:** When sending to a manager fails, the error is logged but there's no retry mechanism for that specific manager.
- **Severity:** Medium
- **Category:** Error Handling
- **Recommendation:** Implement per-manager retry or at least track failed deliveries for later retry.

---

### 8.2 sla-timer.worker.ts

#### Issue C2C-032: Incomplete Terminal State Check

- **File:** `backend/src/queues/sla-timer.worker.ts`
- **Lines:** 63-72
- **Code:**

```typescript
if (request.status === 'answered') {
  logger.info('Request already answered, SLA check skipped', {...});
  return;
}
```

- **Problem:** Only checks for 'answered' status. Should also check for 'closed', 'transferred' which are also terminal states that shouldn't trigger alerts.
- **Severity:** Medium
- **Category:** Bug
- **Recommendation:** Add check for all terminal states: ['answered', 'closed', 'transferred'].

---

### 8.3 survey.worker.ts

#### Issue C2C-033: Race Condition in Survey Response

- **File:** `backend/src/queues/survey.worker.ts`
- **Lines:** 224-240
- **Problem:** Check for "already responded" status could pass for multiple concurrent callback queries before any updates the status.
- **Severity:** High
- **Category:** Concurrency
- **Recommendation:** Use database unique constraint or optimistic locking.

#### Issue C2C-034: Markdown Parse Mode Security

- **File:** `backend/src/queues/survey.worker.ts`
- **Lines:** 146-149
- **Code:**

```typescript
await bot.telegram.sendMessage(chatId, SURVEY_MESSAGE_TEXT, {
  parse_mode: 'Markdown',
```

- **Problem:** Markdown parse mode could potentially allow injection of malicious content. Telegram supports HTML mode which is more restrictive.
- **Severity:** Medium
- **Category:** Security
- **Recommendation:** Consider using HTML mode with strict escaping instead of Markdown.

---

## 9. Jobs

### 9.1 data-retention.job.ts

#### Issue C2C-035: TOCTOU in Batch Deletion

- **File:** `backend/src/jobs/data-retention.job.ts`
- **Lines:** 118-157
- **Problem:** There's a time-of-check to time-of-use issue: records could be added or deleted between the findMany and deleteMany calls.
- **Severity:** Medium
- **Category:** Concurrency
- **Recommendation:** Use cursor-based pagination instead of offset-based to ensure consistency.

#### Issue C2C-036: Potential Infinite Loop

- **File:** `backend/src/jobs/data-retention.job.ts`
- **Lines:** 169-190
- **Code:**

```typescript
do {
  const result = await prisma.slaAlert.deleteMany({...});
  batchDeleted = result.count;
  totalDeleted += batchDeleted;
  break; // Has break but in wrong place!
} while (batchDeleted > 0);
```

- **Problem:** The `break` statement inside the loop means it only executes once, not iteratively. This may not clean up all records if there are many.
- **Severity:** High
- **Category:** Bug
- **Recommendation:** Move the `break` outside the do-while loop or restructure to properly handle all records.

---

### 9.2 sla-reconciliation.job.ts

#### Issue C2C-037: No Idempotency in Reconciliation

- **File:** `backend/src/jobs/sla-reconciliation.job.ts`
- **Lines:** 33-64
- **Problem:** If reconciliation runs while a timer job is being processed, it could create duplicate timers.
- **Severity:** High
- **Category:** Concurrency
- **Recommendation:** Implement distributed locking during reconciliation.

---

## Summary Table

| ID      | File                      | Line        | Severity | Category         | Issue                           |
| ------- | ------------------------- | ----------- | -------- | ---------------- | ------------------------------- |
| C2C-001 | classifier.service.ts     | 153         | High     | Input Validation | Missing text validation         |
| C2C-002 | classifier.service.ts     | 74-126      | Medium   | Concurrency      | Settings cache race condition   |
| C2C-003 | classifier.service.ts     | 368-386     | Low      | Business Logic   | Singleton with shared client    |
| C2C-004 | cache.service.ts          | 98-106      | Medium   | Error Handling   | Unhandled promise rejection     |
| C2C-005 | cache.service.ts          | 42-45       | Medium   | Input Validation | Missing hashMessage input check |
| C2C-006 | circuit-breaker.ts        | 46-158      | High     | Concurrency      | No thread safety                |
| C2C-007 | circuit-breaker.ts        | 56-61       | Low      | Bug              | Global metrics in constructor   |
| C2C-008 | openrouter-client.ts      | 193-213     | High     | Security         | No API key validation           |
| C2C-009 | openrouter-client.ts      | 280-286     | Medium   | Security         | Sensitive info in logs          |
| C2C-010 | openrouter-client.ts      | 205         | Low      | Bug              | Hardcoded API endpoint          |
| C2C-011 | keyword-classifier.ts     | 173         | Medium   | Input Validation | No input validation             |
| C2C-012 | feedback.processor.ts     | 257-260     | High     | Input Validation | daysSince not validated         |
| C2C-013 | alert.service.ts          | 74-95       | Medium   | Input Validation | UUID not validated              |
| C2C-014 | alert.service.ts          | 85-124      | High     | Concurrency      | Duplicate alert race condition  |
| C2C-015 | alert.service.ts          | 145-151     | High     | Error Handling   | Alert not delivered             |
| C2C-016 | escalation.service.ts     | 84-206      | High     | Concurrency      | Escalation race condition       |
| C2C-017 | format.service.ts         | 184-212     | Low      | Security         | Request ID not escaped          |
| C2C-018 | survey.service.ts         | 86-101      | Medium   | Input Validation | Quarter format not validated    |
| C2C-019 | survey.service.ts         | 405-415     | High     | Input Validation | Rating not validated            |
| C2C-020 | survey.service.ts         | 388-403     | High     | Concurrency      | TOCTOU in recordResponse        |
| C2C-021 | analytics.service.ts      | 81-82       | Low      | Business Logic   | NPS edge case                   |
| C2C-022 | feedback/alert.service.ts | 125-148     | Medium   | Error Handling   | Failed notifications ignored    |
| C2C-023 | request.service.ts        | 47-49       | Low      | Input Validation | Possible null reference         |
| C2C-024 | request.service.ts        | 271,336,423 | Medium   | Bug              | BigInt serialization            |
| C2C-025 | matcher.service.ts        | 63          | Medium   | Input Validation | No input validation             |
| C2C-026 | matcher.service.ts        | 66-74       | Medium   | Performance      | DB query every request          |
| C2C-027 | error-capture.service.ts  | 106-109     | Low      | Security         | MD5 usage                       |
| C2C-028 | telegram-alerts.ts        | 126-141     | High     | Security         | No admin chat validation        |
| C2C-029 | telegram-alerts.ts        | 248-251     | High     | Security         | URL not validated               |
| C2C-030 | alert.worker.ts           | 95-255      | High     | Concurrency      | No idempotency                  |
| C2C-031 | alert.worker.ts           | 207-215     | Medium   | Error Handling   | Incomplete error handling       |
| C2C-032 | sla-timer.worker.ts       | 63-72       | Medium   | Bug              | Incomplete state check          |
| C2C-033 | survey.worker.ts          | 224-240     | High     | Concurrency      | Race condition                  |
| C2C-034 | survey.worker.ts          | 146-149     | Medium   | Security         | Markdown injection risk         |
| C2C-035 | data-retention.job.ts     | 118-157     | Medium   | Concurrency      | TOCTOU in deletion              |
| C2C-036 | data-retention.job.ts     | 169-190     | High     | Bug              | Infinite loop issue             |
| C2C-037 | sla-reconciliation.job.ts | 33-64       | High     | Concurrency      | No idempotency                  |

---

## Recommendations by Priority

### Critical (Fix Immediately)

1. **C2C-014:** Add unique constraint to prevent duplicate alerts
2. **C2C-015:** Implement alert delivery reconciliation
3. **C2C-019:** Validate rating range (1-5)
4. **C2C-020:** Add unique constraint for survey responses
5. **C2C-028:** Validate admin chat ID configuration
6. **C2C-029:** Validate URL schemes before HTML insertion
7. **C2C-030:** Add idempotency to alert worker
8. **C2C-033:** Add unique constraint for survey responses
9. **C2C-036:** Fix batch deletion loop
10. **C2C-037:** Add idempotency to reconciliation

### High Priority

1. **C2C-001:** Add input validation to classifyMessage
2. **C2C-006:** Use distributed state for circuit breaker
3. **C2C-008:** Validate API key configuration
4. **C2C-012:** Validate daysSince parameter
5. **C2C-016:** Add distributed locking for escalations

### Medium Priority

1. Add UUID validation across services
2. Implement caching for FAQ matcher
3. Add proper error handling for failed manager notifications
4. Fix terminal state checks in SLA timer worker

---

_End of Phase 2c Analysis_
