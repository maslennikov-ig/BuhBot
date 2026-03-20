# Code Review: feat/manager-multiselect-sla-fixes

**Date:** 2026-02-27
**Branch:** feat/manager-multiselect-sla-fixes
**Reviewer:** Code Review Worker (claude-sonnet-4-6)
**Commits reviewed:** `1166aed` (feat(sla): manager multi-select dropdown), `7333ec3` (fix(monitoring): wire error capture and alerts)

---

## Summary

This branch introduces a manager multi-select UI for configuring per-chat and global SLA notification recipients, replacing a raw comma-separated text input. It also fixes a silent-failure bug in `isAccountantForChat` and adds a Telegram account verification flow.

**Files reviewed:**
- `backend/src/bot/handlers/response.handler.ts`
- `backend/src/bot/handlers/message.handler.ts`
- `backend/src/api/trpc/routers/user.ts`
- `backend/src/bot/handlers/__tests__/response.handler.test.ts`
- `frontend/src/components/chats/ManagerMultiSelect.tsx`
- `frontend/src/components/chats/TelegramAuthModal.tsx`
- `frontend/src/components/chats/ChatSettingsForm.tsx`
- `frontend/src/components/settings/SlaManagerSettingsForm.tsx`

**Reference files checked:**
- `frontend/src/components/chats/AccountantSelect.tsx` (pattern baseline)
- `frontend/src/components/chats/AccountantUsernamesInput.tsx` (pattern baseline)
- `backend/src/utils/bigint.ts`

**Context7 validation:**
- tRPC v11 — discriminated union return pattern confirmed valid; TRPCError preferred over silent returns for infrastructure errors
- React Hook Form v7 — `useWatch` is recommended over `form.watch()` in render functions for performance; `setValue` with `shouldDirty` is correct

---

## Overall Assessment

The feature is largely well-implemented. The core fix (re-throwing in `isAccountantForChat`) is correct and the accompanying catch in `message.handler.ts` is sound. The frontend components follow the existing BuhBot design system. However, there are four issues that must be addressed before merge: an unhandled exception in `verifyTelegramUsername` for large Telegram IDs, a missing database conflict guard in the same procedure, a broken keyboard return type in `ManagerMultiSelect`, and a `form.watch()` anti-pattern causing full re-renders in `SlaManagerSettingsForm`.

---

## Critical Issues

### CR-01 — `safeNumberFromBigInt` throws an uncaught exception for large Telegram IDs

**File:** `backend/src/api/trpc/routers/user.ts`, lines 269–271

**Priority:** P0 — must fix before merge

**Description:**

`verifyTelegramUsername` calls `safeNumberFromBigInt(telegramUserId).toString()` on the BigInt retrieved from `chat_messages.telegram_user_id`. `safeNumberFromBigInt` is documented to **throw** if the value exceeds `Number.MAX_SAFE_INTEGER` (2^53 − 1). Telegram user IDs issued after mid-2023 (the new 64-bit range) exceed this bound. When an affected user is looked up, the mutation throws an untyped 500 error instead of returning a structured error to the frontend. The error state `unknown` is shown to the user with no actionable information, and the DB write step is never reached.

The same path is safe in `user.list` because there, `safeNumberFromBigInt` throws before the return, propagating as a tRPC INTERNAL_SERVER_ERROR — also undesirable but at least clearly a list failure. In `verifyTelegramUsername` the throw happens after the `sendMessage` already succeeded, meaning the verification message is delivered to the user but the `User` record is never updated. This creates a desynchronised state.

**Suggested fix:**

Use `bigIntToString` (already exported from `backend/src/utils/bigint.ts`) for the return value, and store the string representation in the response. The frontend `TelegramAuthModal` already treats `telegramId` as `string`, so no frontend changes are needed.

```typescript
// user.ts — verifyTelegramUsername, replace the return block:
return {
  success: true as const,
  telegramId: telegramUserId.toString(), // always safe — string, not Number
};
```

For `user.list`, apply the same treatment (return as string or use `bigIntToString`) so the mapping does not throw on large IDs:

```typescript
return users.map((u) => ({
  ...u,
  telegramId: u.telegramId ? u.telegramId.toString() : null,
}));
```

Note: `ManagerMultiSelect` already converts to string with `String(u.telegramId)`, so a numeric-string or a numeric input both work correctly there.

---

### CR-02 — `verifyTelegramUsername` can corrupt an existing `TelegramAccount` row

**File:** `backend/src/api/trpc/routers/user.ts`, lines 253–260

**Priority:** P0 — must fix before merge

**Description:**

