# Plan: Process GitHub Issues #237, #238, #228, #213, #239

## Context

5 open GitHub issues need analysis and fixing. User requested sequential processing starting with #237, then #238, #228, #213, #239. All issues are interconnected:
- #237 (deploy) and #239 (dev mode) share the Prisma migration problem
- #238 (CSS stacking) blocks #213 (global managers field is "not fixed" because ManagerMultiSelect dropdown is unusable)
- #228 (code quality bugs from PR #224) are independent minor fixes

## Priority Scoring

| Rank | Issue | Title | Sev | Imp | Lkh | Score | Priority |
|------|-------|-------|-----|-----|-----|-------|----------|
| 1 | #237 | Prisma migration EACCES + rollback failure | 10 | 10 | 10 | 30 | P0 |
| 2 | #238 | Dropdown overlap (CSS stacking context) | 7 | 10 | 10 | 27 | P0 |
| 3 | #213 | Global Manager IDs field not working | 5 | 7 | 10 | 22 | P1 |
| 4 | #228 | PR #224 potential bugs (inline colors, dynamic import, null BigInt) | 5 | 3 | 5 | 13 | P2 |
| 5 | #239 | DEV MODE unusable | 5 | 3 | 7 | 15 | P2 |

## Dependency Graph

```
#238 (CSS stacking) ──blocks──> #213 (global managers field)
#237, #228, #239 — independent of each other
```

## Execution Order

1. **#237** — Deploy: Prisma migration EACCES fix
2. **#238** — Frontend: CSS stacking context fix (unblocks #213)
3. **#228** — Code quality: PR #224 bug fixes
4. **#213** — Verify global managers field works after #238 fix (may need no code changes)
5. **#239** — DX: DEV MODE improvements

---

## Issue #237: Prisma migration EACCES + rollback failure

### Root Cause
1. `backend/Dockerfile` creates `USER nodejs` (uid 1001) but sets no `HOME` or `npm_config_cache` env var
2. `github-deploy.sh:387` runs `docker exec buhbot-bot-backend npx prisma migrate deploy` — `npx` tries to write npm cache as uid 1001 to non-writable dir
3. Rollback logic has no pre-check for image existence and no DB rollback step

### Fix Plan

#### Fix 1: Dockerfile — add writable HOME/cache dirs
File: `backend/Dockerfile`
- After `USER nodejs` (line 76), add:
  ```dockerfile
  ENV HOME=/app
  ENV npm_config_cache=/app/.npm
  ```
- Before `USER nodejs`, add `mkdir -p /app/.npm && chown nodejs:nodejs /app/.npm`

#### Fix 2: Deploy script — use local prisma binary instead of npx
File: `infrastructure/scripts/github-deploy.sh`
- Change line ~387 from:
  ```bash
  docker exec buhbot-bot-backend npx prisma migrate deploy
  ```
  to:
  ```bash
  docker exec buhbot-bot-backend ./node_modules/.bin/prisma migrate deploy
  ```
  This avoids npx cache entirely.

#### Fix 3: Rollback — add image existence check
File: `infrastructure/scripts/github-deploy.sh`
- In `rollback()`, before re-tagging images, verify they exist:
  ```bash
  if ! docker image inspect "buhbot-backend:${previous_commit}" &>/dev/null; then
      log_warning "Previous image not found, attempting pull or using :latest"
  fi
  ```

#### Fix 4: deploy.yml — fix rollback trigger condition
File: `.github/workflows/deploy.yml`
- Rollback condition at line ~219 checks only `steps.deploy.outcome == 'failure'`
- Should also trigger on healthcheck failure: `if: failure()`

#### Fix 5: Remove dead NODE_VERSION env var
File: `.github/workflows/deploy.yml`
- Line 22: `NODE_VERSION: '18'` is never used — remove it

### Files to Modify
- `backend/Dockerfile` (lines 72-76)
- `infrastructure/scripts/github-deploy.sh` (lines 384-394, 450-501)
- `.github/workflows/deploy.yml` (lines 22, 219-220)

---

## Issue #238: Dropdown overlap (CSS stacking context)

### Root Cause
`GlassCard` with `buh-glass` (backdrop-filter) and `buh-hover-lift` (transform) creates stacking contexts that trap `z-[1000]` dropdowns. DangerZone card below overlaps the dropdown.

### Fix Plan — Use shadcn Popover (portal-based)

The project already uses shadcn `Popover` (Radix portal) in 5+ components. Migrate AccountantSelect and ManagerMultiSelect dropdowns to use `Popover` component which renders via portal, escaping stacking contexts entirely.

#### AccountantSelect.tsx
File: `frontend/src/components/chats/AccountantSelect.tsx`
- Replace custom `absolute z-[1000]` dropdown div (line 200-209) with `<Popover>` + `<PopoverTrigger>` + `<PopoverContent>`
- Keep existing search, keyboard navigation, and selection logic
- PopoverContent renders via portal — no stacking context issue

#### ManagerMultiSelect.tsx
File: `frontend/src/components/chats/ManagerMultiSelect.tsx`
- Same refactor: replace custom `absolute z-[1000]` dropdown div (line 268-276) with `<Popover>` + `<PopoverTrigger>` + `<PopoverContent>`
- Keep existing multi-select logic, chips, search

