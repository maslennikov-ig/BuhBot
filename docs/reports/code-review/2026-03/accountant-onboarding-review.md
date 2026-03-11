# Code Review: Telegram-first Accountant Onboarding

**Branch:** `feat/telegram-first-accountant-onboarding`
**Plan:** `docs/plans/virtual-launching-parnas.md`
**Date:** 2026-03-11
**Reviewer:** Code Review Agent (Claude Opus 4.6)

---

## Summary

This review covers the implementation of Telegram-first onboarding for the accountant role. The changeset modifies 16 files (15 modified, 1 new) across backend and frontend, implementing silent Supabase user creation, Telegram deep-link verification flow, password setup via bot callback, role-based navigation filtering, and frontend route guards.

**Overall assessment:** The implementation closely follows the plan with good structural decisions. There are several issues that need attention, ranging from a critical security concern to important correctness and robustness improvements.

---

## Plan Alignment

### Fully Implemented (matches plan)

| Plan Step | Status | Notes |
|-----------|--------|-------|
| 1. Bug fix: username lookup in `chats.ts` | Implemented correctly | Expanded to check both `User.telegramUsername` and `TelegramAccount.username` |
| 2. Backend: `createUser` silent creation for accountant | Implemented correctly | Uses `admin.createUser()` with `email_confirm: true`, returns `verificationLink` |
| 3. Frontend: `UserCreateDialog` shows TG link | Implemented correctly | Copy-to-clipboard, keeps dialog open, correct UX flow |
| 4. Bot: Post-verification inline keyboard | Implemented correctly | Two buttons: web link + password setup callback |
| 5. Bot: `request_password_email` callback handler | Implemented correctly | Uses `admin.generateLink({ type: 'recovery' })` as planned |
| 6. Frontend: Role-based nav filtering | Implemented correctly | `ACCOUNTANT_ALLOWED_NAV_IDS` set, items prop to Sidebar |
| 7. Frontend: Settings page - accountant sees only Profile | Implemented correctly | Conditional render based on `auth.me` query |
| 8. Frontend: Route guards (`useRoleGuard`) | Implemented correctly | New hook, applied to 6 pages per plan |

### Deviations from Plan

| Deviation | Assessment |
|-----------|------------|
| Plan step 2 mentioned a possible `requestPasswordEmail` tRPC procedure; implementation uses bot callback instead | **Beneficial** -- the plan itself noted this alternative and recommended it as the simpler approach |
| `faq.ts` and `templates.ts` Zod output schema changes (`createdBy` made nullable) | **Not in plan** -- see Issue S-1 below |
| Dev mode path does not handle accountant role specifically | **Neutral** -- dev mode creates all users with `isOnboardingComplete: true` and no `verificationLink`, which is acceptable for local dev but could cause confusion during testing |

---

## Issues

### CRITICAL

#### C-1: Password recovery link sent in plain text via Telegram message

**File:** `backend/src/bot/handlers/accountant.handler.ts` (lines 382-388)

The `request_password_email` callback handler sends the Supabase `action_link` (a password recovery URL containing a one-time token) directly in the Telegram chat as a plain text message. This link grants full password-setting access to the account.

**Security concerns:**
1. The link persists in Telegram chat history indefinitely and cannot be revoked once sent
2. If the user's Telegram account is compromised, all password setup links are visible in history
3. The `action_link` from `admin.generateLink({ type: 'recovery' })` is a server-side generated link that bypasses the normal email delivery channel, so Supabase's built-in link expiration UX does not apply

**Recommendation:** This is an inherent tradeoff of the Telegram-first design (the plan explicitly chose this approach). The risk is mitigated by:
- The link expires after 1 hour (Supabase default for recovery links)
- It is a private bot-to-user chat

However, consider these hardening measures:
1. After sending the link, edit or delete the message after 5 minutes using `ctx.deleteMessage()` with a `setTimeout`
2. Add a disclaimer to the message: "This link will be invalidated after use"
3. Rate-limit the callback to prevent link generation spam (see I-1)

---

### IMPORTANT

#### I-1: Missing rate limiting on `request_password_email` callback

**File:** `backend/src/bot/handlers/accountant.handler.ts` (lines 344-398)

Any user who has ever seen the inline keyboard can click the "Set password" button repeatedly, generating unlimited Supabase recovery links. Each call hits `supabase.auth.admin.generateLink()`, which is an admin API call.

**Impact:** Potential abuse to flood admin API, generate many valid recovery tokens.

**Recommendation:** Add a simple in-memory or Redis-based cooldown:

```typescript
const passwordRequestCooldown = new Map<number, number>(); // telegramId -> timestamp

bot.action('request_password_email', async (ctx: BotContext) => {
  if (!ctx.from) return;

  const lastRequest = passwordRequestCooldown.get(ctx.from.id);
  if (lastRequest && Date.now() - lastRequest < 5 * 60 * 1000) {
    await ctx.answerCbQuery('Please wait 5 minutes before requesting another link.');
    return;
  }
  passwordRequestCooldown.set(ctx.from.id, Date.now());
  // ... rest of handler
});
```

---

#### I-2: Missing role check in `request_password_email` handler

**File:** `backend/src/bot/handlers/accountant.handler.ts` (lines 344-398)

The handler checks that the user exists via `findUserByTelegramId` but does NOT verify the user's role. Any Telegram-linked user (admin, manager, observer) can trigger this callback if they somehow encounter the inline keyboard button (e.g., through message forwarding).

While the button is only shown post-verification for accountants, Telegram callback_data is just a string -- any user who knows the callback data `request_password_email` can craft a request.

**Recommendation:** Add a role check after the user lookup:

```typescript
const user = await findUserByTelegramId(ctx.from.id);
if (!user) {
  await ctx.answerCbQuery('You are not linked to BuhBot.');
  return;
}

if (user.role !== 'accountant') {
  await ctx.answerCbQuery('This feature is for accountants only.');
  return;
}
```

Note: While generating a recovery link for non-accountant users is not catastrophic (they already have passwords), it is a defense-in-depth violation. All other commands in `accountant.handler.ts` (lines 57, 148, 220, 284) consistently check `user.role !== 'accountant'`.

---

#### I-3: `useRoleGuard` renders content briefly before redirect

**File:** `frontend/src/hooks/useRoleGuard.ts`

The hook returns `{ isAllowed: null }` while the `auth.me` query is loading. During this time, the consuming pages proceed to render their content (hooks are called, queries fire, DOM is built). The guard only triggers a redirect via `useEffect` after the query resolves, which means:

1. There is a flash of restricted content before the redirect occurs
2. Backend queries for restricted data may fire unnecessarily (e.g., analytics, logs)

**Current pattern in consuming pages:**
```typescript
const { isAllowed } = useRoleGuard(['accountant']);
// ... all hooks run unconditionally ...
if (isAllowed === false) return null;
```

The `return null` prevents rendering AFTER the hook resolves, but by that time, all hooks above (including tRPC queries) have already executed.

**Recommendation:** Move the null-render check to the top, before any data-fetching hooks. Alternatively, use a wrapper component pattern:

```typescript
export function useRoleGuard(deniedRoles: string[]) {
  const { data: me, isLoading } = trpc.auth.me.useQuery();
  const router = useRouter();

  useEffect(() => {
    if (me && deniedRoles.includes(me.role)) {
      router.replace('/dashboard');
    }
  }, [me, deniedRoles, router]);

  // Return loading state so pages can short-circuit before other hooks
  return {
    isAllowed: me ? !deniedRoles.includes(me.role) : null,
    isLoading,
  };
}
```

Then in each page:
```typescript
export default function AnalyticsPage() {
  const { isAllowed, isLoading } = useRoleGuard(['accountant']);
  if (isLoading || isAllowed === false) return null;
  // ... rest of page with hooks
}
```

**Caveat:** This requires placing the guard check before other hooks, which violates React's rules of hooks if done conditionally. The wrapper component pattern is cleaner -- wrap the entire page content in a `<RoleGuard>` component.

---

#### I-4: Frontend-only authorization is insufficient for defense in depth

**Files:** All 6 guarded pages, plus `AdminLayout.tsx`, `settings/page.tsx`

The accountant restrictions (hidden nav items, role guard redirects, settings tab filtering) are **client-side only**. The backend tRPC routers for analytics, reports, feedback, logs, etc. use `authedProcedure` (any authenticated user). An accountant with a password could directly call tRPC endpoints and access all data.

**Impact:** Medium. The plan explicitly scopes this to UI restrictions ("accountant role needs restricted web access"), and the server-side authorization model (`authedProcedure` for reads) predates this feature. However, this should be documented as a known gap.

**Recommendation:** For a future iteration, consider:
1. Adding `managerProcedure` to analytics, reports, feedback, and logs routers
2. Or adding an `accountantReadProcedure` that restricts data to the accountant's own scope
3. At minimum, add a code comment documenting that these guards are UI-only

---

#### I-5: Dev mode path does not return `verificationLink` for accountant role

