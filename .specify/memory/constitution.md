<!--
Sync Impact Report
==================
Version Change: 1.0.0 → 2.0.0 → 2.1.0 → 2.2.0 (Supabase adoption)
Modified Principles:
- Principle I: Removed Yandex Cloud constraints, added hybrid architecture (Supabase + First VDS)
- Principle VIII: REMOVED (Russian Market Compliance) - 152-ФЗ not critical for this project
- Principle X: Changed from Yandex GPT Lite to OpenRouter/OpenAI for AI/NLP
- Security Requirements: Updated to use Supabase Auth and RLS policies
- Technology Standards: Updated to hybrid deployment (Supabase cloud + First VDS)
- Authentication: Now uses Supabase Auth with RLS instead of custom JWT
- MCP Configuration: Updated note about Supabase usage (now actively used)

Added Sections (v2.0.0):
- Principle IX: Modular Phase-Based Delivery (3-phase approach)
- Principle X: AI/NLP Integration Standards (OpenRouter/OpenAI, spam filtering)
- Technology Standards: BuhBot stack with hybrid architecture
- Documentation Requirements: Russian language documentation standards

Updated Sections (v2.2.0):
- Database: Now Supabase (cloud) instead of self-hosted PostgreSQL
- Frontend: Added Supabase JS client, Supabase Auth, Realtime
- Hosting: Hybrid deployment (Supabase for DB/Auth/Storage, VDS for bot/workers)
- Authentication: Supabase Auth + RLS policies for RBAC

Removed Sections:
- Generic "Symancy" references replaced with BuhBot domain specifics
- Yandex Cloud specific requirements
- 152-ФЗ compliance requirements (not applicable)
- Self-hosted PostgreSQL setup

Templates Requiring Updates:
✅ plan-template.md - Constitution Check section references constitution file
✅ spec-template.md - Already aligned with user-centric requirements approach
✅ tasks-template.md - Already organized by user stories and testability principles
⚠ PENDING: Commands may need review for BuhBot-specific workflows

Follow-up TODOs:
- Review .claude/commands/ for alignment with Phase 1/2/3 delivery model
- ❗ CRITICAL: Update docs/Phase-1-Technical-Prompt.md to reflect Supabase + First VDS architecture
- ❗ CRITICAL: Update Module 1.4 (Admin Panel) with Supabase Auth integration
- ❗ CRITICAL: Update Module 1.5 (Infrastructure) with Supabase setup instead of self-hosted PostgreSQL
-->

# BuhBot Project Constitution

**Project**: BuhBot - Accounting Firm Client Communication Automation Platform
**Repository**: https://github.com/maslennikov-ig/BuhBot
**Domain**: Russian accounting firm automation with Telegram integration

## Core Principles

### I. Context-First Development

Every feature implementation MUST begin with comprehensive context gathering before any code is written or delegated. This principle is NON-NEGOTIABLE.

**Requirements:**
- Read existing code in related files
- Search codebase for similar patterns and implementations
- Review relevant documentation files (specs, design docs, technical specifications)
- Check recent commits that touched related areas
- Understand dependencies and integration points
- Consider First VDS infrastructure constraints (single server setup)
- Verify resource usage implications (CPU, RAM, disk on single VDS)

**Rationale:** Context-first prevents duplicate work, ensures consistency with existing patterns, and prevents conflicting approaches. For single VDS deployment, understanding resource constraints is critical. Blind implementation or delegation leads to rework and technical debt.

### II. Agent-Based Orchestration

Complex tasks MUST be delegated to specialized subagents. The orchestrator coordinates but does not implement beyond minimal changes.

**Requirements:**
- Provide complete context to subagents (code snippets, file paths, patterns, documentation references)
- Specify exact expected output and validation criteria
- Include resource constraints when relevant (single VDS deployment considerations)
- Verify results after subagent completes (read modified files, run type-check)
- Re-delegate with corrections if results incorrect
- Only execute directly for trivial tasks (single-line fixes, simple imports, minimal configuration)

**Rationale:** Specialized agents produce higher quality results in their domain. Orchestrator maintains oversight while leveraging specialized expertise. Consistent delegation ensures important constraints are communicated.

### III. Test-Driven Development (Conditional)

When tests are specified in feature requirements, Test-Driven Development (TDD) is MANDATORY. Tests MUST be written first, verified to fail, then implementation proceeds.

