# Code Review: Users Page Overhaul

**Branch:** `feat/users-page-overhaul`
**Date:** 2026-03-06
**Reviewer:** Code Review Agent (claude-opus-4-6)
**Files Reviewed:** 7

---

## Summary

This changeset adds the 'accountant' role across all user management UI components, introduces a new `UserEditDialog` combining profile editing, role changes, and status toggle, enhances `UserList` with role filters and a status column, adds an `auth.updateUser` backend procedure, and updates `AccountantSelect` to query all assignable roles. The `UsersPage` is rewired to use `UserEditDialog` instead of the standalone `UserRoleDialog`.

Overall the implementation is well-structured and consistent with existing patterns. The `UserEditDialog` is a thoughtful consolidation of previously separate actions. Several issues were found, ranging from a security-relevant backend bug (email update without Supabase sync) to UX and cleanup concerns.

---

## Critical Issues (P0)

### CR-1: `updateUser` changes email in Prisma DB but not in Supabase Auth -- causes login/auth split-brain

**File:** `backend/src/api/trpc/routers/auth.ts:236-282`
**Severity:** P0 -- Security / Data Integrity

**Description:**
The new `updateUser` procedure allows an admin to change a user's `email` in the Prisma database, but does not update the corresponding Supabase Auth user record. After this mutation:

1. The user's email in the `users` table differs from their Supabase Auth email.
2. The user continues to log in with their old Supabase Auth email.
3. Supabase session tokens contain the old email, creating identity confusion.
4. Password reset emails go to the old Supabase Auth email, not the new one.

The `createUser` procedure correctly uses `supabase.auth.admin.inviteUserByEmail` and includes cleanup logic on failure. The `updateUser` procedure has no Supabase counterpart.

**Suggested fix:** Either (a) add a `supabase.auth.admin.updateUserById` call to sync the email, wrapped in a try-catch with rollback similar to `createUser`, or (b) remove email editing from `updateUser` entirely until proper sync is implemented. Option (b) is safer for a first iteration:

```typescript
// Remove email from input schema for now
updateUser: adminProcedure
  .input(
    z.object({
      userId: z.string().uuid(),
      fullName: z.string().min(1).optional(),
      // email removed until Supabase sync is implemented
    })
  )
```

If email editing is needed, the mutation must also call:

```typescript
await supabase.auth.admin.updateUserById(input.userId, {
  email: input.email,
});
```

This should be transactional -- if the Supabase update fails, the Prisma update must be rolled back.

### CR-2: `updateUser` does not check email uniqueness before update

**File:** `backend/src/api/trpc/routers/auth.ts:258-273`
**Severity:** P0 -- Data Integrity

**Description:**
The email field has a `@unique` constraint in the Prisma schema (`backend/prisma/schema.prisma:147`). If an admin sets a user's email to one that already exists, Prisma will throw a raw `P2002` unique constraint violation error, which surfaces as an unhelpful internal error to the client.

The `createUser` procedure correctly checks `findUnique({ where: { email } })` before creating. The `updateUser` procedure does not.

**Suggested fix:**

```typescript
if (input.email !== undefined) {
  const existingByEmail = await ctx.prisma.user.findUnique({
    where: { email: input.email },
  });
  if (existingByEmail && existingByEmail.id !== input.userId) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Пользователь с таким email уже существует',
    });
  }
  updateData.email = input.email;
}
```

---

## Important Issues (P1)

### CR-3: UserEditDialog uses stale `user` object for status toggle and change detection

**File:** `frontend/src/components/settings/users/UserEditDialog.tsx:97-148`
**Severity:** P1 -- Logic Bug

**Description:**
The `handleSave` function compares current form state against the `user` prop to detect changes (lines 103, 114). The `handleToggleActive` function reads `user.isActive` to decide whether to deactivate or reactivate (line 135). However, after deactivation/reactivation succeeds, the dialog calls `onClose()` which clears `editUser` in the parent. If the user were to save and toggle status in sequence (e.g., change name, then toggle status before closing), the `user` prop would be stale since the list data was invalidated but the prop was not refreshed.

