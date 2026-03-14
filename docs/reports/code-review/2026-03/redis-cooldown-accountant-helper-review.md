# Code Review: Redis Cooldown + `createAccountantInTransaction` Helper

**Commit**: `91cdf3a`
**Branch**: `feat/telegram-first-accountant-onboarding`
**Date**: 2026-03-13
**Reviewer**: Code Reviewer Worker (Claude Sonnet 4.6)
**Files changed**:
- `backend/src/bot/handlers/accountant.handler.ts` — Redis GET/SET+EX cooldown
- `backend/src/api/trpc/routers/auth.ts` — `createAccountantInTransaction` extraction

---

## Summary

This commit makes two independent changes: it replaces an in-memory `Map`-based cooldown with a Redis-backed one in the bot handler, and it extracts a duplicated ~50-line transaction block into a shared helper function. Both changes are directionally correct and improve the codebase. However, the Redis cooldown implementation contains a meaningful logic bug and is missing Redis failure handling that the existing `rate-limit.ts` reference pattern explicitly provides. The `createAccountantInTransaction` extraction is clean with one type-safety concern.

**Issue count**: 1 Critical, 2 High, 3 Medium, 2 Low

---

## Critical

### C-01: Redis cooldown calculates remaining time from a stored wall-clock timestamp instead of relying on Redis TTL — produces wrong values and is not monotonic

**File**: `backend/src/bot/handlers/accountant.handler.ts`, lines 355–361

**Problem**: When the cooldown key is found in Redis, the code recalculates how much time is left by reading the stored `Date.now()` value and subtracting from the current wall clock:

```typescript
const elapsed = Date.now() - parseInt(lastRequest, 10);
const remainingSec = Math.max(0, COOLDOWN_TTL - Math.floor(elapsed / 1000));
```

This approach has two concrete failure modes:

1. **Clock skew / NTP adjustment**: If the server clock is adjusted backward between the `SET` and the `GET` (NTP sync, DST, timezone misconfiguration), `Date.now() - parseInt(lastRequest, 10)` can be negative. `elapsed` becomes a large negative number. `COOLDOWN_TTL - Math.floor(elapsed / 1000)` overflows to a huge positive value, so `remainingSec` becomes e.g. 3600+ seconds. The user is told to wait an hour.

2. **Redundant state**: Redis already knows exactly when the key expires — that is what the `EX` TTL was set for. The stored payload (a timestamp) is not needed for the "show remaining time" use case; it adds a second source of truth.

3. **The `parseInt` can produce `NaN`**: If the stored value is somehow not a valid integer string (empty string, truncated data, Redis corruption), `parseInt(lastRequest, 10)` returns `NaN`. All arithmetic on `NaN` produces `NaN`. `Math.max(0, NaN)` returns `NaN`. The template literal becomes `"Подождите NaN сек."` and is sent to the user.

**Fix — use Redis TTL directly**:

The correct approach is to ask Redis how long the key has left rather than storing and re-deriving a timestamp. Use the `TTL` command, which returns the remaining seconds atomically:

```typescript
const cooldownKey = `cooldown:password_request:${ctx.from.id}`;
const ttl = await redis.ttl(cooldownKey);

if (ttl > 0) {
  const waitText = ttl < 60 ? `${ttl} сек.` : `${Math.ceil(ttl / 60)} мин.`;
  await ctx.answerCbQuery(`Подождите ${waitText} перед повторным запросом.`);
  return;
}
```

Then store a sentinel value (any non-empty string works since the value is never read for calculation):

```typescript
await redis.set(cooldownKey, '1', 'EX', COOLDOWN_TTL);
```

This eliminates the timestamp arithmetic entirely, the stored value becomes meaningless boilerplate, and `TTL` returning `-2` (key does not exist) vs. `> 0` (cooldown active) is unambiguous. It also matches the pattern used throughout the codebase: `rate-limit.ts` trusts Redis expiry state rather than storing derived timestamps.

---

## High

### H-01: Redis failure in the cooldown check is not caught — an unhandled rejection crashes the bot callback

**File**: `backend/src/bot/handlers/accountant.handler.ts`, lines 354–362

**Problem**: `await redis.get(cooldownKey)` and `await redis.set(cooldownKey, ...)` are called without any error handling. The outer `try/catch` block (line 347) does exist and would catch exceptions — however, the `catch` handler sends a generic "Произошла ошибка" message via `ctx.answerCbQuery`, which means **a Redis outage silently blocks every password-link request**. The user receives an unexplained error with no path to recovery.