**File:** `backend/src/api/trpc/routers/auth.ts` (lines 434-458)

When `isDevMode === true`, the `createUser` mutation short-circuits and creates the user directly without Supabase. For accountant role, it:
- Sets `isOnboardingComplete: true` (should be `false` for accountants)
- Does NOT create a `VerificationToken`
- Does NOT return a `verificationLink`

This means the frontend's `UserCreateDialog` will never show the TG deep link in dev mode, making the accountant flow untestable locally.

**Recommendation:** Add accountant-specific handling in dev mode:

```typescript
if (isDevMode) {
  // ... existing code ...

  if (input.role === 'accountant') {
    const tokenValue = randomBytes(16).toString('base64url');
    // Create verification token...
    return {
      ...result,
      isOnboardingComplete: false,
      verificationLink: `https://t.me/${env.BOT_USERNAME}?start=verify_${tokenValue}`,
    };
  }
}
```

---

### SUGGESTIONS

#### S-1: Zod output schema mismatch -- `createdBy` nullable vs Prisma non-nullable

**Files:** `backend/src/api/trpc/routers/faq.ts` (lines 44, 177), `backend/src/api/trpc/routers/templates.ts` (lines 55, 116)

The `createdBy` field is changed from `z.string().uuid()` to `z.string().uuid().nullable()` in four Zod output schemas. However, the Prisma schema defines `createdBy` as `String` (non-nullable) with NO `onDelete: SetNull` on the FK relation.

This means:
1. Prisma will never return `null` for `createdBy` -- the DB column is NOT NULL
2. The Zod change is technically harmless (it only loosens the output type) but misleading
3. If the intent is to handle deleted users who created FAQ/templates, the correct fix would be a migration to make the column nullable + add `onDelete: SetNull` to the Prisma relation

**Recommendation:** Either:
- **Revert** the `.nullable()` changes since they do not match the database schema and create a false impression that null is possible
- **Or** if null values are expected in the future (e.g., when user deletion sets `created_by` to NULL), create a proper migration first

This change appears unrelated to the accountant onboarding feature and may have been added to fix a separate type error -- if so, it should be tracked as a separate issue.

---

#### S-2: `BOT_USERNAME` env var is optional -- missing `verificationLink` is silently swallowed

**File:** `backend/src/api/trpc/routers/auth.ts` (lines 560-563)

```typescript
const botUsername = env.BOT_USERNAME;
if (botUsername) {
  verificationLink = `https://t.me/${botUsername}?start=verify_${result.tokenValue}`;
}
```

If `BOT_USERNAME` is not set, the accountant is created successfully but no `verificationLink` is returned. The frontend will show the standard "user created" toast instead of the TG deep link, with no indication that something went wrong.

**Recommendation:** Either:
- Make `BOT_USERNAME` required (not optional) in the env schema when accountant creation is supported
- Or log a warning and return an error when creating an accountant without `BOT_USERNAME` configured

---

#### S-3: Inline keyboard button persists after use

**File:** `backend/src/bot/handlers/invitation.handler.ts` (lines 429-435)

After the accountant clicks "Set password" and receives the link, the original message with the inline keyboard remains unchanged. The button can be clicked again (see I-1 for rate limiting concern).

**Recommendation:** In the `request_password_email` handler, after successfully generating the link, edit the original message to remove or disable the inline keyboard:

```typescript
await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
```

This is a standard Telegraf pattern for one-time-use inline buttons.

---

#### S-4: `onSuccess` called before dialog state is fully resolved for accountant

**File:** `frontend/src/components/settings/users/UserCreateDialog.tsx` (lines 33-34)

```typescript
onSuccess: (data) => {
  utils.auth.listUsers.invalidate();
  onSuccess();  // Called immediately

  if (data.verificationLink) {
    setVerificationLink(data.verificationLink);
    // Dialog stays open...
    return;
  }
  // ... non-accountant path closes dialog
}
```

`onSuccess()` is called before checking if this is an accountant (which keeps the dialog open). Depending on what `onSuccess` does in the parent component, this could cause inconsistent state -- e.g., if the parent clears selection or triggers a navigation.

**Recommendation:** For the accountant path, call `onSuccess()` after the user closes the dialog via "Done" button, not immediately in the mutation callback.

---

#### S-5: Consider using `Markup.inlineKeyboard` from Telegraf instead of raw object

**File:** `backend/src/bot/handlers/invitation.handler.ts` (lines 429-435)

The inline keyboard is constructed using a raw object literal:
```typescript
reply_markup: {
  inline_keyboard: [
    [{ text: '...', url: '...' }],
    [{ text: '...', callback_data: 'request_password_email' }],
  ],
}
```

Telegraf provides `Markup.inlineKeyboard()` which adds type safety:
```typescript
import { Markup } from 'telegraf';

