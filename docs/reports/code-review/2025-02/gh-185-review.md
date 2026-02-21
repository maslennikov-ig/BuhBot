# Code Review: gh-185 Changes

**Date:** 2026-02-21
**Commits reviewed:**
- `56aa3ba` — fix(backend): resolve missing chat messages (gh-185)
- `7dc8eed` — fix(backend): atomic migration and chat filtering (gh-185)

**Files reviewed:**
- `backend/src/bot/handlers/chat-event.handler.ts`
- `backend/src/api/trpc/routers/chats.ts`
- `backend/src/bot/handlers/message.handler.ts`
- `backend/src/bot/handlers/faq.handler.ts`

---

## Summary

The gh-185 changes address four root causes of missing chat messages and incorrect chat visibility. The fixes are logically sound and correct the documented bugs (RC1–RC3, S1–S2). However, the implementation has several gaps, the most serious being: (1) the Group→Supergroup migration is not truly atomic because the old-chat read is outside the transaction, creating a TOCTOU window; (2) the migration silently skips migrating `SurveyDelivery` records that would violate a unique constraint, causing data loss; (3) `includeDisabled=true` is accessible to any authenticated user, including observers, bypassing the observer-scoping added in the same PR.

The RC1 (`monitoringEnabled` moved after upsert) and RC2 (FAQ `next()`) fixes are correct. The S1 filter (`includeDisabled`) is correctly implemented except for the authorization gap noted above.

---

## Critical Issues (P0–P1)

### P0-1. TOCTOU race: `oldChat` read is outside the transaction

**File:** `backend/src/bot/handlers/chat-event.handler.ts`, lines 170, 185–250

**Description:**

```typescript
// Line 170 — OUTSIDE the transaction
const oldChat = await prisma.chat.findUnique({ where: { id: BigInt(oldChatId) } });

if (oldChat) {
  // Lines 185–250 — INSIDE the transaction
  await prisma.$transaction([
    prisma.chat.upsert({ ... }),
    prisma.chatMessage.updateMany({ ... }),
    // ...
    prisma.chat.update({ where: { id: oldId }, data: { ... } }),
  ]);
}
```

The record is fetched into `oldChat` before the transaction begins. Between the `findUnique` and the transaction start, a concurrent request (e.g., a second `migrate_to_chat_id` event arriving due to Telegram retry, or a concurrent `chats.update` call) can modify or delete the old chat record. The transaction then operates with a stale snapshot of `oldChat`.

Concrete failure modes:
- A concurrent `chats.update` changes `assignedAccountantId` on the old chat. The transaction copies the stale value into the new chat. The assignment is silently lost.
- A concurrent deletion of the old chat causes `prisma.chat.update` (the last operation in the transaction array) to throw `P2025` ("Record not found"), rolling back all migrations. The new chat upsert is also rolled back, leaving the system with no record for the supergroup.

The fix is to perform the `findUnique` inside an interactive transaction (callback form) with a `SELECT FOR UPDATE` lock, or to use `$transaction(async (tx) => { ... })` with all reads inside.

**Proposed fix:**

```typescript
bot.on('migrate_to_chat_id', async (ctx) => {
  try {
    const oldChatId = ctx.chat.id;
    const newChatId = ctx.message.migrate_to_chat_id;
    const oldId = BigInt(oldChatId);
    const newId = BigInt(newChatId);

    await prisma.$transaction(
      async (tx) => {
        // Lock the old row first to prevent concurrent modifications
        await tx.$queryRaw`SELECT id FROM "public"."chats" WHERE "id" = ${oldId} FOR UPDATE`;

        const oldChat = await tx.chat.findUnique({ where: { id: oldId } });
        if (!oldChat) {
          // Register as new and return
          await tx.chat.upsert({ where: { id: newId }, create: { ... }, update: { ... } });
          return;
        }

        await tx.chat.upsert({ ... });
        await tx.chatMessage.updateMany({ ... });
        // ... all FK migrations ...
        await tx.chat.update({ where: { id: oldId }, data: { ... } });
      },
      { timeout: 15000 }
    );
  } catch (error) { ... }
});
```

**Priority:** P0 — silent data corruption in a migration path that cannot be replayed.

---

### P0-2. `SurveyDelivery` migration will violate unique constraint if new chat already has deliveries

**File:** `backend/src/bot/handlers/chat-event.handler.ts`, lines 233–236

**Description:**

```typescript
prisma.surveyDelivery.updateMany({
  where: { chatId: oldId },
  data: { chatId: newId },
}),
```