**Requirements:**
- Write tests BEFORE implementation
- Verify tests FAIL before implementing
- Follow Red-Green-Refactor cycle
- Tests MUST be independently verifiable for each user story
- Integration tests MUST cover Telegram Bot API interactions
- Performance tests MUST validate <2s bot response time and <3s admin panel load time

**Rationale:** TDD ensures requirements are testable, prevents over-engineering, and provides immediate validation of implementation correctness. Performance requirements are critical for user experience in real-time communication systems.

**Note:** Tests are OPTIONAL by default. Only when explicitly requested in feature specifications does this principle activate.

### IV. Atomic Task Execution

Each task MUST be independently completable, testable, and committable. Tasks are completed one at a time with immediate validation.

**Requirements:**
- Mark task in_progress BEFORE starting
- Verify implementation (read files + run type-check + run build)
- For SLA monitoring features: validate working hours calculation logic
- For bot features: test Telegram API integration manually or with staging bot
- Mark task completed IMMEDIATELY after validation
- Update tasks.md with [X] and artifacts
- Commit with `/push patch` after EACH task
- Move to next task only after current task validated

**Rationale:** Atomic commits provide detailed history, easy rollback, better code review, and clear progress tracking. Batching hides granularity and complicates debugging. For SLA-critical systems, granular validation prevents cascading failures.

### V. User Story Independence

Features MUST be decomposed into independently testable user stories. Each user story delivers standalone value and can be deployed independently.

**Requirements:**
- Prioritize user stories (P1, P2, P3...)
- Each story MUST be independently implementable
- Each story MUST be independently testable
- Each story MUST deliver measurable value (e.g., "30% faster client responses")
- Foundation phase MUST complete before any user story work begins
- Each story MUST respect Telegram Bot API rate limits

**Rationale:** Independent user stories enable incremental delivery, parallel development, and risk reduction. MVP can be delivered with just P1 story. For BuhBot, this enables phased rollout (Phase 1 → Phase 2 → Phase 3) with measurable business value at each stage.

### VI. Quality Gates (NON-NEGOTIABLE)

Type-check, build, and performance validation MUST pass before any commit. No exceptions.

**Requirements:**
- Run type-check after implementation (TypeScript strict mode enabled)
- Run build verification (no build errors)
- No hardcoded credentials (use environment variables)
- No TODO comments without issue references
- Bot response time MUST be <2 seconds (95th percentile)
- Admin panel load time MUST be <3 seconds
- Database query time MUST be <100ms (95th percentile)
- No ESLint errors, no Prettier violations

**Rationale:** Quality gates prevent broken code from entering main branch, reduce debugging time, and maintain codebase health. Performance gates ensure SLA monitoring system itself meets performance standards expected of monitored systems.

### VII. Progressive Specification

Features progress through mandatory specification phases before implementation. Each phase builds upon previous validated artifacts.

**Requirements:**
- Phase 0: Specification (spec.md with user stories)
- Phase 1: Planning (plan.md with technical approach)
- Phase 2: Task Generation (tasks.md organized by user stories)
- Phase 3: Implementation (execute tasks atomically)
- No phase can be skipped
- Each phase output MUST be validated before proceeding
- For BuhBot modules: follow 6-module structure from technical specification

**Rationale:** Progressive specification reduces rework, ensures shared understanding, and validates approach before expensive implementation. BuhBot's modular structure (SLA Monitoring, Feedback, Quick Wins, Admin Panel, Infrastructure, Documentation) maps naturally to user story phases.

### VIII. Modular Phase-Based Delivery

BuhBot MUST be delivered in 3 phases with measurable ROI at each phase. Each phase is independently deployable.

**Requirements:**
- **Phase 1 (6-8 weeks)**: CORE + QUICK WINS (SLA monitoring, feedback, inline buttons, FAQ, templates, infrastructure)
- **Phase 2 (8-12 weeks)**: INTELLIGENCE & PROACTIVE (analytics, big data collection, smart reminders, churn detection)
- **Phase 3 (10-14 weeks)**: WOW & DIFFERENTIATION (referral program, status tracking, celebrations, tier-based membership, integrations)
- Each phase MUST deliver measurable business value independently
- Phase 1 target: 3-4 month payback period, 4x productivity increase for accountants
- Phase 2 target: 15-20% client retention improvement
- No Phase 2 work can begin until Phase 1 is production-ready and validated
- No Phase 3 work can begin until Phase 2 demonstrates measurable analytics value

**Rationale:** Phased delivery reduces financial risk, enables early feedback, and allows course correction based on real usage data. Each phase pays for itself before next phase begins.

