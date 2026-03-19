---
name: process-logs
description: 'Process production monitoring: check Prometheus alerts & metrics, fetch error_logs from Supabase, auto-mute known patterns, create Beads tasks, fix by priority. Use when user says "process logs", "check errors", "обработай логи", or "проверь ошибки".'
version: 1.1.0
---

# Process Error Logs

End-to-end workflow: check Prometheus alerts & metrics → fetch new errors from `error_logs` → auto-ignore known patterns → analyze & prioritize → create Beads tasks → fix by priority order.

## CRITICAL REQUIREMENTS

> **YOU MUST FOLLOW THESE RULES. NO EXCEPTIONS.**

### 1. BEADS IS MANDATORY

**EVERY error group MUST have a Beads task before fixing.** No direct fixes without tracking.

```bash
bd create --type=bug --priority=<0-4> --title="<error summary>"
```

### 2. CONTEXT7 IS MANDATORY

**ALWAYS query documentation before implementing any fix involving external libraries:**

```
mcp__context7__resolve-library-id -> mcp__context7__query-docs
```

When to use: Prisma, BullMQ, Telegraf, tRPC, Express, Redis/ioredis, Winston, prom-client.

### 3. SEARCH SIMILAR PROBLEMS FIRST

Before fixing ANY error, search BOTH sources:

```bash
# Beads (closed tasks)
bd search "<keyword>" --type=bug --status=closed

# GitHub (closed issues)
gh issue list --state closed --search "<keyword>"
```

If found: read the solution, apply same pattern, reference in fix.

### 4. TASK COMPLEXITY ROUTING

| Complexity | Examples                         | Action                   |
| ---------- | -------------------------------- | ------------------------ |
| Simple     | Typo, missing null check, config | Execute directly         |
| Medium     | Multi-file fix, schema change    | **Delegate to subagent** |
| Complex    | Architecture change              | Ask user first           |

---

## Usage

Invoke via: `/process-logs` or "обработай логи" / "проверь ошибки"

Optional arguments:

- `/process-logs --limit=10` — process max 10 error groups
- `/process-logs --level=error` — only errors (skip warnings)
- `/process-logs --since=24h` — errors from last 24 hours (default: 48h)
- `/process-logs --dry-run` — analyze and prioritize only, don't fix

---

## Workflow

### Step 0: Production Health Snapshot

Before diving into error_logs, get the full picture from the monitoring stack via SSH to VDS.

**Access:** `ssh buhbot@185.200.177.180` (key-based auth, working dir: `/home/buhbot/BuhBot`)

#### 0a. Container health

```bash
ssh buhbot@185.200.177.180 "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.RunningFor}}'"
```

**Check for:** containers in `Restarting`, `Exited`, or unhealthy state. If `bot-backend` is down — this is P0, stop and fix immediately.

#### 0b. Prometheus firing alerts

```bash
ssh buhbot@185.200.177.180 "curl -s http://localhost:9090/api/v1/alerts | python3 -m json.tool"
```

**Parse the response.** Look for alerts with `state: "firing"`:

| Alert Name                     | Severity | What It Means          | Immediate Action                 |
| ------------------------------ | -------- | ---------------------- | -------------------------------- |
| `BotDown`                      | critical | Backend не отвечает    | P0 — перезапуск / расследование  |
| `HighCPU`                      | warning  | CPU >80% более 5 мин   | Проверить top processes          |
| `HighMemory`                   | warning  | RAM >80% более 5 мин   | Проверить memory leaks           |
| `HighDisk`                     | critical | Disk >85%              | Очистить логи / расширить        |
| `HighMessageLatency`           | warning  | P95 latency >5s        | Проверить DB / external APIs     |
| `SupabaseErrors`               | warning  | >10 DB ошибок за 5 мин | Проверить сеть / Supabase status |
| `HighSupabaseLatency`          | warning  | P95 query >0.5s        | Медленные запросы / индексы      |
| `RedisHighMemory`              | warning  | Redis RAM >80%         | Проверить eviction policy        |
| `RedisConnectionPoolSaturated` | warning  | Connections >80%       | Утечки соединений                |

