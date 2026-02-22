# Phase 2a: tRPC API Routers Security & Bug Analysis Report

**Date:** 2026-02-16  
**Scope:** 18 router files analyzed  
**Status:** ✅ RESOLVED

---

## Executive Summary

This report documents security vulnerabilities, bugs, and business logic issues found in the tRPC API routers. Overall, the codebase demonstrates good security practices with proper authentication, authorization via middleware, and Zod-based input validation. However, several issues were identified that require attention.

| Severity | Count |
| -------- | ----- |
| Critical | 1     |
| High     | 2     |
| Medium   | 5     |
| Low      | 4     |

---

## Issue Details

### 1. CRITICAL: Missing Ownership Verification in Public Feedback Submission

**File:** `backend/src/api/trpc/routers/feedback.ts`  
**Lines:** 104-166  
**Procedure:** `submitRating`

**Problematic Code:**

```typescript
submitRating: publicProcedure
  .input(
    z.object({
      deliveryId: z.string().uuid(),
      rating: z.number().min(1).max(5),
      telegramUsername: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const { deliveryId, rating, telegramUsername } = input;

    // Verify delivery exists and is valid
    const delivery = await getDeliveryById(deliveryId);
    if (!delivery) { ... }

    // ❌ NO CHECK: Does this delivery belong to the requesting user?
    // Anyone with a deliveryId can submit/change ratings for any survey!
```

**Why It's a Problem:**

- The `submitRating` endpoint is public (no authentication required)
- It accepts any `deliveryId` without verifying ownership
- An attacker can submit ratings for any survey delivery by guessing UUIDs
- This allows rating manipulation and data integrity attacks

**Severity:** Critical  
**Category:** Security (Broken Access Control)  
**Recommendation:** Add ownership verification - validate that the `telegramUsername` matches the delivery's recipient, or require authentication.

---

### 2. HIGH: Ineffective In-Memory Rate Limiting

**File:** `backend/src/api/trpc/routers/messages.ts`  
**Lines:** 15-56  
**Procedure:** `listByChat`

**Problematic Code:**

```typescript
// Simple in-memory rate limiter
// In production, consider using Redis for distributed rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
```

**Why It's a Problem:**

- In-memory rate limiting doesn't work in multi-instance deployments
- Rate limit state is lost on instance restart
- Comment acknowledges this is "for production consider Redis" but uses it anyway
- Can be bypassed by sending requests to different instances

**Severity:** High  
**Category:** Security (Rate Limiting Bypass)  
**Recommendation:** Use Redis-based rate limiting (already available in project) or integrate with existing middleware.

---

### 3. HIGH: Empty String Can Clear API Keys

**File:** `backend/src/api/trpc/routers/settings.ts`  
**Lines:** 339-383  
**Procedure:** `updateGlobalSettings`

**Problematic Code:**

```typescript
updateGlobalSettings: adminProcedure
  .input(UpdateGlobalSettingsInput)
  .mutation(async ({ ctx, input }) => {
    // Filter out undefined values from input for Prisma compatibility
    const updateData = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined)
    );
    // ❌ If input.openrouterApiKey is "", it passes filter and overwrites!
    const settings = await ctx.prisma.globalSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...updateData },
      update: updateData,
    });
```

**Why It's a Problem:**

- Passing empty string `""` passes the `.optional()` check and Zod validation
- Empty string is not `undefined`, so it passes the filter
- The existing API key gets overwritten with empty string, breaking the classifier
- Input schema at line 63: `openrouterApiKey: z.string().optional()` allows empty strings

**Severity:** High  
**Category:** Security (Availability)  
**Recommendation:** Add validation to reject empty strings: `.refine(val => !val || val.length > 0)`

---

### 4. MEDIUM: Race Condition in Chat Update

**File:** `backend/src/api/trpc/routers/chats.ts`  
**Lines:** 340-500  
**Procedure:** `update`

**Problematic Code:**