More concretely: after `handleToggleActive` calls `utils.auth.listUsers.invalidate()` and `onClose()`, the parent sets `editUser` to `null`. This means the status toggle always closes the dialog, which is fine in isolation. But consider the reverse flow: if the user toggles status first (which closes the dialog), any unsaved profile changes are silently lost because `handleToggleActive` calls `onClose()` without checking for dirty form state.

**Suggested fix:** Either (a) show a confirmation warning if there are unsaved changes before toggle, or (b) save profile changes atomically alongside the status toggle. At minimum, disable the deactivate/reactivate button when form fields are dirty:

```typescript
const isDirty = fullName !== user.fullName || email !== user.email || selectedRole !== user.role;
// ...
<Button
  variant="ghost"
  size="sm"
  onClick={handleToggleActive}
  disabled={isPending || isDirty}
  title={isDirty ? 'Сначала сохраните или отмените изменения' : undefined}
>
```

### CR-4: AccountantSelect does not filter out deactivated users

**File:** `frontend/src/components/chats/AccountantSelect.tsx:68-71`
**Severity:** P1 -- UX / Business Logic

**Description:**
The `AccountantSelect` component now queries all users with roles `['accountant', 'manager', 'admin']` via `trpc.user.list`. However, the `user.list` procedure (`backend/src/api/trpc/routers/user.ts:142-192`) does not filter by `isActive` and does not return `isActive` in its response. This means deactivated users appear in the assignment dropdown and can be assigned to chats.

Since `UserList` now shows a status column and supports deactivation, it is inconsistent for deactivated users to appear as assignable options.

**Suggested fix:** Either (a) add `isActive: true` to the `where` clause in `user.list` when used for assignment (add an optional `activeOnly` input param), or (b) filter on the frontend after fetching. Option (a) is cleaner:

```typescript
// In user.list procedure
if (input?.activeOnly) {
  where.isActive = true;
}
```

```typescript
// In AccountantSelect
const { data: fetchedUsers } = trpc.user.list.useQuery(
  { role: ['accountant', 'manager', 'admin'], activeOnly: true },
  { enabled: !providedAccountants }
);
```

### CR-5: `updateUser` module JSDoc header not updated

**File:** `backend/src/api/trpc/routers/auth.ts:1-9`
**Severity:** P1 -- Documentation

**Description:**
The file header JSDoc lists only two procedures:

```
 * Procedures:
 * - me: Get current authenticated user profile
 * - listUsers: List all users (for assignment dropdowns)
```

It is missing `updateUser`, `updateUserRole`, `createUser`, `deleteUser`, `deactivateUser`, `reactivateUser`, `updateProfile`, and `setUserTelegramId`. This was a pre-existing issue, but the new `updateUser` procedure makes the discrepancy larger. The header should be updated to reflect all procedures.

---

## Improvements (P2)

### CR-6: UserRoleDialog is now dead code

**File:** `frontend/src/components/settings/users/UserRoleDialog.tsx`
**Severity:** P2 -- Cleanup

**Description:**
The `UserRoleDialog` component is no longer imported or used by `UsersPage` (the only consumer). The `UserEditDialog` now handles role changes inline. The file only references itself (no other importers found in the codebase).

**Suggested fix:** Delete `frontend/src/components/settings/users/UserRoleDialog.tsx` and its potential barrel export to keep the codebase clean.

### CR-7: ROLES constant is duplicated across three components

**File:** `UserCreateDialog.tsx:22-39`, `UserRoleDialog.tsx:24-41`, `UserEditDialog.tsx:18-35`
**Severity:** P2 -- DRY / Maintainability

**Description:**
The `ROLES` array with role values, labels, and descriptions is copy-pasted identically in three files. If a new role is added or a description is changed, all three files must be updated in sync.

**Suggested fix:** Extract to a shared module:

```typescript
// frontend/src/components/settings/users/constants.ts
export const ROLES = [
  { value: 'admin' as const, label: 'Администратор', description: '...' },
  { value: 'manager' as const, label: 'Менеджер', description: '...' },
  { value: 'accountant' as const, label: 'Бухгалтер', description: '...' },
  { value: 'observer' as const, label: 'Наблюдатель', description: '...' },
];
```

The `ROLE_LABELS` and `ROLE_COLORS` maps in `UserList.tsx` (lines 25-37) should also live in this shared module.

### CR-8: UserEditDialog handleSave makes two sequential mutations without transactional guarantee

**File:** `frontend/src/components/settings/users/UserEditDialog.tsx:97-128`
**Severity:** P2 -- Robustness

**Description:**
When both profile fields and role have changed, `handleSave` calls `updateUser` followed by `updateUserRole` as two separate mutations. If the first succeeds and the second fails (e.g., network error), the user sees an error but the name/email is already persisted while the role remains unchanged. The `listUsers` cache is still invalidated (line 121), so the UI shows a partially updated state.

This is a partial-save scenario that may confuse users.

**Suggested fix:** Consider either (a) adding the `role` field to the `updateUser` backend procedure so a single mutation handles all changes, or (b) showing a more informative error message explaining what was saved and what was not. Option (a) is recommended since both `updateUser` and `updateUserRole` are admin-only procedures on the same entity:

```typescript
// Extend updateUser to optionally accept role
updateUser: adminProcedure
  .input(
    z.object({
      userId: z.string().uuid(),
      fullName: z.string().min(1).optional(),
      email: z.string().email().optional(),
      role: UserRoleSchema.optional(),
    })
  )
```

### CR-9: UserEditDialog `onSuccess` callback called from both save and toggle paths

**File:** `frontend/src/components/settings/users/UserEditDialog.tsx`, `frontend/src/app/settings/users/page.tsx:87-92`
**Severity:** P2 -- UX / Ambiguity

**Description:**
In `UsersPage`, the `onSuccess` prop is wired to `handleCloseEditDialog` which sets `editUser` to `null` and closes the dialog. This is called from both `handleSave` (line 123) and `handleToggleActive` (line 143). Since `onClose` is also called immediately after, the `onSuccess` callback is redundant with `onClose` in the current wiring:

```tsx
<UserEditDialog
  user={editUser}
  open={isEditDialogOpen}
  onClose={handleCloseEditDialog}   // sets editUser=null, closes dialog
  onSuccess={handleCloseEditDialog} // same function
/>
```

The `onSuccess` callback should semantically be used for side effects like showing a toast or refreshing external data -- not duplicating the close behavior.

**Suggested fix:** Either make `onSuccess` a no-op (since the dialog handles its own toasts) or use it to trigger a list refresh callback distinct from the close handler.

### CR-10: `updateUserRole` lacks audit logging

**File:** `backend/src/api/trpc/routers/auth.ts:292-306`
**Severity:** P2 -- Consistency / Audit Trail

**Description:**
The new `updateUser` procedure includes audit logging (line 275):

```typescript
logger.info('[Audit] Admin updated user profile', { ... });
```

However, the pre-existing `updateUserRole` procedure (lines 292-306) has no audit logging. Since `UserEditDialog` calls both procedures, role changes are untracked in logs while profile changes are tracked. Other admin procedures like `deactivateUser`, `reactivateUser`, and `setUserTelegramId` all include audit logging.

**Suggested fix:** Add logging to `updateUserRole`:

```typescript
logger.info('[Audit] Admin updated user role', {
  adminId: ctx.user.id,
  targetUserId: input.userId,
  newRole: input.role,
});
```

---

## Minor / Style (P3)

### CR-11: `type` assertion `user.role as UserRole` in UserEditDialog

**File:** `frontend/src/components/settings/users/UserEditDialog.tsx:55`
**Severity:** P3 -- Type Safety

**Description:**
Line 55 casts `user.role as UserRole`. The `UserItem` type already has `role` typed from the tRPC output schema, so this cast should be unnecessary. If the types are not compatible, the root cause should be investigated rather than casting.

### CR-12: ROLE_COLORS accountant uses raw CSS opacity syntax