**If any alert is firing:**

- Create a Beads task with P0/P1 priority immediately
- Note the alert in the task description — it provides context for error_logs later
- Firing alerts take precedence over error_logs analysis

#### 0c. Key application metrics (anomaly check)

```bash
# Circuit breaker state (0=CLOSED, 1=OPEN, 2=HALF_OPEN)
ssh buhbot@185.200.177.180 "curl -s http://localhost:3000/metrics | grep -E 'classifier_circuit_breaker_state|classifier_errors_total|classifier_fallback_total|http_errors_total|redis_connection_errors|supabase_connection_errors'"
```

**Red flags to look for:**

| Metric                                       | Red Flag                       | Meaning                     |
| -------------------------------------------- | ------------------------------ | --------------------------- |
| `classifier_circuit_breaker_state` = 1 or 2  | Circuit breaker OPEN/HALF_OPEN | Classifier service degraded |
| `classifier_errors_total` rapidly increasing | API errors piling up           | OpenRouter/OpenAI issues    |
| `classifier_fallback_total` > 0              | Fallback to REQUEST active     | Classifier completely down  |
| `http_errors_total` increasing               | HTTP 500s                      | Backend errors              |
| `redis_connection_errors` increasing         | Redis connectivity             | Container/network issues    |
| `supabase_connection_errors` increasing      | DB connectivity                | Supabase/network issues     |

**If anomalies found:** note them as context — they help correlate with specific error_logs entries.

#### 0d. Uptime Kuma check (optional, if SSH available)

```bash
# Check recent downtime events from Uptime Kuma API
ssh buhbot@185.200.177.180 "curl -s http://localhost:3001/api/status-page/heartbeat/buhbot-status 2>/dev/null | python3 -c 'import sys,json; d=json.load(sys.stdin); [print(f\"{k}: {len([h for h in v if h[\"status\"]==0])} down events\") for k,v in d.get(\"heartbeatList\",{}).items()]' 2>/dev/null || echo 'Uptime Kuma API not available'"
```

If Uptime Kuma shows downtime events — correlate timestamps with error_logs.

#### 0e. Present health snapshot

```markdown
### Step 0: Production Health Snapshot

**Containers:** All healthy / <N> unhealthy
**Prometheus Alerts:** None firing / <list of firing alerts>
**Metric Anomalies:** None / <list of anomalies>
**Uptime Kuma:** All up / <downtime events>

**Critical findings (carry forward to Step 2 prioritization):**

- <finding 1>
- <finding 2>
```

**If critical alerts are firing (BotDown, HighDisk):** skip to Step 3 immediately, create P0 task, fix first.
**Otherwise:** proceed to Step 1 with this context.

---

### Step 1: Fetch New Errors

Query error_logs grouped by fingerprint where status = 'new':

```sql
-- Via Supabase MCP: mcp__supabase__execute_sql
-- Fetch new error groups, ordered by occurrence count

SELECT
  fingerprint,
  COUNT(*) AS occurrence_count,
  MAX(level) AS max_level,
  MIN(timestamp) AS first_seen,
  MAX(timestamp) AS last_seen,
  (array_agg(message ORDER BY timestamp DESC))[1] AS latest_message,
  (array_agg(stack ORDER BY timestamp DESC))[1] AS latest_stack,
  (array_agg(service ORDER BY timestamp DESC))[1] AS service,
  (array_agg(id ORDER BY timestamp DESC))[1] AS sample_id
FROM error_logs
WHERE status = 'new'
  AND timestamp > NOW() - INTERVAL '48 hours'
GROUP BY fingerprint
ORDER BY COUNT(*) DESC, MAX(timestamp) DESC;
```

**If no results:** Report "No new errors in the last 48 hours" and stop.

