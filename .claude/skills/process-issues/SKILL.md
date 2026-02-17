---
name: process-issues
description: 'Process GitHub Issues: fetch, prioritize (scoring matrix), create Beads tasks with dependencies, then auto-fix by priority order'
version: 2.0.0
---

# Process GitHub Issues

End-to-end workflow: fetch open GitHub Issues → analyze & score → create Beads tasks with dependency graph → auto-execute fixes by priority.

## CRITICAL REQUIREMENTS

> **YOU MUST FOLLOW THESE RULES. NO EXCEPTIONS.**

### 1. BEADS IS MANDATORY

**EVERY issue MUST have a Beads task before fixing.** No direct fixes without tracking.

```bash
# ALWAYS run this FIRST for each issue:
bd create --type=<bug|task|feature> --priority=<0-4> --title="<issue_title>" --external-ref="gh-<number>"
```

### 2. READ ISSUE COMMENTS (MANDATORY)

**ALWAYS read comments — they contain valuable insights:**

```bash
# View issue with all comments
gh issue view <number> --comments

# Or via API for structured data
gh api repos/maslennikov-ig/BuhBot/issues/<number>/comments --jq '.[].body'
```

**What to analyze in comments:**

- **User clarifications**: Additional context about the problem
- **Suggested solutions**: Community/team members often propose fixes
- **Workarounds**: Temporary solutions that hint at root cause
- **Related issues**: Links to other issues with same problem
- **Screenshots/logs**: Additional debugging information

**Decision making for suggestions:**

| Suggestion Type       | Action                                          |
| --------------------- | ----------------------------------------------- |
| Clear fix with code   | Verify correctness, adopt if valid              |
| Architecture proposal | Evaluate complexity, discuss with user if major |
| Workaround            | Note it, but look for proper fix                |
| Conflicting advice    | Analyze trade-offs, choose best approach        |
| Outdated advice       | Check if still relevant to current codebase     |

### 3. SEARCH SIMILAR PROBLEMS FIRST (MANDATORY)

**Before fixing ANY issue, search BOTH sources:**

#### 3a. Search in Beads (closed tasks)

```bash
bd search "<keyword>" --type=bug --status=closed
bd search "<keyword>" --type=task --status=closed
```

#### 3b. Search in GitHub (closed issues)

```bash
gh issue list --state closed --search "<keyword>"
gh issue view <number>
```

#### 3c. If found similar resolved issue

1. **From Beads**: Read task description for root cause and fix approach
2. **From GitHub**: Read the closing comment — contains solution
3. Apply same solution pattern if applicable
4. **Reference in your fix**: `Similar to buh-xxx / gh-NN. Same fix applied.`

### 4. CONTEXT7 IS MANDATORY

**ALWAYS query documentation before implementing any fix involving external libraries:**

```
mcp__context7__resolve-library-id → mcp__context7__query-docs
```

**When to use:**

- React/Next.js patterns
- Supabase queries
- BullMQ job handling
- Telegraf bot patterns
- Prisma ORM patterns
- tRPC router/middleware
- Any external library involved in the fix

**How to use (2-step):**

1. `mcp__context7__resolve-library-id` with library name (e.g., "telegraf", "prisma")
2. `mcp__context7__query-docs` with resolved ID and specific topic (e.g., "middleware", "transactions")

### 5. TASK COMPLEXITY ROUTING

| Complexity  | Examples                              | Action                   |
| ----------- | ------------------------------------- | ------------------------ |
| **Simple**  | Typo fix, single import, config value | Execute directly         |
| **Medium**  | Multi-file fix, migration, API change | **Delegate to subagent** |
| **Complex** | Architecture change, new feature      | Ask user first           |

**Subagent selection:**

| Domain            | Subagent                             | When                     |
| ----------------- | ------------------------------------ | ------------------------ |
| DB/migrations     | `database-architect`                 | Schema changes, RLS      |
| UI components     | `nextjs-ui-designer`                 | New pages, components    |
| Backend services  | `fullstack-nextjs-specialist`        | APIs, workers            |
| Types             | `typescript-types-specialist`        | Complex types, generics  |
| Telegram bot      | `telegraf-bot-middleware-specialist` | Bot handlers, middleware |
| SLA/monitoring    | `sla-backend-specialist`             | SLA timers, alerts       |
| Bug investigation | `problem-investigator`               | Complex root cause       |

### 6. BUG FIXING PRINCIPLES

> **This is PRODUCTION. Every bug matters.**

