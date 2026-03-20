# Plan: Accountant (Бухгалтер) Role — Full PRD Implementation

## Context

BuhBot — платформа автоматизации коммуникаций для бухгалтерских фирм. Сейчас система поддерживает 3 роли: Admin, Manager, Observer. PRD из PR #236 (`docs/PRD-Accountant-Role.md`, смержен в main) описывает добавление 4-й роли — Accountant (Бухгалтер) с read-only доступом к своим чатам/статистике, Manager-Group Model (M:N), manager scoping, Telegram-верификацию и систему уведомлений.

**Решения:**
- Registration: **Option B** (только админ создаёт бухгалтеров)
- Git: новая ветка `feat/accountant-role` от `origin/main`
- Scope: полная реализация PRD (Phase 1-5)

## Git Setup

```bash
git fetch origin main
git checkout -b feat/accountant-role origin/main
```

---

## Phase 1: Schema Migration

### Task 1.1: Prisma schema — enum, isActive, новые модели

**Files:** `backend/prisma/schema.prisma`

**Changes:**
1. Add `accountant` to `UserRole` enum (line 22-28)
2. Add `isActive Boolean @default(true) @map("is_active")` to User model (after line 154)
3. Add `@@index([isActive])` to User model
4. Add relations to User: `managedByManagers`, `managedAccountants`, `verificationTokens`, `notificationPreferences`
5. Create `UserManager` model (join table M:N)
6. Create `VerificationToken` model
7. Create `NotificationPreference` model (per PRD §7.8.3 — notificationType + isEnabled + overriddenBy)

**Reuse:** Existing User model pattern (UUID PKs, Timestamptz, @@map, @@schema)

**Migration:** `npx prisma migrate dev --name add_accountant_role`

**Verify:** `npx prisma generate && tsc --noEmit`

---

## Phase 2: API Layer Updates

### Task 2.1: Update types and schemas

**Files:**
- `backend/src/api/trpc/routers/auth.ts:21` — `UserRoleSchema`: add `'accountant'`
- `backend/src/api/trpc/authorization.ts:13` — `AuthUser.role`: add `'accountant'`
- `backend/src/api/trpc/context.ts:37` — `ContextUser.role`: add `'accountant'`, add `isActive: boolean`
- `backend/src/api/trpc/context.ts:~180` — select: add `isActive: true`
- `backend/src/api/trpc/context.ts:~209` — role cast: add `'accountant'`, add `isActive`

### Task 2.2: Add isActive check to auth middleware

**File:** `backend/src/api/trpc/trpc.ts` (isAuthed middleware, line 65-80)

After `if (!ctx.user)` check, add:
```typescript
if (ctx.user.isActive === false) {
  throw new TRPCError({ code: 'FORBIDDEN', message: 'Ваш аккаунт деактивирован.' });
}
```

Also update `DEV_MODE_USER` in context.ts: add `isActive: true`

### Task 2.3: Create accountantProcedure middleware

**File:** `backend/src/api/trpc/trpc.ts`

New middleware `isAccountant` allowing `['admin', 'manager', 'accountant']`. Export `accountantProcedure`.

### Task 2.4: Update requireChatAccess

**File:** `backend/src/api/trpc/authorization.ts`

Add `'accountant'` to AuthUser type. The function logic already works correctly — admin/manager get full access, everyone else scoped by `assignedAccountantId`. Just update the type definition.

### Task 2.5: Update createUser for accountant + managerIds

**File:** `backend/src/api/trpc/routers/auth.ts:333`

Add optional `managerIds: z.array(z.string().uuid()).optional()` to input. After user creation, if `role === 'accountant' && managerIds`, create UserManager records + create VerificationToken.

**Verify:** `tsc --noEmit && npm run build`

---

## Phase 3: Manager Scoping

### Task 3.1: Create scoping helper

**New file:** `backend/src/api/trpc/helpers/scoping.ts`

```typescript
export async function getScopedChatIds(prisma, userId, role): Promise<bigint[] | null>
```
- admin: return null (no filter)
- manager: query UserManager → get accountant IDs → get their chat IDs + own chat IDs
- accountant/observer: get own assigned chat IDs

### Task 3.2: Apply scoping to chats router

**File:** `backend/src/api/trpc/routers/chats.ts:87-89`

Change `if (ctx.user.role === 'observer')` to `if (['observer', 'accountant'].includes(ctx.user.role))`.

Also check `getById` procedure for same pattern.

### Task 3.3: Apply scoping to requests router

**File:** `backend/src/api/trpc/routers/requests.ts`

For `list` procedure: if accountant/observer, add `chatId: { in: scopedChatIds }` filter.

### Task 3.4: Apply scoping to analytics router

**File:** `backend/src/api/trpc/routers/analytics.ts`

For `slaCompliance`, `accountantPerformance`: scope SQL queries by chat IDs for accountant role. This may involve raw SQL WHERE clause additions.

### Task 3.5: Apply scoping to alerts, alert, feedback, messages routers

**Files:**
- `backend/src/api/trpc/routers/alerts.ts` — change `managerProcedure` to `accountantProcedure` for `listUnacknowledged`, add scoping
- `backend/src/api/trpc/routers/alert.ts` — `getAlerts`, `getActiveAlerts`, `getAlertStats`: add scoping for accountant
- `backend/src/api/trpc/routers/feedback.ts` — accountants: ❌ No access (per PRD §7.1.2)
- `backend/src/api/trpc/routers/messages.ts` — already uses `requireChatAccess()`, should work

