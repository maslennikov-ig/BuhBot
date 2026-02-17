---
name: work
description: 'Work with tasks: view ready, pick, execute with Context7 docs, close. Full lifecycle with MCP documentation lookup.'
version: 1.0.0
---

# Work with Tasks

Skill для работы с задачами: просмотр, выбор, выполнение с обязательным использованием Context7 для актуальной документации.

## Usage

Invoke via: `/work` or "покажи задачи" or "что делать"

Optional arguments:

- `/work` — показать готовые задачи (default: 20)
- `/work -n 50` — показать больше задач
- `/work -l frontend` — только frontend задачи
- `/work pick` — автовыбор задачи по приоритету
- `/work defer buh-xxx +3m` — отложить задачу на 3 месяца
- `/work deferred` — показать отложенные задачи

---

## CRITICAL: Context7 MCP — MANDATORY

**Before implementing ANY task, query Context7 for up-to-date documentation on involved libraries.**

Skip only for trivial changes that don't touch library APIs (typos, comments, config values).

### How to use (2-step)

```
1. mcp__context7__resolve-library-id  — resolve library name to ID
2. mcp__context7__query-docs          — query docs by resolved ID + topic
```

When delegating to subagents — fetch docs first, include in delegation context.

---

## Step 1: Show Ready Tasks

Показать готовые задачи:

```bash
# Get arguments
LIMIT="${1:--n 20}"

# Show ready tasks
bd ready $LIMIT 2>/dev/null | head -30

# Count
echo ""
echo "---"
TOTAL=$(bd ready -n 100 2>/dev/null | wc -l)
echo "Total ready: $TOTAL tasks"
```

If no tasks:

```markdown
No ready tasks found.

Options:

1. /process-issues — import from GitHub Issues
2. bd create --title='Task title' --type=task --priority=2 — create manually
```

---

## Step 2: Task Selection Workflow

### Option A: User Selects Task

User says: "возьми buh-xxx" or provides task ID

```bash
# Show task details
bd show buh-xxx

# Claim task
bd update buh-xxx --status in_progress
```

### Option B: Auto-Pick by Priority

User says: `/work pick` or "выбери задачу"

```bash
# Get highest priority task (P0 > P1 > P2 > P3 > P4)
TASK=$(bd ready -n 1 --sort priority 2>/dev/null | head -1 | grep -oP 'buh-[a-z0-9]+')

if [ -n "$TASK" ]; then
    echo "Selected: $TASK"
    bd show $TASK
    bd update $TASK --status in_progress
else
    echo "No tasks available"
fi
```

---

## Step 3: Working on Task

### Rules

1. **Read task description** before starting
2. **Query Context7** for any libraries involved (MANDATORY)
3. **Gather context** — read related files, understand scope
4. **Delegate to subagent** if complex (see CLAUDE.md), include Context7 docs in delegation
5. **Verify changes** — type-check, build
6. **Close task** when done

### Execution Pattern

```
1. bd show buh-xxx                — read full description
2. Context7: resolve + query      — get docs for involved libraries (MANDATORY)
3. Gather context                 — read files, search codebase
4. Implement                      — delegate or execute directly
5. Verify                         — npm run type-check && npm run build
6. bd close buh-xxx               — mark complete
7. git commit && git push         — commit changes
```

### Context7 in delegation (MANDATORY)

When delegating to subagents, ALWAYS include Context7 docs:

```
Task: Fix/implement <description>
Issue: <title>

Context7 Documentation:
<paste relevant docs fetched from Context7 here>

Files to modify:
- <path1>: <what to change>
- <path2>: <what to change>

Validation: Run `npm run type-check` after changes
```

### Subagent Selection

| Domain            | Subagent                             | When                     |
| ----------------- | ------------------------------------ | ------------------------ |
| DB/migrations     | `database-architect`                 | Schema changes, RLS      |
| UI components     | `nextjs-ui-designer`                 | New pages, components    |
| Backend services  | `fullstack-nextjs-specialist`        | APIs, workers, services  |
| Telegram bot      | `telegraf-bot-middleware-specialist` | Bot handlers, middleware |
| SLA/monitoring    | `sla-backend-specialist`             | SLA timers, alerts       |
| TypeScript types  | `typescript-types-specialist`        | Complex types, generics  |
| Bug investigation | `problem-investigator`               | Complex root cause       |
| Security          | `vulnerability-fixer`                | Auth, XSS, injection     |
| Performance       | `performance-optimizer`              | Slow queries, rendering  |