**Parse results** into a list of error groups with: `fingerprint`, `occurrence_count`, `max_level`, `latest_message`, `latest_stack`, `service`, `sample_id`.

### Step 1.5: Bulk Auto-Ignore Known Patterns

Before manual analysis, auto-ignore noise patterns. These are expected operational events, not bugs.

**Known noise patterns for BuhBot:**

| Pattern (message ILIKE)         | Reason                                         |
| ------------------------------- | ---------------------------------------------- |
| `%ECONNRESET%`                  | Redis reconnect during graceful shutdown       |
| `%ECONNREFUSED%127.0.0.1:6379%` | Redis restart / container lifecycle            |
| `%redis%reconnect%`             | Redis auto-reconnect (ioredis handles it)      |
| `%health%check%`                | Health probe failure (transient)               |
| `%SIGTERM%`                     | Graceful shutdown signal (expected)            |
| `%stalled%job%`                 | BullMQ stalled job retry (handled by BullMQ)   |
| `%409%Conflict%`                | Telegram webhook conflict (duplicate instance) |
| `%429%Too Many Requests%`       | Telegram rate limit (auto-retry in Telegraf)   |
| `%connection%pool%timeout%`     | Prisma pool saturation (transient under load)  |
| `%ETIMEDOUT%api.telegram.org%`  | Telegram API timeout (transient)               |

**For each noise pattern match:**

```sql
-- Via Supabase MCP: mcp__supabase__execute_sql
UPDATE error_logs
SET status = 'ignored',
    notes = 'Auto-ignored: <reason>'
WHERE status = 'new'
  AND fingerprint = '<fingerprint>'
  AND timestamp > NOW() - INTERVAL '48 hours';
```

**Report auto-ignored count:**

```markdown
### Auto-Ignored (known patterns)

| Fingerprint (short) | Count  | Pattern     | Reason                          |
| ------------------- | ------ | ----------- | ------------------------------- |
| abc123...           | 47     | ECONNRESET  | Redis reconnect during shutdown |
| def456...           | 12     | stalled job | BullMQ stalled job retry        |
| **Total**           | **59** |             |                                 |
```

### Step 2: Analyze & Prioritize Remaining Errors

For each remaining error group (not auto-ignored):

#### 2a. Classify error domain

| Pattern in message/stack                            | Domain       | Subagent                             |
| --------------------------------------------------- | ------------ | ------------------------------------ |
| `PrismaClient`, `prisma`, `migration`, `database`   | DB/Prisma    | `database-architect`                 |
| `tRPC`, `TRPCError`, `router`, `procedure`          | tRPC/API     | `fullstack-nextjs-specialist`        |
| `TypeError`, `type`, `interface`, `generic`         | TypeScript   | `typescript-types-specialist`        |
| `SLA`, `BullMQ`, `Queue`, `Job`, `Worker`           | SLA/Queue    | `sla-backend-specialist`             |
| `Telegraf`, `telegram`, `bot`, `webhook`, `ctx.`    | Bot/Telegram | `telegraf-bot-middleware-specialist` |
| `React`, `Next`, `Component`, `render`, `hydration` | Frontend/UI  | `fullstack-nextjs-specialist`        |
| `Auth`, `JWT`, `token`, `permission`, `RLS`         | Security     | `vulnerability-fixer`                |
| `Winston`, `logger`, `prom-client`, `metrics`       | Infra        | `monitoring-stack-specialist`        |

#### 2b. Calculate priority score

**Severity** (how bad?):

| Level    | Score | Description                           |
| -------- | ----- | ------------------------------------- |
| critical | 10    | App crash, data loss, security breach |
| high     | 7     | Feature broken, no workaround         |
| medium   | 5     | Degraded, workaround exists           |
| low      | 2     | Cosmetic, minor                       |

**Impact** (how many users?):

| Level    | Score | Description           |
| -------- | ----- | --------------------- |
| breaking | 10    | All users blocked     |
| major    | 7     | Most users affected   |
| minor    | 3     | Some users, edge case |
| none     | 0     | Internal only         |

