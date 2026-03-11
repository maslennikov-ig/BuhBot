---
report_type: code-review
generated: 2026-03-11T00:00:00Z
version: 2026-03-11
status: partial
agent: code-reviewer
pr: 265
branch: fix/buh-9o55-user-delete-fk-constraints
files_reviewed: 5
issues_found: 10
critical_count: 1
high_count: 3
medium_count: 4
low_count: 2
---

# Code Review Report: PR #265 — User Deletion FK Constraint Fix

**Generated**: 2026-03-11
**Status**: PARTIAL — fix is correct but has meaningful gaps
**PR**: #265 `fix/buh-9o55-user-delete-fk-constraints`
**Branch**: `fix/buh-9o55-user-delete-fk-constraints`
**Issue**: buh-9o55
**Files Reviewed**: 5
**Commit**: `171941b`

---

## Executive Summary

The PR correctly resolves the immediate crash (`chat_invitations_created_by_fkey` FK violation on
user deletion). The approach — making 4 fields nullable at the DB level and adding `onDelete: SetNull`
to all 6 relations — is the right pattern according to Prisma 7 documentation. The SQL migration is
technically sound.

However there are several meaningful gaps:

- The entire delete operation is **not wrapped in a transaction**, creating a real partial-failure
  window where pre-cleanup succeeds but the final `user.delete` fails (or vice versa), leaving the
  database in an inconsistent state.
- Supabase Auth is **never cleaned up** after a successful DB deletion, creating a split-brain user
  that can still log in despite having no DB record.
- The `SlaAlert.acknowledgedBy` field already had `onDelete: SetNull` in the schema **before this
  PR** but is **absent from the application-level cleanup block**, making the defensive cleanup
  incomplete.
- Two errors in `deleteUser` use bare `throw new Error(...)` instead of `TRPCError`, producing
  unstructured 500s to the client.

None of the issues block the core bug fix from working under normal conditions, but the transaction
gap and Supabase Auth leak are high-severity concerns for a production admin operation.

---

## Detailed Findings

### Critical Issues (1)

#### 1. No transaction wrapping — partial deletion is possible

**Files**: `backend/src/api/trpc/routers/auth.ts` lines 630–688

**Description**: The `deleteUser` procedure performs three sequential async operations outside any
transaction:

1. `chat.updateMany` — reassign chats (single await)
2. `Promise.all([...])` — 10 parallel updates/deletes
3. `user.delete` — the actual deletion

If step 1 succeeds and step 2 or 3 throws (e.g. a transient DB error, a Prisma runtime error, a
network interruption), the database is left in a partially cleaned state. Worse, if step 2 fully
completes but `user.delete` fails, all the `createdBy`/`assignedTo` FK fields have already been
nulled out — the content is now orphaned with no creator and the user still exists. Running the
operation again will then fail silently on the nulling step but may still fail on `user.delete`.

The Prisma documentation explicitly recommends `$transaction([...])` for exactly this scenario
(GDPR-style user deletion across multiple models). The sequential array form ensures all operations
succeed together or are rolled back as a unit.

**Impact**: Data integrity risk on transient failures. An incomplete deletion leaves the system in
an undefined state that is difficult to detect or repair.

**Recommendation**: Wrap the entire operation in a `prisma.$transaction`:

```typescript
// All cleanup + deletion in one atomic unit
await ctx.prisma.$transaction([
  ctx.prisma.chat.updateMany({
    where: { assignedAccountantId: input.userId },
    data: { assignedAccountantId: null },
  }),
  ctx.prisma.userManager.deleteMany({
    where: { OR: [{ managerId: input.userId }, { accountantId: input.userId }] },
  }),
  ctx.prisma.verificationToken.deleteMany({ where: { userId: input.userId } }),
  ctx.prisma.notificationPreference.deleteMany({ where: { userId: input.userId } }),
  ctx.prisma.notificationPreference.updateMany({
    where: { overriddenBy: input.userId },
    data: { overriddenBy: null },
  }),
  ctx.prisma.telegramAccount.deleteMany({ where: { userId: input.userId } }),
  ctx.prisma.chatInvitation.updateMany({
    where: { createdBy: input.userId },
    data: { createdBy: null },
  }),
  ctx.prisma.template.updateMany({
    where: { createdBy: input.userId },
    data: { createdBy: null },
  }),
  ctx.prisma.faqItem.updateMany({
    where: { createdBy: input.userId },
    data: { createdBy: null },
  }),
  ctx.prisma.classificationCorrection.updateMany({
    where: { correctedBy: input.userId },
    data: { correctedBy: null },
  }),
  ctx.prisma.feedbackSurvey.updateMany({
    where: { closedBy: input.userId },
    data: { closedBy: null },
  }),
  ctx.prisma.errorLog.updateMany({
    where: { assignedTo: input.userId },
    data: { assignedTo: null },
  }),
  ctx.prisma.slaAlert.updateMany({
    where: { acknowledgedBy: input.userId },
    data: { acknowledgedBy: null },
  }),
  ctx.prisma.user.delete({ where: { id: input.userId } }),
]);
```

Note: The `$transaction([...])` array form (not the interactive callback form) is the correct choice
here because all operations are independent write statements with no reads between them.

---

### High Priority Issues (3)

#### 2. Supabase Auth user is never deleted — split-brain state after user deletion

**File**: `backend/src/api/trpc/routers/auth.ts` lines 683–688

**Description**: The `deleteUser` procedure deletes the Prisma DB record but never calls
`supabase.auth.admin.deleteUser(input.userId)`. The same code in `createUser` (lines 565–574)
demonstrates the correct pattern: it calls `supabase.auth.admin.deleteUser` as a cleanup step.

After this procedure completes successfully, the deleted user's Supabase session remains valid.
They can still present a JWT to the tRPC context, pass `authedProcedure`, and hit the `me`
procedure. The `me` handler has a special dev-mode auto-create path (lines 91–119), but in
production it throws `new Error('User not found in database')` — a 500, not a proper auth error.
More importantly, any authenticated endpoint that does not look up the full DB user (e.g. write
mutations that trust `ctx.user`) will process requests from a logically deleted user until their
JWT expires (default Supabase JWT TTL: 1 hour).

**Impact**: Deleted users retain functional auth tokens for up to 1 hour. This is a security
and compliance gap, especially relevant under 152-ФЗ data deletion obligations.

**Recommendation**: After `user.delete` completes, call Supabase Auth cleanup:

```typescript
// After prisma transaction:
try {
  await supabase.auth.admin.deleteUser(input.userId);
} catch (authError) {
  // Log but do not throw — DB record is already gone, auth cleanup is best-effort
  logger.error('[deleteUser] Failed to delete Supabase Auth user', {
    userId: input.userId,
    error: authError instanceof Error ? authError.message : String(authError),
  });
}
```

The failure is non-fatal because once the DB record is gone, the user cannot do anything
meaningful, but the Auth record should still be cleaned up.

#### 3. SlaAlert.acknowledgedBy is excluded from application-level cleanup

**File**: `backend/src/api/trpc/routers/auth.ts` lines 639–681

**Description**: The schema already had `SlaAlert.acknowledgedUser` with `onDelete: SetNull`
before this PR (line 413 of schema.prisma). This PR does not add it to the migration (correct —
it was already there) but also does not add an `updateMany` for `slaAlert.acknowledgedBy` to the
application-level cleanup block. Every other SetNull relation is covered defensively in the
`Promise.all`, but `SlaAlert.acknowledgedBy` is silently absent.

The comment at line 636–638 says this block is "defense-in-depth for onDelete: SetNull" — but it
is incomplete. The DB-level constraint will handle it correctly, but the defensive layer is
inconsistent.

**Impact**: The application-level defensive nulling is asymmetric. If the DB constraint were ever
removed or the relation mode changed (e.g. `relationMode = "prisma"` instead of `foreignKeys`),
this field would not be covered. More immediately, it contradicts the stated intent of the comment
and creates confusion about what the block is supposed to cover.

