# Code Review Report: gh-172–182

**Date**: 2026-02-20
**Commits reviewed**: `9c37739`, `5e12f93`, `c2c00f5`, `1f809b4` (4 commits, excluding beads sync)
**Issues addressed**: gh-172, gh-173, gh-174, gh-175, gh-176, gh-177, gh-178, gh-179, gh-180, gh-181, gh-182
**Reviewer**: Claude Sonnet 4.6 (code-reviewer worker)
**Verdict**: PASS WITH NOTES

---

## Summary

This batch of fixes addressed five distinct concern areas: CI build-arg propagation, DEV_MODE cleanup, Telegram validation hardening, URL centralization, and documentation. Overall the changes are correct and well-scoped. No critical bugs were introduced. Several medium/low-severity observations are noted below.

**Files reviewed (11):**
- `.github/workflows/ci.yml`
- `frontend/Dockerfile`
- `infrastructure/docker-compose.yml`
- `frontend/src/lib/trpc.ts`
- `frontend/src/lib/supabase.ts`
- `frontend/src/components/auth/SetPasswordForm.tsx`
- `frontend/src/components/ProfileMenu.tsx`
- `backend/src/index.ts`
- `backend/src/services/telegram/validation.ts`
- `backend/src/api/trpc/routers/auth.ts`
- `frontend/.env.example`

**Supporting files read for context:**
- `frontend/src/lib/config.ts`
- `backend/src/config/env.ts`
- `backend/src/api/trpc/context.ts`
- `backend/src/lib/supabase.ts`
- `infrastructure/docker-compose.yml` (full)

---

## Findings

### Medium Priority

---

#### M-1: `docker-compose.yml` service comment not updated

**File**: `infrastructure/docker-compose.yml`, line 59
**Issue**: The service comment block for `frontend` still reads:

```yaml
# Build args: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```

The actual `args:` block now passes four arguments, but the comment only documents two of the original ones. A developer setting up a new environment via the compose file will not see `NEXT_PUBLIC_BOT_NAME` or `NEXT_PUBLIC_API_URL` listed in the inline documentation.

**Suggested fix**:
```yaml
# Build args: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#             NEXT_PUBLIC_BOT_NAME, NEXT_PUBLIC_API_URL
```

---

#### M-2: `frontend/src/app/page.tsx` – hardcoded production URL in `openGraph` metadata

**File**: `frontend/src/app/page.tsx`, line 30
**Issue**: The OpenGraph `url` field is still hardcoded:

```ts
url: 'https://buhbot.aidevteam.ru',
```

This was not part of the stated scope of gh-180, and it is in static Next.js `export const metadata` (which cannot reference runtime env vars directly). However, this URL is the staging domain, not the final production domain, which means if/when the domain changes it will require a manual code change. The issue already exists but is worth flagging now that URL centralization is a stated goal.

**Options**:
1. Accept as-is if `buhbot.aidevteam.ru` is the permanent domain.
2. Extract to a build-time constant and document it as a known non-centralized value.
3. Use `NEXT_PUBLIC_FRONTEND_URL` build-arg at build time for Next.js metadata, consistent with how `NEXT_PUBLIC_API_URL` is now handled.

---

#### M-3: `backend/src/services/telegram/validation.ts` – `console.error` instead of structured logger

**File**: `backend/src/services/telegram/validation.ts`, line 49
**Issue**: The fallback catch path uses `console.error` rather than the project's Winston `logger`:

```ts
console.error('Telegram validation error:', error);
```

Every other error path in the backend uses `logger.error(...)` with structured fields (file, service tag, etc.). This error will not appear in Winston-formatted logs or be captured by the Prometheus error counter.

**Suggested fix**:
```ts
import logger from '../../utils/logger.js';
// ...
logger.error('Telegram validation error', {
  error: error instanceof Error ? error.message : String(error),
  service: 'telegram-validation',
});
```

---

#### M-4: `backend/src/api/trpc/routers/auth.ts` – `supabase.auth.admin.inviteUserByEmail` called without null-guard

**File**: `backend/src/api/trpc/routers/auth.ts`, line 283
**Issue**: `supabase` is imported from `../../../lib/supabase.js`. Looking at that module, it is always non-null (it uses placeholder credentials in dev mode), so there is no runtime crash here. However, the backend `supabase.ts` comment explicitly says the placeholder client "will fail gracefully" if used — and `admin.inviteUserByEmail` is an actual API call that will fail at runtime if DEV_MODE is active and real credentials are absent.

