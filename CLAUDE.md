# CLAUDE.md

@AGENTS.md

## Claude Code CLI Adapter

- Target runtime: Claude Code CLI in the VS Code integrated terminal on WSL.
- Primary workflow comes from global `~/.claude/CLAUDE.md` and the `orchestration-bridge` plugin.
- Remote push, PR creation, merge, deploy, force-push, and production mutation require repo contract support and current user authorization.

## Preserved Project Notes

## Project Conventions

**File Organization**:

- Agents: `.claude/agents/{domain}/{orchestrators|workers}/`
- Commands: `.claude/commands/`
- Skills: `.claude/skills/{skill-name}/SKILL.md`
- Temporary: `.tmp/current/` (git ignored)
- Reports: `docs/reports/{domain}/{YYYY-MM}/`

**Git Workflow**:

- Always work on feature branches, never push directly to main
- Branch naming: `feat/<issue-id>`, `fix/<issue-id>`, `chore/<description>`
- Use `/push` to commit, push feature branch, and create PR
- PRs merge to main via GitHub (squash merge preferred)
- Release Please creates release PR automatically after merge to main
- Direct push to main is blocked by branch protection

**Code Standards**:

- Type-check must pass before commit
- Build must pass before commit
- **Pre-commit hooks (Husky)** run on `git commit`: lint-staged (ESLint + Prettier on staged files) and commitlint (message format). If commit fails, the **terminal output** of the commit command contains the errors; fix and retry. Do not use `--no-verify` unless explicitly asked.
- No hardcoded credentials

**Agent Selection**:

- Worker: Plan file specifies nextAgent (health workflows only)
- Skill: Reusable utility, no state, <100 lines

**BuhBot Specific**:

- Project: BuhBot - communication automation for accounting firms
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

> **LTS Policy**: Use only stable LTS versions. Upgrade major versions after 3+ months of stability.

**Runtime & Language:**

- Node.js 20.x (recorded baseline; now EOL — plan migration separately).
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