```typescript
.mutation(async ({ ctx, input }) => {
  // Verify chat exists before updating
  const existingChat = await ctx.prisma.chat.findUnique({
    where: { id: input.id },
  });

  // ❌ Time-of-check to time-of-use (TOCTOU) race condition
  // Between check and update, another request could modify the chat

  // Validate: Cannot enable SLA without managers configured
  if (input.slaEnabled === true && existingChat.slaEnabled === false) {
    // ... validation logic
  }

  // Multiple subsequent queries (lines 359-394) before final update
  const updatedChat = await ctx.prisma.chat.update({
    where: { id: input.id },
    data,
  });
```

**Why It's a Problem:**

- TOCTOU vulnerability between existence check and update
- Concurrent updates could cause inconsistent state
- Multiple sequential queries without transaction wrapping

**Severity:** Medium  
**Category:** Bug (Race Condition)  
**Recommendation:** Wrap the mutation logic in a database transaction with appropriate locking.

---

### 5. MEDIUM: Missing Authorization for Chat Access

**File:** `backend/src/api/trpc/routers/chats.ts`  
**Lines:** 137-194  
**Procedure:** `getById`

**Problematic Code:**

```typescript
getById: authedProcedure
  .input(z.object({ id: z.number() }))
  .query(async ({ ctx, input }) => {
    const chat = await ctx.prisma.chat.findUnique({
      where: { id: input.id },
    });
    // ❌ No check: Does the user have permission to view this chat?
    // Any authenticated user can view ANY chat in the system
```

**Why It's a Problem:**

- All authenticated users can view any chat by ID
- No role-based filtering (observer, manager, admin)
- May expose sensitive client information to unauthorized personnel

**Severity:** Medium  
**Category:** Security (Broken Authorization)  
**Recommendation:** Add authorization checks - verify user role or chat assignment before returning data.

---

### 6. MEDIUM: N+1 Query Problem in Analytics

**File:** `backend/src/api/trpc/routers/analytics.ts`  
**Lines:** 293-389  
**Procedure:** `accountantPerformance`

**Problematic Code:**

```typescript
.query(async ({ ctx, input }) => {
  const accountants = await ctx.prisma.user.findMany({ ... });

  // ❌ N+1 Query: Makes a separate database query for EACH accountant
  const performance = await Promise.all(
    accountants.map(async (accountant) => {
      const requests = await ctx.prisma.clientRequest.findMany({ ... });
      // ... more queries per accountant
      const feedbackResponses = await ctx.prisma.feedbackResponse.findMany({ ... });
    })
  );
```

**Why It's a Problem:**

- Performance degrades linearly with user count
- 100 accountants = 100+ database queries per request
- Can cause timeouts under load

**Severity:** Medium  
**Category:** Bug (Performance)  
**Recommendation:** Use single batched queries with JOINs or aggregate functions.

---

### 7. MEDIUM: CSV Injection Vulnerability

**File:** `backend/src/api/trpc/routers/feedback.ts`  
**Lines:** 474-489  
**Procedure:** `exportCsv`

**Problematic Code:**

```typescript
const escapeCSV = (value: string) => {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};
// ❌ Missing: Sanitization for formulas (starting with =, +, -, @, tab)
// These can execute formulas in Excel/Google Sheets
const rows = responses.map((r) => [
  r.id,
  escapeCSV(r.chat?.title ?? ''),
  escapeCSV(r.clientUsername ?? ''),  // User input!
```

**Why It's a Problem:**

- Attackers can inject spreadsheet formulas via chat titles or usernames
- Formula injection can execute commands or exfiltrate data (CSV injection)
- Particularly risky since export is available to managers who may have higher privileges

**Severity:** Medium  
**Category:** Security (CSV Injection)  
**Recommendation:** Add prefix injection prevention - prepend single quote or filter formula characters.

---

### 8. LOW: DEV_MODE Hardcoded Credentials

**File:** `backend/src/api/trpc/context.ts`  
**Lines:** 42-52

**Problematic Code:**

```typescript
const DEV_MODE_USER: ContextUser = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  email: env.DEV_USER_EMAIL || 'admin@buhbot.local',
  role: 'admin',
  fullName: 'DEV Admin',
};
```

**Why It's a Problem:**

- DEV_MODE can accidentally be left enabled in production
- Hardcoded admin user with known UUID
- Bypasses all authentication

**Severity:** Low  
**Category:** Security (Configuration)  
**Recommendation:** Add production-only guard: `if (isDevMode && process.env.NODE_ENV === 'production') throw...`

