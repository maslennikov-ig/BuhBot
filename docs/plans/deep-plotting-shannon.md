# GitHub Issues Processing Plan

## Summary

| #   | Issue | Type   | Priority | Status            | Fix Approach                 |
| --- | ----- | ------ | -------- | ----------------- | ---------------------------- |
| 1   | #17   | bug    | P1       | Ready             | Code fix + migration + tests |
| 2   | #16   | bug    | P2       | Ready             | Code fix + tests             |
| 3   | #8    | config | P3       | **Already Fixed** | Closed by owner              |

---

## Issue #8: Bot Privacy Mode (CLOSED)

**Status:** Закрыт владельцем. Privacy Mode уже отключён.

---

## Issue #17: SLA Breach Notification Not Sent to Group Chat (P1)

### Root Cause (verified in code)

В `chats.ts:584-596` (`registerChat`) поле `notifyInChatOnBreach` НЕ указано явно:

```typescript
create: {
  id: chatId,
  // MISSING: notifyInChatOnBreach NOT explicitly set!
}
```

Prisma `@default(true)` не работает для существующих записей с `NULL`.
Worker проверяет `if (request.chat?.notifyInChatOnBreach)` — `NULL` = `false`.

### Solution

1. Add `notifyInChatOnBreach: true` to `registerChat` create block
2. Migration to set `notifyInChatOnBreach = true` for existing chats

### Files to Modify

| File                                        | Change                                                                                    |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `backend/src/api/trpc/routers/chats.ts:596` | Add `notifyInChatOnBreach: true`                                                          |
| Migration                                   | `UPDATE chats SET notify_in_chat_on_breach = true WHERE notify_in_chat_on_breach IS NULL` |

### Proposed Tests (from issue)

**File**: `backend/src/__tests__/routers/chats.test.ts`

1. **Unit Test**: Chat creation sets `notifyInChatOnBreach` explicitly
2. **Integration Test**: Group notification sent when enabled / NOT sent when disabled
3. **Integration Test**: sendMessage errors handled gracefully
4. **Logging Test**: Verify skip reason is logged

---

## Issue #16: Global SLA Threshold Doesn't Update Existing Chats (P2)

### Root Cause (verified in code)

`settings.ts:640-658` (`updateSlaThresholds`) updates only `GlobalSettings.defaultSlaThreshold`, NOT existing chats.

### Solution

Add `chat.updateMany()` to also update all existing chats:

```typescript
await ctx.prisma.chat.updateMany({
  where: {},
  data: {
    slaThresholdMinutes: input.slaThreshold,
    slaResponseMinutes: input.slaThreshold,
  },
});
```

### Files to Modify

| File                                               | Change                  |
| -------------------------------------------------- | ----------------------- |
| `backend/src/api/trpc/routers/settings.ts:646-656` | Add `chat.updateMany()` |

### Proposed Tests (from issue)

**File**: `backend/src/__tests__/routers/settings.test.ts`

1. **Integration Test**: `updateSlaThresholds` updates all existing chats
2. **Integration Test**: `GlobalSettings.defaultSlaThreshold` is updated
3. **Regression Test**: New chats use global default

---

## Implementation Plan

### Phase 1: Create Beads Tasks

```bash
bd create --type=bug --priority=1 --title="Fix notifyInChatOnBreach not set on chat creation (gh-17)" --external-ref="gh-17"
bd create --type=bug --priority=2 --title="Global SLA threshold should update existing chats (gh-16)" --external-ref="gh-16"
```

### Phase 2: Fix Issue #17 (P1)

**Step 2.1:** Edit `backend/src/api/trpc/routers/chats.ts`

Add `notifyInChatOnBreach: true` to the create block at line 596:

```typescript
create: {
  id: chatId,
  chatType: input.chatType,
  title: input.title ?? null,
  accountantUsername: input.accountantUsername ?? null,
  slaEnabled: true,
  slaResponseMinutes: defaultThreshold,
  slaThresholdMinutes: defaultThreshold,
  monitoringEnabled: true,
  is24x7Mode: false,
  managerTelegramIds: [],
  notifyInChatOnBreach: true,  // ADD THIS
},
```

**Step 2.2:** Create migration

```bash
cd backend
npx prisma migrate dev --name fix_notify_in_chat_default
```

Migration SQL:

```sql
UPDATE "chats" SET "notify_in_chat_on_breach" = true WHERE "notify_in_chat_on_breach" IS NULL;
```

**Step 2.3:** Write tests for Issue #17

Create/update `backend/src/__tests__/routers/chats.test.ts`:

```typescript
describe('chats.registerChat', () => {
  it('should explicitly set notifyInChatOnBreach to true on creation', async () => {
    const chat = await caller.chats.registerChat({
      telegramChatId: '123456',
      chatType: 'group',
    });

    const dbChat = await prisma.chat.findUnique({ where: { id: 123456n } });
    expect(dbChat?.notifyInChatOnBreach).toBe(true);
  });
});
```

Create/update `backend/src/__tests__/workers/sla-timer.worker.test.ts`:

```typescript
describe('SLA Timer Worker - Group Notifications', () => {
  it('should send notification to group chat when notifyInChatOnBreach is true', async () => {
    // Mock bot.telegram.sendMessage
    // Create chat with notifyInChatOnBreach = true
    // Process SLA breach
    // Assert sendMessage called with chat ID
  });

  it('should NOT send notification when notifyInChatOnBreach is false', async () => {
    // Create chat with notifyInChatOnBreach = false
    // Process SLA breach
    // Assert sendMessage NOT called for chat ID
  });

  it('should handle sendMessage errors gracefully without failing the job', async () => {
    // Mock sendMessage to reject
    // Process SLA breach
    // Assert no throw, alert still created
  });
});
```

### Phase 3: Fix Issue #16 (P2)

**Step 3.1:** Edit `backend/src/api/trpc/routers/settings.ts`

Modify `updateSlaThresholds` mutation (lines 646-658):

```typescript
updateSlaThresholds: adminProcedure
  .input(z.object({
    slaThreshold: z.number().min(1).max(480),
  }))
  .output(z.object({
    success: z.boolean(),
    updatedChats: z.number(),
  }))
  .mutation(async ({ ctx, input }) => {
    // 1. Update global default
    await ctx.prisma.globalSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', defaultSlaThreshold: input.slaThreshold },
      update: { defaultSlaThreshold: input.slaThreshold },
    });

    // 2. Update ALL existing chats
    const result = await ctx.prisma.chat.updateMany({
      where: {},
      data: {
        slaThresholdMinutes: input.slaThreshold,
        slaResponseMinutes: input.slaThreshold,
      },
    });

    return { success: true, updatedChats: result.count };
  }),
```

**Step 3.2:** Write tests for Issue #16

Create/update `backend/src/__tests__/routers/settings.test.ts`:

```typescript
describe('settings.updateSlaThresholds', () => {
  it('should update slaThresholdMinutes for all existing chats', async () => {
    // Create 3 chats with different thresholds
    // Update global threshold to 15
    // Assert all chats now have threshold = 15
  });

  it('should update GlobalSettings.defaultSlaThreshold', async () => {
    // Update global threshold
    // Assert GlobalSettings.defaultSlaThreshold updated
  });

  it('should return count of updated chats', async () => {
    // Create N chats
    // Update threshold
    // Assert result.updatedChats === N
  });
});
```

### Phase 4: Verification

```bash
cd backend

# Type check
npm run type-check

# Build
npm run build

# Run all tests
npm test

# Run specific test files
npm test -- --grep "chats.registerChat"
npm test -- --grep "SLA Timer Worker"
npm test -- --grep "settings.updateSlaThresholds"
```

### Phase 5: Close Issues & Sync

```bash
# Close GitHub issues
gh issue close 17 --comment "Fixed in commit <sha>

**Changes:**
1. Added explicit \`notifyInChatOnBreach: true\` to \`registerChat\` create block
2. Migration to update existing chats with NULL values
3. Tests added: chats.test.ts, sla-timer.worker.test.ts

Beads task: buh-xxx"

gh issue close 16 --comment "Fixed in commit <sha>

**Changes:**
1. \`updateSlaThresholds\` now updates all existing chats via \`chat.updateMany()\`
2. Returns \`updatedChats\` count in response
3. Tests added: settings.test.ts

Beads task: buh-yyy"

# Close Beads tasks
bd close buh-xxx --reason="Fixed gh-17"
bd close buh-yyy --reason="Fixed gh-16"

# Sync and push
bd sync
git push
```

---

## Execution Summary

| Task                     | Complexity | Executor | Test Coverage |
| ------------------------ | ---------- | -------- | ------------- |
| #17: Add field to create | Simple     | Direct   | Yes           |
| #17: Migration           | Simple     | Direct   | N/A           |
| #17: Tests               | Medium     | Direct   | 4 tests       |
| #16: Add updateMany      | Simple     | Direct   | Yes           |
| #16: Tests               | Medium     | Direct   | 3 tests       |

**Total: 5 code changes + 7 tests.**

---

## Verification Checklist

### Code Changes

- [ ] `notifyInChatOnBreach: true` added to `registerChat` create block
- [ ] Migration created and applied for existing chats
- [ ] `updateSlaThresholds` updates all chats with `updateMany`
- [ ] Output schema updated to return `updatedChats` count

### Tests

- [ ] `chats.test.ts`: notifyInChatOnBreach set on creation
- [ ] `sla-timer.worker.test.ts`: notification sent when enabled
- [ ] `sla-timer.worker.test.ts`: notification NOT sent when disabled
- [ ] `sla-timer.worker.test.ts`: errors handled gracefully
- [ ] `settings.test.ts`: all chats updated on threshold change
- [ ] `settings.test.ts`: GlobalSettings updated
- [ ] `settings.test.ts`: updatedChats count returned

### Quality Gates

- [ ] `npm run type-check` passes
- [ ] `npm run build` passes
- [ ] `npm test` passes

### Closure

- [ ] GitHub issues #16, #17 closed with comments
- [ ] Beads tasks created and closed
- [ ] Changes committed with issue refs
- [ ] Changes pushed to remote
