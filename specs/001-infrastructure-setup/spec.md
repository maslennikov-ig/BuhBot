# Feature Specification: Infrastructure & Security - Hybrid Deployment Setup

**Feature Branch**: `001-infrastructure-setup`
**Created**: 2025-11-17
**Status**: Draft
**Input**: "Setup Supabase Cloud and First VDS hybrid deployment infrastructure with authentication, database schema, and RLS policies"

## Clarifications

### Session 2025-11-17

- Q: Which Supabase plan tier should be used for the production deployment? → A: Free tier (with plan to upgrade when PITR becomes critical)
- Q: Which VDS hosting provider should be used for the First VDS server? → A: First VDS (FirstVDS.ru)
- Q: What notification channel should critical monitoring alerts use (CPU >80%, bot down, Supabase errors)? → A: Telegram bot messages
- Q: What deployment trigger strategy should GitHub Actions use? → A: GitHub Actions with manual approval for main branch
- Q: Which external uptime monitoring service should be configured (FR-015)? → A: Self-hosted Uptime Kuma
- Q: What should be the containerization strategy for the bot application? → A: Separate containers: one for bot application, one shared container for all monitoring tools (Prometheus + Grafana + Uptime Kuma)

## User Scenarios & Testing

### User Story 1 - Supabase Cloud Database Setup (Priority: P1)

**As a** developer, **I want** a fully configured Supabase project with database schema, authentication, and storage buckets, **so that** all application modules can securely store and retrieve data with role-based access control.

**Independent Test**: Navigate to Supabase dashboard → verify database tables exist, RLS policies are active, Auth provider is configured, and Storage buckets are created.

**Acceptance Scenarios**:

1. **Given** Supabase project is created in EU region (Free tier), **When** I check project settings, **Then** I see PostgreSQL 15+ database with daily automated backups enabled
2. **Given** database schema is deployed, **When** I query tables via SQL editor, **Then** all tables (client_requests, feedback_responses, sla_alerts, etc.) exist with correct relationships
3. **Given** RLS policies are configured, **When** I attempt to query data as different roles (admin/manager/observer), **Then** I see only data permitted by RLS policies
4. **Given** Supabase Auth is enabled, **When** I create a test user with email/password, **Then** user can authenticate and receive JWT token
5. **Given** Storage buckets are created, **When** I upload a test file to 'invoices' bucket, **Then** file is stored with correct permissions

---

### User Story 2 - First VDS Server Deployment (Priority: P1)

**As a** DevOps engineer, **I want** a VDS server with Docker Compose running Node.js bot, Redis, Nginx, and monitoring tools, **so that** the Telegram bot application can operate reliably with HTTPS and proper monitoring.

**Independent Test**: SSH into VDS → run `docker compose ps` → verify all containers (bot, redis, nginx, monitoring-stack) are running and healthy.

**Acceptance Scenarios**:

1. **Given** VDS is provisioned with Ubuntu 22.04 LTS, **When** I check system resources, **Then** I see 2-4 vCPU, 4-8 GB RAM, 50-100 GB SSD available
2. **Given** Docker and Docker Compose are installed, **When** I run `docker --version && docker compose version`, **Then** both commands return valid versions
3. **Given** bot application is deployed via Docker Compose, **When** I run `docker compose ps`, **Then** all services (bot, redis, nginx, monitoring-stack) show 'Up' status
4. **Given** Nginx reverse proxy is configured, **When** I visit `https://bot.example.com`, **Then** HTTPS works with valid Let's Encrypt certificate
5. **Given** environment variables are set, **When** I check `.env.production` file, **Then** all secrets (SUPABASE_URL, TELEGRAM_BOT_TOKEN, etc.) are present and NOT committed to git

---

### User Story 3 - Security & Data Protection Implementation (Priority: P1)

**As a** security-conscious administrator, **I want** all connections encrypted via HTTPS/TLS and secrets managed securely, **so that** client data is protected from unauthorized access and interception.