- Find and fix the ROOT CAUSE, not just symptoms
- If error happens in function X but cause is in function Y → fix Y
- Don't add workarounds/hacks that mask the problem
- Ask: "Why did this happen?" until you reach the actual cause
- One good fix > multiple quick patches

---

## Usage

Invoke via: `/process-issues` or "обработай GitHub issues"

Optional arguments:

- `/process-issues --label=bug` — only bug issues
- `/process-issues --limit=5` — process max 5 issues
- `/process-issues 42 43 44` — process specific issues
- `/process-issues --dry-run` — analyze and prioritize only, don't fix

---

## Workflow

### Phase 1: FETCH — Collect Open Issues

```bash
# Get all open issues with full metadata
gh issue list --state open --json number,title,labels,body,createdAt,comments --limit 50

# Or filter by label
gh issue list --state open --label bug --json number,title,labels,body,comments
```

### Phase 2: ANALYZE — Deep Analysis of Each Issue

For each open issue:

1. **Read issue details + comments** (MANDATORY):

   ```bash
   gh issue view <number> --comments
   ```

2. **Extract key information**:
   - Issue type (bug/feature/enhancement)
   - Affected files/components
   - Error messages (if bug)
   - Expected vs actual behavior
   - Useful suggestions from comments

3. **Search for similar resolved issues** (MANDATORY):

   ```bash
   bd search "<keyword from issue>"
   gh issue list --state closed --search "<keyword>"
   ```

4. **Identify cross-issue relationships**:
   - Does fixing issue A require issue B to be fixed first?
   - Do issues share the same root cause?
   - Do issues touch the same files (conflict potential)?

### Phase 3: PRIORITIZE — Score and Rank All Issues

**For each issue, calculate a priority score using the scoring matrix:**

#### Scoring Matrix

**Severity** (how bad is it?):

| Level    | Score | Description                           |
| -------- | ----- | ------------------------------------- |
| critical | 10    | App crash, data loss, security breach |
| high     | 7     | Major feature broken, no workaround   |
| medium   | 5     | Feature degraded, workaround exists   |
| low      | 2     | Cosmetic, minor inconvenience         |

**Impact** (how many users affected?):

| Level    | Score | Description              |
| -------- | ----- | ------------------------ |
| breaking | 10    | All users blocked        |
| major    | 7     | Most users affected      |
| minor    | 3     | Some users, edge case    |
| none     | 0     | Internal, no user impact |

**Likelihood** (how often does it happen?):

| Level    | Score | Description                    |
| -------- | ----- | ------------------------------ |
| certain  | 10    | Every time, 100% reproducible  |
| likely   | 7     | Most of the time, >50%         |
| possible | 5     | Sometimes, specific conditions |
| unlikely | 2     | Rare, hard to reproduce        |

**Total Score** = severity + impact + likelihood (range: 0-30)

**Score → Priority mapping:**

| Score | Priority | Label                       | Action                   |
| ----- | -------- | --------------------------- | ------------------------ |
| 25-30 | **P0**   | Critical — Immediate Action | Drop everything, fix now |
| 19-24 | **P1**   | High — Fix This Sprint      | Prioritize immediately   |
| 12-18 | **P2**   | Medium — Schedule Soon      | Include in current batch |
| 5-11  | **P3**   | Low — When Convenient       | Backlog, fix if time     |
| 0-4   | **P4**   | Minimal — Consider Closing  | May not be worth fixing  |

**GitHub Label → default severity hints:**

| GitHub Label  | Default Severity | Notes                             |
| ------------- | ---------------- | --------------------------------- |
| `bug`         | high-critical    | Analyze actual severity from body |
| `enhancement` | medium           | Adjust by user impact             |
| `UX`          | medium           | User-facing, usually P2           |
| `A11Y`        | medium-low       | Accessibility compliance          |
| `feature`     | low-medium       | New functionality request         |

**Output: Ranked priority table (sorted by score DESC):**

```markdown
| Rank | Issue | Title        | Score | Sev | Imp | Lkh | Priority | Beads ID |
| ---- | ----- | ------------ | ----- | --- | --- | --- | -------- | -------- |
| 1    | #42   | Bot crashes  | 27    | 10  | 10  | 7   | P0       | buh-xxx  |
| 2    | #43   | Login broken | 24    | 7   | 10  | 7   | P1       | buh-yyy  |
| 3    | #44   | Typo in menu | 7     | 2   | 3   | 2   | P3       | buh-zzz  |
```

### Phase 4: CREATE BEADS — Tasks with Dependency Graph

**4a. Create an Epic for this processing batch:**

```bash
bd create --title="Process GitHub Issues Batch $(date +%Y-%m-%d)" --type=epic --priority=2 \
  --description="Batch processing of open GitHub issues"
```