---

### 9. LOW: Missing Input Sanitization for Keywords

**File:** `backend/src/api/trpc/routers/faq.ts`  
**Lines:** 103-150  
**Procedure:** `search`

**Problematic Code:**

```typescript
.query(async ({ ctx, input }) => {
  const queryLower = input.query.toLowerCase(); // User input

  const allFaqItems = await ctx.prisma.faqItem.findMany({ ... });

  // ❌ No length limit on query input
  // Could cause excessive memory usage with very large queries
  const scoredItems = allFaqItems
    .map((item) => {
      let score = 0;
      item.keywords.forEach((keyword: string) => {
        if (queryLower.includes(keyword.toLowerCase())) { score += 10; }
      });
      // ... scoring logic
```

**Why It's a Problem:**

- No maximum length validation on search query
- Could potentially cause DoS via large inputs
- Loads ALL FAQ items into memory before filtering

**Severity:** Low  
**Category:** Bug (Input Validation)  
**Recommendation:** Add `.max(200)` to query string validation.

---

### 10. LOW: Missing Error Handling in Async Queue Call

**File:** `backend/src/api/trpc/routers/feedback.ts`  
**Lines:** 144-157

**Problematic Code:**

```typescript
if (shouldTriggerAlert) {
  // Don't await - queue asynchronously to not block the response
  queueLowRatingAlert({
    feedbackId,
    chatId: delivery.chatId.toString(),
    rating,
    clientUsername: telegramUsername,
    comment: undefined,
  }).catch((error) => {
    // Log but don't fail the request
    console.error('Failed to queue low-rating alert:', error);
  });
```

**Why It's a Problem:**

- Using `console.error` instead of structured logger
- Silently fails - no retry mechanism
- Low-rated feedback may not trigger alerts

**Severity:** Low  
**Category:** Bug (Error Handling)  
**Recommendation:** Use proper logger, consider retry logic or dead-letter queue.

---

### 11. LOW: Missing Authorization on Contact Form Consent

**File:** `backend/src/api/trpc/routers/contact.ts`  
**Lines:** 10-42

**Problematic Code:**

```typescript
submit: publicProcedure.input(
  z.object({
    name: z.string(),
    email: z.string().email(),
    company: z.string().optional(),
    message: z.string().optional(),
    consent: z.boolean(), // ❌ Boolean can be submitted as "false" string or 0
  })
);
```

**Why It's a Problem:**

- Boolean validation may accept falsy values incorrectly
- `consent: false` submissions might still be processed due to type coercion
- GDPR compliance requires explicit consent

**Severity:** Low  
**Category:** Bug (Input Validation)  
**Recommendation:** Use `.transform(val => val === true)` or stricter boolean validation.

---

## Positive Security Observations

1. **Input Validation:** All routers use Zod for robust input validation
2. **Authorization Middleware:** Proper use of `authedProcedure`, `managerProcedure`, `adminProcedure`
3. **SQL Injection Protection:** Uses Prisma ORM (parameterized queries)
4. **No Hardcoded Secrets:** API keys are fetched from environment
5. **API Key Masking:** OpenRouter API key is properly masked in responses
6. **Proper Error Handling:** Most endpoints have try-catch blocks
7. **Transaction Usage:** `requests.ts` delete uses transactions appropriately
8. **Type Safety:** Good TypeScript usage throughout

---

## Recommendations Summary

| Priority | Issue                                 | Fix Complexity |
| -------- | ------------------------------------- | -------------- |
| 1        | Add ownership check to `submitRating` | Low            |
| 2        | Use Redis for rate limiting           | Medium         |
| 3        | Validate empty string for API keys    | Low            |
| 4        | Wrap mutations in transactions        | Medium         |
| 5        | Add authorization to chat queries     | Low            |
| 6        | Optimize N+1 queries with batching    | Medium         |
| 7        | Add CSV injection prevention          | Low            |
| 8        | Add production guard to DEV_MODE      | Low            |

---

_Analysis completed: 2026-02-16_

---

## Remediation Status

**Status:** RESOLVED  
**Completion Date:** February 17, 2026  
**Commit:** `b443db66b6eedcace5b127d59482dfc10e55c59c`  

All identified vulnerabilities have been remediated.
