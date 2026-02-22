# Security Audit Report - Phase 2d & 2e

**Date:** 2026-02-16  
**Scope:** Database Layer, Migrations, Configuration, and Middleware  
**Status:** ✅ RESOLVED

---

## Part 1: Database Layer Analysis

### 1.1 Prisma Schema Analysis

#### ✅ Good Practices Found:

1. **Cascade Deletes** - Properly implemented on relationships:
   - [`Notification.user`](backend/prisma/schema.prisma:187) - `onDelete: Cascade`
   - [`TelegramAccount.user`](backend/prisma/schema.prisma:208) - `onDelete: Cascade`
   - [`RequestHistory.request`](backend/prisma/schema.prisma:327) - `onDelete: Cascade`
   - [`ClassificationCorrection.request`](backend/prisma/schema.prisma:347) - `onDelete: Cascade`
   - [`ChatHoliday.chat`](backend/prisma/schema.prisma:617) - `onDelete: Cascade`

2. **Indexes** - Comprehensive indexing strategy for query optimization

3. **Enums** - Well-defined enums for type safety

4. **Constraints** - CHECK constraints added in migrations for data validation

---

#### Issues Found:

| #   | Location                                                                                | Issue                                                                | Severity | Category |
| --- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------- | -------- |
| 1   | [`Chat.assignedAccountantId`](backend/prisma/schema.prisma:224)                         | Nullable foreign key without proper handling - no `onDelete` cascade | Medium   | Bug      |
| 2   | [`ClientRequest.assignedTo`](backend/prisma/schema.prisma:261)                          | Nullable UUID with no explicit cascade delete                        | Medium   | Bug      |
| 3   | [`ClientRequest.chat`](backend/prisma/schema.prisma:292)                                | Missing `onDelete` - if chat is deleted, orphaned requests remain    | High     | Bug      |
| 4   | [`SlaAlert.request`](backend/prisma/schema.prisma:380)                                  | Missing `onDelete` - if request is deleted, orphaned alerts remain   | High     | Bug      |
| 5   | [`FeedbackResponse.chat/request/survey/delivery`](backend/prisma/schema.prisma:404-408) | Multiple nullable FKs without cascade deletes                        | Medium   | Bug      |
| 6   | [`WorkingSchedule.chat`](backend/prisma/schema.prisma:485)                              | Missing `onDelete` - orphaned schedules on chat deletion             | Medium   | Bug      |
| 7   | [`SurveyDelivery.chat/survey`](backend/prisma/schema.prisma:461-462)                    | Missing cascade deletes                                              | Medium   | Bug      |

---

#### Issue Details:

**Issue #1: Missing Cascade Delete on Chat.assignedAccountantId**

```prisma
// backend/prisma/schema.prisma:224-238
assignedAccountantId String?  @map("assigned_accountant_id") @db.Uuid
// ...
assignedAccountant User?              @relation("AssignedAccountant", fields: [assignedAccountantId], references: [id])
// Missing: onDelete: SetNull or similar handling
```

**Why it's a problem:** When a user is deleted, their assigned chats will have orphaned `assignedAccountantId` references.

**Fix:** Add `onDelete: SetNull` to allow NULL assignment when accountant is removed:

```prisma
assignedAccountant User? @relation("AssignedAccountant", fields: [assignedAccountantId], references: [id], onDelete: SetNull)
```

---

**Issue #2 & #3: Missing Cascade Delete on ClientRequest Relations**

```prisma
// backend/prisma/schema.prisma:292-293
chat              Chat               @relation(fields: [chatId], references: [id])
assignedUser      User?              @relation("AssignedTo", fields: [assignedTo], references: [id])
// Both missing onDelete
```

**Why it's a problem:** If a Chat is deleted, all related ClientRequest records become orphaned. If a User is deleted, requests assigned to them retain invalid references.

**Fix:**

```prisma
chat Chat @relation(fields: [chatId], references: [id], onDelete: Cascade)
assignedUser User? @relation("AssignedTo", fields: [assignedTo], references: [id], onDelete: SetNull)
```

---

**Issue #4: SlaAlert.request Missing Cascade**

```prisma
// backend/prisma/schema.prisma:380
request ClientRequest @relation(fields: [requestId], references: [id])
// Missing: onDelete: Cascade
```

**Why it's a problem:** Orphaned SLA alerts remain after request deletion.

**Fix:**

```prisma
request ClientRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)
```

---