Save returned `<epic-id>`.

**4b. Create a Beads task for EACH issue (sorted by priority):**

```bash
bd create --title="gh-<number>: <issue_title>" \
  --type=<bug|task|feature> \
  --priority=<0-4> \
  --external-ref="gh-<number>" \
  --deps parent:<epic-id> \
  --description="GitHub Issue: #<number>
Score: <score> (sev=<s>, imp=<i>, lkh=<l>)
Root Cause: <analysis>
Solution: <proposed fix>
Files: <file list>
Similar: <buh-xxx / gh-NN if found>
Executor: <subagent-name | MAIN>"
```

**4c. Build dependency graph between tasks:**

Analyze cross-issue dependencies and set them up:

```bash
# If issue B requires issue A to be fixed first:
bd dep add <buh-B> <buh-A>

# If issues share same root cause (related, not blocking):
# Just note in description: "Related: buh-xxx"

# If issues touch same files (sequential execution required):
bd dep add <buh-later> <buh-earlier>
```

**Dependency rules (auto-detect):**

| Condition                                  | Dependency Type   | Command                            |
| ------------------------------------------ | ----------------- | ---------------------------------- |
| Issue B's fix needs A's changes            | `blocked-by`      | `bd dep add <B> <A>`               |
| Issues touch same files                    | `blocked-by`      | `bd dep add <later> <earlier>`     |
| Issues share root cause but fix separately | `related`         | Note in description only           |
| Issue found during analysis of another     | `discovered-from` | `--deps discovered-from:<id>`      |
| DB migration needed before feature         | `blocked-by`      | `bd dep add <feature> <migration>` |

**4d. Present the dependency graph to user:**

```markdown
## Dependency Graph

buh-aaa (#42, P0) ─blocks──→ buh-bbb (#43, P1)
buh-aaa (#42, P0) ─blocks──→ buh-ccc (#45, P2)
buh-bbb (#43, P1) ─blocks──→ buh-ddd (#44, P3)
buh-eee (#46, P2) ── independent ──

### Execution Order (topological sort by priority):

1. buh-aaa (#42) — P0, no blockers
2. buh-eee (#46) — P2, no blockers [PARALLEL with #1]
3. buh-bbb (#43) — P1, after buh-aaa
4. buh-ccc (#45) — P2, after buh-aaa [PARALLEL with #3]
5. buh-ddd (#44) — P3, after buh-bbb
```

### Phase 5: EXECUTE — Auto-Fix by Priority Order

**Execution follows topological sort: respect dependencies, then sort by priority within unblocked tasks.**

**For EACH task in execution order:**

#### 5a. Claim task

```bash
bd update <task_id> --status=in_progress
```

#### 5b. Query Context7 (MANDATORY for any library-related fix)

```
mcp__context7__resolve-library-id → mcp__context7__query-docs
```

#### 5c. Gather full context

- Read ALL files that will be modified
- Search for related patterns in codebase
- Check recent commits in affected files
- Review library docs via Context7

#### 5d. Execute fix

| Complexity | Action                                       |
| ---------- | -------------------------------------------- |
| Simple     | Execute directly (Edit tool)                 |
| Medium     | Delegate to appropriate subagent (Task tool) |
| Complex    | Ask user for approval first, then delegate   |

**Subagent delegation template:**

```
Task: Fix GitHub Issue #<number>
Issue: <title>
Root Cause: <analysis>
Solution: <proposed fix>
Files to modify:
- <path1>: <what to change>
- <path2>: <what to change>
Context7 docs: <relevant docs fetched>
Similar fix reference: <buh-xxx if applicable>
Validation: Run `npm run type-check` after changes
```

#### 5e. Verify fix

```bash
npm run type-check
npm run build
```

- Read ALL modified files to verify correctness
- If verification fails: re-delegate with error details
- Accept/reject loop until fix passes

#### 5f. Commit fix

Use `/push patch` with conventional commit message:

```bash
# Commit message format:
fix(scope): <description> (gh-<number>)
# or
feat(scope): <description> (gh-<number>)
```

#### 5g. Close issue and task

```bash
# Close GitHub Issue
gh issue close <number> --comment "Fixed in commit <sha>

**Solution:**
<description of fix>

**Root cause:**
<root cause analysis>

Beads task: <task_id>"

# Close Beads task
bd close <task_id> --reason="Fixed: <description>"
```

#### 5h. Move to next task

```bash
bd ready   # Check what's unblocked now
```

Proceed to next unblocked task by priority.

### Phase 6: REPORT — Summary