The reference pattern in `rate-limit.ts` handles this explicitly and is documented with a comment:

```typescript
// Fail closed - deny request if Redis is unavailable
try {
  await ctx.reply(RATE_LIMIT_MESSAGE);
} catch {
  // Ignore reply errors
}
```

That is a deliberate policy decision (fail-closed for rate limiting is appropriate). For a password-setup link request the right policy is the opposite: **fail-open**. If Redis is unavailable the user should still be able to get their password link rather than being silently blocked.

**Fix**:

```typescript
let isOnCooldown = false;
try {
  const ttl = await redis.ttl(cooldownKey);
  isOnCooldown = ttl > 0;
  if (isOnCooldown) {
    const waitText = ttl < 60 ? `${ttl} сек.` : `${Math.ceil(ttl / 60)} мин.`;
    await ctx.answerCbQuery(`Подождите ${waitText} перед повторным запросом.`);
    return;
  }
} catch (redisErr) {
  logger.warn('Redis unavailable for cooldown check, proceeding without rate limit', {
    telegramId: ctx.from.id,
    error: redisErr instanceof Error ? redisErr.message : String(redisErr),
    service: 'accountant-handler',
  });
  // Fail open: allow the request rather than blocking the user
}
```

And analogously wrap the `redis.set` after the link is generated:

```typescript
try {
  await redis.set(cooldownKey, '1', 'EX', COOLDOWN_TTL);
} catch (redisErr) {
  logger.warn('Failed to set password request cooldown key', {
    telegramId: ctx.from.id,
    error: redisErr instanceof Error ? redisErr.message : String(redisErr),
    service: 'accountant-handler',
  });
  // Non-fatal: user can request again, but the link was already sent
}
```

### H-02: Race condition — cooldown is set AFTER the Supabase link is generated, not before

**File**: `backend/src/bot/handlers/accountant.handler.ts`, lines 384–402

**Problem**: The sequence of operations is:

1. Check cooldown key (Redis GET)
2. Look up user in DB
3. Check role
4. **Generate Supabase password-recovery link** (network call to Supabase)
5. **Set cooldown key** (Redis SET)

If two concurrent callbacks for the same user arrive at nearly the same time (e.g., the user double-taps the button), both will pass the cooldown check at step 1 because the key does not exist yet. Both will proceed to step 4 and both will generate a Supabase recovery link. The cooldown is not in place until step 5, by which point the second request has already succeeded.

In the worst case, the user ends up with two valid but distinct recovery links. This is a minor security concern (unnecessary token proliferation) and wastes a Supabase admin API call.

**Fix — set the cooldown key optimistically before the Supabase call**:

Use `SET NX EX` (set-if-not-exists with expiry), which is atomic. If the key was already set by a concurrent request, the command returns `null` and the current request should bail out:

```typescript
// Atomic: acquire cooldown lock before any side-effecting work
const acquired = await redis.set(cooldownKey, '1', 'EX', COOLDOWN_TTL, 'NX');
if (acquired === null) {
  // Another concurrent request beat us to it
  await ctx.answerCbQuery('Запрос уже обрабатывается. Подождите немного.');
  return;
}

// Now proceed with DB lookup, role check, and Supabase link generation.
// If anything below fails, the key will auto-expire after COOLDOWN_TTL anyway,
// which is acceptable (the user can retry in 5 minutes).
```

This replaces both the initial `GET` check and the later `SET` with a single atomic `SET NX EX`.

---

## Medium

### M-01: `createAccountantInTransaction` is a module-level function that imports `prisma` but only receives a `TransactionClient` — the module-level import is unused by the helper itself and exists solely for the type derivation

**File**: `backend/src/api/trpc/routers/auth.ts`, lines 26–31

**Problem**: The `prisma` singleton is imported at the top of `auth.ts` and is used throughout the router procedures via `ctx.prisma`. However, the new module-level import was added specifically to derive the `TransactionClient` type:

```typescript
import { prisma } from '../../../lib/prisma.js';

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
```

This is a minor architectural issue: the helper function depends on the `prisma` import being present not for runtime behaviour but solely to extract a generic type at compile time. If this helper were ever moved to its own file, the import would need to move with it (but there would be no obvious reason why, as the function never calls `prisma` directly).

A cleaner approach is to derive the type from Prisma's own exported types rather than from the singleton instance:

```typescript
import type { Prisma } from '@prisma/client';

type TransactionClient = Prisma.TransactionClient;
```

`Prisma.TransactionClient` is the official exported type for exactly this purpose. This removes the coupling between the type annotation and the singleton instance.

### M-02: `createAccountantInTransaction` return type declares `tokenValue: string` but the non-accountant path in the DEV_MODE branch returns `tokenValue: undefined`

**File**: `backend/src/api/trpc/routers/auth.ts`, lines 61–93 and 499–521

**Problem**: The helper's declared return type is:

```typescript
Promise<{
  user: { id: string; email: string; fullName: string; role: string };
  tokenValue: string;
}>
```

`tokenValue` is typed as `string` (non-nullable). This is correct for calls to `createAccountantInTransaction` because a token is always generated. However, the DEV_MODE code path that does **not** call the helper still uses the same `newUser` variable and returns `{ user, tokenValue: undefined }` (line 521). The caller then checks `isAccountant && newUser.tokenValue` (line 531), relying on the `undefined` being falsy. This is consistent but the types in the DEV_MODE non-accountant branch are not governed by the helper's return type — it is a parallel shape that happens to match by convention.

This is not a bug but it is a code smell: the two shapes (`tokenValue: string` from the helper vs. `tokenValue: undefined` from the non-accountant path) are united under the same `newUser` variable without a discriminated union. A future change to the helper's return type would not cause a compile error in the non-accountant path.

**Suggested fix**:

Explicitly type `newUser` in the DEV_MODE block:

```typescript
type UserResult =
  | { user: { id: string; email: string; fullName: string; role: string }; tokenValue: string }
  | { user: { id: string; email: string; fullName: string; role: string }; tokenValue: undefined };

const newUser: UserResult = await ctx.prisma.$transaction(async (tx) => { ... });
```

Or define the non-accountant branch inline as a separate `const` before returning, making the types distinct per branch.

### M-03: `COOLDOWN_TTL` is declared inside `registerAccountantHandler()` rather than at module scope

**File**: `backend/src/bot/handlers/accountant.handler.ts`, line 345

**Problem**:

```typescript
export function registerAccountantHandler(): void {
  // ...
  const COOLDOWN_TTL = 300; // 5 minutes in seconds
```

`COOLDOWN_TTL` is a constant that does not vary per invocation of `registerAccountantHandler`. Declaring it inside the function creates a new binding on every call (even though in practice the function is only called once at startup). More importantly, it is not visible as a module-level configuration value. The old `PASSWORD_COOLDOWN_MS` had the same scope issue; the refactor preserved the scope rather than fixing it.

**Fix**: Move to module scope alongside the other module-level constants:

```typescript
// At module top, near the imports
const COOLDOWN_TTL_SECONDS = 300; // Password request rate limit: 5 minutes
```

The `_SECONDS` suffix makes the unit explicit in the name, which is useful since `rate-limit.ts` uses `_MS` suffixes for millisecond values.

---

## Low

### L-01: The cooldown key namespace uses `cooldown:` as a prefix but the rate-limiter uses `ratelimit:` — no documented key namespace convention

**File**: `backend/src/bot/handlers/accountant.handler.ts`, line 354
**Reference**: `backend/src/bot/middleware/rate-limit.ts`, line 39

**Observation**: Redis key prefixes in the project:
- `ratelimit:` — general bot rate limiter (`rate-limit.ts`)
- `cooldown:password_request:` — password request limiter (`accountant.handler.ts`)

These are not wrong but there is no documented convention. If the project grows more Redis keys (session tokens, feature flags, queue locks), ad-hoc prefixes become a maintenance problem when reasoning about key collisions or scanning for keys by namespace.

**Suggestion**: Add a comment in `redis.ts` or a separate `redis-keys.ts` constant file documenting the key namespace schema, e.g.:

```typescript
// Redis key namespaces
// ratelimit:<userId>          — general bot rate limiter (rate-limit.ts)
// cooldown:<type>:<userId>    — per-action cooldowns (accountant.handler.ts)
// session:<token>             — (future)
```

### L-02: No test coverage for the Redis cooldown path

**File**: `backend/src/bot/handlers/accountant.handler.ts`

**Observation**: The previous in-memory `Map`-based cooldown was similarly untested, so this is not a regression introduced by this commit. However, the new implementation has more failure modes (Redis down, NaN from `parseInt`, clock skew) that are worth covering. At minimum, a unit test mocking `redis.get` to return a recent timestamp would verify the rate-limiting branch is entered and the correct message format is returned.

