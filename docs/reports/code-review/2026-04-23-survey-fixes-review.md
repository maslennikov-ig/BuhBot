# Code Review: Survey Fixes + Secret Scanning (2026-04-23)

**Branch:** `fix/buh-idid-survey-list-responses`
**Commits reviewed:** `1853a5d`, `1cd83af`, `1937d0e`
**Reviewer:** Claude Sonnet 4.6 (automated review)
**Date:** 2026-04-23

---

## Executive Summary

- **Overall verdict:** ACCEPT WITH CHANGES
- **Critical issues:** 0
- **Major issues:** 3
- **Minor issues:** 4
- **Suggestions:** 3

The core logic for user-level response rate calculation (gh-334) is **correct** — the formula
`voters / totalRecipientsCount * 100` is implemented properly and protected against division by
zero. All 722 backend tests pass. TypeScript type-check exits cleanly (exit 0).

Three **major** issues require attention before or shortly after merge: an N+1 query pattern in
`aggregateSurveysInternal`, a semantic mismatch between the `list` and `getById` response rate
formulas, and significant gaps in the secret detection regex that leave the most critical
credentials (Supabase JWT, OpenAI keys, AWS, Slack) undetected.

---

## Findings (by priority)

---

### Major Issues (should fix before or shortly after merge)

---

#### M-1: N+1 queries in `aggregateSurveysInternal` for `chatMessage` lookups

**File:** `backend/src/services/feedback/vote.service.ts:464-477`

**Problem:**
The loop iterates over every survey that has votes and issues a separate
`prisma.chatMessage.findMany` call per survey:

```typescript
for (const [sid, s] of sums) {            // N iterations (surveys with votes)
  if (s.chatIds.size > 0) {
    const recipients = await prisma.chatMessage.findMany({   // 1 DB round-trip each
      where: { chatId: { in: Array.from(s.chatIds) }, isAccountant: false },
      select: { telegramUserId: true },
      distinct: ['telegramUserId'],
    });
    totalRecipientsMap.set(sid, recipients.length);
  }
}
```

For a page of 20 surveys where all have votes: **21 DB round-trips** (1 for votes + 20 for
chatMessages). At `pageSize: 100` (the max): **101 round-trips per list request**.

**Impact:**
High latency on the survey list page as the survey count grows. With default `pageSize: 20` this is
acceptable today, but as survey history grows this becomes visible.

**Fix:**
Collect all `chatIds` from all surveys into one set, make a single query, then distribute results
by `chatId` in JavaScript:

```typescript
// Collect all chatIds across all surveys
const allChatIds = new Set<bigint>();
for (const s of sums.values()) {
  for (const cid of s.chatIds) allChatIds.add(cid);
}

// Single query for all chats at once
const allRecipients = allChatIds.size > 0
  ? await prisma.chatMessage.findMany({
      where: { chatId: { in: Array.from(allChatIds) }, isAccountant: false },
      select: { chatId: true, telegramUserId: true },
      distinct: ['chatId', 'telegramUserId'],
    })
  : [];

// Build chatId → Set<telegramUserId> map
const chatUserMap = new Map<bigint, Set<bigint>>();
for (const row of allRecipients) {
  if (!chatUserMap.has(row.chatId)) chatUserMap.set(row.chatId, new Set());
  chatUserMap.get(row.chatId)!.add(row.telegramUserId);
}

// Per-survey count: union of distinct users across all its chats
const totalRecipientsMap = new Map<string, number>();
for (const [sid, s] of sums) {
  const uniqueUsers = new Set<bigint>();
  for (const cid of s.chatIds) {
    for (const uid of chatUserMap.get(cid) ?? []) uniqueUsers.add(uid);
  }
  if (uniqueUsers.size > 0) totalRecipientsMap.set(sid, uniqueUsers.size);
}
```

This reduces the DB round-trips from `1 + N` to `2` regardless of how many surveys have votes.

**Note:** The `aggregateInternal` path (used by `getById`) already uses a single query — no N+1
there.

**Priority:** P1

---

#### M-2: Missing composite index for the `chatMessage` DISTINCT query

**File:** `backend/prisma/schema.prisma:897` (ChatMessage model)

**Problem:**
The new query pattern is:

```sql
SELECT DISTINCT telegram_user_id
FROM chat_messages
WHERE chat_id IN (...) AND is_accountant = false
```

The existing index is:

```
@@index([chatId, isAccountant, telegramDate], name: "idx_chat_messages_chat_accountant_tgdate")
```

The `telegramDate` column at the end means the index cannot be used as a covering index for the
DISTINCT on `telegramUserId` — PostgreSQL must fetch `telegramUserId` from the heap and then
deduplicate. For chats with thousands of messages (active buhbot chats), this is a full index scan
on `chatId + isAccountant`, then a sort/hash for DISTINCT.

**Impact:**
Medium. With the N+1 fix from M-1 already reducing to one query, a missing covering index becomes
the primary performance bottleneck. A chat with 10,000 messages will scan all rows matching the
`chatId + isAccountant` condition.

**Fix:**
Add a covering index that includes `telegramUserId`:

```prisma
// In ChatMessage model
@@index([chatId, isAccountant, telegramUserId], name: "idx_chat_messages_recipients")
```

This allows PostgreSQL to satisfy the full query from the index without a heap fetch, and the
DISTINCT can be computed as an index-only scan.

**Priority:** P1

---

#### M-3: `responseRate` formula inconsistency between `list` and `getById`

**File:** `backend/src/api/trpc/routers/survey.ts:191-194` (list) vs `293-295` (getById)

**Problem:**
The two procedures calculate `responseRate` using different numerators:

**list** (`survey.ts:191-194`):
```typescript
responseRate:
  totalRecipients > 0
    ? Math.round(((agg?.count ?? 0) / totalRecipients) * 100 * 10) / 10
    : 0,
```
Numerator: `agg?.count ?? 0` — always the live vote count from `SurveyVote`.

**getById** (`survey.ts:293-295`):
```typescript
responseRate:
  (agg.totalRecipientsCount ?? 0) > 0
    ? Math.round((effectiveResponseCount / (agg.totalRecipientsCount ?? 1)) * 100 * 10) / 10
    : 0,
```
Numerator: `effectiveResponseCount` — falls back to the legacy `survey.responseCount` column when
`agg.count = 0` (surveys that pre-date the `SurveyVote` store, gh-294).

**Scenario that causes divergence:** A pre-gh-294 survey with `survey.responseCount = 3` but no
`SurveyVote` rows. The list page shows `responseRate = 0%` (no live votes); the detail page shows
`responseRate = 3 / totalRecipientsCount * 100` (legacy numerator mixed with new denominator).

**Additional code smell** (`survey.ts:294`):
```typescript
Math.round((effectiveResponseCount / (agg.totalRecipientsCount ?? 1)) * 100 * 10) / 10
```
The outer guard at line 293 already ensures `totalRecipientsCount > 0`, so `?? 1` is
dead code — it will never evaluate to 1 in this branch. It creates false confidence
that division by zero is handled here.

**Fix:**
Either accept the legacy fallback and apply the same pattern to `list` (for backwards compat with
old surveys), or explicitly document that `responseRate` is 0 for pre-gh-294 surveys. The simpler
path is to remove the dead `?? 1` and add a comment explaining the semantic:

```typescript
// getById: legacy surveys (no SurveyVote rows) show responseRate=0,
// consistent with the list view.
responseRate:
  agg.count > 0 && (agg.totalRecipientsCount ?? 0) > 0
    ? Math.round((agg.count / agg.totalRecipientsCount!) * 100 * 10) / 10
    : 0,
```

**Priority:** P1

---

### Minor Issues (nice to have before merge, or in next iteration)

---

#### m-1: Secret detection regex misses the most critical credentials

**File:** `.husky/pre-commit:4`

**Problem:**
The regex pattern:
```
(service_role[_A-Za-z0-9]{20}|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82}|
AAAB[0-9A-Za-z]{3}[0-9A-Za-z+/]{178}|sk_[a-z]+_[A-Za-z0-9]{20}|pk_[a-z]+_[A-Za-z0-9]{20})
```

**Gaps verified with test inputs:**

| Credential | Pattern | Detected? |
|---|---|---|
| Supabase service role JWT (`eyJhbGci...`) | `service_role[_A-Za-z0-9]{20}` | **No** — actual JWT starts with `eyJ`, the word `service_role` only appears in the decoded payload |
| OpenAI API key (`sk-proj-...`) | `sk_[a-z]+_[A-Za-z0-9]{20}` | **No** — OpenAI uses `sk-proj-` (hyphen, not underscore) |
| AWS access key (`AKIAIOSFODNN7...`) | none | **No** |
| Slack bot token (`xoxb-...`) | none | **No** |
| Stripe key (correct format) | `sk_[a-z]+_[A-Za-z0-9]{20}` | **Yes** (20 chars exact match) |
| GitHub PAT `ghp_` (36 chars) | `ghp_[A-Za-z0-9]{36}` | **Yes** |