#### ChatDetailsContent.tsx
File: `frontend/src/components/chats/ChatDetailsContent.tsx`
- Remove misleading comment at line 352: `{/* Settings Form - dropdown uses z-[1000] so no wrapper z-index needed */}`

### Files to Modify
- `frontend/src/components/chats/AccountantSelect.tsx`
- `frontend/src/components/chats/ManagerMultiSelect.tsx`
- `frontend/src/components/chats/ChatDetailsContent.tsx` (comment only)

---

## Issue #228: PR #224 potential bugs

### Fix 1: Inline Tailwind colors → design system tokens
File: `frontend/src/components/chats/ManagerMultiSelect.tsx`
- Line 205: `border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20` → `border-[var(--buh-warning)]/50 bg-[var(--buh-warning)]/10`
- Lines 222, 348: `text-yellow-500` → `text-[var(--buh-warning)]`

### Fix 2: Null BigInt guard
File: `backend/src/api/trpc/routers/user.ts`
- Line 239: `telegramUserId` is non-nullable BigInt per schema — **no fix needed** (false positive). Add a comment explaining this.

### Fix 3: Dynamic import comment
File: `backend/src/api/trpc/routers/user.ts`
- Line 254: Dynamic import is intentional to avoid circular dependency. Add explanatory comment:
  ```ts
  // Dynamic import to avoid circular: user.ts → telegram-client → bot → trpc → user.ts
  ```

### Files to Modify
- `frontend/src/components/chats/ManagerMultiSelect.tsx` (lines 205, 222, 348)
- `backend/src/api/trpc/routers/user.ts` (lines 239, 254 — comments only)

---

## Issue #213: Global Manager IDs field

### Analysis
`SlaManagerSettingsForm` component exists on main and is rendered on `/settings` page. User reports "Not fixed!" because the ManagerMultiSelect dropdown inside it is broken due to the same CSS stacking context bug (#238).

### Fix Plan
After #238 is fixed (ManagerMultiSelect migrated to Popover), verify that the `/settings` page works correctly. **No additional code changes expected** — this issue should be resolved by #238 fix.

### Verification
- Navigate to `/settings`
- Confirm SlaManagerSettingsForm renders
- Confirm ManagerMultiSelect dropdown opens and is usable (not clipped)
- Confirm saving globalManagerIds works via API

---

## Issue #239: DEV MODE improvements (full scope)

### Fix 1: Auto-migrate on dev startup
File: `backend/package.json`
- Change `"dev"` script to run `prisma migrate deploy` before starting nodemon:
  ```json
  "dev": "prisma migrate deploy && nodemon --exec tsx src/index.ts"
  ```

### Fix 2: Add prisma seed config
File: `backend/package.json`
- Add `"prisma": { "seed": "tsx prisma/seed.ts" }` to enable native `prisma db seed`

### Fix 3: Auto-seed on empty DB + full dev-env.sh setup
File: `infrastructure/scripts/dev-env.sh`
- After starting Redis, add:
  1. `cd backend && npx prisma migrate deploy` — apply any pending migrations
  2. Check if DB is empty (query Settings table), if so run `npx prisma db seed`
  3. Then start backend + frontend via concurrently

### Fix 4: Enable/mock BullMQ workers in DEV MODE
File: `backend/src/index.ts` (or worker startup files)
- Ensure BullMQ workers start in DEV MODE (they may be conditionally disabled)
- If Telegram bot conflicts (`409: terminated by other getUpdates`), add guard to use webhooks or skip polling in DEV MODE when another bot instance is running
- Search for any `if (isDevMode) return` guards that disable workers

### Fix 5: DEV MODE user creation
File: `backend/src/api/trpc/routers/auth.ts`
- In `createUser` mutation, add DEV MODE bypass that creates user directly in DB without Supabase `inviteUserByEmail`
- Pattern: check `isDevMode`, if true — `prisma.user.create()` directly with mock email/role

### Fix 6: Surface API errors in DEV MODE frontend
File: `frontend/src/lib/trpc.ts` (or global error handler)
- Add a DEV MODE global tRPC error handler that shows toast/console.warn on mutation failures
- Use existing toast infrastructure (search for existing toast usage)

### Files to Modify
- `backend/package.json` (dev script, prisma.seed config)
- `infrastructure/scripts/dev-env.sh` (migrate + seed + worker startup)
- `backend/src/index.ts` or worker files (ensure workers start in dev)
- `backend/src/api/trpc/routers/auth.ts` (~line 351, DEV MODE user creation)
- `frontend/src/lib/trpc.ts` or error handler (DEV MODE error surfacing)

---

## Verification

For each issue after fix:
1. `npm run type-check` — must pass
2. `npm run build` — must pass
3. Issue-specific verification:
   - #237: Review Dockerfile and deploy script changes (can't test deploy locally)
   - #238: Run frontend, open chat settings, verify dropdown renders above DangerZone
   - #228: Visual check that warning colors use design system tokens
   - #213: Verify `/settings` page ManagerMultiSelect works
   - #239: Run `npm run dev`, verify auto-migration + seed works, test user creation in DEV MODE, verify workers start, check error toasts on failed mutations