**Reference:** See `docs/Phase-1-Technical-Prompt.md` for complete Phase 1 requirements (₽1,420,000 budget, 178 hours SLA module, 142 hours feedback module, 160 hours quick wins, 104 hours admin panel, 52 hours infrastructure, 40 hours documentation).

### IX. AI/NLP Integration Standards

AI features MUST use OpenRouter/OpenAI for Russian language processing. Fallback strategies MUST be implemented for API failures.

**Requirements:**
- Primary AI provider: OpenRouter or OpenAI (with Russian language capable models)
- Recommended models: GPT-4, Claude, or specialized Russian LLMs via OpenRouter
- Fallback: Keyword-based matching for spam filtering
- Spam filter MUST achieve 90%+ accuracy on test dataset
- AI response time MUST be <2 seconds per message
- Training data MUST include Russian accounting firm communication patterns
- Message classification categories: REQUEST | SPAM | GRATITUDE | CLARIFICATION
- All AI prompts MUST be in Russian for optimal performance
- API key management: environment variables only, never hardcoded

**Rationale:** Russian language requires capable NLP models. OpenRouter provides access to multiple models including those optimized for Russian. Fallback ensures system reliability when API is unavailable. Keyword fallback prevents complete system failure.

**Reference:** See `docs/Phase-1-Technical-Prompt.md` Module 1.1.2 for spam filter requirements and Appendix for Russian accounting context.

## Security Requirements

### Data Protection

User data MUST be protected with industry-standard security practices. Encryption is recommended for sensitive data.