There is no guard for `isDevMode` in `createUser`, unlike the `me` procedure which has an explicit dev-mode branch. A developer running in DEV_MODE who accidentally triggers the "create user" admin flow will receive a confusing network error from the placeholder Supabase client.

**Suggested fix**: Add an early return in `createUser` for dev mode, similar to the `me` procedure:

```ts
if (isDevMode) {
  logger.warn('DEV_MODE: createUser is a no-op', { email: input.email, service: 'auth' });
  throw new Error('DEV_MODE: User creation is disabled without real Supabase credentials');
}
```

---

### Low Priority

---

#### L-1: `frontend/src/lib/supabase.ts` – `isDevModeLocal` logic differs from `config.ts` `isDevMode`

**File**: `frontend/src/lib/supabase.ts`, line 10
**Issue**: After the refactor, `supabase.ts` retains its own local dev-mode detection:

```ts
const isDevModeLocal = process.env.NODE_ENV === 'development' && !isSupabaseConfigured;
```

This logic triggers the `console.warn` warning whenever Supabase is not configured in development, regardless of whether `NEXT_PUBLIC_DEV_MODE=true` is set. By contrast, `config.ts` requires the explicit opt-in:

```ts
export const isDevMode =
  process.env.NEXT_PUBLIC_DEV_MODE === 'true' && process.env.NODE_ENV === 'development';
```

The two conditions are intentionally different (the supabase.ts warning fires whenever Supabase is absent, while the real dev-mode flag requires explicit opt-in), but this is now undocumented and potentially confusing. The comment on line 9 of `supabase.ts` still says "bypass auth when Supabase is not configured", which no longer describes the actual behavior (it used to export `isDevMode`, now it does not).

**Suggested fix**: Update the comment to clarify that this is only used for a one-time `console.warn` at module load:

```ts
// One-time console warning if Supabase env vars are absent in development.
// This does NOT control auth bypass — use isDevMode from @/lib/config for that.
const isDevModeLocal = process.env.NODE_ENV === 'development' && !isSupabaseConfigured;
```

---

#### L-2: `frontend/src/lib/trpc.ts` – `console.warn` in production code path

**File**: `frontend/src/lib/trpc.ts`, line 43
**Issue**: The SSR fallback logs with `console.warn`, which is inconsistent with the rest of the frontend but acceptable for a one-time startup path. No action required unless the team enforces a no-`console` ESLint rule on the frontend.

---

#### L-3: `backend/src/config/env.ts` – `FRONTEND_URL` default is the staging domain

**File**: `backend/src/config/env.ts`, line 102
**Issue**: The Zod default for `FRONTEND_URL` is:

```ts
.default('https://buhbot.aidevteam.ru')
```

This means that if `FRONTEND_URL` is not set in production `.env`, the invite redirect link in Supabase emails and the CORS allowlist will silently use the staging domain. While this is safer than a hardcoded string in application code (because at least it is in one place), the default should ideally be removed so the server fails fast if the variable is missing in production.

**Suggested fix**: Make `FRONTEND_URL` required in non-test environments (similar to how `DATABASE_URL` is handled):

```ts
FRONTEND_URL: isTestEnv
  ? z.string().url().optional().default('http://localhost:3001')
  : z.string().url().describe('Frontend URL for CORS and password reset redirects'),
```

This would force explicit configuration in production rather than silently defaulting to the staging URL. This is a breaking config change and should be done with a migration step.

---

#### L-4: CI workflow – `security-scan` uses `continue-on-error: true` and `|| true`

**File**: `.github/workflows/ci.yml`, lines 226–228
**Issue**: The security scan job is doubly silenced (both `continue-on-error: true` on the job step and `|| true` on the shell command). If vulnerabilities are found, the CI will always report green. This predates the current batch but is worth noting as the overall security posture of the project improves.

**Suggested improvement**: Remove `|| true` and set `continue-on-error: false` with `--audit-level=critical` so critical CVEs will at least break the build.

---

#### L-5: `infrastructure/docker-compose.yml` – `NEXT_PUBLIC_API_URL` default points to internal hostname