The `AAAB[0-9A-Za-z]{3}[0-9A-Za-z+/]{178}` pattern (185 chars total) does not correspond to any
common modern credential format and appears to be a legacy or incorrectly specified pattern.

**Impact:**
A staged `.env` containing the real Supabase JWT or an OpenAI key would NOT be blocked. The hook
provides false confidence.

**Fix:**
Add missing patterns (and fix the Supabase pattern to match actual JWT format):

```bash
if git diff --cached -- ':!.husky' | grep -qiE \
  '(eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|'\
  'ghp_[A-Za-z0-9]{36}|'\
  'github_pat_[A-Za-z0-9_]{82}|'\
  'sk-proj-[A-Za-z0-9_-]{48,}|'\
  'sk_live_[A-Za-z0-9]{20,}|pk_live_[A-Za-z0-9]{20,}|'\
  'AKIA[0-9A-Z]{16}|'\
  'xoxb-[0-9A-Za-z-]+|xoxp-[0-9A-Za-z-]+)'\
; then
  echo "Possible secret detected in staged changes. Aborting."
  exit 1
fi
```

**Long-term recommendation:** Replace the custom regex with `gitleaks` or `detect-secrets` as a
pre-commit hook — these tools have maintained, tested pattern libraries covering 100+ secret types.

**Priority:** P2

---

#### m-2: Missing test coverage for `aggregateSurvey` (getById path) `totalRecipientsCount`

**File:** `backend/src/services/feedback/__tests__/vote.service.test.ts`

**Problem:**
TC-15 tests `totalRecipientsCount` exclusively through `aggregateSurveys` (the batch path used by
`list`). The `aggregateSurvey` function (used by `getById`) has its own independent implementation
in `aggregateInternal` but no test verifies that `totalRecipientsCount` is populated there.

If `aggregateInternal` had a bug in the `chatIds` collection or the `chatMessage.findMany` call,
no test would catch it — all test assertions for `totalRecipientsCount` would still pass.

**Fix:**
Add one test to the `aggregateSurvey / aggregateDelivery` suite:

```typescript
it('returns totalRecipientsCount for aggregateSurvey (getById path)', async () => {
  const chatId = BigInt(300);
  seedChatMessage(chatId, BigInt(10), false);
  seedChatMessage(chatId, BigInt(11), false);
  seedChatMessage(chatId, BigInt(99), true); // accountant, excluded

  seedDelivery('delivery-1', 'survey-1', 'active', chatId);
  await submitVote({ deliveryId: 'delivery-1', telegramUserId: BigInt(10), rating: 4 });

  const agg = await aggregateSurvey('survey-1');
  expect(agg.count).toBe(1);
  // totalRecipientsCount: 2 non-accountant users in the chat
  expect(agg.totalRecipientsCount).toBe(2);
});
```

**Priority:** P2

---

#### m-3: Misleading commit message for `1937d0e`

**Problem:**
Commit `1937d0e` (message: "chore: add secret detection pattern to pre-commit hook (buh-vc8y)")
also modifies `vote.service.ts` with the spread-based fix for `exactOptionalPropertyTypes`:

```
.husky/pre-commit                             | 6 ++++++
backend/src/services/feedback/vote.service.ts | 9 +++++++--
```

The type-safety fix in `vote.service.ts` is functionally different from the pre-commit hook change
and belongs in a separate commit. This makes it difficult to bisect or revert cleanly.

**Impact:**
Low. The code is correct in both files. This is a process/hygiene issue.

**Fix:**
In future work, keep unrelated changes in separate commits. No code change needed here.

**Priority:** P3

---

#### m-4: `survey-detail-content.tsx` — `+45% average rating` bug is NOT fixed in these commits

**File:** `frontend/src/app/settings/survey/[id]/survey-detail-content.tsx:451-457`

**Problem:**
The review request states "Fixed +45% rating display" and lists `survey-detail-content.tsx` as a
reviewed file, but this file does **not appear in any of the three commits** (`1853a5d`, `1cd83af`,
`1937d0e`). The file is identical on `main` and on this branch.