**Independent Test**: Run security audit script → verify HTTPS enabled, no hardcoded secrets in code, Telegram webhook signature validation working, RLS policies enforced.

**Acceptance Scenarios**:

1. **Given** Nginx is configured with Let's Encrypt, **When** I test HTTPS connection with `curl -I https://bot.example.com`, **Then** response shows valid SSL certificate
2. **Given** Supabase connection uses TLS, **When** bot connects to database, **Then** connection string includes `sslmode=require`
3. **Given** Telegram webhook is configured, **When** bot receives webhook request, **Then** webhook signature is validated before processing
4. **Given** API rate limiting is enabled, **When** I send 100 requests in 1 second, **Then** requests are throttled after threshold
5. **Given** RLS policies are active, **When** manager user queries `client_requests` table, **Then** they can only see data for their assigned chats

---

### User Story 4 - Monitoring & Alerting Setup (Priority: P1)

**As a** system administrator, **I want** Prometheus metrics collection and Grafana dashboards for bot performance and system health, **so that** I can proactively identify and resolve issues before they impact users.

**Independent Test**: Visit Grafana dashboard → verify metrics for bot latency, Redis queue length, CPU/RAM usage, and Supabase connection health are displaying.

**Acceptance Scenarios**:

1. **Given** Prometheus is scraping metrics, **When** I query `http://localhost:9090/metrics`, **Then** I see metrics for bot_messages_processed, redis_queue_length, cpu_usage, memory_usage
2. **Given** Grafana is configured, **When** I log in to Grafana dashboard, **Then** I see dashboards for 'Bot Performance', 'System Health', 'SLA Metrics'
3. **Given** Uptime Kuma external monitoring is configured, **When** bot goes offline, **Then** Uptime Kuma sends alert to Telegram within 5 minutes
4. **Given** Prometheus alert rules are defined, **When** CPU usage exceeds 80% for 5 minutes, **Then** Prometheus sends alert to Alertmanager
5. **Given** Grafana alerts are configured, **When** Supabase connection errors exceed threshold, **Then** alert notification is sent to designated Telegram chat (administrator receives bot message with alert details)

---

### User Story 5 - Backup & Disaster Recovery (Priority: P2)

**As a** system administrator, **I want** automated backups of Supabase database and VDS volumes with documented recovery procedures, **so that** data can be restored within 4 hours in case of disaster.

**Independent Test**: Manually trigger backup script → destroy test data → restore from backup → verify data integrity.

**Acceptance Scenarios**:

1. **Given** Supabase Free tier is active, **When** I check backup settings in Supabase dashboard, **Then** daily automated backups are enabled (manual PITR upgrade path documented for Pro tier)
2. **Given** VDS backup script runs weekly via cron, **When** I check `/var/backups/` directory, **Then** I see weekly backup archives (backup-YYYYMMDD.tar.gz)
3. **Given** disaster recovery runbook exists, **When** I follow documented steps to restore database, **Then** data is successfully restored from daily automated backup (Free tier) OR PITR backup (Pro tier if upgraded)
4. **Given** application config is backed up, **When** I export settings tables to JSON, **Then** critical configuration (templates, FAQ, settings) is saved to version control
5. **Given** recovery time objective is 4 hours, **When** I simulate complete VDS failure, **Then** full system restoration (VDS + database) completes within RTO target

---

### User Story 6 - CI/CD Deployment Pipeline (Priority: P2)

**As a** developer, **I want** GitHub Actions workflow that automatically deploys bot application to VDS on git push, **so that** deployments are consistent, automated, and traceable.

**Independent Test**: Push code change to main branch → verify GitHub Actions workflow succeeds → SSH to VDS and verify new version is deployed.

**Acceptance Scenarios**:

1. **Given** GitHub Actions workflow is configured, **When** I push to `main` branch, **Then** workflow triggers automatically and runs build/test steps
2. **Given** workflow runs tests, **When** tests pass, **Then** deployment waits for manual approval before executing
3. **Given** deployment uses SSH to VDS, **When** workflow connects to VDS, **Then** connection uses SSH key stored in GitHub Secrets
4. **Given** deployment script runs, **When** new Docker image is built, **Then** bot restarts with zero downtime (graceful shutdown)
5. **Given** deployment completes, **When** I check deployment status in GitHub Actions, **Then** workflow shows 'Success' and logs are accessible