### 1.2 Database Client Analysis

#### [`backend/src/db/client.ts`](backend/src/db/client.ts)

| #   | Location   | Issue                                        | Severity | Category |
| --- | ---------- | -------------------------------------------- | -------- | -------- |
| 1   | Line 32    | QUERY_TIMEOUT defined but not used           | Low      | Bug      |
| 2   | Line 57-59 | SSL warning only, not enforced in production | Medium   | Security |

**Issue Details:**

**Issue #1: Unused Query Timeout**

```typescript
// backend/src/db/client.ts:26-35
export const POOL_CONFIG = {
  // ...
  /** Query timeout in milliseconds */
  QUERY_TIMEOUT: 30000, // Defined but never applied to pool
};
```

**Issue #2: SSL Not Enforced in Production**

```typescript
// backend/src/db/client.ts:50-59
const hasSSL = url.includes('sslmode=require') || /* ... */;
if (!hasSSL && process.env['NODE_ENV'] === 'production') {
  logger.warn('DATABASE_URL missing sslmode=require - TLS is recommended for production');
  // Only warns, doesn't prevent connection
}
```

---

#### [`backend/src/lib/prisma.ts`](backend/src/lib/prisma.ts)

| #   | Location     | Issue                                                             | Severity | Category |
| --- | ------------ | ----------------------------------------------------------------- | -------- | -------- |
| 1   | Line 123-127 | TLS certificate verification disabled in development for Supabase | Medium   | Security |
| 2   | Line 186-185 | TOCTOU race condition in audit trail                              | Low      | Bug      |

**Issue Details:**

**Issue #1: Disabled TLS Verification in Dev**

```typescript
// backend/src/lib/prisma.ts:121-127
if (isDev && isSupabase) {
  // eslint-disable-next-line no-console
  console.log('[prisma] Disabling TLS certificate verification for development');
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'; // SECURITY ISSUE
}
```

**Why it's a problem:** Disabling TLS verification can become a security issue if accidentally deployed to production.

**Issue #2: TOCTOU Race in Audit Trail**

```typescript
// backend/src/lib/prisma.ts:177-185
// There is a theoretical TOCTOU race between this read and the update below.
// If another concurrent request modifies the same record...
```

**Note:** This is documented in code and acknowledged as acceptable trade-off.

---

### 1.3 Migration Analysis

#### ✅ Good Practices Found:

1. **Data Migration Before Schema Changes** - Migration `20260214040000` properly migrates data before dropping columns
2. **IF EXISTS/IF NOT EXISTS** - Safe conditional statements used
3. **Backup Data First** - Before dropping columns, data is migrated
4. **Check Constraints** - Added in `20251122215631` migration

#### ⚠️ Potential Issues:

| #   | Migration                                          | Issue                                     | Severity | Category       |
| --- | -------------------------------------------------- | ----------------------------------------- | -------- | -------------- |
| 1   | `20260211020000_drop_sla_response_minutes`         | DROP COLUMN without prior backup          | Medium   | Business Logic |
| 2   | `20260214040000_remove_legacy_accountant_username` | Data migration in same transaction as DDL | Low      | Business Logic |

**Note:** No DROP TABLE operations found - this is good.

---

## Part 2: Configuration & Middleware Analysis

### 2.1 Environment Configuration ([`backend/src/config/env.ts`](backend/src/config/env.ts))

| #   | Location   | Issue                                                 | Severity | Category |
| --- | ---------- | ----------------------------------------------------- | -------- | -------- |
| 1   | Line 68-72 | JWT_SECRET is optional in production                  | High     | Security |
| 2   | Line 73-77 | ENCRYPTION_KEY is optional in production              | High     | Security |
| 3   | Line 54-58 | TELEGRAM_WEBHOOK_SECRET minimum 32 chars but optional | Medium   | Security |

**Issue Details:**

**Issue #1 & #2: Optional Security-Critical Keys**

```typescript
// backend/src/config/env.ts:68-77
JWT_SECRET: z
  .string()
  .min(32)
  .optional() // Should be required in production
  .describe('JWT secret for authentication (min 32 chars)'),
ENCRYPTION_KEY: z
  .string()
  .min(32)
  .optional() // Should be required in production
  .describe('Encryption key for sensitive data (min 32 chars)'),
```

**Why it's a problem:** Application will start without critical security keys, potentially using weak defaults or no encryption.

**Fix:** Make these required in production:

```typescript
JWT_SECRET: isTestEnv
  ? z.string().min(1).optional()
  : z.string().min(32).describe('JWT secret for authentication'),
```

---

### 2.2 Configuration Service ([`backend/src/config/config.service.ts`](backend/src/config/config.service.ts))

✅ **No critical issues found.** Good practices:

- Hardcoded defaults as fallback
- Cache with TTL
- Graceful error handling
- Stale cache fallback

---

### 2.3 Rate Limiting Middleware ([`backend/src/middleware/rate-limit.ts`](backend/src/middleware/rate-limit.ts))

| #   | Location        | Issue                                                      | Severity | Category       |
| --- | --------------- | ---------------------------------------------------------- | -------- | -------------- |
| 1   | Line 116-118    | In-memory store doesn't work in multi-instance deployments | Medium   | Business Logic |
| 2   | Line 295-306    | Redis rate limiter not implemented (placeholder)           | Medium   | Business Logic |
| 3   | Line 10 msg/min | Default limit may be too restrictive for legitimate users  | Low      | Business Logic |

**Issue Details:**

**Issue #1: In-Memory Rate Limiting**

```typescript
// backend/src/middleware/rate-limit.ts:116-118
const store: RateLimitStore = new Map();
// Only works for single-instance deployments
// Multiple instances won't share rate limit state
```

**Issue #2: Redis Implementation Missing**

```typescript
// backend/src/middleware/rate-limit.ts:295-306
export function createRedisRateLimiter(
  _redis: unknown,
  options: Partial<RedisRateLimitOptions> = {}
): Middleware<Context> {
  // TODO: Implement Redis-backed rate limiting
  logger.warn('Redis rate limiter not yet implemented, falling back to in-memory');
  return createRateLimiter(options);
}
```

---

### 2.4 Telegram Signature Middleware ([`backend/src/middleware/telegram-signature.ts`](backend/src/middleware/telegram-signature.ts))

✅ **Good security practices found:**

- Constant-time comparison (`timingSafeEqual`) prevents timing attacks
- Proper logging of failed attempts
- Prometheus metrics for monitoring
- Missing header returns 401

| #   | Location     | Issue                                                 | Severity | Category |
| --- | ------------ | ----------------------------------------------------- | -------- | -------- |
| 1   | Line 211-228 | Default middleware checks env at runtime, not startup | Low      | Bug      |

**Issue Details:**

**Issue #1: Runtime Env Check**

```typescript
// backend/src/middleware/telegram-signature.ts:206-228
const telegramSignatureMiddleware: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const secret = process.env['TELEGRAM_WEBHOOK_SECRET'];
  if (!secret) {
    // Error thrown at runtime, not at module load
  }
};
```

**Why it's a problem:** Error only detected on first request, not at application startup.

---

### 2.5 Redis Configuration ([`backend/src/lib/redis.ts`](backend/src/lib/redis.ts))

✅ **Good practices:**

- Proper retry strategy with exponential backoff
- Connection event handlers
- Graceful disconnect
- Health check with timeout

| #   | Location   | Issue                                          | Severity | Category |
| --- | ---------- | ---------------------------------------------- | -------- | -------- |
| 1   | Line 46    | `maxRetriesPerRequest: null` can cause hanging | Medium   | Bug      |
| 2   | Line 50-52 | No command timeout - can hang on slow Redis    | Medium   | Bug      |

**Issue Details:**

**Issue #1: Unlimited Retries**

```typescript
// backend/src/lib/redis.ts:46
maxRetriesPerRequest: null, // Can cause indefinite hang
```

**Issue #2: No Command Timeout**

```typescript
// backend/src/lib/redis.ts:50-52
// Note: commandTimeout removed for BullMQ compatibility
// BullMQ uses blocking commands (BRPOPLPUSH, SUBSCRIBE) that can exceed short timeouts
```

This is a known trade-off documented in code.

---

### 2.6 Supabase Client ([`backend/src/lib/supabase.ts`](backend/src/lib/supabase.ts))

| #   | Location   | Issue                                            | Severity | Category |
| --- | ---------- | ------------------------------------------------ | -------- | -------- |
| 1   | Line 25-26 | Fallback to placeholder credentials in dev mode  | Medium   | Security |
| 2   | Line 36-38 | Warns but continues with placeholder in dev mode | Low      | Bug      |

**Issue Details:**

**Issue #1: Placeholder Credentials**