**Verify:** `tsc --noEmit`, manual test with accountant user

---

## Phase 4: New Features

### Task 4.1: UserManager router

**New file:** `backend/src/api/trpc/routers/userManager.ts`

Procedures:
- `assign` (adminProcedure): create UserManager record
- `unassign` (adminProcedure): delete UserManager record
- `reassign` (adminProcedure): transaction — delete old, create new, notify
- `listByManager` (managerProcedure): list accountants for manager
- `listByAccountant` (authedProcedure): list managers for accountant

Register in `backend/src/api/trpc/router.ts`.

### Task 4.2: Telegram verification handler

**File:** `backend/src/bot/handlers/invitation.handler.ts:47`

In `bot.start` handler, before invitation token processing:
```typescript
if (payload.startsWith('verify_')) {
  await processVerification(ctx, payload.substring(7));
  return;
}
```

New `processVerification()`:
1. Find VerificationToken by token string
2. Validate: not used, not expired
3. Check Telegram ID not already linked to another user
4. Transaction: update User (telegramId, telegramUsername, isOnboardingComplete=true), upsert TelegramAccount, mark token used
5. Reply with success message
6. Notify bound managers

### Task 4.3: Accountant bot commands

**New file:** `backend/src/bot/handlers/accountant.handler.ts`

Commands:
- `/mystats` — personal stats (response time, SLA compliance)
- `/mychats` — list assigned chats
- `/newchat` — create ChatInvitation (self-service)
- `/invite` — generate invite link for existing chat
- `/notifications` — toggle notification preferences

Register in bot setup after existing handlers.

### Task 4.4: Notification preferences system

**New file:** `backend/src/api/trpc/routers/notificationPref.ts`

Procedures:
- `get` (authedProcedure): get own preferences
- `update` (authedProcedure): toggle own preferences (if not locked)
- `override` (managerProcedure): lock/override for group accountants
- `adminOverride` (adminProcedure): override any user

Integrate with `escalation.service.ts:50-72` — check preferences before sending.

### Task 4.5: Deactivation flow

**File:** `backend/src/api/trpc/routers/auth.ts`

New procedures:
- `deactivateUser` (adminProcedure): prerequisite check (no assigned chats), set isActive=false, notify managers
- `reactivateUser` (adminProcedure): set isActive=true

### Task 4.6: Manager cascade logic

**File:** `backend/src/api/trpc/routers/auth.ts` (extend deactivateUser)

When deactivating a manager:
1. Find accountants managed only by this manager (orphan risk)
2. If orphans exist → block with list of affected accountants
3. If all have other managers → proceed

### Task 4.7: Frontend updates

**Files:**
- `frontend/src/components/chats/AccountantSelect.tsx:68-69` — add `'accountant'` to role filter
- User management dialogs — add accountant role option with label "Бухгалтер"
- User list — add isActive status indicator
- New: Manager group assignment UI (admin panel)

---

## Phase 5: Verification

### Automated
- `tsc --noEmit` — full type check
- `npm run build` — production build
- `npm test` — existing tests pass (no regression)

### Manual E2E Test Plan
1. Admin creates accountant user → verify VerificationToken created
2. Accountant clicks `t.me/bot?start=verify_TOKEN` → verify Telegram linked
3. Admin assigns accountant to manager → verify UserManager record
4. Admin assigns accountant to 2 chats → verify chat list shows only 2
5. Verify requests/analytics/alerts scoped to own chats
6. Test `/mystats`, `/mychats` bot commands
7. Test deactivation → verify blocked if chats assigned
8. Test manager cascade → verify blocked if accountants orphaned
9. Verify admin/manager flows unchanged (regression)

---

## Critical Files

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Enum, User model, 3 new models |
| `backend/src/api/trpc/trpc.ts` | isActive check, accountantProcedure |
| `backend/src/api/trpc/authorization.ts` | AuthUser type |
| `backend/src/api/trpc/context.ts` | ContextUser type, isActive field |
| `backend/src/api/trpc/routers/auth.ts` | UserRoleSchema, createUser, deactivate/reactivate |
| `backend/src/api/trpc/router.ts` | Register new routers |
| `backend/src/api/trpc/helpers/scoping.ts` | NEW — scoping helper |
| `backend/src/api/trpc/routers/userManager.ts` | NEW — manager group management |
| `backend/src/api/trpc/routers/notificationPref.ts` | NEW — notification preferences |
| `backend/src/api/trpc/routers/chats.ts` | Scoping for accountant role |
| `backend/src/api/trpc/routers/requests.ts` | Scoping for accountant role |
| `backend/src/api/trpc/routers/analytics.ts` | Scoping for accountant role |
| `backend/src/api/trpc/routers/alerts.ts` | Scoping + accountantProcedure |
| `backend/src/api/trpc/routers/alert.ts` | Scoping for accountant role |
| `backend/src/bot/handlers/invitation.handler.ts` | Verification token handling |
| `backend/src/bot/handlers/accountant.handler.ts` | NEW — bot commands |
| `frontend/src/components/chats/AccountantSelect.tsx` | Role filter update |

## Execution Strategy

Phase 1-2 выполняются последовательно (зависимость на схему). Phase 3 задачи (3.2-3.5) параллелизируются после создания scoping helper (3.1). Phase 4 задачи (4.1-4.7) в основном параллельны (кроме 4.6→4.1 и 4.3→4.2).