---

### Edge Cases

- **What happens when Supabase service has an outage?** Bot should cache recent data in Redis and switch to read-only mode, displaying cached responses to clients until Supabase recovers.
- **How does system handle VDS resource exhaustion?** Prometheus alerts fire when CPU/RAM/disk exceed thresholds → administrator receives notification → can scale VDS resources or restart services.
- **What if Let's Encrypt certificate renewal fails?** Monitoring detects certificate expiration approaching → manual renewal triggered → Nginx reloaded with new certificate.
- **How to handle corrupted Docker volumes?** Weekly backups allow restore from latest snapshot → documented recovery procedure ensures minimal downtime.
- **What if multiple administrators try to deploy simultaneously?** GitHub Actions uses concurrency control → only one deployment runs at a time → subsequent deployments queue.

## Requirements

### Functional Requirements

- **FR-001**: System MUST provision Supabase project in EU region with PostgreSQL 15+, Auth, Storage, and Realtime capabilities
- **FR-002**: System MUST deploy complete database schema with all tables (client_requests, feedback_responses, sla_alerts, users, chats, working_schedules, templates, faq_items) including indexes and relationships
- **FR-003**: System MUST configure RLS policies for three roles: admin (full access), manager (view all, modify settings), observer (read-only)
- **FR-004**: System MUST set up Supabase Auth with email/password provider and JWT token generation
- **FR-005**: System MUST create Supabase Storage buckets (invoices, documents, files) with appropriate access policies
- **FR-006**: System MUST provision First VDS (FirstVDS.ru provider) with minimum 2 vCPU, 4 GB RAM, 50 GB SSD running Ubuntu 22.04 LTS
- **FR-007**: System MUST deploy Docker Compose stack with separate containers: bot application (isolated), Redis, Nginx, and shared monitoring container (Prometheus + Grafana + Uptime Kuma bundled together for resource efficiency)
- **FR-008**: System MUST configure Nginx reverse proxy with Let's Encrypt SSL certificate for HTTPS
- **FR-009**: System MUST configure VDS firewall to allow only ports 443 (HTTPS), 80 (HTTP redirect), and SSH (key-based auth only)
- **FR-010**: System MUST store all secrets in environment variables (.env.production file) and NEVER commit secrets to git
- **FR-011**: System MUST implement Telegram webhook signature validation to prevent unauthorized requests
- **FR-012**: System MUST implement API rate limiting (configurable threshold, default 100 req/min per IP)
- **FR-013**: System MUST collect Prometheus metrics: bot_messages_processed, redis_queue_length, cpu_usage, memory_usage, supabase_connection_errors
- **FR-014**: System MUST create Grafana dashboards: Bot Performance, System Health, SLA Metrics
- **FR-015**: System MUST configure external uptime monitoring using self-hosted Uptime Kuma with 5-minute check interval and Telegram notifications
- **FR-016**: System MUST enable Supabase Point-in-Time Recovery with 7+ day retention (deferred until upgrade to Pro tier; Free tier relies on daily automated backups with manual export capability)
- **FR-017**: System MUST create automated weekly VDS backup script (cron job) for Docker volumes and configs
- **FR-018**: System MUST document disaster recovery procedures with RTO=4 hours, RPO=24 hours
- **FR-019**: System MUST implement GitHub Actions CI/CD workflow for automated deployment to VDS with manual approval gate on main branch (auto build/test, manual deploy approval)
- **FR-020**: System MUST use connection pooling for Supabase database connections to optimize performance
- **FR-021**: System MUST send all critical monitoring alerts (CPU >80%, memory >80%, disk >85%, bot down, Supabase errors) to designated Telegram chat via bot messages with severity level and actionable details

### Key Entities

