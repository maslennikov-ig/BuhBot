# Plan: Process GitHub Issues #332, #334, #333

## Context

Three open issues from `/settings/survey` area. Issues #334 and #333 share the same root cause (data-source divergence after gh-294 migration to `SurveyVote`). #332 is a UI alignment bug independent of the others.

**Execution order (per user instruction):**
- #332 — independently (parallel with #334→#333 chain)
- #334 — first in the survey-data chain
- #333 — after #334 (both touch the same files in `survey.ts`)

---

## Priority Scores

| Rank | Issue | Title | Sev | Imp | Lkh | Score | Priority |
|------|-------|-------|-----|-----|-----|-------|----------|
| 1 | #334 | Response % exceeds 100% | 7 | 7 | 10 | **24** | P1 |
| 2 | #333 | List shows 0 responses/0% | 7 | 7 | 10 | **24** | P1 |
| 3 | #332 | Calendar day numbers misaligned | 2 | 3 | 10 | **15** | P2 |

---

## Phase 1: Beads Setup

Create epic + 3 tasks before coding:

```bash
bd create --title="Fix survey issues: calendar alignment + response rate metrics" --type=epic --priority=1
# → save as <epic-id>

# Task 1 (P1) — independent
bd create --title="gh-332: Fix calendar day number alignment in survey date picker" \
  --type=bug --priority=2 --external-ref="gh-332" --deps parent:<epic-id>
# → buh-A

# Task 2 (P1) — must be done first
bd create --title="gh-334: Fix survey response percentage exceeding 100%" \
  --type=bug --priority=1 --external-ref="gh-334" --deps parent:<epic-id>
# → buh-B

# Task 3 (P1) — after task 2
bd create --title="gh-333: Fix survey list showing 0 responses while detail shows correct" \
  --type=bug --priority=1 --external-ref="gh-333" --deps parent:<epic-id>
# → buh-C

bd dep add <buh-C> <buh-B>  # #333 depends on #334
```

---

## Issue #332 — Calendar Alignment (Independent, P2)

**Root cause:** In `react-day-picker` v9, `day` maps to the `<td>` cell, `day_button` to the `<button>` inside it. The `<td>` is not a flex container, so the button sits at default top-left position, misaligning with highlight backgrounds on `today`/`selected`/`range_*`.

**File:** `frontend/src/components/ui/calendar.tsx` line 35

**Fix:** Add `flex items-center justify-center` to `day` class:

```ts
// Before:
day: 'h-9 w-9 p-0 text-center text-sm',
// After:
day: 'h-9 w-9 p-0 text-center text-sm flex items-center justify-center',
```

**Verification:** `npm run type-check` in `frontend/` — no type changes expected.

---

## Issue #334 — Response % > 100% (Fix First, P1)

**Root cause:** `getById` computes `responseRate` as `effectiveResponseCount / deliveredCount × 100`, where:
- `effectiveResponseCount = agg.count` = total **per-user votes** (from `SurveyVote`)
- `deliveredCount` = number of **chats** (deliveries), not users

Dividing votes by chats inflates rate proportionally to users per chat.

**File:** `backend/src/api/trpc/routers/survey.ts`, lines 267–270

**Fix:** Replace `effectiveResponseCount` with `stats.responded` as numerator (already computed in same procedure at lines 222–237):

```ts
// Before:
responseRate:
  survey.deliveredCount > 0
    ? Math.round((effectiveResponseCount / survey.deliveredCount) * 100 * 10) / 10
    : 0,

// After:
responseRate:
  survey.deliveredCount > 0
    ? Math.round((stats.responded / survey.deliveredCount) * 100 * 10) / 10
    : 0,
```

`stats.responded` = count of `SurveyDelivery` rows with `status = 'responded'` — semantically "fraction of delivered chats that responded", always ≤ 100%.

**Verification:**
- `npm run type-check` in `backend/`
- Logic: `stats.responded` is number type, same formula shape, no type changes

---

## Issue #333 — List Shows 0 (After #334, P1)

**Root cause:** `list` procedure (lines 149–171) reads legacy snapshot columns directly (`survey.responseCount`, `survey.averageRating`). These columns are never updated by the new `SurveyVote` path (gh-294). `getById` uses `aggregateSurvey()` overlay to get live counts. Divergence → list always shows 0.

**Files:**
1. `backend/src/services/feedback/vote.service.ts` — add batch helper
2. `backend/src/api/trpc/routers/survey.ts` — update `list` procedure