await ctx.reply(message, Markup.inlineKeyboard([
  [Markup.button.url('Personal Cabinet', `${env.FRONTEND_URL}/settings/profile`)],
  [Markup.button.callback('Set Password (optional)', 'request_password_email')],
]));
```

This is a minor style suggestion. The raw object approach works correctly and is used elsewhere in the codebase.

---

## What Was Done Well

1. **Transaction safety with Supabase cleanup:** The accountant creation path correctly wraps DB operations in a `$transaction` and cleans up the Supabase Auth user if the transaction fails (lines 564-573). This prevents split-brain state between Supabase Auth and the application database.

2. **Consistent error handling in bot handlers:** The `request_password_email` callback handler follows the established pattern with try/catch, `ctx.answerCbQuery()` for user feedback, and structured logging.

3. **Clean separation of accountant vs non-accountant paths:** The `auth.ts` createUser mutation cleanly splits into two branches at line 496 (`if (input.role === 'accountant')`) rather than trying to fit both flows into one code path. This improves readability.

4. **Username lookup fix is well-implemented:** The `chats.ts` bug fix correctly uses Prisma's `OR` with relation-based filtering and builds the `knownSet` from both sources using `flatMap`.

5. **Role guard hook is minimal and reusable:** The `useRoleGuard` hook is a clean 18-line utility with a good API surface (`deniedRoles` array rather than hardcoded roles).

6. **Frontend UX for accountant creation:** The dialog flow (keep open, show TG link, copy-to-clipboard, contextual description text change) provides a smooth admin experience.

7. **Navigation filtering uses Set for O(1) lookups:** `ACCOUNTANT_ALLOWED_NAV_IDS` is a `Set` rather than an array, which is the correct choice for membership testing.

---

## Files Reviewed

| File | Type |
|------|------|
| `backend/src/api/trpc/routers/auth.ts` | Modified |
| `backend/src/api/trpc/routers/chats.ts` | Modified |
| `backend/src/api/trpc/routers/faq.ts` | Modified |
| `backend/src/api/trpc/routers/templates.ts` | Modified |
| `backend/src/bot/handlers/accountant.handler.ts` | Modified |
| `backend/src/bot/handlers/invitation.handler.ts` | Modified |
| `frontend/src/hooks/useRoleGuard.ts` | New |
| `frontend/src/components/settings/users/UserCreateDialog.tsx` | Modified |
| `frontend/src/components/layout/AdminLayout.tsx` | Modified |
| `frontend/src/app/settings/page.tsx` | Modified |
| `frontend/src/app/analytics/page.tsx` | Modified |
| `frontend/src/app/feedback/feedback-content.tsx` | Modified |
| `frontend/src/app/logs/page.tsx` | Modified |
| `frontend/src/app/reports/page.tsx` | Modified |
| `frontend/src/app/settings/survey/survey-list-content.tsx` | Modified |
| `frontend/src/app/settings/users/page.tsx` | Modified |

**TypeScript check:** Both backend and frontend pass `tsc --noEmit` with no errors.

---

## Verdict

**Status: Approve with required changes**

The implementation faithfully follows the plan and the code quality is generally good. The critical and important issues identified above should be addressed before merging:

| Priority | Issue | Action Required |
|----------|-------|-----------------|
| Critical | C-1: Password link in TG chat history | Acknowledge risk, add message auto-delete or disclaimer |
| Important | I-1: No rate limiting on password link generation | Add cooldown |
| Important | I-2: Missing role check in `request_password_email` | Add `user.role !== 'accountant'` guard |
| Important | I-3: Content flash before role guard redirect | Document or improve with loading state |
| Important | I-4: Frontend-only authorization | Document as known gap |
| Important | I-5: Dev mode does not support accountant flow | Add dev mode accountant handling |
| Suggestion | S-1: Zod nullable mismatch with Prisma | Revert or add migration |
| Suggestion | S-2: Silent failure when `BOT_USERNAME` missing | Add warning/error |
| Suggestion | S-3: Inline keyboard persists after use | Edit message markup |
| Suggestion | S-4: `onSuccess` timing for accountant | Defer to dialog close |
| Suggestion | S-5: Use Telegraf Markup helpers | Style preference |

At minimum, **I-1** and **I-2** should be fixed before merge as they are straightforward security hardening with minimal code changes.