Step 5 of `verifyTelegramUsername` does:

```typescript
await ctx.prisma.user.update({
  where: { id: input.userId },
  data: {
    telegramId: telegramUserId,
    telegramUsername: normalizedUsername,
  },
});
```

`TelegramAccount.telegramId` has a `@unique` constraint (see `schema.prisma` line 199). If `telegramUserId` is already linked to **another** user's `TelegramAccount` row, the `User.telegramId` update succeeds (no unique constraint on `User.telegramId` itself), but the next call to `linkTelegram` for the conflicting user will break. More critically, if the looked-up `telegramUserId` from chat history happens to be the same BigInt that another user has in their `TelegramAccount`, the system will have two `User` rows referencing the same Telegram identity with no integrity enforcement at the `User` level.

`linkTelegram` does check for this (`existingLink && existingLink.userId !== ctx.user.id`), but `verifyTelegramUsername` does not — it is an admin/manager bypass that skips the self-service flow entirely.

**Suggested fix:**

Add a pre-check before the `User.update`:

```typescript
// After step 4 (sendMessage), before step 5:
const conflictingAccount = await ctx.prisma.telegramAccount.findUnique({
  where: { telegramId: telegramUserId },
});

if (conflictingAccount && conflictingAccount.userId !== input.userId) {
  throw new TRPCError({
    code: 'CONFLICT',
    message: 'Этот Telegram аккаунт уже привязан к другому пользователю',
  });
}
```

---

## High Priority Issues

### CR-03 — Telegram 404 / "chat not found" error silently falls through as an unknown error

**File:** `backend/src/api/trpc/routers/user.ts`, lines 244–251

**Priority:** P1 — should fix before merge

**Description:**

The `sendMessage` error handler catches `403` (bot blocked) and the string `"bot was blocked"`, then re-throws everything else. Telegram also returns `400 Bad Request: chat not found` when a user has never started a conversation with the bot *and* has never appeared in a group — which is a valid user-facing scenario distinct from "bot blocked". This re-throw surfaces as an opaque 500 to the frontend, which displays the generic `unknown` error state with no recoverable action suggested.

Additionally, the detection is fragile string-matching on the error message. The Telegraf/`node-telegram-bot-api` library exposes a structured `response.error_code` field. The current code would also miss `"Forbidden: bot was blocked by the user"` if the phrasing changes in a Telegram API update.

**Suggested fix:**

```typescript
} catch (sendError: unknown) {
  const isTelegramError = (e: unknown): e is { response?: { error_code?: number } } =>
    typeof e === 'object' && e !== null;

  if (isTelegramError(sendError)) {
    const code = sendError.response?.error_code;
    if (code === 403) {
      return { success: false as const, error: 'bot_blocked' as const };
    }
    if (code === 400) {
      // "chat not found" — user has never started the bot
      return { success: false as const, error: 'bot_blocked' as const };
    }
  }
  throw sendError;
}
```

And add a `'chat_not_found'` error variant to `ModalState` in `TelegramAuthModal.tsx` with a distinct message explaining the user must start the bot first (the `bot_blocked` message already covers this but conflates two different causes).

---

### CR-04 — `ManagerMultiSelect` listbox items have no keyboard activation (Enter/Space)

**File:** `frontend/src/components/chats/ManagerMultiSelect.tsx`, lines 302–338

**Priority:** P1 — should fix before merge

**Description:**

The `<li role="option">` elements handle `onClick` only. The ARIA authoring guide for `listbox` requires that `role="option"` items be keyboard-activatable via Enter and Space. A keyboard-only user can open the dropdown (Enter on the trigger), focus moves to the search input, but then cannot select an item without a mouse. This breaks WCAG 2.1 SC 2.1.1 (Keyboard).

The existing `AccountantSelect.tsx` has the same gap, but `ManagerMultiSelect` is new code and can establish the correct pattern.

**Suggested fix:**

```tsx
<li
  key={user.id}
  role="option"
  aria-selected={false}
  tabIndex={0}
  onClick={() => handleSelect(user)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect(user);
    }
  }}
  ...
>
```

Additionally, `aria-selected` is hardcoded to `false`. For already-selected users that appear in the trigger chips (excluded from the dropdown), this is vacuously true, but the ARIA pattern still expects the listbox to reflect state. Because selected items are excluded from `filteredUsers`, a comment clarifying this is the intended design would suffice, but the `tabIndex` and keyboard handler are mandatory.

---

### CR-05 — Dynamic `import()` of bot inside a tRPC mutation breaks module isolation

**File:** `backend/src/api/trpc/routers/user.ts`, lines 239

