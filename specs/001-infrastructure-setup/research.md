# Research: Infrastructure & Security Technical Decisions

**Feature**: 001-infrastructure-setup
**Date**: 2025-11-17
**Phase**: 0 - Research & Technical Decisions

## Overview

This document consolidates technical research for infrastructure setup decisions. All NEEDS CLARIFICATION items from Technical Context have been resolved through best practices research, Context7 documentation, and project constitution alignment.

---

## 1. ORM Selection: Prisma vs TypeORM

### Decision: **Prisma**

### Rationale:

- **Type Safety**: Prisma generates TypeScript types automatically from schema, reducing runtime errors
- **Developer Experience**: Intuitive schema syntax, excellent VS Code integration, auto-completion
- **Migration Management**: Declarative migrations with `prisma migrate`, easy rollback support
- **Supabase Integration**: Official Supabase support with connection pooling via Supavisor
- **Performance**: Query batching, connection pooling, optimized query generation
- **Community**: Active development, extensive documentation, large ecosystem

### Alternatives Considered:

- **TypeORM**: Decorator-based, more complex setup, less type-safe than Prisma
- **Drizzle ORM**: Lightweight but smaller community, less mature for production use
- **Raw SQL**: Maximum control but high maintenance burden, no type safety

### Implementation Notes:

- Use Prisma schema at `backend/prisma/schema.prisma`
- Configure connection string via `DATABASE_URL` environment variable (Supabase connection string)
- Enable Prisma Studio for database inspection during development
- Use Prisma Client with connection pooling (max 10 connections per constitution)

---

## 2. Bot Library: node-telegram-bot-api vs Telegraf

### Decision: **Telegraf**

### Rationale:

- **Modern Architecture**: Middleware-based design, cleaner separation of concerns
- **Scene Management**: Built-in conversation flow management (multi-step dialogs)
- **TypeScript Support**: First-class TypeScript support with accurate type definitions
- **Webhook Signature Validation**: Built-in webhook validation for security
- **Extensibility**: Plugin ecosystem for common patterns (rate limiting, session management)
- **Active Maintenance**: Regular updates, responsive maintainers, production-ready

### Alternatives Considered:

- **node-telegram-bot-api**: Older, callback-based API, less TypeScript-friendly
- **grammY**: Modern but smaller community, less battle-tested in production

### Implementation Notes:

- Use Telegraf v4.15+
- Configure webhook mode (not polling) for VDS deployment
- Implement middleware for: logging, error handling, rate limiting, analytics
- Store conversation state in Redis using Telegraf session middleware
- Validate webhook signature using `secretToken` parameter (Telegram Bot API 6.0+)

---

## 3. API Layer: REST vs tRPC

### Decision: **tRPC** (with REST fallback for Telegram webhook)

### Rationale:

- **Type Safety**: End-to-end type safety between backend and frontend (no code generation)
- **Developer Velocity**: Faster development with autocomplete, refactoring support
- **BuhBot Context**: Admin panel is internal tool with controlled client (Next.js), perfect for tRPC
- **Supabase Integration**: tRPC can coexist with Supabase Auth (use Supabase session in tRPC context)
- **Performance**: Batching, caching, optimistic updates out of the box

### Alternatives Considered:

- **REST API**: More universal but requires manual typing, API versioning overhead
- **GraphQL**: Overkill for internal admin panel, complex caching strategies

### Implementation Notes:

- **Telegram Webhook**: Use Express.js REST endpoint (Telegraf handles webhook validation)
- **Admin Panel API**: Use tRPC for all admin panel operations
- tRPC router structure: `settings`, `analytics`, `templates`, `feedback`
- Authentication middleware: Verify Supabase session in tRPC context
- Deploy tRPC server alongside bot application (same container for simplicity)

---

## 4. Docker Base Images

### Decision:

- **Node.js Backend**: `node:20-alpine` (minimal, secure, 40MB compressed)
- **Next.js Frontend**: `node:20-alpine` for build, `node:20-alpine` for runtime (or static export to Nginx)
- **Redis**: `redis:7-alpine` (official, well-maintained)
- **Nginx**: `nginx:1.25-alpine` (latest stable)
- **Monitoring Stack**: Custom multi-service image based on `ubuntu:22.04` (Prometheus + Grafana + Uptime Kuma)

### Rationale:

- **Alpine Linux**: Minimal attack surface, smaller image sizes, faster deployments
- **Node.js 20**: LTS version with long-term support until 2026-04-30
- **Official Images**: Security updates, best practices, community validation

### Implementation Notes:

- Use multi-stage builds for backend/frontend (build stage + runtime stage)
- Non-root user in all containers (security best practice)
- Health checks for all services (Docker Compose `healthcheck` directive)
- Resource limits per VDS constraints (2-4 vCPU, 4-8 GB RAM shared)

---

## 5. Monitoring Stack Bundling Strategy

### Decision: **Shared monitoring-stack container** (Prometheus + Grafana + Uptime Kuma)

### Rationale:

- **Resource Efficiency**: Single VDS with limited resources (4-8 GB RAM) - bundling reduces overhead
- **Operational Simplicity**: Single container restart instead of managing 3 separate services
- **Network Optimization**: All monitoring tools share local network, reduced latency
- **Clarification Context**: User explicitly chose Option A in clarification session

### Implementation Details:

- **Base Image**: `ubuntu:22.04` with supervisord for process management
- **Prometheus**: Port 9090 (internal), scrapes metrics from bot, redis, nginx
- **Grafana**: Port 3000 (exposed via Nginx reverse proxy at `/grafana`)
- **Uptime Kuma**: Port 3001 (exposed via Nginx at `/uptime`)
- **Persistent Storage**: Docker volumes for Prometheus data, Grafana config, Uptime Kuma database
- **Healthcheck**: Combined script checking all 3 services via HTTP endpoints

### Configuration:

```yaml
# docker-compose.yml snippet
monitoring-stack:
  build: ./infrastructure/monitoring
  ports:
    - '9090:9090' # Prometheus (internal)
    - '3000:3000' # Grafana
    - '3001:3001' # Uptime Kuma
  volumes:
    - prometheus-data:/prometheus
    - grafana-data:/var/lib/grafana
    - uptime-kuma-data:/app/data
  restart: unless-stopped
```

---

## 6. Let's Encrypt Certificate Management

### Decision: **Certbot with Nginx plugin** (automated renewal)

### Rationale:

- **Industry Standard**: Most widely used ACME client, battle-tested in production
- **Nginx Integration**: Official nginx plugin for seamless certificate installation
- **Auto-Renewal**: Systemd timer or cron job for automatic 90-day renewals
- **Wildcard Support**: Can issue wildcard certificates if needed for subdomains

### Alternatives Considered:

- **acme.sh**: Shell script alternative, less integration with Nginx
- **Traefik**: Would require replacing Nginx, too complex for this use case

### Implementation Notes:

- Install certbot via Docker container (avoid VDS package dependencies)
- Initial certificate issuance: `certbot certonly --webroot --webroot-path=/var/www/certbot`
- Renewal cron job: `0 0,12 * * * docker exec nginx-certbot certbot renew --quiet && docker exec nginx nginx -s reload`
- Store certificates in Docker volume shared with Nginx container
- Monitor certificate expiration via Prometheus alerting (>30 days remaining)

---

## 7. Secrets Management Strategy

### Decision: **Environment Variables via `.env` files** (not committed to git)

### Rationale:

- **Simplicity**: No external secret management service needed for Phase 1 (single VDS)
- **Docker Compose Integration**: Native support via `env_file` directive
- **Security**: `.env` files excluded via `.gitignore`, only `.env.example` committed
- **Constitution Compliance**: Aligns with "No hardcoded credentials" requirement

### Secrets Inventory:

```bash
# .env.production (example structure)
# Supabase
DATABASE_URL="postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres?pgbouncer=true"
SUPABASE_URL="https://[PROJECT-REF].supabase.co"
SUPABASE_ANON_KEY="[ANON_KEY]"
SUPABASE_SERVICE_ROLE_KEY="[SERVICE_ROLE_KEY]"

# Telegram Bot
TELEGRAM_BOT_TOKEN="[BOT_TOKEN]"
TELEGRAM_WEBHOOK_SECRET="[RANDOM_SECRET]"

# Redis
REDIS_URL="redis://localhost:6379"

# OpenRouter (for Phase 1 Module 1.1 - future)
OPENROUTER_API_KEY="[API_KEY]"

# Monitoring
GRAFANA_ADMIN_PASSWORD="[SECURE_PASSWORD]"
```

### Implementation Notes:

- Use `dotenv` package (Node.js) to load variables at runtime
- Validate required environment variables at application startup (fail-fast)
- Separate `.env` files for dev/staging/production
- Deploy secrets via GitHub Actions secrets for CI/CD pipeline

---

## 8. Backup Strategy

### Decision:

- **Supabase**: Automatic daily backups (Free tier) + manual PITR exports before schema changes
- **VDS**: Weekly cron job backing up Docker volumes + configs to `/var/backups/` + optional S3 upload

