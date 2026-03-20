# Plan: buh-n0w9 + buh-6vtt — Redis cooldown & extract accountant helper

## Context

Code review (H-02, M-02) выявил два tech debt в accountant onboarding:
1. **buh-n0w9 [P3]**: Cooldown для `request_password_email` хранится в in-memory `Map` — сбрасывается при рестарте, растёт без ограничений
2. **buh-6vtt [P4]**: DEV_MODE и production пути создания accountant дублируют ~50 строк идентичной логики (managers + token)

## Task 1: buh-n0w9 — Redis cooldown (subagent)

**File:** `backend/src/bot/handlers/accountant.handler.ts:344-400`

**What to change:**
- Remove `const passwordRequestCooldown = new Map<number, number>()` (line 344)
- Remove `const PASSWORD_COOLDOWN_MS = 5 * 60 * 1000` (line 345) — use inline `300` for Redis TTL
- Import `redis` from `../../../lib/redis.js` (already used in the project)
- Replace Map.get/set with Redis GET/SET+EX pattern

**Implementation pattern** (from existing `sla-reconciliation.job.ts:41`):
```typescript
const COOLDOWN_TTL = 300; // 5 minutes in seconds
const cooldownKey = `cooldown:password_request:${ctx.from.id}`;

// Check cooldown
const lastRequest = await redis.get(cooldownKey);
if (lastRequest) {
  const elapsed = Date.now() - parseInt(lastRequest, 10);
  const remainingSec = Math.max(0, COOLDOWN_TTL - Math.floor(elapsed / 1000));
  const waitText = remainingSec < 60 ? `${remainingSec} сек.` : `${Math.ceil(remainingSec / 60)} мин.`;
  await ctx.answerCbQuery(`Подождите ${waitText} перед повторным запросом.`);
  return;
}

// ... process password ...

// Set cooldown with auto-expiry
await redis.set(cooldownKey, Date.now().toString(), 'EX', COOLDOWN_TTL);
```

**Also fixes L-01:** More precise cooldown message (seconds when < 1 min).

**Key files:**
- `backend/src/lib/redis.ts` — Redis client singleton
- `backend/src/bot/middleware/rate-limit.ts` — reference pattern for Redis rate limiting

## Task 2: buh-6vtt — Extract accountant helper (subagent)

**File:** `backend/src/api/trpc/routers/auth.ts:434-622`

**Duplicate logic in two paths:**
- DEV_MODE: lines 454-471 (inside `$transaction`)
- Production: lines 572-593 (inside `$transaction`)

Both do: create User → create UserManager records → generate token → create VerificationToken → build link.

**What to change:**

1. Extract helper function at file scope (before `authRouter`):
```typescript
async function createAccountantInTransaction(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  params: {
    userId: string;
    email: string;
    fullName: string;
    role: string;
    managerIds?: string[];
    isOnboardingComplete: boolean;
  },
): Promise<{ user: { id: string; email: string; fullName: string; role: string }; tokenValue: string }> {
  const user = await tx.user.create({
    data: {
      id: params.userId,
      email: params.email,
      fullName: params.fullName,
      role: params.role,
      isOnboardingComplete: params.isOnboardingComplete,
    },
  });

  if (params.managerIds && params.managerIds.length > 0) {
    await tx.userManager.createMany({
      data: params.managerIds.map((managerId) => ({
        managerId,
        accountantId: user.id,
      })),
    });
  }

  const tokenValue = randomBytes(16).toString('base64url');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await tx.verificationToken.create({
    data: { userId: user.id, token: tokenValue, expiresAt },
  });

  return { user, tokenValue };
}
```

2. Replace both DEV_MODE and production `$transaction` bodies to call this helper
3. Build `verificationLink` from returned `tokenValue` (same as now, using `env.BOT_USERNAME`)

**Key constraint:** The `Prisma` transaction type — use `Parameters<>` utility or import `PrismaClient` for proper typing. Check existing patterns in the codebase.

## Execution Strategy

- **Task 1 (buh-n0w9)** and **Task 2 (buh-6vtt)** are independent — delegate to subagents **in parallel**
- After both complete: verify by reading modified files + run `npx tsc --noEmit` for backend and frontend
- Close beads, commit, push

## Verification

1. `npx tsc --noEmit --project backend/tsconfig.json` — 0 errors
2. `npx tsc --noEmit --project frontend/tsconfig.json` — 0 errors
3. Read modified files to verify:
   - No in-memory Map remains in accountant.handler.ts
   - Redis import present, GET/SET+EX pattern used
   - Helper function exists in auth.ts
   - Both DEV_MODE and production paths call the helper
   - No duplicate token generation logic