**Priority:** P1 — should fix before merge

**Description:**

```typescript
const { bot } = await import('../../../bot/bot.js');
```

Dynamic import inside a hot path creates several problems:

1. **Module singleton is not guaranteed by dynamic import** — if the module bundler or test runner uses different module registries, a second `bot` instance can be created with its own polling loop.
2. **Circular dependency risk** — `bot.ts` imports `env.ts`, middlewares, and potentially routers. The tRPC router already sits in the dependency graph below `bot.ts`; a dynamic re-import can hide circular dependency cycles that would otherwise be caught at startup.
3. **Testability** — the dynamic import cannot be mocked by standard `vi.mock()` at the top of a test file; it requires `vi.doMock()` or `unstable_mockModule`.

The existing `verifyTelegramUsername` approach was presumably added to avoid a top-level circular import. The correct solution is to inject the bot's `telegram` object as a dependency, or export a singleton accessor that the router uses.

**Suggested fix (minimal):**

Create `backend/src/bot/telegram-client.ts`:

```typescript
import { bot } from './bot.js';
export const telegramClient = bot.telegram;
```

Then in `user.ts`:

```typescript
import { telegramClient } from '../../../bot/telegram-client.js';
// ...
await telegramClient.sendMessage(telegramUserId.toString(), message);
```

If a circular dependency still exists, it needs to be resolved structurally rather than hidden by dynamic import.

---

## Medium Priority Issues

### CR-06 — `SlaManagerSettingsForm` uses `form.watch()` in render instead of `useWatch`

**File:** `frontend/src/components/settings/SlaManagerSettingsForm.tsx`, line 87

**Priority:** P2 — nice to have, but causes unnecessary re-renders

**Description:**

```tsx
value={form.watch('ids')}
```

`form.watch()` called inside a render function subscribes to all form value changes and causes the entire `SlaManagerSettingsForm` component to re-render on every keystroke or change to any field. `useWatch` from `react-hook-form` creates an isolated subscription that only re-renders the component when the watched field changes. `ChatSettingsForm` already uses `useWatch` correctly (lines 157–166), so this is a pattern inconsistency.

Context7 (React Hook Form v7 docs) confirms: `useWatch` is the recommended hook for observing field values in render without causing broader re-renders.

**Suggested fix:**

```tsx
import { useForm, useWatch } from 'react-hook-form';
// ...
const watchedIds = useWatch({ control: form.control, name: 'ids' });
// ...
<ManagerMultiSelect
  value={watchedIds}
  onChange={(val) => form.setValue('ids', val, { shouldDirty: true })}
  ...
/>
```

---

### CR-07 — `verifyTelegramUsername` does not validate username format

**File:** `backend/src/api/trpc/routers/user.ts`, line 201

**Priority:** P2

**Description:**

The input schema is `z.string().min(1)` for `username`. `AccountantUsernamesInput.tsx` validates usernames against `/^[a-z0-9][a-z0-9_]{3,30}[a-z0-9]$/`. The backend `verifyTelegramUsername` does no format validation beyond trimming the `@` prefix. A malformed username (e.g. `"__"`, `"a"`, spaces) will be passed directly to `chatMessage.findFirst` as a case-insensitive match and then written to `User.telegramUsername` if a match is found. This can corrupt user records with invalid Telegram usernames.

**Suggested fix:**

Add a Zod refinement or a min-length check aligned with the frontend validator:

```typescript
username: z.string().min(5).max(32).regex(
  /^@?[a-z0-9][a-z0-9_]{3,30}[a-z0-9]$/i,
  'Неверный формат Telegram username'
),
```

---

### CR-08 — `TelegramAuthModal` has no ARIA `role="dialog"` or `aria-modal`

**File:** `frontend/src/components/chats/TelegramAuthModal.tsx`, lines 101–106

**Priority:** P2

**Description:**

The modal overlay is a plain `<div>` with no `role="dialog"`, `aria-modal="true"`, or `aria-labelledby`. Screen readers will not announce this as a modal dialog when it opens, and focus is not trapped inside. A keyboard user pressing Tab will cycle through background content behind the overlay.

```tsx
// Current:
<div className="fixed inset-0 z-50 flex items-center justify-center ...">
  <GlassCard ...>
```

**Suggested fix:**

```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="tg-auth-modal-title"
  className="fixed inset-0 z-50 flex items-center justify-center ..."
>
  <GlassCard ...>
    {/* In the header: */}
    <h2 id="tg-auth-modal-title" ...>Привязка Telegram</h2>
```