- **Supabase Project**: Cloud-hosted PostgreSQL database, Auth service, Storage service, Realtime subscriptions. Primary data store for all application data.
- **VDS Server**: FirstVDS.ru server hosting bot application, Redis queue, Nginx proxy, monitoring tools. Connects to Supabase over HTTPS/TLS.
- **Docker Containers**: Services running in Docker Compose with separation of concerns: bot (Node.js, isolated for fault tolerance), redis (cache/queue), nginx (reverse proxy), monitoring-stack (shared container with Prometheus + Grafana + Uptime Kuma for resource efficiency).
- **RLS Policy**: Row Level Security rule in Supabase enforcing role-based access control at database level. Three roles: admin, manager, observer.
- **Supabase Auth User**: Authenticated admin panel user with JWT token. Created via Supabase Auth, stored in `auth.users` table.
- **Storage Bucket**: Supabase Storage container for uploaded files. Three buckets: invoices, documents, files. Each has access policies.
- **Prometheus Metric**: Time-series data point collected by Prometheus. Examples: bot_messages_processed_total, redis_queue_length_current, cpu_usage_percent.
- **Grafana Dashboard**: Visualization panel displaying Prometheus metrics. Three dashboards: Bot Performance, System Health, SLA Metrics.
- **Backup Archive**: Compressed tar.gz file containing VDS Docker volumes and configs. Created weekly, retained 4 weeks.
- **GitHub Actions Workflow**: CI/CD pipeline triggered on git push. Runs tests → builds Docker image → deploys to VDS via SSH.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Supabase database schema deployed with 100% of required tables, indexes, and RLS policies verified
- **SC-002**: All Docker containers (bot, redis, nginx, monitoring-stack) achieve 99.5%+ uptime during 7-day pilot test
- **SC-003**: HTTPS certificate from Let's Encrypt successfully issued and auto-renews every 90 days without manual intervention
- **SC-004**: Bot response time to Telegram webhook requests <500ms (p95) measured via Prometheus metrics
- **SC-005**: Supabase database queries execute in <100ms (p95) measured via query logs
- **SC-006**: Zero secrets leaked to git repository verified by scanning commit history and .gitignore coverage
- **SC-007**: Telegram webhook signature validation rejects 100% of invalid signatures in penetration testing
- **SC-008**: RLS policies prevent unauthorized data access in 100% of role-based test scenarios (20+ scenarios)
- **SC-009**: Prometheus collects metrics from all services with <1% data loss over 7-day period
- **SC-010**: Grafana dashboards display real-time metrics with <5 second refresh latency
- **SC-011**: External uptime monitoring (Uptime Kuma) detects bot downtime within 5 minutes and sends Telegram alert
- **SC-012**: Database restore from Supabase daily backup completes successfully within 1 hour in disaster recovery test (RPO: 24 hours on Free tier)
- **SC-013**: VDS backup script runs weekly without errors and creates valid backup archives for 4 consecutive weeks
- **SC-014**: GitHub Actions deployment workflow completes in <10 minutes with 95%+ success rate over 10 deployments
- **SC-015**: System handles 100 simultaneous Telegram webhook requests without errors or rate limit violations
- **SC-016**: Monitoring alerts fire within 5 minutes when critical thresholds exceeded (CPU >80%, memory >80%, disk >85%)

### Performance Metrics

- **PM-001**: Bot webhook response time: <500ms (p95), <1000ms (p99)
- **PM-002**: Supabase query latency: <50ms (p50), <100ms (p95)
- **PM-003**: Redis operation latency: <10ms (p95)
- **PM-004**: HTTPS handshake time: <200ms (p95)
- **PM-005**: Grafana dashboard load time: <2 seconds
- **PM-006**: Prometheus metric scrape interval: 15 seconds
- **PM-007**: Backup script execution time: <30 minutes
- **PM-008**: GitHub Actions deployment time: <10 minutes
- **PM-009**: Container restart time (graceful shutdown): <30 seconds
- **PM-010**: System recovery time (full outage): <4 hours (RTO)
