---
report_type: code-review
generated: 2026-02-26T00:00:00Z
version: 2026-02-26
status: partial
agent: code-reviewer
branch: fix/sla-notification-managers
commit: 0cac6be
files_reviewed: 11
issues_found: 10
critical_count: 0
high_count: 3
medium_count: 5
low_count: 2
---

# Code Review Report: SLA Notification Fallback Fixes (gh-210)

**Generated**: 2026-02-26
**Status**: PARTIAL — no blocking issues, but 3 high-priority findings should be addressed before merge
**Branch**: `fix/sla-notification-managers`
**Commit**: `0cac6be`
**Files Reviewed**: 11 (6 backend, 5 frontend)

---

## Executive Summary

This PR introduces `accountantTelegramIds` as a middle tier in the SLA notification resolution
chain, filling a gap where chats that had accountants assigned (and thus `accountantTelegramIds`
populated) but no explicit `managerTelegramIds` and no `globalManagerIds` would silently drop SLA
notifications.

The approach is correct and the intent is well-executed across most of the codebase. The core
precedence chain (`managerTelegramIds > accountantTelegramIds > globalManagerIds`) is applied in
all five notification delivery sites. However, several consistency and quality issues were found,
including one DRY violation that is a source of future divergence risk, one UX gap in the warning
banner, and missing test coverage for the new accountant-suppresses-warning behaviour.

---

## Findings

### High Priority

---

#### H-1: DRY Violation — `getManagerIdsForChat` in `alerts/alert.service.ts` Does Not Delegate to `config.service.ts`

**File**: `backend/src/services/alerts/alert.service.ts`, lines 496–527
**Category**: Code Quality / Maintainability

`alerts/alert.service.ts` contains a private `getManagerIdsForChat` function that reimplements the
resolution chain in full — including the `globalSettings` DB query — instead of delegating to the
shared `getManagerIds` from `config.service.ts`. By contrast, `escalation.service.ts` correctly
calls `getCachedManagerIds` (the exported `getManagerIds` from `config.service.ts`).

Current code in `alerts/alert.service.ts`:

```typescript
async function getManagerIdsForChat(chatId: bigint): Promise<string[]> {
  // ...
  if (chat?.managerTelegramIds && chat.managerTelegramIds.length > 0) {
    return chat.managerTelegramIds;
  }
  if (chat?.accountantTelegramIds && chat.accountantTelegramIds.length > 0) {
    return chat.accountantTelegramIds.map((id) => id.toString());
  }
  const globalSettings = await prisma.globalSettings.findUnique({ ... });
  return globalSettings?.globalManagerIds ?? [];
}
```

`escalation.service.ts` (correct pattern):

```typescript
return getCachedManagerIds(chat?.managerTelegramIds, chat?.accountantTelegramIds);
```

`getCachedManagerIds` (`config.service.ts:getManagerIds`) already handles the full chain including
the global settings lookup. If the precedence logic changes again in the future, it now needs to be
updated in two places instead of one.

**Recommendation**: Refactor `alerts/alert.service.ts:getManagerIdsForChat` to call the shared
function:

```typescript
import { getManagerIds } from '../../config/config.service.js';

async function getManagerIdsForChat(chatId: bigint): Promise<string[]> {
  try {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { managerTelegramIds: true, accountantTelegramIds: true },
    });
    return getManagerIds(chat?.managerTelegramIds, chat?.accountantTelegramIds);
  } catch (error) {
    logger.error('Failed to get manager IDs for chat', { ... });
    return [];
  }
}
```

---

#### H-2: `sla-timer.worker.ts` Still Inlines the Full Resolution Chain Instead of Calling `getManagerIds`

**File**: `backend/src/queues/sla-timer.worker.ts`, lines 155–175
**Category**: Code Quality / DRY