`SurveyDelivery` has a `@@unique([surveyId, chatId])` constraint (`unique_survey_chat` in the schema). If the new supergroup chat (`newId`) already exists in the database (e.g., because `migrate_to_chat_id` is delivered twice by Telegram, or because a `my_chat_member` event for the supergroup already created it with its own deliveries), then migrating `surveyDelivery` rows from `oldId` to `newId` will collide with existing `(surveyId, newId)` pairs.

The entire `$transaction` will roll back with a unique-constraint violation (`P2002`). None of the FK migrations complete. The error is caught by the outer `try/catch`, which logs it and silently returns. The old chat is not disabled. Messages continue to arrive on `oldChatId`, which the bot may or may not serve, and on `newChatId`, which has no configuration.

Similarly, `WorkingSchedule` has `@@unique([chatId, dayOfWeek])` (`unique_chat_day`). If the supergroup already has any schedule rows, the migration will fail for the same reason.

**Proposed fix:**

For `SurveyDelivery`, handle conflicts explicitly. Because each `(surveyId, chatId)` pair must be unique, and the old and new chats represent the same logical entity, duplicates should be deleted (the new chat's existing delivery takes precedence):

```typescript
// Within interactive transaction:
// 1. Delete old-chat survey deliveries that conflict with existing new-chat deliveries
const conflictingSurveys = await tx.surveyDelivery.findMany({
  where: { chatId: oldId },
  select: { surveyId: true },
});
const newChatExistingSurveyIds = (
  await tx.surveyDelivery.findMany({
    where: { chatId: newId, surveyId: { in: conflictingSurveys.map((s) => s.surveyId) } },
    select: { surveyId: true },
  })
).map((s) => s.surveyId);

// Delete conflicting old deliveries (new chat already has them)
if (newChatExistingSurveyIds.length > 0) {
  await tx.surveyDelivery.deleteMany({
    where: { chatId: oldId, surveyId: { in: newChatExistingSurveyIds } },
  });
}
// Now the remaining old deliveries can be migrated safely
await tx.surveyDelivery.updateMany({ where: { chatId: oldId }, data: { chatId: newId } });
```

Apply the same pattern to `WorkingSchedule` (conflict on `(chatId, dayOfWeek)`).

**Priority:** P0 — the entire migration transaction rolls back silently on any duplicate delivery, leaving both chats in a broken state.

---

### P1-1. `includeDisabled=true` bypasses observer role scoping

**File:** `backend/src/api/trpc/routers/chats.ts`, lines 87–94

**Description:**

```typescript
// Observer role: restrict to assigned chats only (gh-185)
if (ctx.user.role === 'observer') {
  where.assignedAccountantId = ctx.user.id;
}

// Filter out disabled/migrated chats by default (gh-185)
if (!input.includeDisabled) {
  where.monitoringEnabled = true;
}
```

The `list` procedure is on `authedProcedure`, meaning any authenticated user (including observers) can call it with `includeDisabled: true`. When an observer passes `includeDisabled: true`, the `monitoringEnabled` filter is skipped, but the `assignedAccountantId` filter is still applied — so the observer still only sees their own chats, including their disabled/migrated ones.

This is not a privilege-escalation to other users' chats. However, it reveals migrated/disabled chats to observers, which is presumably not intended given that the purpose of `includeDisabled` is for administrative investigation of migrated chats. More importantly, the parameter is also interactable with `assignedTo`: an observer can pass `assignedTo` equal to their own ID plus `includeDisabled: true` to list their disabled chats, or (since observer scoping overwrites `where.assignedAccountantId`) a manager could pass `includeDisabled: true` to see all disabled chats system-wide.

The administrative intent of `includeDisabled` should be restricted to `managerProcedure` or the parameter should be ignored unless the caller is a manager/admin.

**Proposed fix:**

```typescript
// Filter out disabled/migrated chats by default (gh-185)
// Only admins/managers may opt in to see disabled chats
const canSeeDisabled = ctx.user.role === 'admin' || ctx.user.role === 'manager';
if (!input.includeDisabled || !canSeeDisabled) {
  where.monitoringEnabled = true;
}
```

**Priority:** P1 — exposes migrated chat metadata to non-admin roles beyond intended scope.

---

### P1-2. Migration transaction has no timeout — can block connection pool

**File:** `backend/src/bot/handlers/chat-event.handler.ts`, line 185

**Description:**

```typescript
await prisma.$transaction([
  prisma.chat.upsert({ ... }),
  prisma.chatMessage.updateMany({ ... }),
  // 7 operations total
]);
```

The sequential (batch) `$transaction([])` API in Prisma has a default timeout of 5 seconds in Prisma 7. With a large chat (e.g., 50,000 `ChatMessage` rows, 500 `ClientRequest` rows), the seven `updateMany` operations may exceed this limit, causing a timeout error that rolls back the migration and leaves the system without any `migrate_to_chat_id` record for the supergroup.

More critically, with the pg Pool adapter configured with `max: 10` connections, a slow migration that holds a connection for several seconds will degrade throughput for all concurrent operations.

**Proposed fix:**

Add an explicit timeout and use `LOCK TIMEOUT` on the row lock (addressed in P0-1 fix):

```typescript
await prisma.$transaction(
  async (tx) => { /* ... */ },
  { timeout: 30000 } // 30s for large chats; adjust based on p99 data volume
);
```

Document the timeout as a known limitation: if a chat has extreme message volume, the migration should be done as a background job rather than inline with the Telegram event.

**Priority:** P1 — can cause migration failure and connection pool exhaustion under load.

---

## Improvements (P2–P3)

### P2-1. `monitoringEnabled` is a poor semantic flag for "disabled/migrated"

**File:** `backend/src/api/trpc/routers/chats.ts`, lines 91–94; `backend/src/bot/handlers/chat-event.handler.ts`, lines 244–248

**Description:**

The migration disables old chats by setting `monitoringEnabled = false`. The `chats.list` filter then uses `monitoringEnabled = true` as a proxy for "not migrated/disabled".

This conflates two distinct states:
1. A live chat with monitoring intentionally turned off by an admin (`monitoringEnabled = false`, active use).
2. A chat that was migrated and should no longer appear (`monitoringEnabled = false`, tombstone).

An admin who intentionally disables monitoring on a live chat will find it disappears from `chats.list` by default. They would need to pass `includeDisabled: true` to see it again, which — per P1-1 — requires manager/admin role anyway, but is still surprising.

The migration also sets the title to `[MIGRATED] <original>`, which is a reasonable workaround, but semantically fragile (title is a display string, not a state field).

**Proposed fix (medium-term):**

Add a dedicated `isMigrated: Boolean @default(false)` field to the `Chat` model with an index, set it during migration, and filter on it independently of `monitoringEnabled`. This makes the filter unambiguous.

Short-term (without a schema migration): Document in code that `monitoringEnabled = false` is used for both states, and add a comment on the `chats.list` filter explaining this limitation.

**Priority:** P2 — current behavior works but creates semantic confusion and a UX issue for admins managing manually-disabled chats.

---

### P2-2. `faqHandled` check calls `return next()` — will trigger response handler unnecessarily for FAQ messages

**File:** `backend/src/bot/handlers/message.handler.ts`, lines 214–221

**Description:**

```typescript
if ((ctx.state as Record<string, unknown>)['faqHandled']) {
  logger.debug('FAQ-handled message, skipping SLA classification', { ... });
  return next();
}
```

When a FAQ match is found, the flow is:
1. `faq.handler` replies, sets `faqHandled = true`, calls `next()`.
2. `message.handler` logs the `ChatMessage`, then hits this branch and calls `next()`.
3. `response.handler` receives the message.

The `response.handler` checks if the sender is an accountant and, if so, attempts to stop the SLA timer for the chat. For FAQ-matched messages sent by a non-accountant client, `response.handler` will determine the sender is not an accountant and do nothing — so the behavior is currently correct.

However, the intent stated in the comment and the docblock in `faq.handler.ts` is that FAQ-handled messages should not propagate further down the handler chain for SLA purposes. Calling `return next()` rather than `return` silently invokes `response.handler` for every FAQ match. If `response.handler` is ever extended to handle non-accountant messages (e.g., to detect client-sent commands), FAQ messages would be processed twice.

Additionally, there is a control-flow inconsistency: when `monitoringEnabled = false`, the handler does `return` (no next()), but when `faqHandled = true`, it does `return next()`. If the intent is that `response.handler` must always run, the `monitoringEnabled` early return should also call `next()`.

**Proposed fix:**

Clarify the intent. If `response.handler` should always run regardless of SLA state:

```typescript
if ((ctx.state as Record<string, unknown>)['faqHandled']) {
  // FAQ already replied; skip SLA classification but let response.handler run
  return next();
}
if (!chat.monitoringEnabled) {
  return next(); // consistent: response handler still runs
}
```

If `response.handler` should not run for FAQ-handled messages (FAQ answer is not an accountant response):

```typescript
if ((ctx.state as Record<string, unknown>)['faqHandled']) {
  return; // Fully handled; do not propagate
}
```

**Priority:** P2 — not currently broken, but semantically ambiguous and fragile under future changes to `response.handler`.

---

### P2-3. `ChatInvitation.createdChatId` is not migrated

**File:** `backend/src/bot/handlers/chat-event.handler.ts`, lines 218–249

**Description:**

The schema has `ChatInvitation.createdChatId: BigInt?` (line 670 of `schema.prisma`), which stores the Telegram chat ID of the chat created via an invitation. This field is not a formal Prisma relation (no `@relation` directive) — it is a denormalized reference. However, it is a semantic reference to a Chat by its Telegram ID.

After migration, `createdChatId` will still hold the old group ID (`oldId`). Queries that look up invitations by `createdChatId` (e.g., to determine whether an invitation has been used to create a specific chat) will not find the new supergroup.

The transaction does not include:

```typescript
prisma.chatInvitation.updateMany({
  where: { createdChatId: oldId },
  data: { createdChatId: newId },
}),
```

**Proposed fix:**

Add `chatInvitation.updateMany` to the migration transaction:

```typescript
prisma.chatInvitation.updateMany({
  where: { createdChatId: oldId },
  data: { createdChatId: newId },
}),
```

**Priority:** P2 — data integrity issue; invitation lookup by chat ID will return stale results after migration.

---

### P3-1. Double `next()` call when SLA processing completes normally

**File:** `backend/src/bot/handlers/message.handler.ts`, lines 220, 244, 436

**Description:**

The message handler's control flow has multiple paths that call `next()` explicitly inside the `try` block, and then `next()` is also called unconditionally at the end of the handler (line 436, outside the `try` block):

```typescript
// Inside try block:
if ((ctx.state as Record<string, unknown>)['faqHandled']) {
  return next();   // Line 220 — exits handler, line 436 never reached
}
// ...
if (isAccountant) {
  return next();   // Line 244 — exits handler, line 436 never reached
}
// ... full SLA processing ...
// Falls through to:

// Outside try block (line 436):
await next();  // Always called if no early return
```

For paths that `return next()` inside the `try` block, `next()` is called exactly once. For the normal path (full SLA processing), `next()` is called at line 436. This is correct.

The risk is that a future developer adding a new early-return branch inside the `try` block might write `return;` instead of `return next()`, unintentionally skipping `response.handler`. The asymmetric pattern (some paths use `return next()`, the default path uses a trailing `await next()`) makes this error easy to make.

**Proposed fix:**

Restructure to make `next()` calls uniform. One approach: move all early returns inside the `try` to `return` (no `next()`), and call `next()` unconditionally at the end as it already does. For branches that specifically need to invoke `response.handler`, document why explicitly.

**Priority:** P3 — not currently broken; readability and maintenance concern.

---

### P3-2. `upsert` on `newChat` does not copy `inviteLink` in the `update` branch

**File:** `backend/src/bot/handlers/chat-event.handler.ts`, lines 186–216

**Description:**

```typescript
prisma.chat.upsert({
  where: { id: newId },
  create: {
    // ...
    inviteLink: oldChat.inviteLink,   // Copied in create
  },
  update: {
    // ...
    // inviteLink is NOT here
  },
}),
```

If the new supergroup chat already exists in the database (e.g., because `my_chat_member` fired for the supergroup before `migrate_to_chat_id` arrived — this is Telegram's documented behavior), the `upsert` will take the `update` path and the `inviteLink` from the old chat will not be carried over. The new chat may retain a stale or null invite link.

**Proposed fix:**

Add `inviteLink` to the `update` block:

```typescript
update: {
  title: oldChat.title,
  slaEnabled: oldChat.slaEnabled,
  slaThresholdMinutes: oldChat.slaThresholdMinutes,
  monitoringEnabled: oldChat.monitoringEnabled,
  is24x7Mode: oldChat.is24x7Mode,
  managerTelegramIds: oldChat.managerTelegramIds,
  notifyInChatOnBreach: oldChat.notifyInChatOnBreach,
  accountantUsernames: oldChat.accountantUsernames,
  accountantTelegramIds: oldChat.accountantTelegramIds,
  assignedAccountantId: oldChat.assignedAccountantId,
  clientTier: oldChat.clientTier,
  inviteLink: oldChat.inviteLink,  // Add this
},
```

**Priority:** P3 — minor data loss in the edge case where supergroup record pre-exists; invite link is not critical for core functionality.

---

### P3-3. `ctx.state` cast to `Record<string, unknown>` repeated in two places without a type helper

**Files:** `backend/src/bot/handlers/faq.handler.ts` line 115; `backend/src/bot/handlers/message.handler.ts` line 214

**Description:**

```typescript
// faq.handler.ts
(ctx.state as Record<string, unknown>)['faqHandled'] = true;

// message.handler.ts
if ((ctx.state as Record<string, unknown>)['faqHandled']) {
```

The `BotContext` type likely does not include `faqHandled` in its `state` definition, so both accesses require a runtime cast. This is repeated in two files. If the key name changes or additional state flags are added, both sites must be updated manually.

**Proposed fix:**

Extend the `BotContext` state type in `bot.ts`:

```typescript
// In bot.ts
interface BotState {
  faqHandled?: boolean;
}

export type BotContext = Context & {
  state: BotState;
};
```

Then in both handlers:

```typescript
// faq.handler.ts
ctx.state.faqHandled = true;

// message.handler.ts
if (ctx.state.faqHandled) { ... }
```

**Priority:** P3 — type safety and maintainability improvement; no runtime impact.

---

## Minor / Style (P4)

### P4-1. Comment references wrong step numbers after renumbering

**File:** `backend/src/bot/handlers/message.handler.ts`, lines 223, 234, 247, 271

After the gh-185 refactor, step comments were renumbered to 5, 7, 8, 9, 10... skipping 6. Lines 223 and 271 refer to step "7" and "10" but step "6" does not exist in the current file.

**Proposed fix:** Renumber sequentially: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10.

---

### P4-2. `migrate_from_chat_id` event is not handled

**File:** `backend/src/bot/handlers/chat-event.handler.ts`

Telegram sends two events during a Group→Supergroup migration:
- `migrate_to_chat_id` to the old group (handled)
- `migrate_from_chat_id` to the new supergroup (not handled)

The new supergroup receives a `migrate_from_chat_id` message, which the bot also receives because it is now a member of the supergroup. This event is currently silently ignored. While not strictly required (the `migrate_to_chat_id` handler does the full migration), registering a no-op or a log-only handler for `migrate_from_chat_id` would make the system's awareness of the event explicit and prevent log noise from unhandled updates.

**Priority:** P4 — informational; no functional impact.

---

### P4-3. Error log for migration failure has low detail

**File:** `backend/src/bot/handlers/chat-event.handler.ts`, lines 279–281

```typescript
} catch (error) {
  logger.error('Error handling migration', { error });
}
```

The outer catch for the entire `migrate_to_chat_id` handler logs `{ error }` directly without extracting `.message` and `.stack`. Compare with the pattern used everywhere else in the file:

```typescript
logger.error('Error handling my_chat_member', {
  error: error instanceof Error ? error.message : String(error),
  stack: error instanceof Error ? error.stack : undefined,
  service: 'chat-event-handler',
});
```

When the migration transaction fails (e.g., P0-2 unique constraint violation), the logged error object may not serialize cleanly depending on the Winston transport, making debugging harder.

**Proposed fix:**

```typescript
} catch (error) {
  logger.error('Error handling migration', {
    oldChatId,
    newChatId,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    service: 'chat-event-handler',
  });
}
```

**Priority:** P4 — operational quality; does not affect correctness.

---

## Verdict

| Scope | Verdict |
|---|---|
| RC1 (`monitoringEnabled` moved after upsert) | Correct |
| RC2 (FAQ `next()` + `faqHandled` flag) | Correct, minor type safety gap (P3-3) |
| RC3 (atomic Group→Supergroup migration) | Partially correct — atomicity is improved but TOCTOU window remains (P0-1) and unique constraint conflicts can roll back the whole migration (P0-2) |
| S1 (`includeDisabled` filter) | Correct, authorization gap for non-admin roles (P1-1) |
| S2 (observer role filter) | Correct |

**Must fix before next release:** P0-1, P0-2, P1-1, P1-2.

**Should fix soon:** P2-1 (semantic flag confusion), P2-2 (next() consistency), P2-3 (ChatInvitation.createdChatId not migrated).

The transaction atomicity improvement in `7dc8eed` is the right direction. The remaining risk is that the transaction can still fail silently on unique constraint violations, which is a more pressing correctness issue than the TOCTOU window (which is narrow in practice). Resolving P0-2 by switching to an interactive transaction (P0-1 fix) also naturally resolves the timeout issue (P1-2) since the interactive form accepts a `timeout` option.