The current code:
```typescript
change={
  surveyData.averageRating
    ? {
        value: Math.round(surveyData.averageRating * 10),  // 4.5 → 45
        label: 'ср. оценка',
        type: surveyData.averageRating >= 4 ? 'increase' : 'neutral',
      }
    : undefined
}
```

`StatCard` always appends `%` to `change.value` (line 95 of `StatCard.tsx`):
```tsx
{change.type === 'increase' && '+'}{change.value}%
```

For `averageRating = 4.5` → value 45 → displays **"+45%"**. The visual bug is still present.

**Fix:**
Either display the raw average rating directly (e.g., `value: surveyData.averageRating.toFixed(1)`
with `label: '⭐ ср. оценка'`) without using the `change` slot, or add a dedicated non-percentage
slot to `StatCard`.

```typescript
// Option A: move averageRating out of "change" into main value
// Only show responseRate in this card, add separate card for rating
// Option B: Display as "4.5 ср. оценка" without the % suffix
value: surveyData.averageRating
  ? `${surveyData.averageRating.toFixed(1)} ★`
  : '—',
// and remove the change prop entirely
```

**Priority:** P2 (visual bug still in production UI, regression not introduced by these commits
but should be tracked separately)

---

### Suggestions (future improvements)

---

#### S-1: Use `COUNT(DISTINCT telegram_user_id)` raw SQL instead of `findMany + .length`

**File:** `backend/src/services/feedback/vote.service.ts:468-476` and `537-545`

The current approach fetches all `{ telegramUserId }` rows from `chatMessage` and counts them in
JS. For a large chat this transfers N rows over the wire to count them. A raw SQL approach:

```typescript
const result = await prisma.$queryRaw<[{ cnt: bigint }]>`
  SELECT COUNT(DISTINCT telegram_user_id)::bigint AS cnt
  FROM chat_messages
  WHERE chat_id = ANY(${chatIds}::bigint[])
    AND is_accountant = false
`;
totalRecipientsCount = Number(result[0]?.cnt ?? 0);
```

This pushes the deduplication work to PostgreSQL and returns a single integer. Relevant once the
N+1 fix (M-1) is applied — at that point a single query covers all chats.

---

#### S-2: Guard `batchSize` parameter against zero or negative values

**File:** `backend/src/services/feedback/vote.service.ts:368-370`

```typescript
export async function aggregateSurveys(
  surveyIds: string[],
  batchSize: number = 100
): Promise<Map<string, SurveyAggregate>> {
```

If a caller passes `batchSize = 0`, the loop `for (let i = 0; i < N; i += 0)` creates an infinite
loop. Add a guard:

```typescript
const effectiveBatchSize = Math.max(1, Math.floor(batchSize));
```

---

#### S-3: Consider renaming `respondedDeliveryCount` vs `totalRecipientsCount` in JSDoc

**File:** `backend/src/services/feedback/vote.service.ts:82-89`

The property `respondedDeliveryCount` counts deliveries that have at least one active vote (the
numerator of a delivery-level rate). `totalRecipientsCount` counts distinct users in delivery chats
(the denominator of the user-level rate). The asymmetry — one is a numerator, the other a
denominator — is not obvious from the names alone.

Consider adding a usage example in the JSDoc:

```typescript
/**
 * responseRate = count / totalRecipientsCount * 100  (user-level %)
 * deliveryRate = respondedDeliveryCount / deliveriesTotal * 100  (not computed here)
 */
```

---

## Test Coverage Analysis

| Test | Coverage |
|---|---|
| `submitVote` — create / idempotent / update / reactivate / closed | Full |
| `removeVote` — active→removed / no-op (missing) / no-op (already removed) | Full |
| `aggregateDelivery` / `aggregateSurvey` — count/avg/dist/removed exclusion | Partial — no `totalRecipientsCount` test for `aggregateSurvey` (see m-2) |
| `aggregateSurveys` — TC-1 through TC-15 | Full; TC-15 covers `totalRecipientsCount` for batch path |
| `aggregateSurveys` — isAccountant exclusion in batch | Full (TC-15) |
| `aggregateSurveys` — chunking (TC-13 batchSize=50 with 250 IDs) | Full |
| `aggregateSurveys` — concurrent calls (TC-9, TC-9b) | Full |
| Edge case: `chatIds.size = 0` for survey with no deliveries | Not covered — safe by inspection but no explicit test |
| `getById` responseRate with `totalRecipientsCount` | Not covered |