### Step 1: Add `aggregateSurveys()` in vote.service.ts (after line 343)

```ts
export async function aggregateSurveys(
  surveyIds: string[]
): Promise<Map<string, SurveyAggregate>> {
  if (surveyIds.length === 0) return new Map();

  const votes = await prisma.surveyVote.findMany({
    where: {
      state: 'active',
      delivery: { surveyId: { in: surveyIds } },
    },
    select: {
      rating: true,
      delivery: { select: { surveyId: true } },
    },
  });

  const result = new Map<string, SurveyAggregate>();
  for (const v of votes) {
    const sid = v.delivery.surveyId;
    if (!result.has(sid)) {
      result.set(sid, { count: 0, average: null, distribution: emptyDistribution() });
    }
    const agg = result.get(sid)!;
    const rating = v.rating as 1 | 2 | 3 | 4 | 5;
    if (rating >= 1 && rating <= 5) {
      agg.distribution[rating] += 1;
      agg.count += 1;
      agg.average = ((agg.average ?? 0) * (agg.count - 1) + rating) / agg.count;
    }
  }
  return result;
}
```

Add `aggregateSurveys` to default export at line 402+.

**Note:** The running-average formula above has a subtle issue. Better approach: accumulate sum separately and compute average at the end. Use this instead:

```ts
// Accumulate per-survey
const sums = new Map<string, { sum: number; count: number; dist: ReturnType<typeof emptyDistribution> }>();
for (const v of votes) {
  const sid = v.delivery.surveyId;
  if (!sums.has(sid)) sums.set(sid, { sum: 0, count: 0, dist: emptyDistribution() });
  const s = sums.get(sid)!;
  const rating = v.rating as 1 | 2 | 3 | 4 | 5;
  if (rating >= 1 && rating <= 5) { s.count += 1; s.sum += rating; s.dist[rating] += 1; }
}
// Convert to SurveyAggregate map
const result = new Map<string, SurveyAggregate>();
for (const [sid, s] of sums) {
  result.set(sid, { count: s.count, average: s.count > 0 ? s.sum / s.count : null, distribution: s.dist });
}
return result;
```

### Step 2: Update `list` procedure in survey.ts

Add import: `import { aggregateSurvey, aggregateSurveys, getVoteHistory } from '../../../services/feedback/vote.service.js';`

After `surveys` fetch (after line 146), before `surveys.map(...)`:

```ts
// Fetch live vote aggregates for all surveys in one query (gh-333)
const surveyIds = surveys.map((s) => s.id);
const aggMap = await aggregateSurveys(surveyIds);
```

In `surveys.map(...)`, replace direct `survey.responseCount` usage:

```ts
const agg = aggMap.get(survey.id);
const effectiveResponseCount = agg && agg.count > 0 ? agg.count : survey.responseCount;
// ...
responseCount: effectiveResponseCount,
responseRate:
  survey.deliveredCount > 0
    ? Math.round((effectiveResponseCount / survey.deliveredCount) * 100 * 10) / 10
    : 0,
```

**Verification:**
- `npm run type-check` in `backend/`
- Frontend (`survey-list-content.tsx`) already reads `survey.responseCount` and `survey.responseRate` — no frontend changes needed

---

## Execution Dependency Graph

```
#332 (buh-A) — INDEPENDENT ──────────────────────────→ commit fix-calendar
#334 (buh-B) ──────────────────────────────────────→ commit fix-rate
#333 (buh-C) — depends on #334 ───────────────────→ commit fix-list
```

Parallel execution: buh-A can be worked simultaneously with buh-B→buh-C chain.

---

## Commit Messages

```
fix(survey): correct calendar day-number alignment in date picker (gh-332)
fix(survey): fix response rate exceeding 100% by using delivery-level denominator (gh-334)
fix(survey): show live vote aggregates in survey list via batch aggregateSurveys (gh-333)
```

---

## Verification Checklist

- [ ] `frontend/`: `npm run type-check` passes
- [ ] `backend/`: `npm run type-check` passes
- [ ] Calendar day numbers centered in all cell states (today, selected, range)
- [ ] `responseRate` in `getById` never exceeds 100% for multi-user surveys
- [ ] `survey.list` shows non-zero `responseCount` and correct `responseRate`
- [ ] All 3 GitHub issues closed with fix comments
- [ ] All 3 Beads tasks closed

## nextAgent

Implementation can proceed directly. Medium complexity — delegate #333 to subagent (multi-file backend change), fix #332 and #334 directly.