---

## Step 4: Closing Task

```bash
# Close with reason
bd close buh-xxx --reason="Fixed: description of what was done"

# If task has GitHub reference, also close GitHub issue
# Check external-ref in task description
GITHUB_REF=$(bd show buh-xxx 2>/dev/null | grep -oP 'external-ref.*gh-\K[0-9]+' | head -1)
if [[ -n "$GITHUB_REF" ]]; then
    gh issue close $GITHUB_REF --comment "Fixed in Beads task buh-xxx"
fi
```

---

## Integration with /process-issues

When no local tasks → suggest importing from GitHub:

```
User: /work
Claude: No ready tasks.

Options:
1. /process-issues — Check GitHub for new issues
2. bd create --title="..." --type=task --priority=2 — Create task manually

User: /process-issues
Claude: [Processes GitHub issues, creates Beads tasks with external-ref]

User: /work
Claude: Found 3 ready tasks:
1. [P1] buh-abc: Fix auth bug (gh-45)
2. [P2] buh-def: Add feature X (gh-52)
...
```

---

## Task Sources

| Source                   | How to Create                                                           | External Ref |
| ------------------------ | ----------------------------------------------------------------------- | ------------ |
| GitHub Issue             | `/process-issues`                                                       | `gh-123`     |
| Manual                   | `bd create --title="Title" --type=task --priority=2`                    | none         |
| Emergent (found at work) | `bd create --title="Found bug" --type=bug --deps discovered-from:buh-x` | none         |

---

## Defer Tasks (Откладывание)

Отложенные задачи скрыты из `bd ready` до указанной даты.

### Отложить задачу

```bash
# Отложить на время
bd update buh-xxx --defer "+1w"    # на неделю
bd update buh-xxx --defer "+2w"    # на 2 недели
bd update buh-xxx --defer "+3m"    # на 3 месяца

# Отложить до даты
bd update buh-xxx --defer "2026-03-01"
bd update buh-xxx --defer "next monday"

# Снять defer (вернуть в работу)
bd update buh-xxx --defer ""
```

### Массовое откладывание

```bash
# Отложить группу связанных задач
for id in buh-aaa buh-bbb buh-ccc; do
    bd update $id --defer "+3m"
done
```

### Посмотреть отложенные

```bash
bd ready --include-deferred
```

---

## Quick Reference

```bash
# View tasks
bd ready -n 20                    # Ready tasks
bd list --status=in_progress      # Currently working on
bd show buh-xxx                   # Task details

# Work lifecycle
bd update buh-xxx --status in_progress  # Start
bd close buh-xxx --reason="..."         # Finish

# Create tasks
bd create --title="Title" --type=task --priority=2          # Manual
bd create --title="Bug" --type=bug --priority=1 --external-ref="gh-99"  # From GitHub

# Labels
bd ready -l frontend      # Only frontend
bd ready -l backend       # Only backend

# Defer (откладывание)
bd update buh-xxx --defer "+3m"       # Отложить на 3 месяца
bd update buh-xxx --defer ""          # Снять defer
bd ready --include-deferred           # Показать отложенные

# Context7 (MANDATORY before implementation)
# Step 1: mcp__context7__resolve-library-id
# Step 2: mcp__context7__query-docs
```

---

## Verification Checklist

Before closing any task:

- [ ] Task description read and understood
- [ ] Context7 queried for involved libraries (MANDATORY)
- [ ] Context gathered (files, patterns, recent commits)
- [ ] Implementation complete
- [ ] `npm run type-check` passes
- [ ] `npm run build` passes
- [ ] Changes committed with conventional commit
- [ ] Task closed with reason
- [ ] GitHub issue closed (if external-ref exists)