The worker inlines the full three-step resolution chain rather than calling the centralised
`getManagerIds` from `config.service.ts`. The data it needs (`chat.managerTelegramIds`,
`chat.accountantTelegramIds`) is already fetched via `include: { chat: true }` at line 49.

Current inline code:

```typescript
const managerIds = request.chat?.managerTelegramIds ?? [];
let alertManagerIds = managerIds;

if (alertManagerIds.length === 0) {
  const accountantIds = request.chat?.accountantTelegramIds ?? [];
  if (accountantIds.length > 0) {
    alertManagerIds = accountantIds.map((id) => id.toString());
  }
}

if (alertManagerIds.length === 0) {
  const globalSettings = await prisma.globalSettings.findUnique({ where: { id: 'default' } });
  alertManagerIds = globalSettings?.globalManagerIds ?? [];
}
```

**Recommendation**: Replace with a single call:

```typescript
import { getManagerIds } from '../config/config.service.js';

const alertManagerIds = await getManagerIds(
  request.chat?.managerTelegramIds,
  request.chat?.accountantTelegramIds
);
```

This also removes a redundant `prisma.globalSettings.findUnique` DB call that `getManagerIds`
already makes internally, via the cached path.

---

#### H-3: Warning Banner Does Not React to `globalManagerIds` — Can Show False Positive

**File**: `frontend/src/components/chats/ChatSettingsForm.tsx`, lines 234–249
**Category**: UX / Correctness

The warning banner logic is:

```tsx
{slaEnabled &&
  (!formManagerIds || formManagerIds.length === 0) &&
  (!managerTelegramIds || managerTelegramIds.length === 0) &&
  (!accountantTelegramIds || accountantTelegramIds.length === 0) && (
    <WarningBanner />
  )}
```

This hides the warning when `formManagerIds` (in-progress form edits), `managerTelegramIds` (prop
from server), or `accountantTelegramIds` (prop from server) are non-empty — but it ignores whether
`globalManagerIds` are configured. A chat with no per-chat managers or accountants but with global
managers configured will still show the warning banner, telling the user "SLA notifications will
not be delivered" even though they will be.

The backend validation in `chats.ts` correctly checks `globalManagers.length > 0` as a third
condition before throwing. The frontend banner should mirror this logic.

**Recommendation**: Pass `globalManagerIds` down as a prop (it is available from
`trpc.settings.getGlobalSettings`) or fetch it inside `ChatSettingsForm` to include in the banner
condition. If adding a fetch is undesirable, at minimum update the warning text to say "no
per-chat managers or accountants configured — will fall back to global settings" so the user
understands the behaviour rather than seeing a potentially misleading alarm.

---

### Medium Priority

---

#### M-1: `feedback/alert.service.ts` Duplicates `getManagerIds` — Should Import from `config.service.ts`

**File**: `backend/src/services/feedback/alert.service.ts`, lines 183–204
**Category**: Code Quality / DRY

`feedback/alert.service.ts` defines its own private `getManagerIds` function with identical logic
to `config.service.ts:getManagerIds`. This is a third copy of the resolution chain (alongside the
inline version in `sla-timer.worker.ts`).

The function signatures differ only cosmetically (`chatManagerIds: string[]` vs
`chatManagerIds?: string[] | null`). The `feedback/alert.service.ts` version already calls
`prisma.globalSettings.findUnique` directly whereas the `config.service.ts` version would handle
that.

**Recommendation**: Import `getManagerIds` from `config.service.ts` and remove the local copy.
The call site (`sendLowRatingAlert`) passes `chat.managerTelegramIds` and
`chat.accountantTelegramIds` — these align with the shared function's signature.

---

#### M-2: `SlaManagerSettingsForm` Has No Zod Validation for Individual IDs in the `ids` Field

**File**: `frontend/src/components/settings/SlaManagerSettingsForm.tsx`, lines 15–17
**Category**: Validation / UX

The form schema is:

```typescript
const formSchema = z.object({
  ids: z.string().describe('Comma separated IDs'),
});
```

Validation happens only at submit time in `onSubmit` via a `.filter((s) => /^\d+$/.test(s))`
regex. Invalid tokens are silently discarded. If a user enters `"123456, abc, 789"` the form
accepts it (Zod passes — the raw string is valid), and `abc` is silently dropped during the split.
The user receives no feedback that part of their input was ignored.

By contrast, `ChatSettingsForm` also silently drops non-numeric tokens in its `onChange` handler —
but at least that behaviour is live-filtered so the field never contains invalid values.

**Recommendation**: Either:
1. Apply the filtering in an `onChange` handler so the field self-corrects as the user types
   (matching `ChatSettingsForm` behaviour), or
2. Add a refinement to the Zod schema that validates each comma-separated token is numeric and
   surfaces an error message.

---

#### M-3: `SlaManagerSettingsForm` Uses `form.reset()` in a `useEffect` Without Cleanup — Potential Stale Closure

**File**: `frontend/src/components/settings/SlaManagerSettingsForm.tsx`, lines 42–48
**Category**: Code Quality

```typescript
React.useEffect(() => {
  if (settings) {
    form.reset({ ids: settings.globalManagerIds.join(', ') });
  }
}, [settings, form]);
```

This pattern is correct but `form` from `react-hook-form` is a stable reference and will not
trigger re-runs in practice. However, `NotificationSettingsForm` uses the identical pattern so
this is consistent within the codebase. No code change is required, but a comment noting why
`form` is in the dependency array (lint requirement) would aid future readers.

Minor point: the effect will reset the form on every query re-fetch (e.g. after `invalidate()`),
discarding any unsaved user edits. This matches `NotificationSettingsForm` behaviour so it is
intentional, but it is a UX consideration worth documenting.

---

#### M-4: `chats.ts` Validation Block Reads `existingChat.managerTelegramIds` Instead of Applying Input

**File**: `backend/src/api/trpc/routers/chats.ts`, lines 387–407
**Category**: Logic / Edge Case

The "validate before enabling SLA" block checks `existingChat.managerTelegramIds` (the existing
DB value) rather than considering what the user has just submitted as `input.managerTelegramIds`.

```typescript
if (input.slaEnabled === true && existingChat.slaEnabled === false) {
  const chatManagers = existingChat.managerTelegramIds || [];  // <-- uses DB value
  // ...
  const hasRecipients = chatManagers.length > 0 || accountantTgIds.length > 0 || ...
```

A user who submits `{ slaEnabled: true, managerTelegramIds: ['123456789'] }` in a single request
(enabling SLA and setting managers at the same time, both of which are now supported) will
incorrectly get a `BAD_REQUEST` error if no managers were configured beforehand, even though the
submitted data would be valid after the update.

**Recommendation**: Update the check to prefer `input.managerTelegramIds` if present:

```typescript
const chatManagers =
  input.managerTelegramIds !== undefined
    ? input.managerTelegramIds
    : existingChat.managerTelegramIds || [];
```

---

#### M-5: Missing Test Cases for Warning Banner with Accountant IDs Populated

**File**: `frontend/src/components/chats/__tests__/ChatSettingsForm.test.tsx`
**Category**: Testing

The updated warning banner condition has three suppression paths: `formManagerIds`,
`managerTelegramIds` (prop), and `accountantTelegramIds` (prop). The test suite covers:

- Show warning when all three are empty and SLA is enabled (line 188)
- Suppress warning when `managerTelegramIds` prop is non-empty (line 219)
- Suppress warning when SLA is disabled (line 204)

Missing test cases:
- Warning is suppressed when `accountantTelegramIds` prop is non-empty (the new suppression path)
- Warning is suppressed when `formManagerIds` (in-form edit) is non-empty (the live-update path)

**Recommendation**: Add the following two test cases to the warning banner `describe` block:

```typescript
it('should NOT show warning when SLA enabled and accountants configured', () => {
  render(
    <ChatSettingsForm
      chatId={123}
      managerTelegramIds={[]}
      accountantTelegramIds={[123456789]}
      initialData={{ ...DEFAULT_INITIAL_DATA, slaEnabled: true }}
    />
  );
  expect(screen.queryByText('Менеджеры для уведомлений не настроены')).not.toBeInTheDocument();
});

it('should hide warning when user types a manager ID into the form field', async () => {
  const user = userEvent.setup({ delay: null });
  render(
    <ChatSettingsForm
      chatId={123}
      managerTelegramIds={[]}
      accountantTelegramIds={[]}
      initialData={{ ...DEFAULT_INITIAL_DATA, slaEnabled: true }}
    />
  );
  expect(screen.getByText('Менеджеры для уведомлений не настроены')).toBeInTheDocument();
  await user.type(screen.getByPlaceholderText('123456789, 987654321'), '111222333');
  expect(screen.queryByText('Менеджеры для уведомлений не настроены')).not.toBeInTheDocument();
});
```

---

### Low Priority

---

#### L-1: Warning Banner Text Does Not Mention Accountants as a Resolution Path

**File**: `frontend/src/components/chats/ChatSettingsForm.tsx`, lines 241–246
**Category**: UX / Accuracy

The warning banner text still reads:

> "SLA уведомления не будут доставлены, так как не указаны Telegram ID менеджеров.
> Настройте менеджеров в Глобальных настройках или добавьте их для этого чата."

The banner only appears when `managerTelegramIds`, `accountantTelegramIds`, and `formManagerIds`
are all empty — so when it is visible the accountant path is genuinely not configured. However,
the instructional text does not mention the accountant route as a valid configuration path (adding
accountants via `@username` in the form). A user might not know they can resolve the warning by
assigning accountants.

**Recommendation**: Extend the description:

> "Настройте менеджеров в Глобальных настройках, добавьте их для этого чата, или назначьте
> бухгалтера через поле @username ниже."

---

#### L-2: `SlaManagerSettingsForm` Does Not Show Current IDs as a Read-Only Preview Before Load

**File**: `frontend/src/components/settings/SlaManagerSettingsForm.tsx`
**Category**: UX

When `isLoading` is true the component renders a full-card spinner. Once data arrives the form
resets to show the loaded IDs. This is consistent with `NotificationSettingsForm`, so it follows
the existing pattern. No change is strictly required. However, unlike `NotificationSettingsForm`,
this form manages IDs that directly affect SLA delivery criticality. A loading skeleton with
placeholder text would reduce perceived latency for settings pages where the data is fetched
frequently.

This is a polish item only.

---

## Consistency Check: The Five Backend Resolution Implementations

| Location | How chain is resolved | Uses shared `getManagerIds`? |
|---|---|---|
| `config.service.ts:getManagerIds` | Source of truth | N/A (is the function) |
| `escalation.service.ts:getManagerIdsForChat` | Calls `getCachedManagerIds` (= `getManagerIds`) | Yes |
| `feedback/alert.service.ts:getManagerIds` (private) | Inline duplicate with same logic | No — should import |
| `alerts/alert.service.ts:getManagerIdsForChat` | Inline duplicate with same logic | No — should import |
| `sla-timer.worker.ts` (inline) | Inline duplicate with same logic | No — should import |

Three of five delivery sites duplicate the logic instead of delegating to the shared function.
`escalation.service.ts` is the only site that correctly delegates. This is the core DRY concern
of the PR (H-1, H-2, M-1).

---

## Type Safety Review

**BigInt-to-String conversion**: All conversion sites consistently use `.toString()` / `.map((id) => id.toString())`. No unsafe coercion or precision-loss risk detected for Telegram user IDs within the safe integer range.