**Recommendation**: Add to the `Promise.all` block (or the transaction, per issue 1):

```typescript
ctx.prisma.slaAlert.updateMany({
  where: { acknowledgedBy: input.userId },
  data: { acknowledgedBy: null },
}),
```

#### 4. deleteUser uses bare `throw new Error(...)` instead of TRPCError for user-visible errors

**File**: `backend/src/api/trpc/routers/auth.ts` lines 605, 614, 625, 627

**Description**: Several guard conditions in `deleteUser` throw plain `Error` objects:

```typescript
throw new Error('Нельзя удалить самого себя');        // line 605
throw new Error('Пользователь не найден');             // line 614
throw new Error('Нельзя удалить последнего администратора'); // line 627
```

Every other admin procedure in this file (`updateUser`, `setUserTelegramId`, `deactivateUser`,
`reactivateUser`) uses `TRPCError` with appropriate codes (`BAD_REQUEST`, `NOT_FOUND`). Bare
`Error` causes tRPC to return a generic INTERNAL_SERVER_ERROR (500) to the frontend instead of a
properly typed client error, breaking the type-safe error handling pattern in the frontend
consumers.

**Recommendation**: Use `TRPCError` consistently:

```typescript
throw new TRPCError({ code: 'BAD_REQUEST', message: 'Нельзя удалить самого себя' });
throw new TRPCError({ code: 'NOT_FOUND', message: 'Пользователь не найден' });
throw new TRPCError({ code: 'BAD_REQUEST', message: 'Нельзя удалить последнего администратора' });
```

---

### Medium Priority Issues (4)

#### 5. ClassificationCorrection.correctedBy was NOT NULL before — existing DB rows may have no corrector

**File**: `backend/prisma/migrations/20260311000000_user_delete_set_null_fk/migration.sql` line 21

**Description**: The migration uses `ALTER COLUMN "corrected_by" DROP NOT NULL` to make the field
nullable. This is safe going forward, but any `ClassificationCorrection` rows created before the
migration will still have non-null `corrected_by` values pointing at valid users. The concern is
not with existing rows (they are fine) but with the semantic meaning of `correctedBy = null` after
this migration: it now means either "the corrector's account was deleted" OR "the data predates
the fix." Future analytics code that queries `ClassificationCorrection` grouped by corrector needs
to be aware that null has two distinct meanings.

Similarly for `Template.createdBy` and `FaqItem.createdBy` — null now means "deleted user" not
"system-created."

**Recommendation**: Consider adding a migration comment or a sentinel value (e.g. a dedicated
"deleted-user" placeholder UUID) to distinguish the two null cases. At minimum, document this in
the model's Prisma schema comment.

#### 6. Promise.all with 10 concurrent writes — no error context on failure

**File**: `backend/src/api/trpc/routers/auth.ts` lines 639–681

**Description**: `Promise.all([...])` will reject with the first error thrown by any of the 10
concurrent operations, discarding the results of operations that completed and providing no
information about which specific operation failed. For a destructive admin operation like user
deletion, this makes debugging significantly harder.

**Recommendation**: Either:
(a) Wrap in the `$transaction` (which already handles this — see issue 1), or
(b) Add structured logging before the block that names the operation being attempted, so logs
can identify the failing step.

#### 7. Zod output schemas updated in faq.ts and templates.ts but not audit-checked for other procedures

**Files**: `backend/src/api/trpc/routers/faq.ts`, `backend/src/api/trpc/routers/templates.ts`

**Description**: The PR correctly updates `createdBy` to `.nullable()` in the `list` and `create`
output schemas for both `faq.ts` and `templates.ts`. However, `faq.ts` has a `search` procedure
that does not return `createdBy` at all (it only returns `id`, `question`, `answer`,
`relevanceScore`) — that is fine. But neither router has a per-item `get` procedure returning
`createdBy` based on the current code, so the coverage looks complete.