**Requirements:**
- No hardcoded credentials in code (use environment variables)
- Consider encryption for sensitive data at rest (AES-256-GCM if implemented)
- HTTPS/TLS for all network connections (Let's Encrypt SSL)
- Store API keys and secrets in environment variables only
- Implement audit logs for critical operations
- Daily automated database backups with appropriate retention
- Regular VDS snapshots for disaster recovery

**Sensitive Data to Protect:**
- Client personal data (name, email, phone)
- Authentication credentials
- API keys (Telegram Bot Token, OpenRouter/OpenAI keys)
- Session tokens

### Authentication & Authorization

Admin panel MUST enforce role-based access control using Supabase Auth and RLS policies.

**Requirements:**
- Supabase Auth for authentication (email + password, bcrypt hashing handled by Supabase)
- JWT tokens managed by Supabase with configurable expiration
- Role-based access control (RBAC): Admin (full access), Manager (view all, configure settings), Observer (read-only)
- RLS (Row Level Security) policies in Supabase for data isolation by role
- All database operations automatically filtered by RLS policies
- Telegram Bot API endpoints: webhook signature validation (no Supabase auth)
- Admin panel API: Supabase session required for all operations
- Audit logs for login attempts, settings changes, survey sends (stored in Supabase)

### Telegram Bot Security

Bot must validate all incoming messages and protect against malicious input.

**Requirements:**
- Validate Telegram webhook signatures to prevent spoofing
- Rate limiting: respect Telegram Bot API limits (30 messages/second per bot)
- Input validation on all message handlers (prevent command injection)
- No sensitive data in bot command responses (use admin panel for sensitive data)
- Deep link validation (prevent open redirect attacks)

## Technology Standards

### Core Stack

**Backend:**
- Runtime: Node.js 18+ with TypeScript (strict mode enabled)
- Framework: Express.js or Fastify
- ORM: Prisma or TypeORM
- Queue: BullMQ with Redis
- Validation: Zod for all API inputs
- Testing: Vitest + Supertest for HTTP testing
- Logging: Winston or Pino (structured logging)

**Frontend (Admin Panel):**
- Framework: Next.js 14+ (App Router)
- UI: Tailwind CSS + shadcn/ui components
- Database Client: Supabase JS client for direct DB queries (with RLS policies)
- API: Supabase client for auth and data operations (alternative: tRPC for complex business logic)
- Charts: Recharts or Chart.js for analytics
- Auth: Supabase Auth (email/password, magic links, optional social providers)
- Realtime: Supabase Realtime for live dashboard updates

**Bot:**
- Library: node-telegram-bot-api or Telegraf
- State Management: Redis for conversation state
- Webhook: Express.js endpoint for Telegram webhooks

**Database:**
- Primary: Supabase (cloud-hosted PostgreSQL with built-in Auth, Storage, Realtime)
- Authentication: Supabase Auth (built-in)
- File Storage: Supabase Storage (for document uploads, invoices)
- Cache: Redis (self-hosted on VDS for BullMQ queue management)
- Search: PostgreSQL Full-Text Search via Supabase (Phase 2: consider Typesense)

**AI/NLP:**
- Provider: OpenRouter or OpenAI (Russian language capable models)
- Recommended: GPT-4, Claude, or specialized Russian LLMs
- Fallback: Keyword matching for spam filtering

**Hosting:**
- Backend API & Bot: First VDS (Russian VDS provider)
- Database & Auth: Supabase (cloud-hosted, EU region recommended for latency)
- Architecture: Hybrid deployment
  - Supabase handles: PostgreSQL, Auth, Storage, Realtime subscriptions
  - VDS handles: Node.js bot application, BullMQ workers, Redis, Nginx
- Monitoring: Supabase dashboard + Prometheus + Grafana (self-hosted on VDS)
- External monitoring: UptimeRobot, Pingdom or similar for uptime alerts
- Backup: Supabase automatic backups + manual exports to VDS/S3

**DevOps:**
- CI/CD: GitHub Actions
- Containers: Docker + Docker Compose
- IaC: Terraform (recommended but optional)
- Process Manager: PM2 or systemd
- Reverse Proxy: Nginx with Let's Encrypt SSL

### File Organization

**Agents:** `.claude/agents/{domain}/{orchestrators|workers}/`
**Commands:** `.claude/commands/`
**Skills:** `.claude/skills/{skill-name}/SKILL.md`
**Specifications:** `.specify/specs/{###-feature-name}/`
**Templates:** `.specify/templates/`
**Temporary Files:** `.tmp/current/` (git ignored)
**Reports:** `docs/reports/{domain}/{YYYY-MM}/`
**Technical Specs:** `docs/Phase-1-Technical-Prompt.md` (authoritative Phase 1 requirements)
**Architecture Docs:** `docs/Agents Ecosystem/ARCHITECTURE.md`

### Code Quality Standards

**TypeScript:**
- Strict mode enabled (`"strict": true` in tsconfig.json)
- No `any` types (use `unknown` if necessary, then type guard)
- ESLint + Prettier configured and enforced
- Import ordering: external libraries, internal modules, relative imports

**Error Handling:**
- All async functions MUST use try/catch
- Structured error responses with status codes
- Log all errors with context (Winston/Pino structured logs)
- User-facing error messages in Russian

**Database:**
- Normalization: 3NF minimum
- Indexes on all foreign keys and frequently queried columns
- Timestamps: `created_at`, `updated_at` on all tables
- Soft deletes: use `deleted_at` instead of hard deletes
- Audit trail: track who created/updated each record

**API Design:**
- RESTful or tRPC (type-safe preferred for admin panel)
- Pagination: maximum 100 items per page
- Filtering support: date range, status, accountant_id
- Sorting: ASC/DESC on key columns
- Consistent error response format: `{ status, message, details }`

**Bot UX:**
- Response time: <2 seconds for all commands (95th percentile)
- Clear feedback: always acknowledge user actions
- Error recovery: helpful error messages with next steps
- Conversation flows: multi-step flows MUST have cancel option
- Accessibility: clear labels, emoji for visual cues
- Language: all bot messages in Russian

### MCP Configuration

**BASE Configuration** (`.mcp.base.json`):
- context7 + sequential-thinking (~600 tokens)
- Use for: code review, debugging, refactoring tasks

**FULL Configuration** (`.mcp.full.json`):
- BASE + supabase + playwright + n8n + shadcn (~5000 tokens)
- Use for: feature development, integration work, UI implementation

**Note:** BuhBot uses Supabase for database, auth, and storage. Use FULL configuration for most development tasks to access Supabase MCP server. Future phases may leverage n8n MCP server for workflow automation.

Switch configurations with `./switch-mcp.sh` based on task needs.

## Performance Requirements

### Bot Performance

- Message response time: <2 seconds (95th percentile)
- Webhook processing: <5 seconds per incoming message
- SLA timer start: within 5 seconds of message receipt
- Alert delivery: within 60 seconds of SLA breach

### Admin Panel Performance

- Page load time: <3 seconds (initial load)
- Dashboard updates: every 30 seconds (WebSocket or polling)
- Report exports: <10 seconds for 1000 records
- Chart rendering: <1 second for typical datasets

### Database Performance

- Query response time: <100ms (95th percentile)
- Connection pool: minimum 10 connections
- Index all foreign keys and query columns
- Monitor slow queries (log queries >100ms)

### Scalability Targets (Phase 1)

**Single VDS Deployment Constraints:**
- VDS resources: Consider CPU, RAM, disk I/O limitations
- Concurrent connections: Optimize for single-server architecture
- Database connection pooling: Appropriate for VDS resources

**Target Metrics:**
- Support 100+ chats simultaneously
- Handle 1000+ requests/day
- Store 100,000+ messages in database
- 99.5% uptime during working hours (Mon-Fri 9:00-18:00 Moscow time)

**Resource Monitoring:**
- Monitor CPU, RAM, disk usage via Prometheus + Grafana
- Alert on resource exhaustion (>80% utilization)
- Plan for vertical scaling (VDS upgrade) or horizontal scaling (multiple VDS) in later phases

## Documentation Requirements

### Code Documentation

- All functions MUST have JSDoc comments
- Complex algorithms MUST have inline comments explaining logic
- API endpoints MUST have request/response examples
- Database schema MUST be documented (ERD + table descriptions)

### User Documentation (Russian Language)

- **For Accountants:** "How to Use BuhBot" guide with bot commands, quick buttons, templates
- **For Clients:** "Quick Start Guide" with button usage, document uploads, status checks
- **For Manager:** "Admin Panel Guide" with SLA configuration, analytics interpretation, survey management
- **Technical Documentation:** Architecture diagram, database schema, API reference, deployment guide, troubleshooting guide

**Format:** Markdown files + PDF exports + screenshots for UI guides

**Reference:** See `docs/Phase-1-Technical-Prompt.md` Module 1.6 for complete documentation requirements.

### Training Requirements

- Accountant training: 2-hour online session on bot usage and template library
- Manager training: 2-hour online session on admin panel and alert response procedures
- Follow-up Q&A: 1-hour session 2 weeks after launch
- Training materials: slide deck, hands-on exercises, 1-page cheat sheet
- Recorded sessions available for future reference

## Success Metrics

### Phase 1 KPIs (Measure After 3 Months)

**SLA Compliance:**
- Target: 90%+ requests answered <1 hour (working time)
- Measurement: Admin panel analytics

**Client Satisfaction:**
- Target: Average rating ≥4.0/5 in quarterly surveys
- Measurement: Feedback collection system

**Efficiency Gains:**
- Target: 30% reduction in average response time
- Target: 4x faster responses using templates/buttons
- Measurement: Before/after comparison

**Adoption:**
- Target: 60%+ accountants use templates regularly
- Target: 80%+ clients use quick buttons
- Measurement: Usage logs from database

**ROI:**
- Target: 3-4 month payback period
- Calculation: Time saved × accountant hourly rate
- Expected savings: ₽440K/month (5 accountants × 2 hours/day saved)

**Reference:** See `docs/Phase-1-Technical-Prompt.md` "Success Metrics" section for detailed measurement methodology.

## Governance

### Constitution Authority

This constitution supersedes all other development practices. When conflicts arise between this constitution and other guidance, the constitution takes precedence.

### Amendment Procedure

Constitution amendments require:

1. Documented rationale for change
2. Impact analysis on existing templates and workflows
3. Version bump according to semantic versioning:
   - **MAJOR**: Backward incompatible governance or principle removals/redefinitions
   - **MINOR**: New principle or section added, or materially expanded guidance
   - **PATCH**: Clarifications, wording, typo fixes, non-semantic refinements
4. Sync Impact Report identifying affected templates
5. Update of all dependent templates and documentation

### Compliance Review

All feature specifications, plans, and implementations MUST verify compliance with this constitution. The "Constitution Check" section in plan-template.md enforces this requirement.

### Complexity Justification

Any violation of constitutional principles MUST be justified in the "Complexity Tracking" section of plan.md. Justifications must explain:

- Why the principle violation is necessary
- Why simpler alternatives were rejected
- Mitigation strategies for introduced complexity

### Runtime Guidance

Development runtime guidance is maintained in `CLAUDE.md` at repository root. This file provides operational procedures that implement constitutional principles but may be updated more frequently than the constitution itself.

### Phase Gate Reviews

Before advancing from Phase 1 → Phase 2 or Phase 2 → Phase 3:

- All acceptance criteria MUST be met (see `docs/Phase-1-Technical-Prompt.md` for Phase 1 criteria)
- Performance requirements MUST be validated in production on First VDS
- Success metrics MUST show positive trend
- Client sign-off required
- Security audit completed (basic checklist for Phase 1)
- VDS resource utilization analyzed and scaled if needed

**Version**: 2.2.0 | **Ratified**: 2025-11-17 | **Last Amended**: 2025-11-17