**tRPC contract alignment**:
- `getById` output schema declares `accountantTelegramIds: z.array(z.number())` (line 167) and `managerTelegramIds: z.array(z.string())` (line 172). This asymmetry (numbers vs strings) is pre-existing and intentional — `accountantTelegramIds` are BigInt → number via `safeNumberFromBigInt`, while `managerTelegramIds` are stored as `String[]` in the DB.
- `ChatSettingsForm` receives `accountantTelegramIds: number[]` (from the query) and uses them only for the banner condition check, not for conversion, which is correct.
- The `update` mutation input for `managerTelegramIds` is `z.array(z.string())` backend and the frontend form sends `string[]` — aligned.

**Frontend `chatSettingsSchema`**: The `managerTelegramIds` field is `z.array(z.string()).optional()` with no numeric content validation. The backend validates with `/^\d+$/` per-element. The frontend `onChange` handler also filters non-numeric tokens before putting them into the field. This is a two-layer defence which is acceptable, but Zod schema validation in the frontend is absent (see M-2 for the `SlaManagerSettingsForm` version of this issue — the `ChatSettingsForm` version is better because filtering happens live).

---

## Security Review

- **Input validation**: `managerTelegramIds` on the backend tRPC route validates each element with `z.string().regex(/^\d+$/)` — this is correct and prevents injection of non-numeric values.
- **No hardcoded credentials found**.
- **No XSS risk** in the new form fields — values are managed via controlled React components.
- **Privilege check**: The `chats.update` mutation does not check whether the user has permission to set `managerTelegramIds` beyond the existing `requireChatAccess`. This is pre-existing behaviour and consistent with other fields, so not flagged as a new issue.

---

## Performance Review

- `alerts/alert.service.ts` and `sla-timer.worker.ts` each issue a `prisma.globalSettings.findUnique` that could be avoided by delegating to `config.service.ts:getManagerIds` which uses the cached config path. This is low-traffic (one per SLA breach event) so not a critical performance issue, but the fix for H-1 and H-2 would naturally eliminate these extra queries.
- `chats.ts` validation logic issues two `tx.globalSettings.findUnique` calls when updating a chat: once for the enable-SLA guard (lines 391–395) and once for the monitoring warn (lines 417–421). These could be deduplicated into a single read. Low priority given this runs inside a transaction.

---

## Recommendations Summary

### Must Address Before Merge

None blocking, but the following three should be addressed:

1. **(H-1)** Refactor `alerts/alert.service.ts:getManagerIdsForChat` to delegate to `config.service.ts:getManagerIds`.
2. **(H-2)** Refactor `sla-timer.worker.ts` inline chain to call `getManagerIds` from `config.service.ts`.
3. **(H-3)** Fix the warning banner false-positive when `globalManagerIds` are configured but no per-chat recipients exist.

### Recommended Before Merge

4. **(M-1)** Remove the private `getManagerIds` from `feedback/alert.service.ts` and import from `config.service.ts`.
5. **(M-4)** Fix the SLA-enable guard in `chats.ts` to consider `input.managerTelegramIds` when checking recipients.
6. **(M-5)** Add two missing test cases for the warning banner suppression paths.

### Follow-up (Future Sprint)

7. **(M-2)** Add visible validation feedback in `SlaManagerSettingsForm` for non-numeric ID tokens.
8. **(L-1)** Update warning banner text to mention accountant assignment as a resolution path.
9. Deduplicate the double `globalSettings` query in `chats.ts` update mutation validation.

---

## Artifacts

- This report: `docs/reports/code-review/2026-02/sla-notification-fixes-review.md`
- PR: `fix/sla-notification-managers` (gh-210)

---

**Review complete.** The PR implements the correct behaviour and the resolution chain is logically
sound at all five delivery points. The primary concern is that three of those five points duplicate
logic that belongs in the single shared `getManagerIds` function, creating a maintenance hazard.
No critical or security-blocking issues were found.
