# Process GitHub Issues — Plan

## Context

8 open GitHub issues need processing. The critical cluster is **#210-#213** (SLA Notification System): users configure accountants but SLA alerts never deliver because the notification system only checks `managerTelegramIds` (no UI to set it) and `globalManagerIds` (no UI to set it), completely ignoring `accountantTelegramIds`.

Issues #206-#209 are feature requests of varying complexity.

---

## Priority Scoring

| Rank | Issue | Title | Sev | Imp | Lkh | Score | Priority | Type | Action |
|------|-------|-------|-----|-----|-----|-------|----------|------|--------|
| 1 | #210 | SLA Notification System Not Recognizing Managers | 7 | 7 | 10 | 24 | **P1** | bug (parent) | FIX — tracking issue, done when children done |
| 2 | #212 | Backend: Add accountantTelegramIds Fallback | 7 | 7 | 7 | 21 | **P1** | bug | FIX — backend resolution chain |
| 3 | #211 | UI: Add Manager TG IDs to Chat Settings | 5 | 7 | 10 | 22 | **P1** | feature | FIX — add missing form field |
| 4 | #213 | UI: Add Global Manager IDs to Settings | 5 | 7 | 10 | 22 | **P1** | feature | FIX — add missing form field |
| 5 | #206 | Admin Telegram ID Management | 5 | 3 | 5 | 13 | **P2** | feature | DEFER — no schema change needed but separate scope |
| 6 | #207 | Dashboard Alerts for Missing TG IDs | 2 | 3 | 5 | 10 | **P3** | feature | DEFER — needs dedup design |
| 7 | #208 | Chat Scroll Behavior Options | 2 | 3 | 5 | 10 | **P3** | enhancement | DEFER — UX improvement |
| 8 | #209 | Restore Deleted Chats | 5 | 3 | 2 | 10 | **P3** | feature | DEFER — complex, needs spec |

---

## Scope: Fix #210-#213 (SLA Notification Cluster)

### Dependency Graph

```
#212 (backend fallback) ──blocks──> #211 (chat UI)
#212 (backend fallback) ──blocks──> #213 (global UI)
#211 + #213 ──completes──> #210 (parent)
```

Execution order: #212 -> #211 + #213 (parallel) -> close #210

### Root Cause

5 places resolve notification recipients with the same broken chain:
`Chat.managerTelegramIds -> GlobalSettings.globalManagerIds -> []`

Missing step: `Chat.accountantTelegramIds` (populated from verified @usernames, gh-68).

Correct chain: `managerTelegramIds -> accountantTelegramIds -> globalManagerIds -> []`

---

## Phase 1: Backend — Fix Resolution Chain (#212)

### 1.1 `backend/src/config/config.service.ts` (line 202-208)

Add `accountantTelegramIds` parameter to `getManagerIds()`:

```typescript
export async function getManagerIds(
  chatManagerIds?: string[] | null,
  accountantTelegramIds?: bigint[] | null
): Promise<string[]> {
  if (chatManagerIds && chatManagerIds.length > 0) {
    return chatManagerIds;
  }
  if (accountantTelegramIds && accountantTelegramIds.length > 0) {
    return accountantTelegramIds.map((id) => id.toString());
  }
  const settings = await getGlobalSettings();
  return settings.globalManagerIds;
}
```

Type note: `BigInt.toString()` is safe — no precision loss.

### 1.2 `backend/src/services/alerts/alert.service.ts` (line 496-523)

Update `getManagerIdsForChat()` to also select and check `accountantTelegramIds`:

```diff
  select: { managerTelegramIds: true },
+ select: { managerTelegramIds: true, accountantTelegramIds: true },
```

Add fallback step between manager and global checks:
```typescript
if (chat?.accountantTelegramIds && chat.accountantTelegramIds.length > 0) {
  return chat.accountantTelegramIds.map((id) => id.toString());
}
```

### 1.3 `backend/src/queues/sla-timer.worker.ts` (line 155-165)

Add accountant fallback between manager and global checks:

```typescript
// After line 159-160 (managerIds empty check):
if (alertManagerIds.length === 0) {
  const accountantIds = request.chat?.accountantTelegramIds ?? [];
  if (accountantIds.length > 0) {
    alertManagerIds = accountantIds.map((id) => id.toString());
  }
}
// Then existing global fallback...
```

Note: `request.chat` already has full Chat model via `include: { chat: true }`.

### 1.4 `backend/src/services/alerts/escalation.service.ts` (line 48-65)

Update `getManagerIdsForChat()` to also select `accountantTelegramIds` and pass to `getCachedManagerIds`:

```diff
- select: { managerTelegramIds: true },
+ select: { managerTelegramIds: true, accountantTelegramIds: true },
...
- return getCachedManagerIds(chat?.managerTelegramIds);
+ return getCachedManagerIds(chat?.managerTelegramIds, chat?.accountantTelegramIds);
```

### 1.5 `backend/src/services/feedback/alert.service.ts` (line 78-96, 181-194)