### Rationale:

- **Layered Defense**: Database backups (Supabase) + application state backups (VDS)
- **RPO=24h**: Daily Supabase backups + weekly VDS backups meet recovery point objective
- **RTO=4h**: Documented restore procedures enable 4-hour recovery time objective

### Backup Script Design:

```bash
#!/bin/bash
# /infrastructure/scripts/backup.sh

BACKUP_DIR="/var/backups/buhbot"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Backup Docker volumes
docker run --rm -v redis-data:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/redis-$TIMESTAMP.tar.gz -C /data .

# Backup configs
tar czf $BACKUP_DIR/configs-$TIMESTAMP.tar.gz infrastructure/ .env.production

# Retention: keep last 4 weeks
find $BACKUP_DIR -name "*.tar.gz" -mtime +28 -delete

# Optional: upload to S3 (Phase 2 enhancement)
# aws s3 cp $BACKUP_DIR/redis-$TIMESTAMP.tar.gz s3://buhbot-backups/
```

### Cron Configuration:

```cron
# Weekly backups: Sunday 3 AM Moscow time
0 3 * * 0 /infrastructure/scripts/backup.sh >> /var/log/backup.log 2>&1
```

---

## 9. Prometheus Metrics to Collect

### Decision: Custom metrics + Node.js runtime metrics + Redis metrics

### Metrics Inventory:

```typescript
// Bot Application Metrics
bot_messages_received_total; // Counter: total incoming messages
bot_messages_processed_total; // Counter: successfully processed messages
bot_message_processing_duration; // Histogram: processing time in seconds
bot_webhook_signature_failures; // Counter: invalid signature attempts

// Redis Queue Metrics (BullMQ)
redis_queue_length; // Gauge: pending jobs in queue
redis_queue_processing_time; // Histogram: job processing duration
redis_connection_errors; // Counter: Redis connection failures

// Supabase Metrics
supabase_query_duration; // Histogram: database query latency
supabase_connection_errors; // Counter: failed database connections
supabase_connection_pool_size; // Gauge: active connections

// System Metrics (from node-exporter or custom)
system_cpu_usage_percent; // Gauge: CPU utilization
system_memory_usage_bytes; // Gauge: RAM usage
system_disk_usage_percent; // Gauge: Disk utilization
```

### Implementation:

- Use `prom-client` library in Node.js backend
- Expose `/metrics` endpoint on port 9100 (scraped by Prometheus)
- Configure Prometheus scrape interval: 15 seconds (per spec PM-006)

---

## 10. Grafana Dashboard Design

### Decision: 3 dashboards matching spec requirements

### Dashboard 1: Bot Performance

- **Purpose**: Monitor bot responsiveness and message processing
- **Panels**:
  1. Messages Received (rate over 5m) - line graph
  2. Message Processing Duration (p50, p95, p99) - line graph with percentiles
  3. Webhook Signature Failures - counter with alert threshold
  4. Active Conversations - gauge (from Redis session count)
  5. Error Rate (% of failed messages) - line graph with 5% threshold

### Dashboard 2: System Health

- **Purpose**: Monitor VDS resource utilization and service health
- **Panels**:
  1. CPU Usage - gauge (alert at 80%)
  2. Memory Usage - gauge (alert at 80%)
  3. Disk Usage - gauge (alert at 85%)
  4. Container Status - stat panel (up/down for each service)
  5. Redis Connection Pool - gauge with max connections line
  6. Supabase Query Latency - histogram (p95 < 100ms target)

### Dashboard 3: SLA Metrics

- **Purpose**: Track SLA compliance (response times, uptime)
- **Panels**:
  1. Uptime % (last 7 days) - stat panel with 99.5% target
  2. Response Time SLA Compliance - gauge (% of requests <1 hour working time)
  3. Alert Response Time - histogram (time from alert to acknowledgment)
  4. Daily Request Volume - bar chart
  5. Failed Requests by Type - pie chart (spam, errors, timeouts)

### Export Format: JSON dashboard definitions stored in `infrastructure/monitoring/grafana/dashboards/`

---

## 11. GitHub Actions CI/CD Workflow

### Decision: Two-workflow approach (CI + CD with manual approval)

### Workflow 1: CI (Continuous Integration)

- **Trigger**: Pull request to `main` branch
- **Jobs**:
  1. **Lint**: Run ESLint + Prettier
  2. **Type Check**: Run `tsc --noEmit`
  3. **Build**: Build Docker images (backend + frontend)
  4. **Test**: Run Vitest unit tests (if present)
  5. **Security Scan**: Run `npm audit` for dependency vulnerabilities

