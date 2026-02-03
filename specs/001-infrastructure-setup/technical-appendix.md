# Technical Implementation Appendix - Infrastructure Setup

**Related to**: `specs/001-infrastructure-setup/spec.md`

This appendix provides detailed technical specifications, code examples, and configuration files for implementing the hybrid deployment infrastructure.

---

## Table of Contents

1. [Database Schema](#database-schema)
2. [RLS Policies](#rls-policies)
3. [Docker Compose Configuration](#docker-compose-configuration)
4. [Environment Variables](#environment-variables)
5. [Nginx Configuration](#nginx-configuration)
6. [Prometheus Configuration](#prometheus-configuration)
7. [Grafana Dashboards](#grafana-dashboards)
8. [Backup Scripts](#backup-scripts)
9. [GitHub Actions Workflow](#github-actions-workflow)
10. [Deployment Architecture](#deployment-architecture)

---

## Database Schema

### Core Tables

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'observer')),
  full_name TEXT NOT NULL,
  telegram_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chats table
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id BIGINT NOT NULL UNIQUE,
  chat_name TEXT NOT NULL,
  assigned_accountant_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sla_threshold_minutes INTEGER NOT NULL DEFAULT 60,
  monitoring_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Client requests table
CREATE TABLE client_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id BIGINT NOT NULL REFERENCES chats(chat_id),
  client_id BIGINT NOT NULL,
  message_text TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_spam BOOLEAN NOT NULL DEFAULT FALSE,
  sla_timer_started TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  response_time_minutes INTEGER,
  assigned_accountant_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SLA alerts table
CREATE TABLE sla_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES client_requests(id) ON DELETE CASCADE,
  manager_telegram_id BIGINT NOT NULL,
  violation_time_minutes INTEGER NOT NULL,
  escalation_count INTEGER NOT NULL DEFAULT 1,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Feedback responses table
CREATE TABLE feedback_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id BIGINT NOT NULL,
  chat_id BIGINT NOT NULL REFERENCES chats(chat_id),
  quarter TEXT NOT NULL, -- "2025-Q1"
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_anonymous_to_accountant BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Working schedules table
CREATE TABLE working_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id BIGINT NOT NULL REFERENCES chats(chat_id) ON DELETE CASCADE,
  timezone TEXT NOT NULL DEFAULT 'Europe/Moscow',
  working_days INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5], -- Mon-Fri
  working_hours_start TIME NOT NULL DEFAULT '09:00',
  working_hours_end TIME NOT NULL DEFAULT '18:00',
  holidays DATE[] NOT NULL DEFAULT ARRAY[]::DATE[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chat_id)
);

-- Templates table
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FAQ items table
CREATE TABLE faq_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  keywords TEXT[] NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_client_requests_chat_id ON client_requests(chat_id);
CREATE INDEX idx_client_requests_timestamp ON client_requests(timestamp DESC);
CREATE INDEX idx_client_requests_sla_timer ON client_requests(sla_timer_started) WHERE responded_at IS NULL;
CREATE INDEX idx_feedback_responses_quarter ON feedback_responses(quarter);
CREATE INDEX idx_feedback_responses_chat_id ON feedback_responses(chat_id);
CREATE INDEX idx_sla_alerts_request_id ON sla_alerts(request_id);
CREATE INDEX idx_sla_alerts_resolved ON sla_alerts(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_chats_chat_id ON chats(chat_id);
CREATE INDEX idx_templates_category ON templates(category);
CREATE INDEX idx_faq_keywords ON faq_items USING GIN(keywords);

-- Functions for updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_requests_updated_at BEFORE UPDATE ON client_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_working_schedules_updated_at BEFORE UPDATE ON working_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_faq_items_updated_at BEFORE UPDATE ON faq_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## RLS Policies

### Enable RLS on all tables

```sql
-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE faq_items ENABLE ROW LEVEL SECURITY;
```

### Users Table Policies

```sql
-- Admin: full access to all users
CREATE POLICY admin_users_all ON users
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users AS u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Manager/Observer: view all users (read-only)
CREATE POLICY manager_users_select ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users AS u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'manager', 'observer')
    )
  );

-- Users can view their own profile
CREATE POLICY users_select_own ON users
  FOR SELECT
  USING (id = auth.uid());

-- Users can update their own profile (limited fields)
CREATE POLICY users_update_own ON users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
```

### Chats Table Policies

```sql
-- Admin: full access
CREATE POLICY admin_chats_all ON chats
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Manager: view and modify chats
CREATE POLICY manager_chats_select ON chats
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

CREATE POLICY manager_chats_update ON chats
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- Observer: read-only
CREATE POLICY observer_chats_select ON chats
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'observer'
    )
  );
```

### Client Requests Table Policies

```sql
-- Admin: full access
CREATE POLICY admin_requests_all ON client_requests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Manager: view all requests, update assigned to them
CREATE POLICY manager_requests_select ON client_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

CREATE POLICY manager_requests_update ON client_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- Observer: read-only
CREATE POLICY observer_requests_select ON client_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'observer'
    )
  );

-- Service role: bot can insert/update (used for Telegram webhook)
CREATE POLICY service_requests_all ON client_requests
  FOR ALL
  USING (auth.role() = 'service_role');
```

### Feedback Responses Table Policies

```sql
-- Admin and Manager: full access (can see client names)
CREATE POLICY admin_feedback_all ON feedback_responses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- Observer: read-only (anonymized view handled by application layer)
CREATE POLICY observer_feedback_select ON feedback_responses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'observer'
    )
  );

-- Service role: bot can insert feedback
CREATE POLICY service_feedback_insert ON feedback_responses
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
```

### Templates and FAQ Policies

```sql
-- Templates: All authenticated users can read, Admin/Manager can modify
CREATE POLICY all_templates_select ON templates
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid())
  );

CREATE POLICY admin_templates_all ON templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- FAQ: Same as templates
CREATE POLICY all_faq_select ON faq_items
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid())
  );

CREATE POLICY admin_faq_all ON faq_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );
```

---

## Docker Compose Configuration

### `docker-compose.prod.yml`

```yaml
version: '3.8'

services:
  bot:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: buhbot-app
    restart: unless-stopped
    env_file: .env.production
    environment:
      - NODE_ENV=production
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - REDIS_URL=redis://redis:6379
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - buhbot-network
    ports:
      - '3000:3000'
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  redis:
    image: redis:7-alpine
    container_name: buhbot-redis
    restart: unless-stopped
    command: >
      redis-server
      --appendonly yes
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
    volumes:
      - redis-data:/data
    networks:
      - buhbot-network
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    container_name: buhbot-nginx
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - bot
    networks:
      - buhbot-network
    healthcheck:
      test: ['CMD', 'nginx', '-t']
      interval: 30s
      timeout: 10s
      retries: 3

  prometheus:
    image: prom/prometheus:v2.45.0
    container_name: buhbot-prometheus
    restart: unless-stopped
    user: '65534:65534'
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./prometheus/alerts.yml:/etc/prometheus/alerts.yml:ro
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'
    ports:
      - '9090:9090'
    networks:
      - buhbot-network
    healthcheck:
      test: ['CMD', 'wget', '--quiet', '--tries=1', '--spider', 'http://localhost:9090/-/healthy']
      interval: 30s
      timeout: 10s
      retries: 3

  grafana:
    image: grafana/grafana:10.0.3
    container_name: buhbot-grafana
    restart: unless-stopped
    user: '472:472'
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
      - GF_SERVER_ROOT_URL=https://grafana.example.com
      - GF_INSTALL_PLUGINS=redis-datasource
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
      - ./grafana/dashboards:/var/lib/grafana/dashboards:ro
    ports:
      - '3001:3000'
    depends_on:
      - prometheus
    networks:
      - buhbot-network
    healthcheck:
      test: ['CMD', 'wget', '--quiet', '--tries=1', '--spider', 'http://localhost:3000/api/health']
      interval: 30s
      timeout: 10s
      retries: 3

  node-exporter:
    image: prom/node-exporter:v1.6.1
    container_name: buhbot-node-exporter
    restart: unless-stopped
    command:
      - '--path.rootfs=/host'
    pid: host
    volumes:
      - '/:/host:ro,rslave'
    networks:
      - buhbot-network

volumes:
  redis-data:
    driver: local
  prometheus-data:
    driver: local
  grafana-data:
    driver: local

networks:
  buhbot-network:
    driver: bridge
```

### `Dockerfile`

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Production image
FROM node:18-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy production dependencies and built code
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
```

---

## Environment Variables

### `.env.production` Template

```bash
# ===========================================
# BuhBot Production Environment Variables
# ===========================================
# WARNING: NEVER commit this file to git!
# Add to .gitignore immediately

# Supabase Configuration
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eHh4eHh4eHh4eHh4eHh4eHh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODg0ODU2NzAsImV4cCI6MjAwNDA2MTY3MH0.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eHh4eHh4eHh4eHh4eHh4eHh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY4ODQ4NTY3MCwiZXhwIjoyMDA0MDYxNjcwfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Telegram Bot
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz12345678

# AI/NLP Provider (choose one)
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Alternative: OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Redis
REDIS_URL=redis://redis:6379

# Monitoring
GRAFANA_ADMIN_PASSWORD=super_secure_password_change_me

# Optional: Application-level encryption (for sensitive fields)
# ENCRYPTION_KEY=0123456789abcdef0123456789abcdef  # 32 character hex string

# Node Environment
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000

# SLA Configuration
DEFAULT_SLA_THRESHOLD_MINUTES=60
ESCALATION_INTERVAL_MINUTES=30
MAX_ESCALATION_COUNT=5

# Working Hours (default)
DEFAULT_TIMEZONE=Europe/Moscow
DEFAULT_WORKING_DAYS=1,2,3,4,5
DEFAULT_WORKING_HOURS_START=09:00
DEFAULT_WORKING_HOURS_END=18:00
```

### `.env.example` (for git repository)

```bash
# Copy this file to .env.production and fill in your credentials

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_here

# AI Provider
OPENROUTER_API_KEY=your_openrouter_key_here

# Redis
REDIS_URL=redis://redis:6379

# Monitoring
GRAFANA_ADMIN_PASSWORD=change_me_in_production

# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
```

---

## Nginx Configuration

### `nginx/nginx.conf`

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=webhook_limit:10m rate=10r/s;
    limit_req_status 429;

    # Include server blocks
    include /etc/nginx/conf.d/*.conf;
}
```

### `nginx/conf.d/bot.conf`

```nginx
# HTTP server - redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name bot.example.com;

    # ACME challenge for Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS server - main bot application
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name bot.example.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/bot.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bot.example.com/privkey.pem;

    # SSL configuration (Mozilla Intermediate)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # Health check endpoint (no rate limit)
    location /health {
        proxy_pass http://bot:3000/health;
        access_log off;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Telegram webhook endpoint (rate limited)
    location /webhook {
        limit_req zone=webhook_limit burst=20 nodelay;

        proxy_pass http://bot:3000/webhook;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Default location
    location / {
        proxy_pass http://bot:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Prometheus Configuration

### `prometheus/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'buhbot-production'
    environment: 'production'

# Alerting configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets: []
          # Add Alertmanager targets here if using

# Load alerting rules
rule_files:
  - 'alerts.yml'

# Scrape configurations
scrape_configs:
  # Bot application metrics
  - job_name: 'buhbot-app'
    static_configs:
      - targets: ['bot:3000']
    metrics_path: '/metrics'

  # Redis metrics (via redis_exporter if added)
  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']

  # Node exporter (system metrics)
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  # Prometheus self-monitoring
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
```

### `prometheus/alerts.yml`

```yaml
groups:
  - name: buhbot_alerts
    interval: 30s
    rules:
      # Bot service down
      - alert: BotServiceDown
        expr: up{job="buhbot-app"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: 'BuhBot application is down'
          description: 'Bot service has been down for more than 2 minutes'

      # High CPU usage
      - alert: HighCPUUsage
        expr: 100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'High CPU usage detected'
          description: 'CPU usage is above 80% for more than 5 minutes'

      # High memory usage
      - alert: HighMemoryUsage
        expr: (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100 < 20
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'High memory usage detected'
          description: 'Available memory is below 20% for more than 5 minutes'

      # Disk space running low
      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100 < 15
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: 'Disk space running low'
          description: 'Available disk space is below 15%'

      # Redis down
      - alert: RedisDown
        expr: up{job="redis"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: 'Redis is down'
          description: 'Redis has been down for more than 2 minutes'

      # High Redis memory usage
      - alert: RedisHighMemory
        expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'Redis memory usage is high'
          description: 'Redis is using more than 90% of allocated memory'
```

---

## Grafana Dashboards

### `grafana/provisioning/dashboards/dashboard.yml`

```yaml
apiVersion: 1

providers:
  - name: 'BuhBot Dashboards'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
```

### `grafana/provisioning/datasources/prometheus.yml`

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
```

---

## Backup Scripts

### `/root/backup-vds.sh`

```bash
#!/bin/bash
set -euo pipefail

# ================================================
# BuhBot VDS Backup Script
# Backs up Docker volumes and configuration files
# ================================================

# Configuration
BACKUP_DIR="/var/backups/buhbot"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup-$DATE.tar.gz"
RETENTION_DAYS=28
LOG_FILE="$BACKUP_DIR/backup.log"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Starting backup process..."

# Stop containers gracefully
log "Stopping Docker containers..."
cd /root/buhbot
docker compose -f docker-compose.prod.yml down

# Create backup archive
log "Creating backup archive: $BACKUP_FILE"
tar -czf "$BACKUP_FILE" \
    --exclude='*.log' \
    /var/lib/docker/volumes/buhbot_redis-data \
    /var/lib/docker/volumes/buhbot_prometheus-data \
    /var/lib/docker/volumes/buhbot_grafana-data \
    /root/buhbot/.env.production \
    /root/buhbot/nginx \
    /root/buhbot/prometheus \
    /root/buhbot/grafana \
    /root/buhbot/docker-compose.prod.yml

# Verify backup integrity
if [ -f "$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log "Backup created successfully: $BACKUP_FILE (Size: $BACKUP_SIZE)"
else
    log "ERROR: Backup file not created"
    exit 1
fi

# Restart containers
log "Restarting Docker containers..."
docker compose -f docker-compose.prod.yml up -d

# Wait for health checks
log "Waiting for services to be healthy..."
sleep 10
docker compose -f docker-compose.prod.yml ps

# Delete backups older than retention period
log "Cleaning up old backups (retention: $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "backup-*.tar.gz" -mtime +$RETENTION_DAYS -delete

# Calculate total backup size
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
log "Total backup directory size: $TOTAL_SIZE"

log "Backup process completed successfully"

# Optional: Upload to remote storage (uncomment if configured)
# log "Uploading backup to remote storage..."
# rclone copy "$BACKUP_FILE" remote:buhbot-backups/
# log "Remote upload completed"

exit 0
```

### Cron Job Setup

```bash
# Install cron job (run as root)
# Backup every Sunday at 3:00 AM Moscow time
crontab -e

# Add this line:
0 3 * * 0 /root/backup-vds.sh >> /var/backups/buhbot/backup-cron.log 2>&1
```

---

## GitHub Actions Workflow

### `.github/workflows/deploy.yml`

```yaml
name: Deploy to Production VDS

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup SSH
        uses: webfactory/ssh-agent@v0.8.0
        with:
          ssh-private-key: ${{ secrets.VDS_SSH_PRIVATE_KEY }}

      - name: Add VDS to known hosts
        run: |
          mkdir -p ~/.ssh
          ssh-keyscan -H ${{ secrets.VDS_HOST }} >> ~/.ssh/known_hosts

      - name: Deploy to VDS
        env:
          VDS_HOST: ${{ secrets.VDS_HOST }}
          VDS_USER: ${{ secrets.VDS_USER }}
        run: |
          ssh -o StrictHostKeyChecking=no $VDS_USER@$VDS_HOST << 'EOF'
            set -e

            echo "=== Starting deployment ==="
            cd /root/buhbot

            echo "=== Pulling latest code ==="
            git fetch origin
            git checkout main
            git pull origin main

            echo "=== Building Docker images ==="
            docker compose -f docker-compose.prod.yml build --no-cache bot

            echo "=== Restarting services ==="
            docker compose -f docker-compose.prod.yml up -d --remove-orphans

            echo "=== Waiting for services to be healthy ==="
            sleep 10

            echo "=== Service status ==="
            docker compose -f docker-compose.prod.yml ps

            echo "=== Deployment completed ==="
          EOF

      - name: Verify deployment
        env:
          BOT_URL: ${{ secrets.BOT_URL }}
        run: |
          echo "Waiting 15 seconds for services to stabilize..."
          sleep 15

          echo "Testing health endpoint..."
          curl -f -s -o /dev/null -w "%{http_code}" $BOT_URL/health || exit 1

          echo "Health check passed!"

      - name: Notify on failure
        if: failure()
        run: |
          echo "Deployment failed! Check logs."
          # Add notification logic here (Telegram, Slack, etc.)
```

### Required GitHub Secrets

```
VDS_SSH_PRIVATE_KEY - SSH private key for VDS access
VDS_HOST - VDS server IP or hostname
VDS_USER - SSH username (e.g., root)
BOT_URL - Bot URL for health check (e.g., https://bot.example.com)
```

---

## Deployment Architecture

### Architecture Diagram

```
┌───────────────────────────────────────────────────────────────┐
│                     SUPABASE CLOUD (EU)                       │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  PostgreSQL 15+ Database                             │    │
│  │  - Tables: client_requests, feedback, alerts, etc.   │    │
│  │  - RLS Policies: admin/manager/observer roles        │    │
│  │  - Indexes: Optimized for queries                    │    │
│  │  - PITR Backup: 7-30 day retention                   │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Supabase Auth                                       │    │
│  │  - Email/Password provider                           │    │
│  │  - JWT token generation                              │    │
│  │  - Session management                                │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Supabase Storage                                    │    │
│  │  - Buckets: invoices, documents, files              │    │
│  │  - Access policies per bucket                        │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Supabase Realtime                                   │    │
│  │  - WebSocket subscriptions                           │    │
│  │  - Live dashboard updates                            │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────┬────────────────────────────────────────┘
                       │ HTTPS/TLS + WebSocket
                       │ Connection Pooling
                       │
┌──────────────────────┴────────────────────────────────────────┐
│              FIRST VDS SERVER (Ubuntu 22.04 LTS)              │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Nginx (Reverse Proxy + SSL Termination)            │    │
│  │  - Let's Encrypt SSL certificates                    │    │
│  │  - Rate limiting: 10 req/s per IP                    │    │
│  │  - Security headers (HSTS, CSP, etc.)               │    │
│  └──────────────────┬───────────────────────────────────┘    │
│                     │                                          │
│  ┌──────────────────┴───────────────────────────────────┐    │
│  │  Node.js Telegram Bot Application                    │    │
│  │  - Telegraf framework                                │    │
│  │  - Express.js API endpoints                          │    │
│  │  - Webhook handler with signature validation        │    │
│  │  - Health check endpoint (/health)                   │    │
│  │  - Prometheus metrics endpoint (/metrics)            │    │
│  └──────────────────┬───────────────────────────────────┘    │
│                     │                                          │
│  ┌──────────────────┴───────────────────────────────────┐    │
│  │  Redis (Queue + State Management)                    │    │
│  │  - BullMQ job queue                                  │    │
│  │  - Conversation state storage                        │    │
│  │  - Caching layer                                     │    │
│  │  - Persistence: AOF enabled                          │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Prometheus (Metrics Collection)                     │    │
│  │  - Scrapes bot, Redis, Node Exporter                │    │
│  │  - 30-day retention                                  │    │
│  │  - Alert rules configured                            │    │
│  └──────────────────┬───────────────────────────────────┘    │
│                     │                                          │
│  ┌──────────────────┴───────────────────────────────────┐    │
│  │  Grafana (Dashboards & Alerts)                       │    │
│  │  - Bot Performance dashboard                         │    │
│  │  - System Health dashboard                           │    │
│  │  - SLA Metrics dashboard                             │    │
│  │  - Alert notifications (Telegram)                    │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Node Exporter (System Metrics)                      │    │
│  │  - CPU, RAM, Disk usage                              │    │
│  │  - Network statistics                                │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Weekly Backup Cron Job                              │    │
│  │  - Backs up Docker volumes                           │    │
│  │  - Backs up configs (.env, nginx, etc.)             │    │
│  │  - 4-week retention                                  │    │
│  └──────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────┘
                       │
                       │ HTTPS
                       │
┌──────────────────────┴────────────────────────────────────────┐
│              EXTERNAL SERVICES                                 │
│  - UptimeRobot: External uptime monitoring                    │
│  - OpenRouter/OpenAI: AI spam filtering                       │
│  - Telegram Bot API: Bot communication                        │
│  - GitHub Actions: CI/CD deployment                           │
└────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Telegram User → Bot**:
   - User sends message to Telegram
   - Telegram Bot API forwards to webhook endpoint
   - Nginx routes to bot application (rate limited)
   - Bot validates webhook signature
   - Bot processes message and queries Supabase

2. **Bot → Supabase**:
   - Connection pooling (max 10 connections)
   - TLS encrypted connection
   - RLS policies enforce role-based access
   - Queries execute in <100ms (p95)

3. **Bot → Redis**:
   - Store conversation state
   - Queue background jobs (BullMQ)
   - Cache frequent queries
   - Latency <10ms (p95)

4. **Monitoring**:
   - Prometheus scrapes /metrics every 15s
   - Grafana visualizes metrics in real-time
   - UptimeRobot checks /health every 5 minutes
   - Alerts sent to Telegram on threshold breach

5. **Admin Panel → Supabase**:
   - Next.js Server Components query Supabase directly
   - Supabase Auth JWT validates requests
   - RLS policies filter data by user role
   - Realtime subscriptions for live updates

---

## Security Checklist

- [ ] All secrets stored in environment variables (not in code)
- [ ] `.env.production` added to `.gitignore`
- [ ] HTTPS enabled with valid Let's Encrypt certificate
- [ ] Telegram webhook signature validation implemented
- [ ] Supabase RLS policies tested for all roles
- [ ] VDS firewall configured (allow 443, 80, SSH only)
- [ ] SSH key-based authentication (password auth disabled)
- [ ] Nginx rate limiting configured
- [ ] Docker containers run as non-root users
- [ ] Database connection uses TLS
- [ ] Supabase PITR backup enabled
- [ ] GitHub Secrets configured for CI/CD
- [ ] Security headers added to Nginx config
- [ ] No hardcoded API keys in code
- [ ] Input validation with Zod schemas

---

## Performance Optimization

### Database Optimization

1. **Indexes**: All frequently queried columns indexed
2. **Connection Pooling**: Max 10 connections from bot
3. **Query Optimization**: Use `EXPLAIN ANALYZE` for slow queries
4. **Pagination**: Implement cursor-based pagination for large result sets

### Redis Optimization

1. **Memory Limit**: 256MB with LRU eviction policy
2. **Persistence**: AOF for durability
3. **Key Expiration**: Set TTL on conversation state (24 hours)
4. **Compression**: Use MessagePack for serialized data

### Bot Application Optimization

1. **Graceful Shutdown**: Handle SIGTERM for zero-downtime deployments
2. **Health Checks**: Endpoint returns 200 only when Supabase+Redis healthy
3. **Timeout Handling**: 30s timeout for webhook processing
4. **Error Recovery**: Retry failed jobs with exponential backoff

---

## Disaster Recovery Procedures

### Scenario 1: Complete VDS Failure

1. Provision new VDS with same specs
2. Install Docker and Docker Compose
3. Restore latest backup from `/var/backups/buhbot/`
4. Restore `.env.production` file
5. Update DNS to point to new VDS
6. Verify health checks pass
7. **RTO Target**: 4 hours

### Scenario 2: Database Corruption

1. Stop bot application
2. Restore Supabase database from PITR (via dashboard)
3. Verify data integrity with test queries
4. Restart bot application
5. **RPO Target**: 24 hours (daily backups)

### Scenario 3: Compromised Secrets

1. Rotate all secrets immediately:
   - Telegram bot token (via BotFather)
   - Supabase keys (via Supabase dashboard)
   - OpenRouter/OpenAI API key
2. Update `.env.production` on VDS
3. Update GitHub Secrets
4. Restart all services
5. Audit logs for unauthorized access

---

## Post-Deployment Checklist

- [ ] Supabase project created and configured
- [ ] Database schema deployed and verified
- [ ] RLS policies tested for all roles
- [ ] VDS provisioned and secured
- [ ] Docker Compose stack running
- [ ] HTTPS certificate issued and auto-renewal configured
- [ ] Prometheus collecting metrics
- [ ] Grafana dashboards displaying data
- [ ] UptimeRobot monitoring configured
- [ ] Backup script running weekly via cron
- [ ] GitHub Actions deployment workflow tested
- [ ] All environment variables set correctly
- [ ] Health check endpoint returning 200
- [ ] Telegram webhook successfully receiving messages
- [ ] Admin panel authentication working
- [ ] Documentation updated with production URLs
