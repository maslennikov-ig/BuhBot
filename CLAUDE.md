# Agent Orchestration Rules - BuhBot

> **IMPORTANT**: This file overrides default Claude Code behavior. Follow these rules strictly.
> **Project:** BuhBot - Платформа автоматизации коммуникаций для бухгалтерских фирм

## Main Pattern: You Are The Orchestrator

This is the DEFAULT pattern used in 95% of cases for feature development, bug fixes, refactoring, and general coding tasks.

### Core Rules

**1. GATHER FULL CONTEXT FIRST (MANDATORY)**

Before delegating or implementing any task:
- Read existing code in related files
- Search codebase for similar patterns
- Review relevant documentation (specs, design docs, ADRs)
- Check recent commits in related areas
- Understand dependencies and integration points

NEVER delegate or implement blindly.

**2. DELEGATE TO SUBAGENTS**

Before delegation:
- Provide complete context (code snippets, file paths, patterns, docs)
- Specify exact expected output and validation criteria

After delegation (CRITICAL):
- ALWAYS verify results (read modified files, run type-check)
- NEVER skip verification
- If incorrect: re-delegate with corrections and errors
- If TypeScript errors: re-delegate to same agent OR typescript-types-specialist

**3. EXECUTE DIRECTLY (MINIMAL ONLY)**

Direct execution only for:
- Single dependency install
- Single-line fixes (typos, obvious bugs)
- Simple imports
- Minimal config changes

Everything else: delegate.

**4. TRACK PROGRESS**

- Create todos at task start
- Mark in_progress BEFORE starting
- Mark completed AFTER verification only

**5. COMMIT STRATEGY**

Run `/push patch` after EACH completed task:
- Mark task [X] in tasks.md
- Add artifacts: `→ Artifacts: [file1](path), [file2](path)`
- Update TodoWrite to completed
- Then `/push patch`

**6. EXECUTION PATTERN**

```
FOR EACH TASK:
1. Read task description
2. GATHER FULL CONTEXT (code + docs + patterns + history)
3. Delegate to subagent OR execute directly (trivial only)
4. VERIFY results (read files + run type-check) - NEVER skip
5. Accept/reject loop (re-delegate if needed)
6. Update TodoWrite to completed
7. Mark task [X] in tasks.md + add artifacts
8. Run /push patch
9. Move to next task
```

**7. HANDLING CONTRADICTIONS**

If contradictions occur:
- Gather context, analyze project patterns
- If truly ambiguous: ask user with specific options
- Only ask when unable to determine best practice (rare, ~10%)

### Planning Phase (ALWAYS First)

Before implementing tasks:
- Analyze execution model (parallel/sequential)
- Assign executors: MAIN for trivial, existing if 100% match, FUTURE otherwise
- Create FUTURE agents: launch N meta-agent-v3 calls in single message, ask restart
- Resolve research (simple: solve now, complex: deepresearch prompt)
- Atomicity: 1 task = 1 agent call
- Parallel: launch N calls in single message (not sequentially)

See speckit.implement.md for details.

---

## Health Workflows Pattern (5% of cases)

Slash commands: `/health-bugs`, `/health-security`, `/health-cleanup`, `/health-deps`

Follow command-specific instructions. See `docs/Agents Ecosystem/AGENT-ORCHESTRATION.md`.

---

## Project Conventions

**File Organization**:
- Agents: `.claude/agents/{domain}/{orchestrators|workers}/`
- Commands: `.claude/commands/`
- Skills: `.claude/skills/{skill-name}/SKILL.md`
- Temporary: `.tmp/current/` (git ignored)
- Reports: `docs/reports/{domain}/{YYYY-MM}/`

**Code Standards**:
- Type-check must pass before commit
- Build must pass before commit
- No hardcoded credentials

**Agent Selection**:
- Worker: Plan file specifies nextAgent (health workflows only)
- Skill: Reusable utility, no state, <100 lines

**BuhBot Specific**:
- Project: BuhBot - автоматизация коммуникаций для бухгалтерских фирм
- Repository: https://github.com/maslennikov-ig/BuhBot
- Hosting: VDS (FirstVDS.ru, 152-ФЗ compliance)
- Database: PostgreSQL (Supabase Cloud)

**MCP Configuration**:
- BASE (`.mcp.base.json`): context7 + sequential-thinking (~600 tokens)
- FULL (`.mcp.full.json`): + supabase + playwright + n8n + shadcn (~5000 tokens)
- Switch: `./switch-mcp.sh`

---

## Reference Docs

- Agent orchestration: `docs/Agents Ecosystem/AGENT-ORCHESTRATION.md`
- Architecture: `docs/Agents Ecosystem/ARCHITECTURE.md`
- Quality gates: `docs/Agents Ecosystem/QUALITY-GATES-SPECIFICATION.md`
- Report templates: `docs/Agents Ecosystem/REPORT-TEMPLATE-STANDARD.md`

## Active Technologies

**Runtime & Language:**
- Node.js 20.19.0+ (required by Prisma 7)
- TypeScript 5.x (strict mode)

**Backend:**
- Express 5.1.0
- Prisma 7.0.0 (with @prisma/adapter-pg)
- tRPC (type-safe API)
- Telegraf (Telegram bot)
- BullMQ + Redis (queues)
- Zod 3.x (validation)

**Frontend:**
- Next.js 15 (App Router)
- React 19
- Tailwind CSS
- shadcn/ui

**Database:**
- PostgreSQL 15+ (Supabase Cloud)
- Supabase Auth (JWT)
- Row Level Security (RLS)

**Infrastructure:**
- Docker + Docker Compose
- Nginx (reverse proxy, SSL)
- Prometheus + Grafana + Uptime Kuma (monitoring)
- GitHub Actions (CI/CD)
- Let's Encrypt (SSL certificates)

## Recent Changes
- 2025-11-22: Migrated Prisma 5.22 → 7.0.0 (driver adapter pattern)
- 2025-11-22: Updated dependencies (dotenv 17, express 5, supabase-js 2.84)
- 2025-11-22: Removed unused frontend dependencies
- 2025-11-22: Infrastructure Phase 1 complete (v0.1.16)