**File:** `frontend/src/components/settings/users/UserList.tsx:35`
**Severity:** P3 -- Style Consistency

**Description:**
The accountant role color uses `bg-[var(--buh-success)]/10` (Tailwind opacity modifier on a CSS variable), while the admin role uses `bg-[var(--buh-error-muted)]` (a dedicated muted variable). If `--buh-success-muted` exists in the design system, it should be used for consistency. If it does not exist, this is fine as-is but worth noting.

### CR-13: Empty `catch` blocks in UserEditDialog

**File:** `frontend/src/components/settings/users/UserEditDialog.tsx:125-127, 145-147`
**Severity:** P3 -- Style

**Description:**
Both `handleSave` and `handleToggleActive` have empty `catch` blocks with a comment "Error already handled by mutation onError." While technically correct (the `onError` callbacks set the `error` state), empty catch blocks are a code smell. Consider using `.catch(() => {})` on the `mutateAsync` call instead, or documenting the pattern more explicitly.

---

## Positive Observations

1. **Consolidated edit dialog**: Combining profile editing, role changes, and status toggle into `UserEditDialog` is a good UX improvement over having separate dialogs for each action. The dialog is well-organized with clear sections.

2. **Manager/subordinate display**: Showing assigned managers (for accountants) and subordinate accountants (for managers/admins) in the edit dialog provides useful context during user management. The conditional queries with `enabled` flags are correctly implemented.

3. **Role filter chips**: The pill-based role filter in `UserList` is a clean UX pattern that reduces cognitive load. The implementation using `ROLE_FILTER_OPTIONS` is straightforward.

4. **Status column**: Adding the `isActive` status column with sortable header completes the user management picture. The color coding (green for active, red for deactivated) is clear.

5. **Proper loading states**: The `UserEditDialog` shows loading spinners for manager/subordinate data, and the save button shows "Сохранение..." while pending. The `isPending` aggregate across all mutations properly disables actions during any in-flight request.

6. **Backend `updateUser` validation**: The procedure correctly validates that the target user exists before updating, returns a proper `NOT_FOUND` error, and rejects empty update payloads with `BAD_REQUEST`. Audit logging is included.

7. **AccountantSelect expanded roles**: Querying `['accountant', 'manager', 'admin']` for the assignment dropdown is a valid business requirement -- managers and admins may also be assigned to chats.

---

## Issue Summary

| ID    | Severity | File | Description |
|-------|----------|------|-------------|
| CR-1  | P0 | `auth.ts` | `updateUser` changes email in DB but not in Supabase Auth |
| CR-2  | P0 | `auth.ts` | `updateUser` does not check email uniqueness before update |
| CR-3  | P1 | `UserEditDialog.tsx` | Status toggle discards unsaved profile changes silently |
| CR-4  | P1 | `AccountantSelect.tsx` | Deactivated users appear in assignment dropdown |
| CR-5  | P1 | `auth.ts` | Module JSDoc header outdated |
| CR-6  | P2 | `UserRoleDialog.tsx` | Dead code -- no longer imported by any consumer |
| CR-7  | P2 | Multiple | ROLES constant duplicated in three files |
| CR-8  | P2 | `UserEditDialog.tsx` | Two sequential mutations without transactional guarantee |
| CR-9  | P2 | `UserEditDialog.tsx`, `page.tsx` | `onSuccess` is redundant with `onClose` |
| CR-10 | P2 | `auth.ts` | `updateUserRole` lacks audit logging (inconsistent with other procedures) |
| CR-11 | P3 | `UserEditDialog.tsx` | Unnecessary `as UserRole` type assertion |
| CR-12 | P3 | `UserList.tsx` | Inconsistent CSS variable usage for accountant role color |
| CR-13 | P3 | `UserEditDialog.tsx` | Empty catch blocks |

**Must fix before merge:** CR-1, CR-2
**Should fix before merge:** CR-3, CR-4
**Can follow up:** CR-5, CR-6, CR-7, CR-8, CR-9, CR-10, CR-11, CR-12, CR-13