A focus trap (e.g. using `focus-trap-react` or a custom `useEffect`) should also be added to prevent keyboard navigation from reaching content behind the overlay. The `Button` labelled "Отмена" does exist, so closing with Escape is handled, but Tab-cycling into the background is not.

---

### CR-09 — Test description mismatch: Check 0 label describes username array, not Telegram ID array

**File:** `backend/src/bot/handlers/__tests__/response.handler.test.ts`, line 72

**Priority:** P2

**Description:**

The test suite's `describe` block for Check 0 reads:

```
describe('Check 0 - accountantUsernames array match (highest priority)', ...)
```

But the implementation's Check 0 is `accountantTelegramIds` (the secure ID-based check), not `accountantUsernames`. Check 2 is the `accountantUsernames` array check. The test cases inside the block correctly test `accountantUsernames` array behaviour, meaning the tests themselves are validating the wrong check number under a misleading label. This misaligns with the comments in `response.handler.ts` (lines 82, 138).

**Suggested fix:**

Rename the describe block to match the actual check being tested:

```
describe('Check 2 - accountantUsernames array match (username fallback)', ...)
```

And add a separate `describe('Check 0 - accountantTelegramIds array match (highest priority, secure)')` block with appropriate tests.

---

### CR-10 — BigInt overflow test case is misleading

**File:** `backend/src/bot/handlers/__tests__/response.handler.test.ts`, lines 618–635

**Priority:** P2

**Description:**

The test:

```typescript
const largeTelegramId = BigInt('9007199254740991'); // Max safe integer + 1
```

The comment is incorrect. `9007199254740991` is `Number.MAX_SAFE_INTEGER` itself — it is the largest safe integer, not `MAX_SAFE_INTEGER + 1`. `Number(BigInt('9007199254740991')) === 9007199254740991` passes `Number.isSafeInteger()`, so the test exercises the happy path, not the overflow path. To test actual overflow, the value should be `BigInt('9007199254740992')` or higher.

**Suggested fix:**

```typescript
const largeTelegramId = BigInt('9007199254740992'); // First value ABOVE MAX_SAFE_INTEGER
// Note: this would cause safeNumberFromBigInt to throw if used,
// demonstrating why the accountantTelegramIds BigInt comparison is correct
// (BigInt === BigInt, no Number conversion needed).
```

---

## Low Priority Issues

### CR-11 — Orphaned chip IDs in `ManagerMultiSelect` show raw numeric ID with no tooltip

**File:** `frontend/src/components/chats/ManagerMultiSelect.tsx`, lines 88–90

**Priority:** P2

**Description:**

When a `value` entry has no matching user in the fetched list (e.g. user was deleted from the system), the chip displays `"ID 123456789"` with a yellow warning triangle. There is no tooltip or supplementary text explaining why the warning appears. A manager seeing this chip has no way to know whether this ID belongs to a deleted user, an imported legacy ID, or a data error.

**Suggested fix:**

Add a `title` attribute or a tooltip on the orphaned chip:

```tsx
<div
  title="Пользователь не найден в системе. Возможно, аккаунт был удалён."
  ...
>
```

---

### CR-12 — `verifyTelegramUsername` does not invalidate `user.list` cache after linking

**File:** `frontend/src/components/chats/TelegramAuthModal.tsx`, lines 64–75

**Priority:** P2

**Description:**

After a successful verification, `onSuccess(telegramId)` is called, which adds the new ID to the form's `managerTelegramIds` array. However, the `user.list` tRPC query cache is not invalidated. The `ManagerMultiSelect` dropdown still shows the newly-linked user as having no Telegram ID (yellow triangle) until the next page refresh or cache expiry. The user will appear with a green checkmark chip in the trigger area but remain listed with a warning in the dropdown if opened again.

**Suggested fix:**

In `TelegramAuthModal`, after the successful mutation, invalidate `user.list`:

```typescript
const utils = trpc.useUtils();

const verifyMutation = trpc.user.verifyTelegramUsername.useMutation({
  onSuccess: (data) => {
    if (data.success) {
      utils.user.list.invalidate(); // Refresh dropdown so user appears as linked
      setState({ status: 'success', telegramId: data.telegramId, username });
    } else {
      setState({ status: 'error', code: data.error });
    }
  },
  ...
});
```

---

### CR-13 — `handleClose` wrapper in `TelegramAuthModal` is a no-op indirection

**File:** `frontend/src/components/chats/TelegramAuthModal.tsx`, lines 94–96

**Priority:** P2

**Description:**

```typescript
const handleClose = () => {
  onClose();
};
```