```typescript
// backend/src/lib/supabase.ts:25-26
const supabaseUrl = process.env['SUPABASE_URL'] || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] || 'placeholder-key';
```

**Why it's a problem:** If dev mode is accidentally enabled in production, application will use placeholder credentials.

---

## Summary

### Critical Issues (0)

None found.

### High Issues (2)

| #   | Issue                                 | Location                                       | Fix                         |
| --- | ------------------------------------- | ---------------------------------------------- | --------------------------- |
| 1   | Optional JWT_SECRET in production     | [`env.ts:68-72`](backend/src/config/env.ts:68) | Make required in production |
| 2   | Optional ENCRYPTION_KEY in production | [`env.ts:73-77`](backend/src/config/env.ts:73) | Make required in production |

### Medium Issues (8)

| #   | Issue                                               | Location                                                        | Fix                           |
| --- | --------------------------------------------------- | --------------------------------------------------------------- | ----------------------------- |
| 1   | Missing cascade delete on Chat.assignedAccountantId | [`schema.prisma:238`](backend/prisma/schema.prisma:238)         | Add `onDelete: SetNull`       |
| 2   | Missing cascade delete on ClientRequest.chat        | [`schema.prisma:292`](backend/prisma/schema.prisma:292)         | Add `onDelete: Cascade`       |
| 3   | Missing cascade delete on SlaAlert.request          | [`schema.prisma:380`](backend/prisma/schema.prisma:380)         | Add `onDelete: Cascade`       |
| 4   | SSL not enforced in production                      | [`client.ts:50-59`](backend/src/db/client.ts:50)                | Throw error if SSL missing    |
| 5   | TLS verification disabled in dev                    | [`prisma.ts:123-127`](backend/src/lib/prisma.ts:123)            | Remove or use proper dev cert |
| 6   | In-memory rate limiting for multi-instance          | [`rate-limit.ts:118`](backend/src/middleware/rate-limit.ts:118) | Implement Redis backend       |
| 7   | Redis maxRetriesPerRequest null                     | [`redis.ts:46`](backend/src/lib/redis.ts:46)                    | Add reasonable retry limit    |
| 8   | Placeholder Supabase credentials                    | [`supabase.ts:25-26`](backend/src/lib/supabase.ts:25)           | Fail fast if missing          |

### Low Issues (4)

| #   | Issue                                | Location                                                                        | Fix                          |
| --- | ------------------------------------ | ------------------------------------------------------------------------------- | ---------------------------- |
| 1   | Unused QUERY_TIMEOUT constant        | [`client.ts:32`](backend/src/db/client.ts:32)                                   | Apply to pool or remove      |
| 2   | TOCTOU in audit trail (documented)   | [`prisma.ts:177`](backend/src/lib/prisma.ts:177)                                | Use DB triggers for accuracy |
| 3   | Runtime env check for webhook secret | [`telegram-signature.ts:211`](backend/src/middleware/telegram-signature.ts:211) | Check at startup             |
| 4   | Redis command timeout removed        | [`redis.ts:50-52`](backend/src/lib/redis.ts:50)                                 | Document trade-off           |

---

## Recommendations

### Immediate Actions (High Priority)

1. **Make JWT_SECRET and ENCRYPTION_KEY required in production** - Current optional config could lead to weak security

2. **Add cascade deletes to Prisma schema** - Prevent orphaned records:
   - `ClientRequest.chat` → Cascade
   - `SlaAlert.request` → Cascade
   - `Chat.assignedAccountantId` → SetNull

3. **Enforce SSL in production** - Database connections should require SSL

### Short-term Actions

1. **Implement Redis-backed rate limiting** - Current in-memory implementation doesn't work with multiple instances

2. **Remove TLS verification bypass** - The `NODE_TLS_REJECT_UNAUTHORIZED=0` in dev could be accidentally deployed

3. **Add startup validation** - Check critical env vars at startup, not runtime

### Long-term Actions

1. **Consider database triggers** - For accurate audit trail (solves TOCTOU)

2. **Add connection pool monitoring** - Expose pool stats for debugging

---

## Testing Notes

- All cascade delete issues should be tested with actual DB operations
- Rate limiting should be tested with multiple instances
- Environment variable validation should be tested with missing keys

---

## Remediation Status

**Status:** RESOLVED  
**Completion Date:** February 17, 2026  
**Commit:** `b443db66b6eedcace5b127d59482dfc10e55c59c`  

All identified vulnerabilities have been remediated.