**Regression:** 722/722 tests pass. No regressions introduced.

---

## Performance Analysis

### `list` procedure (with `aggregateSurveys`)

**Current query plan per request** (pageSize=20, all surveys have votes):

1. `feedbackSurvey.count` — 1 query
2. `feedbackSurvey.findMany` — 1 query
3. `surveyVote.findMany` (state=active, surveyId IN ...) — 1 query
4. `chatMessage.findMany` × N (one per survey with votes) — **N+1 problem**

With M-1 fix applied:
- Step 4 becomes 1 query → total 4 queries per list request regardless of page size.

### `getById` procedure (with `aggregateSurvey`)

1. `feedbackSurvey.findUnique` — 1 query
2. `surveyDelivery.groupBy` — 1 query
3. `surveyDelivery.findMany` (get chatIds) — 1 query
4. `surveyVote.findMany` — 1 query
5. `chatMessage.findMany` (all chats in one query) — 1 query

Total: 5 queries. No N+1. Acceptable.

### Index situation for chatMessage DISTINCT query

The query `WHERE chatId IN (...) AND isAccountant = false` with `DISTINCT telegramUserId`:

- Existing: `idx_chat_messages_chat_accountant_tgdate(chatId, isAccountant, telegramDate)`
- This index can filter by `chatId + isAccountant` but `telegramUserId` is not covered.
- For DISTINCT on `telegramUserId`, PostgreSQL must fetch rows from heap and sort/hash.
- **Missing index:** `(chatId, isAccountant, telegramUserId)` — see M-2.

---

## Security Analysis

### Pre-commit secret detection

| Pattern | Intended target | Works? |
|---|---|---|
| `service_role[_A-Za-z0-9]{20}` | Supabase service role key | **No** — real key is a JWT (`eyJ...`), `service_role` only appears in decoded payload |
| `ghp_[A-Za-z0-9]{36}` | GitHub Personal Access Token (classic) | Yes |
| `github_pat_[A-Za-z0-9_]{82}` | GitHub Fine-grained PAT | Yes |
| `AAAB[0-9A-Za-z]{3}[0-9A-Za-z+/]{178}` | Unknown — 185 chars | Likely legacy GitLab token format; unverified |
| `sk_[a-z]+_[A-Za-z0-9]{20}` | Stripe secret/public keys | Partial — matches `sk_live_` and `sk_test_` correctly (20 chars) |
| `pk_[a-z]+_[A-Za-z0-9]{20}` | Stripe publishable keys | Partial — same caveat |

**Not covered:** OpenAI (`sk-proj-`, `sk-`), AWS (`AKIA`, `aws_secret_access_key`),
Slack (`xoxb-`, `xoxp-`), Telegram bot tokens (`[0-9]{8,10}:[A-Za-z0-9_-]{35}`).

**Protection for `.env` files:** `.gitignore` correctly excludes `.env` and `.env.local`.
`.env.example` files contain only placeholder values — no real credentials.

**CI security scan:** The `ci.yml` has a `security-scan` job that runs `npm audit` — this covers
dependency vulnerabilities but does NOT scan for committed secrets.

---

## Recommended Follow-up Tasks

| Task | Priority | Issue |
|---|---|---|
| Fix N+1 in `aggregateSurveysInternal` — batch chatMessage queries | P1 | M-1 |
| Add index `(chatId, isAccountant, telegramUserId)` on `chat_messages` | P1 | M-2 |
| Unify `responseRate` formula between `list` and `getById` | P1 | M-3 |
| Fix `+45%` average rating display in `survey-detail-content.tsx` | P2 | m-4 |
| Add `totalRecipientsCount` test for `aggregateSurvey` (getById path) | P2 | m-2 |
| Replace custom regex in pre-commit with `gitleaks` or `detect-secrets` | P2 | m-1 |
| Add `batchSize <= 0` guard in `aggregateSurveys` | P3 | S-2 |

---

## Artifacts

- Report: `docs/reports/code-review/2026-04-23-survey-fixes-review.md`
- Commits reviewed: `1853a5d`, `1cd83af`, `1937d0e`
- Test run: 722/722 passed
- Type-check: exit 0 (clean)
