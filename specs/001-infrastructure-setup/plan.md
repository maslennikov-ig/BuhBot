# Implementation Plan: Infrastructure & Security - Hybrid Deployment Setup

**Branch**: `001-infrastructure-setup` | **Date**: 2025-11-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature spec from `/specs/001-infrastructure-setup/spec.md`

**Note**: Template filled by `/speckit.plan` command.

## Summary

Setup hybrid cloud infrastructure combining Supabase Cloud (EU region, Free tier) for managed PostgreSQL database, Auth, Storage, and Realtime capabilities with First VDS (FirstVDS.ru) for bot application, Redis queue, and monitoring stack. Deploy containerized services using Docker Compose with separate bot container (isolated for fault tolerance) and shared monitoring-stack container (Prometheus + Grafana + Uptime Kuma for resource efficiency). Implement comprehensive security (HTTPS via Let's Encrypt, Telegram webhook signature validation, Supabase RLS policies for RBAC), monitoring (Prometheus metrics, Grafana dashboards, external uptime checks), backup/disaster recovery (automated Supabase backups + weekly VDS backups, RTO=4h, RPO=24h), and CI/CD pipeline (GitHub Actions with manual approval gate for main branch deployments).

## Technical Context

**Language/Version**: Node.js 18+ with TypeScript (strict mode)
**Primary Dependencies**:

- **Backend**: Express.js or Fastify, Prisma or TypeORM, BullMQ + Redis, Zod validation
- **Bot**: node-telegram-bot-api or Telegraf
- **Frontend**: Next.js 14+ (App Router), Supabase JS client, Tailwind CSS + shadcn/ui
- **Database**: Supabase (cloud PostgreSQL), Redis (self-hosted on VDS)
- **Monitoring**: Prometheus, Grafana, Uptime Kuma
- **Infrastructure**: Docker, Docker Compose, Nginx, Let's Encrypt

**Storage**:

- **Primary**: Supabase PostgreSQL (cloud-hosted, EU region)
- **Cache/Queue**: Redis (self-hosted on VDS)
- **Files**: Supabase Storage buckets (invoices, documents, files)

**Testing**: Vitest + Supertest for HTTP testing (TDD optional, not required for Phase 1 infrastructure setup)

**Target Platform**:

- **Database/Auth/Storage**: Supabase Cloud (EU region)
- **Bot/Workers/Monitoring**: First VDS (FirstVDS.ru) - Ubuntu 22.04 LTS, 2-4 vCPU, 4-8 GB RAM, 50-100 GB SSD

**Project Type**: Web application (bot backend + admin panel frontend) + Infrastructure

**Performance Goals**:

- Bot webhook response: <500ms (p95), <1000ms (p99)
- Supabase query latency: <50ms (p50), <100ms (p95)
- Redis operations: <10ms (p95)
- HTTPS handshake: <200ms (p95)
- Container restart (graceful): <30 seconds

**Constraints**:

- Single VDS deployment (resource-constrained, optimize for CPU/RAM efficiency)
- Supabase Free tier limitations (no PITR until Pro tier upgrade)
- Telegram Bot API rate limits (30 messages/second)
- HTTPS required for all connections (TLS 1.2+)
- Daily automated backups (Supabase), weekly VDS backups
- No hardcoded credentials (environment variables only)

**Scale/Scope**:

- Support 100+ chats simultaneously
- Handle 1000+ requests/day
- Store 100,000+ messages in database
- 99.5% uptime target during working hours
- Phase 1 infrastructure foundation for 3-phase roadmap

## Constitution Check

_GATE: Must pass before Phase 0. Re-check after Phase 1._

### I. Context-First Development ✅ PASS

- Infrastructure setup requires context gathering from:
  - Existing codebase structure (verify if any infrastructure already exists)
  - Technology standards from constitution (Node.js, TypeScript, Supabase, Docker, etc.)
  - BuhBot Phase 1 technical requirements (`docs/Phase-1-Technical-Prompt.md`)
  - Similar Docker Compose deployments (research phase)
  - Supabase best practices documentation
  - First VDS resource constraints and optimization strategies

### II. Agent-Based Orchestration ✅ PASS

- Complex infrastructure tasks will be delegated to specialized agents:
  - `infrastructure-specialist`: Supabase setup, VDS configuration, Docker Compose, monitoring tools
  - `database-architect`: PostgreSQL schema design, RLS policies, migration creation
  - `api-builder` (if needed): API endpoints for admin panel integration
- Orchestrator provides complete context including resource constraints, security requirements, performance targets
- Verification required after each subagent task: read config files, test deployments, validate security settings

### III. Test-Driven Development (Conditional) ⚠️ DEFERRED

- TDD not explicitly required for infrastructure setup in spec
- Infrastructure verification relies on acceptance tests (manual verification steps in user stories)
- Integration tests for API endpoints will be added in subsequent features (not infrastructure setup)
- **Rationale**: Infrastructure setup is primarily configuration/deployment, not business logic requiring unit tests

### IV. Atomic Task Execution ✅ PASS

- Infrastructure tasks will be broken into atomic units:
  1. Supabase project creation + database schema deployment
  2. RLS policies configuration
  3. Supabase Auth + Storage setup
  4. VDS provisioning + Docker/Docker Compose installation
  5. Docker Compose stack configuration (bot, redis, nginx, monitoring-stack)
  6. Nginx reverse proxy + Let's Encrypt SSL
  7. Security hardening (firewall, secrets management, webhook validation)
  8. Monitoring setup (Prometheus, Grafana, Uptime Kuma)
  9. Backup scripts + disaster recovery documentation
  10. CI/CD pipeline (GitHub Actions)
- Each task independently testable and committable
- Commit after each task with `/push patch`

### V. User Story Independence ✅ PASS

- User stories are independently testable:
  - **US1 (P1)**: Supabase Cloud setup → verify in Supabase dashboard
  - **US2 (P1)**: VDS deployment → SSH + `docker compose ps`
  - **US3 (P1)**: Security implementation → security audit script
  - **US4 (P1)**: Monitoring setup → verify Grafana dashboards
  - **US5 (P2)**: Backup/DR → manual restore test
  - **US6 (P2)**: CI/CD pipeline → test deployment via GitHub Actions
- Foundation (US1 + US2) completes before monitoring/backup layers
- Each story delivers measurable value independently

### VI. Quality Gates (NON-NEGOTIABLE) ✅ PASS

- Quality gates for infrastructure:
  - **Type-check**: All TypeScript configuration files must pass strict type-check
  - **Build**: Docker images must build successfully without errors
  - **Security**: No hardcoded credentials in any config files (verified by git grep)
  - **Performance**: Docker containers must start within <30 seconds
  - **Connectivity**: HTTPS connection must work with valid SSL certificate
  - **RLS**: Database RLS policies must block unauthorized access (20+ test scenarios)
- All gates enforced before commit

### VII. Progressive Specification ✅ PASS

- Phase 0: Specification complete (`spec.md` with 6 user stories, clarifications resolved)
- Phase 1: Planning (this file `plan.md` with technical context)
- Phase 2: Task Generation (`tasks.md` organized by user stories) - **NEXT STEP**
- Phase 3: Implementation (execute tasks atomically)
- No phase skipped, each phase validated before proceeding

### VIII. Modular Phase-Based Delivery ✅ PASS

- Infrastructure setup is **Module 1.5** in BuhBot Phase 1 (52 hours budgeted)
- Completes foundation for Phase 1 modules:
  - Module 1.1: SLA Monitoring (requires database + auth)
  - Module 1.2: Feedback Collection (requires bot + database)
  - Module 1.3: Quick Wins (requires bot + templates storage)
  - Module 1.4: Admin Panel (requires Supabase Auth + RLS + frontend hosting)
- Measurable value: Provides secure, monitored, backed-up infrastructure for all Phase 1 features
- No Phase 2 work included (analytics, big data collection not in scope)

### IX. AI/NLP Integration Standards ⚠️ NOT APPLICABLE

- Infrastructure setup does not involve AI/NLP integration
- OpenRouter/OpenAI integration will occur in Module 1.1 (spam filtering) - different feature
- **Rationale**: This feature focuses on infrastructure, not AI features

### Security Requirements ✅ PASS

- **Data Protection**:
  - HTTPS/TLS for all connections (Let's Encrypt SSL)
  - Supabase automatic encryption at rest
  - No hardcoded credentials (environment variables only)
  - Daily automated backups (Supabase), weekly VDS backups
- **Authentication & Authorization**:
  - Supabase Auth with email/password
  - RLS policies for RBAC (admin/manager/observer roles)
  - JWT tokens managed by Supabase
  - Telegram webhook signature validation
- **Bot Security**:
  - Webhook signature validation
  - Rate limiting (100 req/min per IP)
  - Input validation on message handlers

### Technology Standards ✅ PASS

- Aligns with constitution Technology Standards section:
  - Node.js 18+ with TypeScript (strict mode)
  - Supabase for database/auth/storage (hybrid deployment)
  - First VDS for bot/workers/monitoring (single server)
  - Docker + Docker Compose for containerization
  - Prometheus + Grafana for monitoring
  - GitHub Actions for CI/CD
  - Nginx with Let's Encrypt SSL
- MCP Configuration: Will use FULL configuration (`.mcp.full.json`) for Supabase access during implementation

### Performance Requirements ✅ PASS

- Bot webhook response: <500ms (p95) ← Spec SC-004
- Supabase queries: <100ms (p95) ← Spec SC-005
- Redis operations: <10ms (p95) ← Constitution database performance
- Container restart: <30 seconds ← Spec PM-009
- System recovery: <4 hours (RTO) ← Spec PM-010
- All performance targets measurable via Prometheus metrics

### Documentation Requirements ⚠️ PARTIAL (Will be completed during implementation)

- Disaster recovery runbook: **TO BE CREATED** in Phase 1
- Deployment guide: **TO BE CREATED** as `quickstart.md` in Phase 1
- Architecture diagram: **TO BE ADDED** to technical documentation
- Security audit checklist: **TO BE CREATED** for Phase 1 gate review

**OVERALL STATUS**: ✅ **PASS** (with documentation artifacts to be created during Phase 1)

**Violations Requiring Justification**: None

**Deferred Items**:

- TDD (Principle III): Infrastructure setup uses acceptance tests, not unit tests
- AI/NLP Standards (Principle IX): Not applicable to infrastructure feature
- Documentation: Will be completed as Phase 1 artifacts (quickstart.md, disaster recovery runbook)

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md          # This file
├── research.md      # Phase 0 output
├── research/        # Complex research (if needed)
├── data-model.md    # Phase 1 output
├── quickstart.md    # Phase 1 output
├── contracts/       # Phase 1 output
└── tasks.md         # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

**Structure Decision**: Web application (Telegram bot backend + Next.js admin panel) with Docker Compose orchestration

```text
# Backend (Bot + API)
backend/
├── src/
│   ├── bot/           # Telegram bot handlers
│   ├── services/      # Business logic (SLA, feedback, etc.)
│   ├── db/            # Database client, Prisma/TypeORM models
│   ├── queue/         # BullMQ job processors
│   └── api/           # REST/tRPC endpoints for admin panel
├── tests/
│   ├── integration/   # API endpoint tests
│   └── unit/          # Service logic tests
├── prisma/            # Prisma schema and migrations (if using Prisma)
│   └── migrations/
└── Dockerfile

# Frontend (Admin Panel)
frontend/
├── src/
│   ├── app/           # Next.js 14 App Router pages
│   ├── components/    # shadcn/ui components
│   ├── lib/           # Supabase client, utils
│   └── types/         # TypeScript types
├── public/
└── Dockerfile

# Infrastructure (Deployment)
infrastructure/
├── docker-compose.yml              # Service orchestration
├── docker-compose.prod.yml         # Production overrides
├── nginx/
│   ├── nginx.conf                  # Reverse proxy config
│   └── ssl/                        # Let's Encrypt certificates
├── monitoring/
│   ├── prometheus/
│   │   ├── prometheus.yml          # Metrics collection config
│   │   └── alerts.yml              # Alert rules
│   ├── grafana/
│   │   ├── dashboards/             # JSON dashboard definitions
│   │   └── datasources/            # Prometheus datasource config
│   └── uptime-kuma/
│       └── data/                   # Persistent storage
├── supabase/
│   ├── migrations/                 # SQL migration files
│   ├── seed.sql                    # Initial data
│   └── functions/                  # Supabase Edge Functions (if needed)
├── scripts/
│   ├── backup.sh                   # VDS backup script (cron job)
│   ├── restore.sh                  # Disaster recovery script
│   └── deploy.sh                   # Deployment script for GitHub Actions
└── .env.example                    # Environment variable template

# CI/CD
.github/
└── workflows/
    ├── ci.yml                      # Build + test on PR
    └── deploy.yml                  # Deploy to VDS (manual approval)

# Documentation
docs/
├── infrastructure/
│   ├── deployment-guide.md         # Quickstart for VDS setup
│   ├── disaster-recovery.md        # DR runbook
│   ├── architecture-diagram.png    # System architecture
│   └── security-checklist.md       # Phase 1 security audit
└── Phase-1-Technical-Prompt.md     # Phase 1 requirements (existing)
```

## Complexity Tracking

> Fill ONLY if Constitution Check has violations requiring justification

**No violations detected.** All constitutional principles are satisfied by this implementation plan.

---

## Phase 1 Completion: Post-Design Constitution Re-Check

**Status**: ✅ **PASS** (All principles maintained after design phase)

### Design Artifacts Generated:

1. ✅ **research.md**: 13 technical decisions documented (ORM, bot library, API layer, Docker images, monitoring bundling, SSL management, secrets, backups, metrics, dashboards, CI/CD, disaster recovery, rate limiting)
2. ✅ **data-model.md**: Complete PostgreSQL schema (8 tables, RLS policies, functions, triggers, normalization, indexes)
3. ✅ **contracts/**: API contracts defined (tRPC admin API + Telegram webhook OpenAPI spec)
4. ✅ **quickstart.md**: Comprehensive deployment guide (8 steps, ~2.5 hour first deployment, troubleshooting, security checklist)

### Principle Validation Post-Design:

**I. Context-First Development** ✅ MAINTAINED

- Research phase gathered context from:
  - Prisma vs TypeORM documentation (Context7)
  - Telegraf vs node-telegram-bot-api comparison
  - Docker Alpine base images best practices
  - Supabase RLS policy patterns
  - Let's Encrypt certbot integration guides
- All technical unknowns from Technical Context resolved

**II. Agent-Based Orchestration** ✅ MAINTAINED

- Implementation will delegate to:
  - `infrastructure-specialist`: Docker Compose, Nginx, monitoring stack
  - `database-architect`: Supabase migrations, RLS policies
  - `api-builder`: tRPC router implementation
- Each agent will receive complete context from research.md, data-model.md, contracts/

**III. Test-Driven Development** ⚠️ DEFERRED (unchanged)

- Infrastructure verification via acceptance tests (manual steps in quickstart.md)
- Integration tests for API endpoints deferred to feature modules (not infrastructure setup)

**IV. Atomic Task Execution** ✅ MAINTAINED

- Tasks will be broken down per quickstart.md sections (8 major steps, each independently testable)
- Each step commits after validation (e.g., Supabase schema → verify tables exist → commit)

**V. User Story Independence** ✅ MAINTAINED

- User stories remain independently testable:
  - US1: Supabase setup (verifiable via dashboard)
  - US2: VDS deployment (verifiable via `docker compose ps`)
  - US3: Security (verifiable via security audit script)
  - US4: Monitoring (verifiable via Grafana dashboards)
  - US5: Backups (verifiable via restore test)
  - US6: CI/CD (verifiable via GitHub Actions deployment)

**VI. Quality Gates** ✅ MAINTAINED

- Quality gates enforced via quickstart.md verification checklist (Step 8):
  - Database schema deployed (Supabase SQL query verification)
  - Docker images build successfully (no build errors)
  - HTTPS works with valid SSL certificate (curl test)
  - RLS policies block unauthorized access (20+ test scenarios documented in data-model.md)
  - No hardcoded credentials (gitignore verification + security checklist)

**VII. Progressive Specification** ✅ MAINTAINED

- Phase 0 complete: research.md with all technical decisions resolved
- Phase 1 complete: data-model.md, contracts/, quickstart.md
- Phase 2 next: tasks.md generation (via `/speckit.tasks`)
- Phase 3 next: Implementation (execute tasks atomically)

**VIII. Modular Phase-Based Delivery** ✅ MAINTAINED

- Infrastructure setup remains Module 1.5 in BuhBot Phase 1
- Provides foundation for all Phase 1 modules:
  - Database schema includes tables for SLA monitoring, feedback, templates, FAQ
  - API contracts define endpoints for admin panel integration
  - Monitoring stack ready for Phase 1 metrics collection

**IX. AI/NLP Integration Standards** ⚠️ NOT APPLICABLE (unchanged)

- OpenRouter/OpenAI integration deferred to Module 1.1 (spam filtering)

**Security Requirements** ✅ MAINTAINED

- All security requirements documented in quickstart.md:
  - HTTPS/TLS for all connections (Step 4: Nginx + Let's Encrypt)
  - No hardcoded credentials (Step 3.2: .env.production with .gitignore)
  - Supabase Auth + RLS policies (Step 1: Supabase setup)
  - Telegram webhook signature validation (Step 5: Configure webhook with secret_token)
  - Firewall configuration (Step 2.4: UFW allows only 22, 80, 443)
  - SSH key authentication (Step 2.2: Copy SSH key, disable password auth)

**Technology Standards** ✅ MAINTAINED

- All technology choices from constitution implemented:
  - Node.js 18+ with TypeScript (research.md: ORM selection → Prisma)
  - Supabase for database/auth/storage (data-model.md: Complete schema)
  - Docker + Docker Compose (quickstart.md: Step 3 deployment)
  - Telegraf for bot (research.md: Bot library decision)
  - tRPC for admin API (contracts/trpc-admin-api.ts)
  - Nginx with Let's Encrypt SSL (quickstart.md: Step 4)
  - Prometheus + Grafana + Uptime Kuma (research.md: Monitoring stack bundling)

**Performance Requirements** ✅ MAINTAINED

- Performance targets documented and measurable:
  - Bot webhook response <500ms (quickstart.md: Health check endpoint + Prometheus metrics)
  - Supabase queries <100ms (data-model.md: Indexes on all FKs + query columns)
  - Redis operations <10ms (research.md: Redis 7-alpine official image)
  - Container restart <30 seconds (quickstart.md: Docker Compose graceful shutdown)
  - System recovery <4 hours (quickstart.md: Step 7 backup + disaster recovery procedures)

**Documentation Requirements** ✅ COMPLETED

- All documentation artifacts created:
  - ✅ Deployment guide: `quickstart.md` (comprehensive 8-step guide with troubleshooting)
  - ✅ Architecture diagram: ASCII diagram in quickstart.md (visual architecture overview)
  - ⏳ Disaster recovery runbook: Referenced in quickstart.md (to be created during implementation)
  - ⏳ Security audit checklist: Referenced in quickstart.md (to be created during implementation)

### New Risks Identified: None

### Recommendations:

1. **Proceed to Phase 2**: Run `/speckit.tasks` to generate atomic task breakdown from design artifacts
2. **Create Remaining Documentation**: During implementation, create disaster recovery runbook and security audit checklist
3. **Validate Performance**: After deployment, run load tests to verify <500ms bot response time target

**Overall Status**: ✅ **READY FOR TASK GENERATION** (Phase 2)

---