**Frequency** (how often?):

| Level      | Score | Description        |
| ---------- | ----- | ------------------ |
| constant   | 10    | >100 occurrences   |
| frequent   | 7     | 20-100 occurrences |
| occasional | 5     | 5-19 occurrences   |
| rare       | 2     | 1-4 occurrences    |

**Total Score** = severity + impact + frequency (range: 0-30)

| Score | Priority | Action            |
| ----- | -------- | ----------------- |
| 25-30 | **P0**   | Fix immediately   |
| 19-24 | **P1**   | Fix this session  |
| 12-18 | **P2**   | Schedule soon     |
| 5-11  | **P3**   | Backlog           |
| 0-4   | **P4**   | Consider ignoring |

#### 2c. Present ranked table

```markdown
### Error Priority Ranking

| Rank | Fingerprint | Message (short) | Count | Score | Sev | Imp | Frq | Priority | Domain |
| ---- | ----------- | --------------- | ----- | ----- | --- | --- | --- | -------- | ------ |
| 1    | abc123      | Cannot read...  | 84    | 27    | 10  | 10  | 7   | P0       | Bot    |
| 2    | def456      | TRPC timeout    | 23    | 19    | 7   | 7   | 5   | P1       | API    |
```

### Step 3: Create Beads Tasks & Fix

#### 3a. Create epic for this batch

```bash
bd create --title="Process Error Logs $(date +%Y-%m-%d)" --type=epic --priority=2 \
  --description="Batch processing of production error logs"
```

#### 3b. For EACH error group (by priority):

**Create Beads task:**

```bash
bd create --title="Fix: <short error message>" \
  --type=bug \
  --priority=<0-4> \
  --deps parent:<epic-id> \
  --description="Fingerprint: <fingerprint>
Occurrences: <count> (last 48h)
Score: <score> (sev=<s>, imp=<i>, frq=<f>)
Level: <max_level>
Service: <service>
Message: <latest_message>
Stack: <first 5 lines of stack>
Domain: <classified domain>
Executor: <subagent-name | MAIN>"
```

**Claim task:**

```bash
bd update <task-id> --status=in_progress
```

**Gather full context:**

- Read ALL files mentioned in stack trace
- Search codebase for related patterns
- Query Context7 for relevant library docs
- Check recent commits in affected files

**Execute fix:**

| Complexity | Action                          |
| ---------- | ------------------------------- |
| Simple     | Execute directly (Edit tool)    |
| Medium+    | Delegate to classified subagent |

**Subagent delegation template:**

```
Task: Fix production error
Error: <latest_message>
Stack: <stack trace>
Fingerprint: <fingerprint>
Occurrences: <count>
Root Cause: <your analysis>
Solution: <proposed fix>
Files to modify:
- <path1>: <what to change>
Context7 docs: <relevant docs>
Similar fix: <buh-xxx if found>
Validation: cd backend && npx tsc --noEmit
```

**Verify fix:**

```bash
cd backend && npx tsc --noEmit
npx vitest run --reporter=verbose 2>&1 | tail -20
```

- Read ALL modified files to verify correctness
- If verification fails: re-delegate with error details

**Mark errors as resolved:**

```sql
-- Via Supabase MCP: mcp__supabase__execute_sql
UPDATE error_logs
SET status = 'resolved',
    notes = 'Fixed: <short description of fix>. Beads: <task-id>'
WHERE fingerprint = '<fingerprint>'
  AND status IN ('new', 'in_progress');
```

**Commit fix** using `/push`:

```bash
# Commit message format:
fix(<scope>): <description> (<task-id>)
```

**Close Beads task:**

```bash
bd close <task-id> --reason="Fixed: <description>"
```

**Move to next:**

```bash
bd ready
```

### Step 4: Summary Report

