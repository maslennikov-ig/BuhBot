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

**8. LIBRARY-FIRST APPROACH (MANDATORY)**

Before writing new code (>20 lines), ALWAYS search for existing libraries:
- WebSearch: "npm {functionality} library 2024" or "python {functionality} package"
- Context7: documentation for candidate libraries
- Check: weekly downloads >1000, commits in last 6 months, TypeScript/types support

**Use library when**:
- Covers >70% of required functionality
- Actively maintained, no critical vulnerabilities
- Reasonable bundle size (check bundlephobia.com)

**Write custom code when**:
- <20 lines of simple logic
- All libraries abandoned or insecure
- Core business logic requiring full control

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

## Beads Task Tracking (MANDATORY)

All tasks MUST be tracked in Beads. This is the persistent cross-session memory system.

### Quick Reference

```bash
# Session start
bd ready                    # Find available work
bd prime                    # Get workflow context

# Working on task
bd update <id> --status in_progress   # Claim task
# ... do work ...
bd close <id> --reason "Done"         # Complete task

# Creating work
bd create "Title" -t feature|bug|chore -p 0-4
bd create "Found bug" -t bug --deps discovered-from:<current-id>
```

### Issue Prefix

All issues use `buh-` prefix: `buh-abc123`

### Session Close Protocol (CRITICAL)

**NEVER say "done" without these steps:**

```bash
git status              # 1. What changed?
git add <files>         # 2. Stage code
bd sync                 # 3. Sync beads
git commit -m "... (buh-xxx)"  # 4. Commit with issue ID
bd sync                 # 5. Sync any new changes
git push                # 6. Push to remote
```

**Work is NOT done until pushed!**

### When to Use What

| Scenario | Tool | Command |
|----------|------|---------|
| Big feature (>1 day) | Spec-kit → Beads | `/speckit.specify` → `/speckit.tobeads` |
| Small feature (<1 day) | Beads | `bd create -t feature` |
| Bug | Beads | `bd create -t bug` |
| Tech debt | Beads | `bd create -t chore` |
| Research/spike | Beads wisp | `bd mol wisp exploration` |
| Hotfix (urgent!) | Beads wisp | `bd mol wisp hotfix` |

### Documentation

- Quick reference: `.claude/docs/beads-quickstart.md`
- Full reference: `.claude/docs/beads-speckit-reference.md`
- Formulas: `.beads/formulas/`

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

> **LTS Policy**: Используем только стабильные LTS-версии. Обновление major-версий — после 3+ месяцев стабильности.

**Runtime & Language:**
- Node.js 20.x LTS (Active LTS до апреля 2026)
- TypeScript 5.7.x (strict mode)

**Backend:**
- Express 5.1.x (HTTP server)
- Prisma 7.0.x (ORM, driver adapter pattern)
- tRPC 11.x (type-safe API)
- Telegraf 4.16.x (Telegram bot)
- BullMQ 5.x + ioredis 5.x (job queues)
- Zod 3.23.x (validation)
- Winston 3.x (logging)
- prom-client 15.x (Prometheus metrics)

**Frontend:**
- Next.js 16.x LTS (App Router, Turbopack)
- React 19.x
- Tailwind CSS 4.x
- shadcn/ui (Radix primitives)

**Database:**
- PostgreSQL 15+ (Supabase Cloud, EU region)
- Supabase Auth (JWT)
- Row Level Security (RLS)
- Redis 7.x (BullMQ, caching)

**AI/Classification:**
- OpenRouter API (primary, spam classification)
- OpenAI API (fallback)

**Infrastructure:**
- VDS: FirstVDS.ru (152-ФЗ compliance)
- Docker + Docker Compose
- Nginx (reverse proxy, SSL)
- Prometheus + Grafana + Uptime Kuma (monitoring)
- GitHub Actions (CI/CD)
- Let's Encrypt (SSL certificates)

## Quick Access (For New Sessions)

**VDS Server**: `.tmp/current/vds-credentials.md`
- IP: `185.200.177.180`
- Domain: `buhbot.aidevteam.ru`
- SSH: `ssh buhbot@185.200.177.180` (key-based, password disabled)
- Security: UFW + fail2ban + SSL/HTTPS
- Status: All containers deployed and healthy

**Key Paths**:
- Server access: `.claude/local.md` (SSH commands, containers)
- Full credentials: `.tmp/current/vds-credentials.md`
- Tasks: `docs/speckit/tasks.md`
- Spec: `docs/speckit/spec.md`

## Recent Changes
- 2025-11-23: Frontend Docker multi-stage build for tRPC types
- 2025-11-23: CI fully passing (all jobs green)
- 2025-11-22: Migrated Prisma 5.22 → 7.0.0 (driver adapter pattern)
- 2025-11-22: Updated dependencies (dotenv 17, express 5, supabase-js 2.84)
- 2025-11-22: Removed unused frontend dependencies
- 2025-11-22: Infrastructure Phase 1 complete (v0.1.16)