What is worth noting: `templates.ts` `update` output omits `createdBy` (line 169–175 of the
output schema), so it is not affected. The `faq.ts` `update` output also omits `createdBy`. This
is correct, but the asymmetry between `create` (returns `createdBy`) and `update` (does not)
means consumers cannot refresh the creator after an update — a minor API design inconsistency,
though not introduced by this PR.

**Recommendation**: No immediate action required. The nullable updates are correct and complete
for the affected procedures. Note the API asymmetry for future consideration.

#### 8. deleteUser is missing an audit log entry

**File**: `backend/src/api/trpc/routers/auth.ts`

**Description**: Every other mutating admin procedure in this router logs an audit entry:
`updateUser` (line 285), `updateUserRole` (line 315), `setUserTelegramId` (line 392),
`deactivateUser` (line 772), `reactivateUser` (line 817). The `deleteUser` procedure performs the
most destructive action in the system — permanent user deletion — and logs nothing.

**Recommendation**: Add an audit log entry after the delete:

```typescript
logger.info('[Audit] Admin deleted user', {
  adminId: ctx.user.id,
  targetUserId: input.userId,
  targetEmail: userToDelete.email,
  targetRole: userToDelete.role,
});
```

The `userToDelete` object is already fetched at line 609 and available in scope.

---

### Low Priority Issues (2)

#### 9. Migration filename timestamp is synthetic — not a real timestamp

**File**: `backend/prisma/migrations/20260311000000_user_delete_set_null_fk/migration.sql`

**Description**: The migration directory is named `20260311000000_user_delete_set_null_fk` with
a timestamp of `000000` (midnight exactly). Prisma generates migration timestamps from the local
system clock at the moment `prisma migrate dev` is run; a round `000000` timestamp suggests the
directory was created manually or the timestamp was hand-edited. This is harmless but can cause
ordering confusion if another developer runs `prisma migrate dev` and generates a migration whose
timestamp is also `20260311xxxxxx` but sorts differently.

**Recommendation**: Use the actual timestamp generated by `prisma migrate dev --name
user_delete_set_null_fk` rather than hand-crafting the directory name.

#### 10. Schema comment on deleteUser procedure is slightly misleading

**File**: `backend/src/api/trpc/routers/auth.ts` lines 587–590

**Description**: The JSDoc comment for `deleteUser` says:

> "Removes user and all associated data (telegram account, assigned chats reassigned to null)."

After this PR, the procedure also nulls out `createdBy` on templates, FAQ items, invitations,
classification corrections, and surveys; and `assignedTo` on error logs. The comment only
mentions telegram accounts and chat reassignment, which is now incomplete.

**Recommendation**: Update the JSDoc to reflect the full scope of cleanup operations.

---

## Schema Coverage Analysis

Cross-referencing all `User?` relations in the schema against the cleanup code:

| Relation | Schema onDelete | App-level cleanup | Status |
|---|---|---|---|
| `Chat.assignedAccountantId` | SetNull | `chat.updateMany` | Covered |
| `ClientRequest.assignedTo` | SetNull | (handled by Chat cascade chain / DB) | Covered via DB |
| `SlaAlert.acknowledgedBy` | SetNull | **MISSING** | Gap (issue 3) |
| `FeedbackSurvey.closedBy` | SetNull | `feedbackSurvey.updateMany` | Covered |
| `Template.createdBy` | SetNull (new) | `template.updateMany` | Covered |
| `FaqItem.createdBy` | SetNull (new) | `faqItem.updateMany` | Covered |
| `ChatInvitation.createdBy` | SetNull (new) | `chatInvitation.updateMany` | Covered |
| `ClassificationCorrection.correctedBy` | SetNull (new) | `classificationCorrection.updateMany` | Covered |
| `ErrorLog.assignedTo` | SetNull | `errorLog.updateMany` | Covered |
| `NotificationPreference.overriddenBy` | SetNull | `notificationPreference.updateMany` | Covered |
| `UserManager.managerId` | Cascade | `userManager.deleteMany` | Covered |
| `UserManager.accountantId` | Cascade | `userManager.deleteMany` | Covered |
| `VerificationToken.userId` | Cascade | `verificationToken.deleteMany` | Covered |
| `NotificationPreference.userId` | Cascade | `notificationPreference.deleteMany` | Covered |
| `TelegramAccount.userId` | Cascade | `telegramAccount.deleteMany` | Covered |
| `Notification.userId` | Cascade | (DB cascade handles) | Covered via DB |
| `ClassificationCorrection.correctorId` | SetNull (new) | `classificationCorrection.updateMany` | Covered |