### Workflow 2: CD (Continuous Deployment)

- **Trigger**: Push to `main` branch (after PR merge)
- **Jobs**:
  1. **Build**: Build production Docker images, push to Docker Hub or GitHub Container Registry
  2. **Approval Gate**: Manual approval required (GitHub Environment protection rule)
  3. **Deploy**: SSH to VDS → pull images → `docker compose up -d --no-deps [service]`
  4. **Health Check**: Verify all containers healthy after deployment
  5. **Rollback on Failure**: Automatic rollback to previous images if health check fails

### Implementation Notes:

- Store SSH private key in GitHub Secrets (`VDS_SSH_KEY`)
- Use GitHub Environments for approval gates (e.g., `production` environment)
- Zero-downtime deployment via graceful shutdown (SIGTERM, 30-second timeout)
- Deployment notification sent to Telegram admin chat

---

## 12. Disaster Recovery Procedures (RTO=4h, RPO=24h)

### Decision: Documented runbook with automated scripts

### Recovery Scenarios:

#### Scenario 1: VDS Complete Failure

1. **Provision New VDS** (30 min): FirstVDS dashboard, same specs (2-4 vCPU, 4-8 GB RAM)
2. **Install Docker + Docker Compose** (10 min): Run bootstrap script
3. **Restore Configs** (15 min): Download latest backup from `/var/backups/` or S3
4. **Deploy Application** (20 min): `docker compose up -d`
5. **Restore Redis State** (10 min): Extract `redis-[DATE].tar.gz` to Docker volume
6. **Update DNS** (5 min): Point domain to new VDS IP (if changed)
7. **Verify Services** (30 min): Run health checks, test bot, test admin panel
8. **Total**: ~2 hours (within RTO)

#### Scenario 2: Database Corruption (Supabase)

1. **Identify Last Good Backup** (10 min): Check Supabase dashboard, daily backups
2. **Restore Database** (30 min): Supabase dashboard → Backups → Restore
3. **Verify Data Integrity** (20 min): Query critical tables, check row counts
4. **Replay Lost Transactions** (optional, if RPO < 24h critical): Manual data entry or Redis queue replay
5. **Total**: ~1 hour (within RTO)

#### Scenario 3: Let's Encrypt Certificate Expired

1. **Manual Certificate Renewal** (5 min): `docker exec nginx-certbot certbot renew --force-renewal`
2. **Reload Nginx** (1 min): `docker exec nginx nginx -s reload`
3. **Verify HTTPS** (2 min): `curl -I https://bot.example.com`
4. **Total**: ~10 minutes

### Runbook Location: `docs/infrastructure/disaster-recovery.md` (to be created in Phase 1)

---

## 13. Rate Limiting Implementation

### Decision: **Nginx rate limiting** (IP-based) + **Application-level throttling** (Telegraf middleware)

### Nginx Rate Limiting:

```nginx
# nginx.conf
limit_req_zone $binary_remote_addr zone=webhook_limit:10m rate=100r/m;

location /webhook {
    limit_req zone=webhook_limit burst=20 nodelay;
    proxy_pass http://bot-backend:3000;
}
```

### Application-Level Throttling:

```typescript
// Telegraf middleware
import rateLimit from 'telegraf-ratelimit';

const limiter = rateLimit({
  window: 60000, // 1 minute
  limit: 10, // 10 messages per user per minute
  onLimitExceeded: (ctx) => ctx.reply('Слишком много запросов, подождите минуту.'),
});

bot.use(limiter);
```

### Rationale:

- **Defense in Depth**: Nginx blocks IP-based floods, Telegraf blocks user-based spam
- **Telegram API Compliance**: Respects 30 messages/second bot-wide limit
- **User Experience**: Polite error messages in Russian for legitimate users hitting limits

---

## Research Summary

All technical decisions resolved. Key choices:

- **ORM**: Prisma (type safety, Supabase integration)
- **Bot**: Telegraf (modern, TypeScript-first)
- **API**: tRPC (end-to-end type safety for admin panel)
- **Containerization**: Separate bot + shared monitoring-stack (resource efficiency)
- **Security**: Let's Encrypt SSL, webhook validation, RLS policies, environment variables
- **Monitoring**: Prometheus + Grafana + Uptime Kuma (3 dashboards designed)
- **Backups**: Daily Supabase + weekly VDS (RTO=4h, RPO=24h)
- **CI/CD**: GitHub Actions with manual approval gate

**Next Phase**: Design (data-model.md, contracts/, quickstart.md)