This function adds no logic over directly passing `onClose`. It creates an unnecessary closure allocation on every render and is inconsistent with the surrounding code style (the component's other handlers do add value). This is purely cosmetic but reduces readability.

**Suggested fix:** Pass `onClose` directly where `handleClose` is used, or remove the wrapper.

---

## Pattern Consistency Notes

### Missing `className` prop in `ManagerMultiSelect`

`AccountantSelect` accepts a `className` prop for layout-level overrides by parent components. `ManagerMultiSelect` does not. Both components are used inside `FormField` wrappers where callers may need to apply spacing or width overrides. This is a minor API completeness gap.

### `form.watch` vs `useWatch` (ChatSettingsForm vs SlaManagerSettingsForm)

`ChatSettingsForm` correctly uses `useWatch` for `slaEnabled` and `formManagerIds`. `SlaManagerSettingsForm` uses `form.watch('ids')` inline — see CR-06 above.

### No `Controller` wrapper for `ManagerMultiSelect` in `SlaManagerSettingsForm`

`ChatSettingsForm` wraps `ManagerMultiSelect` in a `<FormField>` with `<FormControl>`, which connects it to React Hook Form's error and dirty tracking. `SlaManagerSettingsForm` connects the component via `form.watch` + `form.setValue` directly, bypassing `FormField` entirely. This means field-level error display (if any Zod rule is added to `ids` in the future) would silently fail. Consider using `<Controller>` for consistency.

---

## Checklist

| Category | Status | Notes |
|---|---|---|
| Security — no hardcoded credentials | PASS | |
| Security — input validation on tRPC inputs | PARTIAL | CR-07: username format not validated |
| Security — authorization checks | PASS | `managerProcedure` enforces manager/admin |
| Security — unique constraint guard | FAIL | CR-02: `telegramAccount` conflict not checked |
| Type safety — no `any` types | PASS | `where: Prisma.UserWhereInput` fix included |
| Type safety — BigInt overflow | FAIL | CR-01: `safeNumberFromBigInt` throws on large IDs |
| Error handling — structured errors | PARTIAL | CR-03: Telegram 400 not distinguished from unexpected errors |
| Error handling — re-throw vs silent fail | PASS | Core bug fixed correctly |
| Testing — re-throw tested | PASS | New tests cover throw behaviour |
| Testing — test labels accurate | FAIL | CR-09, CR-10: mislabelled describe block and wrong constant |
| UX — keyboard navigation | FAIL | CR-04: listbox options not keyboard-activatable |
| UX — ARIA attributes | FAIL | CR-08: modal missing role="dialog", aria-modal |
| UX — loading/error states | PASS | All states handled in TelegramAuthModal |
| UX — cache invalidation after mutation | PARTIAL | CR-12: user.list not invalidated after link |
| Performance — `form.watch` in render | FAIL | CR-06: SlaManagerSettingsForm uses form.watch |
| Patterns — consistent with AccountantSelect | PASS | Structure and styling match |
| Dynamic import — module isolation | FAIL | CR-05: dynamic bot import inside mutation |

---

## Action Plan

**P0 (must fix before merge):**
1. CR-01 — Replace `safeNumberFromBigInt(...).toString()` with `.toString()` directly on the BigInt
2. CR-02 — Add `TelegramAccount` conflict check in `verifyTelegramUsername`

**P1 (should fix before merge):**
3. CR-03 — Distinguish Telegram 400 from unexpected errors; improve error code detection
4. CR-04 — Add `tabIndex` and `onKeyDown` to `<li role="option">` items in `ManagerMultiSelect`
5. CR-05 — Replace dynamic `import()` of bot with a static singleton accessor

**P2 (fix in follow-up or same PR if low effort):**
6. CR-06 — Replace `form.watch('ids')` with `useWatch` in `SlaManagerSettingsForm` (5-minute fix)
7. CR-07 — Add username format validation to `verifyTelegramUsername` input schema
8. CR-08 — Add `role="dialog"`, `aria-modal`, `aria-labelledby` to `TelegramAuthModal`
9. CR-09 — Fix test describe block label (Check 0 vs Check 2)
10. CR-10 — Fix BigInt test constant (should be `9007199254740992`, not MAX_SAFE_INTEGER)
11. CR-11 — Add tooltip to orphaned chips in `ManagerMultiSelect`
12. CR-12 — Invalidate `user.list` cache in `TelegramAuthModal.onSuccess`
13. CR-13 — Remove no-op `handleClose` wrapper

---

*Report generated by code-reviewer agent on 2026-02-27. Branch: fix/monitoring-wiring -> feat/manager-multiselect-sla-fixes.*
