# Plan: Process GitHub Issues #172-#182

## Context

Production Settings page shows "Bot name not configured" because `NEXT_PUBLIC_BOT_NAME` was never added to CI build args. An audit revealed 10 additional issues — all related to DEV MODE implementation, missing CI build args, hardcoded URLs, and Telegram validation. The user emphasized that tickets are interconnected (except #180) and need a holistic approach with surgical fixes, not over-engineering.

## Priority Scoring

| Rank | Issue | Title | Sev | Imp | Lkh | Score | Priority |
|------|-------|-------|-----|-----|-----|-------|----------|
| 1 | #172 | NEXT_PUBLIC_BOT_NAME missing from CI | 10 | 10 | 10 | 30 | P0 |
| 2 | #173 | NEXT_PUBLIC_API_URL missing from CI | 7 | 7 | 10 | 24 | P1 |
| 3 | #175 | X-Dev-Mode dead header | 7 | 3 | 10 | 20 | P1 |
| 4 | #177 | Two different isDevMode exports | 5 | 7 | 10 | 22 | P1 |
| 5 | #176 | Inconsistent mock user IDs | 5 | 5 | 10 | 20 | P1 |
| 6 | #178 | SSR localhost fallback in Docker | 5 | 7 | 7 | 19 | P1 |
| 7 | #179 | DEV_MODE no startup warning | 7 | 3 | 5 | 15 | P2 |
| 8 | #181 | Telegram validation no timeout | 5 | 5 | 5 | 15 | P2 |
| 9 | #182 | Telegram generic error message | 2 | 3 | 5 | 10 | P3 |
| 10 | #180 | Hardcoded production URLs | 2 | 3 | 2 | 7 | P3 |
| 11 | #174 | DEV_MODE not in Docker builds | 2 | 2 | 2 | 6 | P3 |

## Dependency Graph

```
#172 ─┐                     #175 ── independent
#173 ─┼─ same fix (ci.yml)  #177 ── blocks ─→ #176
      │                     #179 ── independent
      └─→ #178 (Dockerfile) #181 ── blocks ─→ #182
#180 ── independent          #174 ── independent (docs only)
```

## Execution Plan: 3 Batches

### Batch 1: CI Build Args (#172, #173, #178)

**Files to modify:**

1. **`.github/workflows/ci.yml`** (line 177-179)
   - Add `NEXT_PUBLIC_BOT_NAME` and `NEXT_PUBLIC_API_URL` to frontend build-args:
   ```yaml
   build-args: |
     NEXT_PUBLIC_SUPABASE_URL=${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
     NEXT_PUBLIC_SUPABASE_ANON_KEY=${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
     NEXT_PUBLIC_BOT_NAME=${{ secrets.NEXT_PUBLIC_BOT_NAME }}
     NEXT_PUBLIC_API_URL=${{ secrets.NEXT_PUBLIC_API_URL }}
   ```

2. **`frontend/Dockerfile`** (line 54-61)
   - Add `NEXT_PUBLIC_API_URL` as ARG and ENV (currently missing, only BOT_NAME and Supabase are present):
   ```dockerfile
   ARG NEXT_PUBLIC_API_URL
   ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
   ```

3. **`infrastructure/docker-compose.yml`** (line 65-68)
   - Add `NEXT_PUBLIC_API_URL` to frontend build args:
   ```yaml
   - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://bot-backend:3000}
   ```

4. **`frontend/src/lib/trpc.ts`** — `getBaseUrl()` (line 30-43)
   - Add production warning for missing `NEXT_PUBLIC_API_URL` on SSR:
   ```typescript
   function getBaseUrl(): string {
     if (typeof window !== 'undefined') {
       return '';
     }
     if (process.env.NEXT_PUBLIC_API_URL) {
       return process.env.NEXT_PUBLIC_API_URL;
     }
     if (process.env.NODE_ENV === 'production') {
       console.warn('[trpc] NEXT_PUBLIC_API_URL not set — SSR requests will fall back to localhost');
     }
     return 'http://localhost:3000';
   }
   ```

**Manual step (not code):** Ensure GitHub repo secrets `NEXT_PUBLIC_BOT_NAME` and `NEXT_PUBLIC_API_URL` exist.

### Batch 2: DEV MODE Cleanup (#175, #177, #176, #179)

**Files to modify:**

1. **`frontend/src/lib/trpc.ts`** (line 62-64) — #175
   - Remove dead `X-Dev-Mode` header:
   ```typescript
   // BEFORE
   if (isDevMode) {
     return {
       'X-Dev-Mode': 'true',
       Authorization: 'Bearer dev-mode-token',
     };
   }
   // AFTER
   if (isDevMode) {
     return {
       Authorization: 'Bearer dev-mode-token',
     };
   }
   ```

2. **`frontend/src/lib/supabase.ts`** (line 10, 21) — #177 + #176
   - Remove `export` from `isDevMode` (keep as private const for internal warning):
   ```typescript
   // line 10: remove export
   const isDevModeLocal = process.env.NODE_ENV === 'development' && !isSupabaseConfigured;
   ```
   - Fix mock user ID to match canonical value:
   ```typescript
   // line 21: change 11111111-... to aaaaaaaa-...
   id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   ```
   - Update internal references from `isDevMode` to `isDevModeLocal`

3. **`frontend/src/components/auth/SetPasswordForm.tsx`** (line 8) — #177
   - Split import:
   ```typescript
   import { supabase } from '@/lib/supabase';
   import { isDevMode } from '@/lib/config';
   ```

4. **`frontend/src/components/ProfileMenu.tsx`** (line 7) — #177
   - Split import:
   ```typescript
   import { supabase } from '@/lib/supabase';
   import { isDevMode } from '@/lib/config';
   ```

5. **`backend/src/index.ts`** (line 10, ~171) — #179
   - Add `isDevMode` to import:
   ```typescript
   import env, { isProduction, isDevelopment, isDevMode } from './config/env.js';
   ```
   - Add startup warning at the beginning of `startServer()`:
   ```typescript
   if (isDevMode) {
     logger.warn('DEV_MODE IS ACTIVE — authentication is bypassed. Never enable in production!', {
       service: 'startup',
     });
   }
   ```

### Batch 3: Telegram Validation + URLs + Docs (#181, #182, #180, #174)

**Files to modify:**

1. **`backend/src/services/telegram/validation.ts`** — #181 + #182
   - Add `AbortSignal.timeout(10_000)` to fetch
   - Differentiate error types in catch:
   ```typescript
   export async function validateBotToken(token: string) {
     try {
       const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
         signal: AbortSignal.timeout(10_000),
       });
       const data = (await response.json()) as TelegramMeResponse;
       if (!data.ok) {
         return { isValid: false, error: data.description || 'Invalid token' };
       }
       return {
         isValid: true,
         botId: data.result.id,
         botUsername: data.result.username,
         firstName: data.result.first_name,
       };
     } catch (error) {
       const err = error as Error;
       if (err.name === 'TimeoutError' || err.name === 'AbortError') {
         return { isValid: false, error: 'Telegram API не отвечает. Попробуйте позже.' };
       }
       if ('code' in err && (err as NodeJS.ErrnoException).code === 'ENOTFOUND') {
         return { isValid: false, error: 'Не удалось подключиться к Telegram. Проверьте сеть.' };
       }
       console.error('Telegram validation error:', error);
       return { isValid: false, error: 'Ошибка сети. Проверьте соединение и попробуйте снова.' };
     }
   }
   ```

2. **`backend/src/api/trpc/routers/auth.ts`** (line 286) — #180
   - Import `env` default export:
   ```typescript
   import env, { isDevMode } from '../../../config/env.js';
   ```
   - Replace hardcoded URL:
   ```typescript
   // BEFORE
   redirectTo: `${process.env['FRONTEND_URL'] || 'https://buhbot.aidevteam.ru'}/set-password`,
   // AFTER
   redirectTo: `${env.FRONTEND_URL}/set-password`,
   ```

3. **`backend/src/index.ts`** (line 44) — #180
   - Use `env.FRONTEND_URL` for CORS:
   ```typescript
   // BEFORE
   origin: isProduction()
     ? ['https://buhbot.aidevteam.ru']
     : ['http://localhost:3001', 'http://localhost:3000'],
   // AFTER
   origin: isProduction()
     ? [env.FRONTEND_URL]
     : ['http://localhost:3001', 'http://localhost:3000'],
   ```

4. **`frontend/.env.example`** (line 19-23) — #174
   - Clarify DEV_MODE is local-only:
   ```
   # DEV MODE - Local Development Without Supabase (pnpm dev only, NOT Docker)
   ```

## Files Summary

| File | Issues | Changes |
|------|--------|---------|
| `.github/workflows/ci.yml` | #172, #173 | Add 2 build-args |
| `frontend/Dockerfile` | #173, #178 | Add NEXT_PUBLIC_API_URL ARG/ENV |
| `infrastructure/docker-compose.yml` | #173 | Add NEXT_PUBLIC_API_URL build arg |
| `frontend/src/lib/trpc.ts` | #175, #178 | Remove X-Dev-Mode header, add SSR warning |
| `frontend/src/lib/supabase.ts` | #176, #177 | Remove export isDevMode, fix mock user ID |
| `frontend/src/components/auth/SetPasswordForm.tsx` | #177 | Fix import |
| `frontend/src/components/ProfileMenu.tsx` | #177 | Fix import |
| `backend/src/index.ts` | #179, #180 | DEV_MODE startup warning, CORS from env |
| `backend/src/services/telegram/validation.ts` | #181, #182 | Timeout + error differentiation |
| `backend/src/api/trpc/routers/auth.ts` | #180 | Use env.FRONTEND_URL |
| `frontend/.env.example` | #174 | Clarify docs |

## What We Are NOT Doing (avoiding over-engineering)

- NOT creating shared constants package for mock user ID (just aligning existing values)
- NOT adding production throw for missing NEXT_PUBLIC_API_URL (just warning — CI fix is the real solution)
- NOT adding Docker build support for DEV_MODE (it's local-only by design)
- NOT rate-limiting DEV_MODE per-request logs (startup warning is sufficient)
- NOT removing hardcoded defaults from env.ts (they serve as valid fallbacks)

## Verification

1. `cd backend && pnpm type-check` — TypeScript compilation
2. `cd frontend && pnpm build` — Next.js build (with env vars set)
3. Verify all `isDevMode` imports resolve to `@/lib/config` (grep check)
4. Verify no `X-Dev-Mode` header remains in frontend (grep check)
5. Verify mock user ID is consistent across all files (grep check)

## Commits

One commit per batch with conventional commit format:

1. `fix(ci): add missing NEXT_PUBLIC_BOT_NAME and NEXT_PUBLIC_API_URL to frontend build args (gh-172, gh-173, gh-178)`
2. `fix(dev-mode): unify isDevMode exports, mock user IDs, and remove dead X-Dev-Mode header (gh-175, gh-176, gh-177, gh-179)`
3. `fix(backend): add Telegram validation timeout, improve errors, centralize URL config (gh-180, gh-181, gh-182, gh-174)`