```markdown
## Issues Processing Complete

### Priority Score Summary

| Rank | Issue | Title | Score | Priority | Status | Beads | Commit |
| ---- | ----- | ----- | ----- | -------- | ------ | ----- | ------ |
| 1    | #42   | ...   | 27    | P0       | Fixed  | buh-a | abc123 |
| 2    | #43   | ...   | 24    | P1       | Fixed  | buh-b | def456 |
| 3    | #44   | ...   | 7     | P3       | Defer  | buh-c | —      |

### Dependencies Resolved

- buh-aaa → buh-bbb: Resolved (both fixed)
- buh-bbb → buh-ddd: Resolved (both fixed)

### Deferred Issues (need user input)

- #XX: <reason — Complex/needs clarification/P3+ deprioritized>

### Commits Made

- `abc123`: fix(bot): <description> (gh-42)
- `def456`: fix(auth): <description> (gh-43)

### Validation

- Type Check: PASS
- Build: PASS
- Issues Closed: N/M
- Beads Tasks Closed: N/M
```

---

## Issue Categories & Subagents

| Pattern in Issue        | Category      | Subagent                             | Default Severity |
| ----------------------- | ------------- | ------------------------------------ | ---------------- |
| `crash`, `error 500`    | Bug Critical  | `problem-investigator`               | critical         |
| `silent failure`        | Bug           | Same domain subagent                 | high             |
| `not displayed`         | UI Bug        | `nextjs-ui-designer`                 | medium           |
| `not editable`          | UI Bug        | `nextjs-ui-designer`                 | medium           |
| `focus`, `scroll`       | UX            | `nextjs-ui-designer`                 | medium           |
| `keyboard`, `a11y`      | Accessibility | `nextjs-ui-designer`                 | low              |
| `telegram`, `bot`       | Bot           | `telegraf-bot-middleware-specialist` | high             |
| `SLA`, `timer`, `alert` | SLA           | `sla-backend-specialist`             | high             |
| `database`, `migration` | DB            | `database-architect`                 | high             |
| `tRPC`, `API`           | Backend       | `fullstack-nextjs-specialist`        | medium           |
| `type error`            | Types         | `typescript-types-specialist`        | medium           |
| `security`, `auth`      | Security      | `vulnerability-fixer`                | critical         |
| `performance`, `slow`   | Performance   | `performance-optimizer`              | medium           |

---

## Verification Checklist

Before marking ANY issue as fixed:

- [ ] Issue comments read and analyzed
- [ ] Useful suggestions considered (adopted/rejected with reason)
- [ ] Similar issues searched (Beads + GitHub)
- [ ] Priority score calculated (severity + impact + likelihood)
- [ ] Beads task exists with external-ref
- [ ] Dependencies set in Beads (blocks/blocked-by)
- [ ] Context7 queried for relevant library docs
- [ ] Root cause identified (not just symptom)
- [ ] Modified files reviewed with Read tool
- [ ] `npm run type-check` passes
- [ ] `npm run build` passes (or known pre-existing failures)
- [ ] Committed with conventional commit (gh-NN reference)
- [ ] GitHub issue closed with solution comment
- [ ] Beads task closed with reason

---

## Quick Commands Reference

```bash
# === FETCH ===
gh issue list --state open --json number,title,labels,body,comments
gh issue view 123 --comments
gh api repos/maslennikov-ig/BuhBot/issues/123/comments --jq '.[] | {author: .user.login, body: .body}'

# === SEARCH SIMILAR ===
bd search "keyword"
gh issue list --state closed --search "keyword"

# === CREATE BEADS ===
bd create --title="gh-123: Issue title" --type=bug --priority=1 --external-ref="gh-123" --deps parent:<epic-id>
bd dep add <buh-child> <buh-parent>    # child depends on parent
bd blocked                              # show blocked tasks

# === EXECUTE ===
bd update <id> --status=in_progress
bd ready                                # what's unblocked?
bd close <id> --reason="Fixed: ..."

# === CLOSE GITHUB ===
gh issue close 123 --comment "Fixed in commit abc123"
gh issue comment 123 --body "Analysis: ..."

# === CONTEXT7 ===
# Step 1: resolve library ID
mcp__context7__resolve-library-id (e.g., "telegraf", "prisma", "next.js")
# Step 2: query docs
mcp__context7__query-docs (resolved ID + topic)
```

---

## Reference Docs

- CLAUDE.md: Main orchestration rules
- Beads Guide: `.claude/docs/beads-quickstart.md`
- Priority Scoring: `.claude/skills/calculate-priority-score/SKILL.md`