```markdown
## Error Log Processing Complete

### Production Health (Step 0)

- Containers: All healthy / <N> issues
- Prometheus Alerts: None firing / <list>
- Metric Anomalies: None / <list>
- Uptime Kuma: All up / <downtime events>

### Auto-Ignored (known patterns)

| Pattern    | Count | Reason          |
| ---------- | ----- | --------------- |
| ECONNRESET | 47    | Redis reconnect |
| ...        | ...   | ...             |
| **Total**  | **N** |                 |

### Errors Fixed

| Rank | Fingerprint | Message | Count | Priority | Status | Beads | Commit |
| ---- | ----------- | ------- | ----- | -------- | ------ | ----- | ------ |
| 1    | abc123      | ...     | 84    | P0       | Fixed  | buh-a | abc123 |
| 2    | def456      | ...     | 23    | P1       | Fixed  | buh-b | def456 |

### Deferred (need user input)

- <fingerprint>: <reason>

### Validation

- Type Check: PASS/FAIL
- Tests: PASS/FAIL
- Errors Resolved: N/M
- Errors Auto-Ignored: N
- Beads Tasks Closed: N/M
```

---

## Error Domain -> Subagent Mapping

| Domain         | Subagent                             | When                              |
| -------------- | ------------------------------------ | --------------------------------- |
| DB/Prisma      | `database-architect`                 | Schema, migrations, queries, RLS  |
| tRPC/API       | `fullstack-nextjs-specialist`        | Router, procedures, middleware    |
| TypeScript     | `typescript-types-specialist`        | Type errors, generics, interfaces |
| SLA/Queue      | `sla-backend-specialist`             | BullMQ jobs, SLA timers, alerts   |
| Bot/Telegram   | `telegraf-bot-middleware-specialist` | Bot handlers, commands, webhooks  |
| Frontend/UI    | `fullstack-nextjs-specialist`        | React components, Next.js pages   |
| Security/Auth  | `vulnerability-fixer`                | Auth, JWT, RLS, permissions       |
| Infrastructure | `monitoring-stack-specialist`        | Docker, logging, metrics          |
| Investigation  | `problem-investigator`               | Complex root cause analysis       |

---

## Verification Checklist

Before marking ANY error as resolved:

- [ ] Similar issues searched (Beads + GitHub)
- [ ] Beads task exists for error group
- [ ] Context7 queried for relevant library docs
- [ ] Root cause identified (not just symptom)
- [ ] All modified files reviewed with Read tool
- [ ] `cd backend && npx tsc --noEmit` passes
- [ ] `npx vitest run` passes (or known pre-existing failures)
- [ ] Error status updated to 'resolved' in DB
- [ ] Committed with conventional commit
- [ ] Beads task closed with reason

---

## Quick SQL Reference

```sql
-- Fetch new errors grouped by fingerprint
SELECT fingerprint, COUNT(*) AS cnt, MAX(level) AS lvl,
  (array_agg(message ORDER BY timestamp DESC))[1] AS msg,
  (array_agg(stack ORDER BY timestamp DESC))[1] AS stack
FROM error_logs
WHERE status = 'new' AND timestamp > NOW() - INTERVAL '48 hours'
GROUP BY fingerprint ORDER BY cnt DESC;

-- Mark error group as in_progress
UPDATE error_logs SET status = 'in_progress'
WHERE fingerprint = '<fp>' AND status = 'new';

-- Resolve error group
UPDATE error_logs SET status = 'resolved', notes = '<fix description>'
WHERE fingerprint = '<fp>' AND status IN ('new', 'in_progress');

-- Auto-ignore by pattern
UPDATE error_logs SET status = 'ignored', notes = 'Auto-ignored: <reason>'
WHERE status = 'new' AND message ILIKE '%<pattern>%'
  AND timestamp > NOW() - INTERVAL '48 hours';

-- Check error counts by status
SELECT status, COUNT(*) FROM error_logs
WHERE timestamp > NOW() - INTERVAL '48 hours'
GROUP BY status ORDER BY COUNT(*) DESC;
```