**File**: `infrastructure/docker-compose.yml`, line 69
**Issue**: The default value:

```yaml
- NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://bot-backend:3000}
```

is an internal Docker network hostname. Because `NEXT_PUBLIC_API_URL` is baked into the Next.js bundle at build time (it is a `NEXT_PUBLIC_` variable), this hostname will be embedded in the client-side JavaScript and will be unreachable from browsers. The `getBaseUrl()` function in `trpc.ts` correctly returns `''` (empty string) on the client side to use a relative path, so SSR calls go to `http://bot-backend:3000` while browser calls use the relative `/api/trpc` — which is the intended behavior.

This is architecturally correct but subtly non-obvious: the build arg controls only the SSR base URL, not the browser URL. The comment in `trpc.ts` documents this, but the compose file does not. Consider adding an inline comment:

```yaml
# SSR-only: browser requests use relative path (/api/trpc), not this value
- NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://bot-backend:3000}
```

---

## Correctness Assessment

| Change | Correct? | Notes |
|--------|----------|-------|
| gh-172/173/178: Added `NEXT_PUBLIC_BOT_NAME` and `NEXT_PUBLIC_API_URL` to CI, Dockerfile, docker-compose | Yes | All three files are consistent |
| gh-175: Removed X-Dev-Mode header | Yes | No remaining references found |
| gh-176: Unified `isDevMode` exports | Yes | All frontend components now import from `@/lib/config`; no stale imports from supabase |
| gh-177: Fixed mock user ID inconsistency | Yes | `aaaaaaaa-aaaa-...` is now consistent across frontend `config.ts`, `supabase.ts`, and backend `context.ts` |
| gh-179: Added startup warning for DEV_MODE | Yes | Positioned correctly before other startup tasks |
| gh-180: Replaced hardcoded CORS origin and invite redirect URL with `env.FRONTEND_URL` | Yes | Both sites (index.ts and auth.ts) updated; one residual in `page.tsx` is static metadata (different concern — M-2) |
| gh-181/182: Added 10s timeout and differentiated error messages | Yes | `AbortSignal.timeout()` is available in Node 17.3+; project uses Node 20 LTS |
| gh-174: Updated `.env.example` comment | Yes | Comment now correctly says "pnpm dev only, NOT Docker" |

---

## Security Assessment

No new security vulnerabilities were introduced.

- The `FRONTEND_URL` centralization removes a risk where a misconfigured environment could accidentally have the hardcoded fallback URL accepted by CORS while a different `env.FRONTEND_URL` was set.
- The DEV_MODE startup warning (gh-179) provides operational visibility that auth bypass is active.
- The Telegram timeout (gh-181) prevents a hung request from blocking an entire tRPC mutation indefinitely (defense-in-depth).
- The differentiated error messages (gh-182) do not leak internal details — all three messages are user-facing without revealing token format or server internals.

One pre-existing concern to note (not introduced by this batch): `backend/src/lib/supabase.ts` uses placeholder credentials in DEV_MODE. The `createUser` admin procedure does not short-circuit for DEV_MODE, meaning it will make a real (failing) HTTP call to `http://localhost:54321` with a fake key. See finding M-4.

---

## Overall Verdict

**PASS WITH NOTES**

The changes achieve their stated goals correctly. No regressions were introduced. The high-value fixes (URL centralization, DEV_MODE unification, Telegram timeout) are well-executed. The notes above are primarily documentation gaps (M-1, L-1, L-5), one minor logger inconsistency (M-3), one edge-case dev-mode guard (M-4), and a pre-existing infra observation (L-3, L-4).

**Recommended follow-up tasks (priority order):**
1. M-3: Replace `console.error` with `logger.error` in `validation.ts`
2. M-4: Add DEV_MODE guard to `createUser` procedure in `auth.ts`
3. M-1: Update docker-compose comment to list all four build args
4. L-1: Update `supabase.ts` comment to clarify `isDevModeLocal` purpose
5. L-3: Consider making `FRONTEND_URL` required in production (`backend/src/config/env.ts`)
6. M-2: Decide on strategy for `page.tsx` OpenGraph URL (static metadata constraint noted)
7. L-4: Tighten security scan to fail on critical CVEs