Update chat query (line 80-83) to also select `accountantTelegramIds`.
Update call at line 96: `getManagerIds(chat.managerTelegramIds, chat.accountantTelegramIds)`.
Update private `getManagerIds()` (line 181-194) to accept and check `accountantTelegramIds`.

### 1.6 `backend/src/api/trpc/routers/chats.ts` (line 383-424)

Update SLA-enable validation (line 383-404) and monitoring warning (line 406-424) to also check `accountantTelegramIds`:

```diff
  const chatManagers = existingChat.managerTelegramIds || [];
+ const accountantTgIds = existingChat.accountantTelegramIds || [];
  ...
- const hasManagers = chatManagers.length > 0 || globalManagers.length > 0;
+ const hasManagers = chatManagers.length > 0 || accountantTgIds.length > 0 || globalManagers.length > 0;
```

---

## Phase 2: Frontend — Chat Manager IDs (#211)

### 2.1 Backend: Add `managerTelegramIds` to update mutation input

File: `backend/src/api/trpc/routers/chats.ts` (line 324-344)

Add to input schema:
```typescript
managerTelegramIds: z
  .array(z.string().regex(/^\d+$/, 'Telegram ID должен быть числом'))
  .optional(),
```

Add to update data building (after line 427):
```typescript
if (input.managerTelegramIds !== undefined) {
  data.managerTelegramIds = input.managerTelegramIds;
}
```

### 2.2 Frontend: Add field + fix warning in `ChatSettingsForm.tsx`

File: `frontend/src/components/chats/ChatSettingsForm.tsx`

1. Add `accountantTelegramIds` to props (line 39-51)
2. Add `managerTelegramIds` to form schema (line 59-68) and defaults (line 76-82)
3. Add `managerTelegramIds` to initialData type
4. Add comma-separated input field for Telegram IDs (after accountant usernames field)
5. Fix warning banner (line 222) — hide when `accountantTelegramIds` is also populated:
   ```diff
   - {slaEnabled && (!managerTelegramIds || managerTelegramIds.length === 0) && (
   + {slaEnabled &&
   +   (!managerTelegramIds || managerTelegramIds.length === 0) &&
   +   (!accountantTelegramIds || accountantTelegramIds.length === 0) && (
   ```

Caller `ChatDetailsContent.tsx` must pass `accountantTelegramIds` and `managerTelegramIds` in initialData.

---

## Phase 3: Frontend — Global Manager IDs (#213)

### 3.1 New component: `SlaManagerSettingsForm.tsx`

File: `frontend/src/components/settings/SlaManagerSettingsForm.tsx`

Pattern: Copy from `NotificationSettingsForm.tsx` (same UX — comma-separated Telegram IDs calling `settings.updateGlobalSettings`).

Fields: Single input for `globalManagerIds` (comma-separated numeric IDs).
tRPC: `settings.updateGlobalSettings({ globalManagerIds: [...] })` — backend already supports this.

### 3.2 Add to Settings page

File: `frontend/src/app/settings/settings-page-content.tsx`

Add `SlaManagerSettingsForm` as a new section under "SLA и Рабочее время" divider (before `WorkingHoursForm`, line 76):

```tsx
<section className="buh-animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
  <SlaManagerSettingsForm />
</section>
```

### 3.3 Update GeneralSettingsForm warning (if it exists separately)

Update warning text to mention the new "Уведомления" section for configuration.

---

## Deferred Issues (Beads tasks only)

| Issue | Reason | Beads Priority |
|-------|--------|----------------|
| #206 | Separate scope, no schema change needed, implement after SLA cluster | P2 |
| #207 | Needs dedup key design decision, depends on SLA cluster | P3 |
| #208 | UX improvement, not blocking | P3 |
| #209 | Complex (15+ files, 2 migrations), needs full spec first | P4 |

---

## Verification

1. `npm run type-check` (backend + frontend)
2. `npm run build` (backend + frontend)
3. Manual verification of resolution chain logic:
   - Chat with `accountantTelegramIds=[12345]` + empty managers -> should resolve to `["12345"]`
   - Chat with `managerTelegramIds=["99999"]` + accountants -> should use `["99999"]` (override wins)
   - Both empty -> falls back to `globalManagerIds`
   - All empty -> returns `[]`
4. Frontend: ChatSettingsForm warning hides when accountants configured
5. Frontend: Global Settings has new SLA manager IDs field

## Files Modified

**Backend (Phase 1-2):**
- `backend/src/config/config.service.ts`
- `backend/src/services/alerts/alert.service.ts`
- `backend/src/queues/sla-timer.worker.ts`
- `backend/src/services/alerts/escalation.service.ts`
- `backend/src/services/feedback/alert.service.ts`
- `backend/src/api/trpc/routers/chats.ts`

**Frontend (Phase 2-3):**
- `frontend/src/components/chats/ChatSettingsForm.tsx`
- `frontend/src/components/chats/ChatDetailsContent.tsx` (pass new props)
- `frontend/src/components/settings/SlaManagerSettingsForm.tsx` (NEW)
- `frontend/src/app/settings/settings-page-content.tsx`