Summary: 1 SetNull relation has no application-level defensive cleanup (`SlaAlert.acknowledgedBy`).
All DB-level constraints are correct and complete — this gap only affects the defensive layer.

---

## Prisma 7 Pattern Validation

**Context7 Status**: Available — `/prisma/docs`

### SetNull referential action

Correctly used. Per Prisma docs: "SetNull only works with optional relations; attempting to use it
on required relations will result in a runtime error." All 6 relations in this PR have:

- The scalar field made nullable in the schema (`String?`)
- The relation field typed as `User?`
- `onDelete: SetNull` on the relation

This is the exact pattern required. No issues.

### Transaction usage

The Prisma docs recommend `$transaction([...])` for multi-model delete operations (GDPR scenario).
This PR does **not** use a transaction for the delete flow. See issue 1.

### Migration correctness

The migration correctly uses the sequence: `DROP NOT NULL` -> `DROP CONSTRAINT` -> `ADD CONSTRAINT
... ON DELETE SET NULL ON UPDATE CASCADE`. This is the correct order — you must drop the old
constraint before adding a new one with different referential actions. No issues with the SQL.

---

## What the PR Gets Right

- The root cause diagnosis is correct. The original schema had `onDelete` omitted on several
  relations, which means Prisma fell back to the default `NoAction` / `Restrict` behavior,
  causing FK violations when `user.delete` was called.
- Making previously `NOT NULL` FK fields nullable is required for `onDelete: SetNull` to work —
  Prisma enforces this at schema validation time.
- Updating Zod output schemas in `faq.ts` and `templates.ts` to reflect the new nullable
  `createdBy` field is correct and necessary for type safety end-to-end.
- The defensive application-level `updateMany` calls (while incomplete per issue 3) are good
  practice in case the relation mode is ever changed from `foreignKeys` to `prisma`.
- The SQL migration is clean, atomic per-table, and correctly handles the two distinct cases
  (fields that were already nullable vs. fields that needed `DROP NOT NULL` first).

---

## Next Steps

### Must Fix Before Merge

1. Wrap the entire `deleteUser` cleanup and `user.delete` in `$transaction([...])` — issue 1.
2. Add `supabase.auth.admin.deleteUser` call after successful DB deletion — issue 2.

### Should Fix Before Merge

3. Add `slaAlert.updateMany({ where: { acknowledgedBy: input.userId }, ... })` to the cleanup
   block — issue 3.
4. Replace bare `throw new Error(...)` with `TRPCError` in `deleteUser` guard conditions — issue 4.
5. Add audit log entry in `deleteUser` — issue 8.

### Follow-Up (Future)

6. Document the new nullable semantics for `createdBy` fields in schema comments — issue 5.
7. Review whether `Promise.all` error surfacing is acceptable or whether structured logging should
   be added (superseded if issue 1 is implemented via `$transaction`) — issue 6.
8. Update JSDoc comment on `deleteUser` to reflect full cleanup scope — issue 10.
9. Use real Prisma-generated timestamps for migrations — issue 9.

---

## Artifacts

- This report: `docs/reports/code-review/2026-03/user-delete-fk-fix-review.md`

---

**Review complete. The core fix is sound and resolves the reported crash. Two must-fix issues
(missing transaction and missing Supabase Auth cleanup) should be addressed before this lands
in main.**
