# Telegram-first onboarding for accountant role

## Context

Current onboarding: Admin creates user -> Supabase sends invite email -> User sets password -> Logs into web -> Connects Telegram.

For accountants this is overcomplicated. They primarily work via Telegram bot. The new flow:
Admin creates accountant -> Gets TG deep link -> Sends to accountant -> Accountant clicks link in TG bot -> Done.
Web access and password are optional, set up later by the accountant themselves via a bot button.

Additionally, accountant role needs restricted web access: no Analytics, Reports, Feedback, Surveys, Users, System Logs. Settings page shows only Profile tab. Dashboard shows only own chats + own SLA.

## Bug fix: accountant username lookup in chat settings

**Problem:** `chats.ts:565-582` — when admin adds an accountant via `@username` in chat settings, the code looks up users by `User.telegramUsername`. But this field is only populated after TG verification (`processVerification` sets it). For accountants who haven't verified yet, or whose TG username differs from what admin types, the lookup fails with "Пользователи не найдены в системе".

**Root cause:** `chats.ts:565-567`:
```typescript
const knownUsers = await tx.user.findMany({
  where: { telegramUsername: { in: finalUsernames, mode: 'insensitive' } },
  select: { telegramUsername: true, telegramId: true },
});
```
Only checks `User.telegramUsername`, ignores `TelegramAccount.username`.

**Fix:** Expand the lookup to also check `TelegramAccount.username`:
```typescript
const knownUsers = await tx.user.findMany({
  where: {
    OR: [
      { telegramUsername: { in: finalUsernames, mode: 'insensitive' } },
      { telegramAccount: { username: { in: finalUsernames, mode: 'insensitive' } } },
    ],
  },
  select: { telegramUsername: true, telegramId: true, telegramAccount: { select: { username: true } } },
});
// Build knownSet from both sources
const knownSet = new Set(
  knownUsers.flatMap((u) => [
    u.telegramUsername?.toLowerCase(),
    u.telegramAccount?.username?.toLowerCase(),
  ]).filter(Boolean)
);
```

**File:** `backend/src/api/trpc/routers/chats.ts` (lines 565-573)

---

## Changes

### 1. Backend: `createUser` mutation for accountant role

**File:** `backend/src/api/trpc/routers/auth.ts`

**What changes:**
- For `role === 'accountant'`: use `supabase.auth.admin.createUser()` instead of `inviteUserByEmail()`
  - Pass `email_confirm: true` (auto-confirm email, no verification needed)
  - Don't set password (user will request it later)
- After creating VerificationToken (line 549), build the deep link: `https://t.me/${env.BOT_USERNAME}?start=verify_${tokenValue}`
- Update output schema: add optional `verificationLink: z.string().url().optional()` to the output
- Return `verificationLink` for accountant role, `inviteSent: false` (no email sent)
- For non-accountant roles: keep existing `inviteUserByEmail()` flow unchanged

**Key code (auth.ts ~line 494):**
```typescript
// For accountant: silent creation, no invite email
if (input.role === 'accountant') {
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: input.email,
    email_confirm: true,
    user_metadata: { full_name: input.fullName, role: input.role },
  });
  // ... rest of DB transaction stays the same
}
```

### 2. Backend: New tRPC procedure `requestPasswordEmail`

**File:** `backend/src/api/trpc/routers/auth.ts`

**What changes:**
- New `authedProcedure` (any authenticated user can call it for themselves, but primarily used via bot)
- Actually, this will be called from the bot, not from authenticated web session. So we need a different approach.

**Alternative: Bot handler for password setup**

**File:** `backend/src/bot/handlers/accountant.handler.ts`

- Add handler for callback_query `request_password_email`
- Looks up user by `telegramId` in DB
- Calls `supabase.auth.admin.generateLink({ type: 'magiclink', email: user.email, options: { redirectTo: env.FRONTEND_URL + '/set-password' } })`
- Sends the generated link to user in TG (private message)
- Alternatively: `supabase.auth.resetPasswordForEmail(email)` to send standard Supabase reset email

**Simplest approach:** Use `supabase.auth.admin.generateLink({ type: 'recovery', email })` which generates a password reset link without sending email, then the bot sends the link directly to user in TG.

### 3. Bot: Post-verification inline keyboard

**File:** `backend/src/bot/handlers/invitation.handler.ts`

**What changes in `processVerification()` (line 421):**
- After successful verification, reply with inline keyboard instead of plain text
- Inline keyboard buttons:
  1. URL button: "Личный кабинет" -> `{FRONTEND_URL}/settings/profile`
  2. Callback button: "Установить пароль" -> callback_data `request_password_email`

```typescript
await ctx.reply(
  'Верификация успешна! Ваш аккаунт Telegram привязан к BuhBot.',
  {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Личный кабинет', url: `${env.FRONTEND_URL}/settings/profile` }],
        [{ text: 'Установить пароль (по желанию)', callback_data: 'request_password_email' }],
      ],
    },
  }
);
```

### 4. Frontend: `UserCreateDialog` shows TG link for accountant

**File:** `frontend/src/components/settings/users/UserCreateDialog.tsx`