---

## What is done well

**Extraction of `createAccountantInTransaction`**: The duplication this removes was real and meaningful — the two inline blocks were identical except for variable names. The extracted helper is properly typed, has a clear JSDoc explaining its scope, and is used in both call sites without any observable behaviour change. The cleanup of the DEV_MODE non-accountant branch (removing the stale `isOnboardingComplete: !isAccountant` conditional in favour of a simple `true`) is also a correct simplification.

**Improved remaining-time display**: The old code always showed minutes (`Math.ceil(remainingSec / 60)`) which would display "1 мин." for a 10-second wait. The new code shows seconds for waits under a minute. This is a genuine UX improvement even though the underlying calculation method has the clock-skew bug described in C-01.

**Redis `EX` instead of manual expiry**: Using `SET ... EX` instead of a separate `EXPIRE` call is correct and atomic. The old `Map`-based cooldown had no expiry at all (it accumulated entries until process restart); this is a meaningful improvement.

**Supabase cleanup on DB transaction failure**: The `createAccountantInTransaction` helper is called inside a `try/catch` that rolls back the Supabase Auth user if the DB transaction fails (lines 620–630). This compensating transaction was present before the refactor and was correctly preserved in both call sites.

---

## Findings index

| ID   | Severity | Area              | Summary                                                          |
|------|----------|-------------------|------------------------------------------------------------------|
| C-01 | Critical | Correctness       | Remaining-time calc uses stored timestamp instead of Redis TTL  |
| H-01 | High     | Resilience        | Redis errors not explicitly handled; silently blocks on outage  |
| H-02 | High     | Race condition    | Cooldown set after Supabase call, not before; window for bypass |
| M-01 | Medium   | Type safety       | `prisma` import used only for type derivation; use `Prisma.TransactionClient` instead |
| M-02 | Medium   | Type safety       | Non-accountant DEV_MODE path returns `tokenValue: undefined` but no union type captures this |
| M-03 | Medium   | Code organisation | `COOLDOWN_TTL` declared inside function body instead of module scope |
| L-01 | Low      | Conventions       | No documented Redis key namespace schema                         |
| L-02 | Low      | Testing           | No test coverage for cooldown check or Redis failure path        |

---

## Recommended action before merge

1. **C-01 + H-01 + H-02 are best addressed together** as a single follow-up fix since they all concern the same ~15-line block. The recommended solution (atomic `SET NX EX` + `TTL` for display + isolated try/catch) resolves all three simultaneously. A suggested consolidated implementation:

```typescript
const COOLDOWN_TTL_SECONDS = 300; // module scope

// Inside the callback, after the ctx.from guard:
let cooldownSet = false;
try {
  // Atomic acquire: returns '1' on success, null if key already exists
  const acquired = await redis.set(cooldownKey, '1', 'EX', COOLDOWN_TTL_SECONDS, 'NX');
  if (acquired === null) {
    // Key exists: show how long to wait
    const ttl = await redis.ttl(cooldownKey);
    const remaining = ttl > 0 ? ttl : COOLDOWN_TTL_SECONDS;
    const waitText = remaining < 60 ? `${remaining} сек.` : `${Math.ceil(remaining / 60)} мин.`;
    await ctx.answerCbQuery(`Подождите ${waitText} перед повторным запросом.`);
    return;
  }
  cooldownSet = true;
} catch (redisErr) {
  logger.warn('Redis cooldown check failed, proceeding without rate limit', {
    telegramId: ctx.from.id,
    error: redisErr instanceof Error ? redisErr.message : String(redisErr),
    service: 'accountant-handler',
  });
  // Fail open: allow the request
}

// ... rest of handler (DB lookup, role check, Supabase call) ...

// If Redis set failed at the top, try again after success:
if (!cooldownSet) {
  redis.set(cooldownKey, '1', 'EX', COOLDOWN_TTL_SECONDS).catch((err: unknown) => {
    logger.warn('Failed to set cooldown key after successful link generation', {
      telegramId: ctx.from.id,
      error: err instanceof Error ? err.message : String(err),
      service: 'accountant-handler',
    });
  });
}
```

2. **M-01** is a one-line change and can be done in the same pass.

3. **M-02 and M-03** are low-risk and can be batched into the next routine cleanup.