**What changes:**
- After successful creation of accountant, show the `verificationLink` with copy-to-clipboard button
- Reuse copy pattern from `InvitationModal.tsx` (lines 130-148)
- Change success toast text for accountant: "Пользователь создан. Отправьте ссылку бухгалтеру для подключения через Telegram"
- Keep dialog open after accountant creation to show the link (don't auto-close)

### 5. Frontend: Role-based navigation filtering

**File:** `frontend/src/components/layout/AdminLayout.tsx`

**What changes:**
- Import `trpc` and fetch current user via `trpc.auth.me.useQuery()`
- Define `ACCOUNTANT_ALLOWED_NAV_IDS` constant:
  ```typescript
  const ACCOUNTANT_ALLOWED_NAV_IDS = ['dashboard', 'chats', 'requests', 'sla', 'alerts', 'violations', 'settings', 'help'];
  ```
  Hidden for accountant: `analytics`, `reports`, `feedback`, `survey`, `users`, `logs`
- Filter `navigationItems` before rendering in Sidebar based on user role
- Pass filtered items to `Sidebar` component

**Sidebar component changes:**
- Accept `items` prop instead of using global `navigationItems`
- In `AdminLayoutContent`: compute filtered items and pass to `Sidebar`

### 6. Frontend: Settings page - accountant sees only Profile tab

**File:** `frontend/src/app/settings/page.tsx`

**What changes:**
- Fetch current user via `trpc.auth.me.useQuery()`
- If `role === 'accountant'`: render only `<ProfileSettingsForm />` without tabs wrapper
- Else: render full tabs as now (no changes for other roles)

### 7. Frontend: Route guards for accountant

**File:** Create middleware or add guards to restricted pages

**Approach:** Add a shared hook `useRoleGuard` that redirects accountant to `/dashboard` if they navigate to restricted routes.

**Files to add guard:**
- `frontend/src/app/analytics/page.tsx`
- `frontend/src/app/reports/page.tsx`
- `frontend/src/app/feedback/feedback-content.tsx`
- `frontend/src/app/settings/survey/page.tsx`
- `frontend/src/app/settings/users/page.tsx`
- `frontend/src/app/logs/page.tsx`

**Implementation:** Small hook:
```typescript
// frontend/src/hooks/useRoleGuard.ts
export function useRoleGuard(deniedRoles: string[]) {
  const { data: me } = trpc.auth.me.useQuery();
  const router = useRouter();
  useEffect(() => {
    if (me && deniedRoles.includes(me.role)) {
      router.replace('/dashboard');
    }
  }, [me, deniedRoles, router]);
  return { isAllowed: me ? !deniedRoles.includes(me.role) : null };
}
```

Each restricted page adds: `const { isAllowed } = useRoleGuard(['accountant']);`

## Implementation order

1. **Bug fix:** Fix accountant username lookup in `chats.ts` (expand to TelegramAccount.username)
2. Backend: Modify `createUser` for accountant (silent Supabase creation + return verificationLink)
3. Frontend: Update `UserCreateDialog` to show TG link
4. Bot: Add inline keyboard after verification + password request handler
5. Frontend: Navigation filtering by role in `AdminLayout`
6. Frontend: Settings page filtering for accountant
7. Frontend: Route guards on restricted pages

## Files to modify

| File | Change |
|------|--------|
| `backend/src/api/trpc/routers/chats.ts` | **Bug fix:** expand username lookup to include TelegramAccount.username |
| `backend/src/api/trpc/routers/auth.ts` | createUser: silent creation for accountant, return verificationLink |
| `backend/src/bot/handlers/invitation.handler.ts` | processVerification: inline keyboard with web + password buttons |
| `backend/src/bot/handlers/accountant.handler.ts` | New callback handler for `request_password_email` |
| `frontend/src/components/settings/users/UserCreateDialog.tsx` | Show TG link after accountant creation |
| `frontend/src/components/layout/AdminLayout.tsx` | Role-based nav filtering |
| `frontend/src/app/settings/page.tsx` | Accountant sees only Profile tab |
| `frontend/src/hooks/useRoleGuard.ts` | New: shared role guard hook |
| 6 page files | Add `useRoleGuard(['accountant'])` call |

## Verification

1. **Create accountant via UI:** Admin creates user with role "Бухгалтер" -> dialog shows TG deep link (t.me/bot?start=verify_TOKEN) -> no invite email sent
2. **TG verification:** Click deep link -> bot replies with success + inline buttons (Личный кабинет, Установить пароль)
3. **Password setup (optional):** Click "Установить пароль" in bot -> receive password reset link in TG -> set password -> can log into web
4. **Web access restrictions:** Log in as accountant -> sidebar shows only: Dashboard, Requests, Chats, SLA, Violations, Alerts, Settings, Help
5. **Settings restrictions:** Navigate to /settings -> only Profile tab visible
6. **Route guards:** Direct navigation to /analytics, /reports, /feedback, /settings/survey, /settings/users, /logs -> redirects to /dashboard
7. **Dashboard scoping:** Dashboard widgets show only accountant's own chats and SLA data (already implemented via API scoping)
8. **Bug fix verification:** Add `@annushka3313` (or any TG username) in chat settings -> user found (no error), even if `User.telegramUsername` is null but `TelegramAccount.username` matches
9. **Type-check:** `npx tsc --noEmit` passes
10. **Build:** `npm run build` passes in both backend and frontend
