# BuhBot Infrastructure Quickstart Guide

**Version**: 1.0.1
**Last Updated**: 2025-11-22
**Target**: Production deployment on First VDS with Supabase Cloud

---

> **Note**: This guide contains placeholder values that you must replace with your actual production values before deployment:
>
> - `YOUR_VDS_IP` - Your VDS server IP address (e.g., `123.45.67.89`)
> - `YOUR_DOMAIN` or `bot.example.com` - Your actual domain name
> - `YOUR_PROJECT.supabase.co` or `[PROJECT-REF]` - Your Supabase project reference
> - `[PASSWORD]`, `[BOT_TOKEN]`, `[API_KEY]`, etc. - Your actual credentials
>
> **Never commit actual credentials to version control.**

---

## Prerequisites

Before starting, ensure you have:

- ✅ **First VDS Account** (FirstVDS.ru) with access to control panel
- ✅ **Supabase Account** (supabase.com) with billing enabled (even for Free tier)
- ✅ **Telegram Bot Token** (obtained from @BotFather)
- ✅ **Domain Name** with DNS access (e.g., `bot.example.com`)
- ✅ **GitHub Account** with repository access
- ✅ **SSH Key Pair** (for VDS access and GitHub Actions deployment)
- ✅ **OpenRouter/OpenAI API Key** (for Phase 1 Module 1.1 - spam filtering, can be added later)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Internet / Clients                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS (443)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     First VDS Server                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Nginx Reverse Proxy (Let's Encrypt SSL)              │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                  │
│         ┌──────────────────┴──────────────────┐              │
│         │                                      │              │
│         ▼                                      ▼              │
│  ┌─────────────────┐                  ┌─────────────────┐   │
│  │  Bot Container  │                  │ Monitoring Stack│   │
│  │  (Node.js 20)   │                  │  - Prometheus   │   │
│  │  - Telegraf     │◄─────────────────┤  - Grafana      │   │
│  │  - tRPC API     │   scrape metrics │  - Uptime Kuma  │   │
│  │  - Prisma       │                  └─────────────────┘   │
│  └────────┬────────┘                                         │
│           │                                                   │
│           ▼                                                   │
│  ┌─────────────────┐                                         │
│  │ Redis Container │                                         │
│  │ (Queue/Cache)   │                                         │
│  └─────────────────┘                                         │
└───────────────┬─────────────────────────────────────────────┘
                │
                │ PostgreSQL connection (TLS)
                ▼
┌─────────────────────────────────────────────────────────────┐
│               Supabase Cloud (EU Region)                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ PostgreSQL 15+ Database                               │  │
│  │ - Tables: chats, client_requests, sla_alerts, etc.    │  │
│  │ - RLS Policies: admin, manager, observer              │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Supabase Auth (JWT, email/password)                   │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Supabase Storage (invoices, documents, files)         │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 1: Supabase Cloud Setup (30 minutes)

### 1.1 Create Supabase Project

1. Log in to [supabase.com](https://supabase.com)
2. Click **"New Project"**
3. Fill in project details:
   - **Name**: `buhbot-production`
   - **Database Password**: Generate strong password (save to password manager)
   - **Region**: **EU (Frankfurt)** or EU (Ireland) - closest to Russia for latency
   - **Pricing Plan**: **Free** (with upgrade path to Pro when PITR needed)
4. Wait ~2 minutes for project provisioning
5. Save credentials:
   - **Project URL**: `https://YOUR_PROJECT.supabase.co` (replace `YOUR_PROJECT` with your actual project reference)
   - **Anon Key**: Found in Settings → API → `anon public`
   - **Service Role Key**: Found in Settings → API → `service_role` (KEEP SECRET)

### 1.2 Deploy Database Schema

1. Navigate to **SQL Editor** in Supabase dashboard
2. Copy contents from `infrastructure/supabase/migrations/00001_initial_schema.sql`
3. Paste into SQL Editor and execute
4. Verify tables created:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   ORDER BY table_name;
   ```
   Expected output: `chats`, `client_requests`, `faq_items`, `feedback_responses`, `sla_alerts`, `templates`, `users`, `working_schedules`

### 1.3 Configure RLS Policies

1. Copy contents from `infrastructure/supabase/migrations/00002_rls_policies.sql`
2. Execute in SQL Editor
3. Verify RLS enabled:
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables
   WHERE schemaname = 'public';
   ```
   All tables should show `rowsecurity = true`

### 1.4 Create First Admin User

1. Navigate to **Authentication → Users** in Supabase dashboard
2. Click **"Add User"** → **"Create New User"**
3. Fill in:
   - **Email**: `YOUR_ADMIN_EMAIL` (replace with your actual admin email)
   - **Password**: Generate strong password
   - **Auto Confirm**: Enabled
4. Note the **User UUID** from user list
5. Go to **SQL Editor** and insert into `users` table:
   ```sql
   INSERT INTO users (id, email, full_name, role)
   VALUES (
     'YOUR_USER_UUID'::uuid,  -- Replace with the UUID from step 4
     'YOUR_ADMIN_EMAIL',      -- Replace with your actual admin email
     'System Administrator',
     'admin'
   );
   ```

### 1.5 Configure Storage Buckets

1. Navigate to **Storage** in Supabase dashboard
2. Create three buckets:
   - **invoices**: Public = ❌ (private), File size limit = 10 MB, Allowed MIME types = `application/pdf,image/*`
   - **documents**: Public = ❌ (private), File size limit = 10 MB
   - **files**: Public = ❌ (private), File size limit = 5 MB
3. For each bucket, go to **Policies** and create:

   ```sql
   -- Example for 'invoices' bucket
   CREATE POLICY "Authenticated users can upload invoices"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'invoices');

   CREATE POLICY "Authenticated users can view invoices"
   ON storage.objects FOR SELECT
   TO authenticated
   USING (bucket_id = 'invoices');
   ```

### 1.6 Enable Realtime (Optional for Phase 1)

1. Navigate to **Database → Replication**
2. Enable Realtime for tables: `client_requests`, `sla_alerts` (for live dashboard updates)

---

## Step 2: VDS Server Provisioning (20 minutes)

### 2.1 Create VDS Instance

1. Log in to [FirstVDS.ru](https://firstvds.ru) control panel
2. Navigate to **"Order VDS"**
3. Select configuration:
   - **CPU**: 2-4 vCPU
   - **RAM**: 4-8 GB
   - **Disk**: 50-100 GB SSD
   - **OS**: **Ubuntu 22.04 LTS** (64-bit)
   - **Location**: Moscow or St. Petersburg data center
4. Complete order and wait for provisioning (~5-10 minutes)
5. Note server credentials:
   - **IP Address**: `YOUR_VDS_IP` (replace with actual IP, e.g., `123.45.67.89`)
   - **Root Password**: Sent to email (change immediately)

### 2.2 Initial Server Configuration

SSH into server:

```bash
ssh root@YOUR_VDS_IP
```

Update system packages:

```bash
apt update && apt upgrade -y
```

Set hostname:

```bash
hostnamectl set-hostname buhbot-prod
```

Configure timezone (Moscow):

```bash
timedatectl set-timezone Europe/Moscow
```

Create non-root user with sudo:

```bash
adduser buhbot
usermod -aG sudo buhbot
```

Configure SSH key authentication:

```bash
# On local machine, generate SSH key if needed:
ssh-keygen -t ed25519 -C "buhbot-deploy"

# Copy public key to server:
ssh-copy-id -i ~/.ssh/id_ed25519.pub buhbot@YOUR_VDS_IP

# Disable password authentication (optional but recommended):
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart sshd
```

### 2.3 Install Docker & Docker Compose

Install Docker:

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker buhbot
```

Install Docker Compose:

```bash
sudo apt install docker-compose-plugin -y
```

Verify installation:

```bash
docker --version        # Expected: Docker version 24.0+
docker compose version  # Expected: Docker Compose version 2.20+
```

### 2.4 Configure Firewall (UFW)

Enable UFW and allow required ports:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (for Let's Encrypt)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
sudo ufw status
```

---

## Step 3: Application Deployment (30 minutes)

### 3.1 Clone Repository

```bash
cd /opt
sudo git clone https://github.com/maslennikov-ig/BuhBot.git
sudo chown -R buhbot:buhbot BuhBot
cd BuhBot
```

### 3.2 Configure Environment Variables

Create `.env.production` file:

```bash
cp .env.example .env.production
nano .env.production
```

Fill in credentials (replace all `YOUR_*` placeholders with your actual values):

```bash
# Supabase (replace YOUR_PROJECT with your Supabase project reference)
DATABASE_URL="postgresql://postgres:YOUR_DB_PASSWORD@YOUR_PROJECT.supabase.co:5432/postgres?pgbouncer=true&connection_limit=10"
SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
SUPABASE_ANON_KEY="YOUR_ANON_KEY"
SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"

# Telegram Bot
TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN"
TELEGRAM_WEBHOOK_SECRET="YOUR_WEBHOOK_SECRET"  # Generate with: openssl rand -hex 16
TELEGRAM_WEBHOOK_URL="https://YOUR_DOMAIN/webhook/telegram"

# Redis
REDIS_URL="redis://redis:6379"

# OpenRouter (for Phase 1 Module 1.1 - can be added later)
OPENROUTER_API_KEY="YOUR_OPENROUTER_API_KEY"

# Monitoring
GRAFANA_ADMIN_PASSWORD="YOUR_GRAFANA_PASSWORD"  # Generate a secure password

# Application
NODE_ENV="production"
PORT="3000"
```

⚠️ **Security**:

```bash
# Ensure .env.production is NOT tracked by git
chmod 600 .env.production
echo ".env.production" >> .gitignore
```

### 3.3 Build Docker Images

```bash
# Build backend (bot + API)
docker build -t buhbot-backend:latest -f backend/Dockerfile backend/

# Build frontend (admin panel)
docker build -t buhbot-frontend:latest -f frontend/Dockerfile frontend/

# Build monitoring stack
docker build -t buhbot-monitoring:latest -f infrastructure/monitoring/Dockerfile infrastructure/monitoring/
```

### 3.4 Deploy Services with Docker Compose

```bash
docker compose -f infrastructure/docker-compose.yml up -d
```

Verify all containers running:

```bash
docker compose ps
```

Expected output:

```
NAME                STATUS              PORTS
bot                 Up 30 seconds       0.0.0.0:3000->3000/tcp
redis               Up 30 seconds       6379/tcp
nginx               Up 30 seconds       0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
monitoring-stack    Up 30 seconds       0.0.0.0:3000->3000/tcp (Grafana), 0.0.0.0:9090->9090/tcp (Prometheus)
```

Check logs:

```bash
docker compose logs -f bot
```

---

## Step 4: Nginx & SSL Setup (20 minutes)

### 4.1 Configure Domain DNS

Add A record in DNS provider:

```
Type: A
Name: bot (or @)
Value: YOUR_VDS_IP (replace with your actual VDS IP address)
TTL: 300
```

Wait for DNS propagation (~5-15 minutes):

```bash
dig YOUR_DOMAIN +short
```

### 4.2 Obtain Let's Encrypt Certificate

Run Certbot in Docker (replace `YOUR_DOMAIN` and `YOUR_EMAIL` with actual values):

```bash
docker run -it --rm --name certbot \
  -v "/opt/BuhBot/infrastructure/nginx/ssl:/etc/letsencrypt" \
  -v "/opt/BuhBot/infrastructure/nginx/certbot:/var/www/certbot" \
  certbot/certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email YOUR_EMAIL \
  --agree-tos \
  --no-eff-email \
  -d YOUR_DOMAIN
```

Certificate will be saved to:

- `/opt/BuhBot/infrastructure/nginx/ssl/live/YOUR_DOMAIN/fullchain.pem`
- `/opt/BuhBot/infrastructure/nginx/ssl/live/YOUR_DOMAIN/privkey.pem`

### 4.3 Configure Nginx

Edit `infrastructure/nginx/nginx.conf` (replace `YOUR_DOMAIN` with your actual domain):

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name YOUR_DOMAIN;

    ssl_certificate /etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/YOUR_DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    # Telegram webhook endpoint
    location /webhook/telegram {
        proxy_pass http://bot:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Admin panel (frontend)
    location / {
        proxy_pass http://frontend:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Grafana dashboard
    location /grafana/ {
        proxy_pass http://monitoring-stack:3000/;
    }

    # Uptime Kuma
    location /uptime/ {
        proxy_pass http://monitoring-stack:3001/;
    }
}
```

Reload Nginx:

```bash
docker compose restart nginx
```

### 4.4 Configure Certificate Auto-Renewal

Add cron job:

```bash
sudo crontab -e
```

Add line (certificate renewal runs automatically twice daily):

```cron
0 0,12 * * * docker run --rm --name certbot -v "/opt/BuhBot/infrastructure/nginx/ssl:/etc/letsencrypt" -v "/opt/BuhBot/infrastructure/nginx/certbot:/var/www/certbot" certbot/certbot renew --quiet && docker compose -f /opt/BuhBot/infrastructure/docker-compose.yml restart nginx
```

> **Note**: This cron job handles automatic SSL certificate renewal. No placeholder replacement needed here.

---

## Step 5: Configure Telegram Webhook (10 minutes)

### 5.1 Set Webhook URL

Use Telegram Bot API (replace placeholders with your actual values):

```bash
curl -F "url=https://YOUR_DOMAIN/webhook/telegram" \
     -F "secret_token=YOUR_WEBHOOK_SECRET" \
     -F "allowed_updates=[\"message\",\"callback_query\"]" \
     https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook
```

Expected response:

```json
{ "ok": true, "result": true, "description": "Webhook was set" }
```

### 5.2 Verify Webhook

Check webhook info (replace `YOUR_BOT_TOKEN` with your actual token):

```bash
curl https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo
```

Expected response:

```json
{
  "ok": true,
  "result": {
    "url": "https://YOUR_DOMAIN/webhook/telegram",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "last_error_date": 0,
    "max_connections": 40
  }
}
```

### 5.3 Test Bot

Send message to bot in Telegram:

```
/start
```

Check bot logs:

```bash
docker compose logs -f bot | grep "Received message"
```

Expected output:

```
[2025-11-17T12:00:00.000Z] INFO: Received message from user 111222333: /start
```

---

## Step 6: Monitoring Setup (15 minutes)

### 6.1 Access Grafana

Open browser: `https://YOUR_DOMAIN/grafana`

Default credentials:

- **Username**: `admin`
- **Password**: `YOUR_GRAFANA_PASSWORD` (the value you set in `.env.production`)

Change password on first login.

### 6.2 Import Dashboards

1. Navigate to **Dashboards → Import**
2. Upload dashboard JSON files from `infrastructure/monitoring/grafana/dashboards/`:
   - `bot-performance.json`
   - `system-health.json`
   - `sla-metrics.json`
3. Select **Prometheus** as data source
4. Verify metrics displaying (may take 15 seconds for first scrape)

### 6.3 Configure Uptime Kuma

Open browser: `https://YOUR_DOMAIN/uptime`

1. Create admin account (first visit)
2. Add monitor:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: BuhBot Webhook
   - **URL**: `https://YOUR_DOMAIN/health`
   - **Heartbeat Interval**: 300 seconds (5 minutes)
3. Add notification (Telegram):
   - **Notification Type**: Telegram
   - **Bot Token**: `YOUR_BOT_TOKEN`
   - **Chat ID**: `YOUR_ADMIN_CHAT_ID` (get your chat ID via @userinfobot on Telegram)

### 6.4 Test Alerting

Simulate bot downtime:

```bash
docker compose stop bot
```

Wait 5 minutes → Uptime Kuma should send Telegram alert.

Restart bot:

```bash
docker compose start bot
```

---

## Step 7: Backup Configuration (10 minutes)

### 7.1 Create Backup Script

Already created at `infrastructure/scripts/backup.sh`. Review and customize:

```bash
nano infrastructure/scripts/backup.sh
```

Make executable:

```bash
chmod +x infrastructure/scripts/backup.sh
```

Test backup:

```bash
sudo ./infrastructure/scripts/backup.sh
```

Verify backup files in `/var/backups/buhbot/`:

```bash
ls -lh /var/backups/buhbot/
```

### 7.2 Schedule Weekly Backups

Add cron job (Sunday 3 AM Moscow time):

```bash
sudo crontab -e
```

Add line:

```cron
0 3 * * 0 /opt/BuhBot/infrastructure/scripts/backup.sh >> /var/log/buhbot-backup.log 2>&1
```

---

## Step 8: CI/CD Pipeline Setup (15 minutes)

### 8.1 Add GitHub Secrets

Navigate to GitHub repository → Settings → Secrets and variables → Actions

Add secrets (replace placeholders with your actual values):

- **VDS_HOST**: `YOUR_VDS_IP`
- **VDS_USER**: `buhbot`
- **VDS_SSH_KEY**: (your private SSH key content from `~/.ssh/id_ed25519`)
- **DOCKER_USERNAME**: `YOUR_DOCKER_USERNAME` (if using Docker Hub)
- **DOCKER_PASSWORD**: `YOUR_DOCKER_PASSWORD` (if using Docker Hub)

### 8.2 Configure GitHub Environment

Settings → Environments → Create **"production"** environment

Enable **"Required reviewers"** → Add yourself as reviewer

### 8.3 Test Deployment Workflow

Commit trivial change:

```bash
echo "# Production deployed $(date)" >> README.md
git add README.md
git commit -m "Test deployment workflow"
git push origin main
```

Navigate to **Actions** tab → verify workflow runs → approve deployment when prompted

---

## Verification Checklist

After completing all steps, verify (replace `YOUR_DOMAIN` with your actual domain):

- [ ] **Supabase**: Database tables exist, RLS policies enabled, admin user created
- [ ] **VDS**: Docker containers running (`docker compose ps` shows all `Up`)
- [ ] **HTTPS**: `https://YOUR_DOMAIN/health` returns `{"status":"healthy"}`
- [ ] **Telegram Bot**: `/start` command receives response
- [ ] **Webhook**: `getWebhookInfo` shows correct URL and no errors
- [ ] **Grafana**: Dashboards display metrics at `https://YOUR_DOMAIN/grafana`
- [ ] **Uptime Kuma**: Bot monitor shows "Up" status
- [ ] **Backups**: `/var/backups/buhbot/` contains backup archive
- [ ] **CI/CD**: GitHub Actions workflow succeeds with manual approval

---

## Troubleshooting

### Bot Not Responding

Check logs:

```bash
docker compose logs bot --tail=100
```

Common issues:

- **Invalid webhook secret**: Verify `TELEGRAM_WEBHOOK_SECRET` matches in `.env` and `setWebhook` call
- **Database connection failed**: Check `DATABASE_URL` in `.env`, verify Supabase project not paused
- **Redis connection refused**: Restart redis container: `docker compose restart redis`

### SSL Certificate Issues

Verify certificate paths (replace `YOUR_DOMAIN` with your actual domain):

```bash
ls -la /opt/BuhBot/infrastructure/nginx/ssl/live/YOUR_DOMAIN/
```

If missing, re-run Certbot (Step 4.2).

Check Nginx logs:

```bash
docker compose logs nginx
```

### Monitoring Stack Not Starting

Check system resources:

```bash
free -h        # RAM usage
df -h          # Disk space
docker stats   # Container resource usage
```

If RAM exhausted, consider upgrading VDS or reducing Prometheus retention:

```yaml
# infrastructure/monitoring/prometheus/prometheus.yml
global:
  retention.time: 7d # Reduce from 15d to 7d
```

---

## Security Best Practices

- ✅ All secrets stored in `.env.production` (not committed to git)
- ✅ RLS policies enabled on all Supabase tables
- ✅ Firewall (UFW) blocks all ports except 22, 80, 443
- ✅ SSH key authentication only (password auth disabled)
- ✅ Let's Encrypt SSL certificate with auto-renewal
- ✅ Telegram webhook signature validation enabled
- ✅ Supabase service role key used only in backend (not exposed to frontend)
- ✅ Docker containers run as non-root users
- ✅ Regular automated backups with 4-week retention

---

## Next Steps

1. **Create Working Schedules**: Insert working hours for each chat in `working_schedules` table
2. **Seed Templates**: Add initial message templates in admin panel
3. **Seed FAQ Items**: Add frequently asked questions in admin panel
4. **Test SLA Monitoring**: Send test messages and verify SLA timer starts
5. **Configure Grafana Alerts**: Set up alert rules for critical metrics
6. **Document Recovery Procedures**: Follow disaster recovery runbook in `docs/infrastructure/disaster-recovery.md`

---

## Support

For issues or questions:

- **Documentation**: `docs/infrastructure/`
- **GitHub Issues**: https://github.com/maslennikov-ig/BuhBot/issues
- **Email**: Contact your system administrator

---

**Deployment Time Estimate**: ~2.5 hours (first-time setup)
**Subsequent Deployments**: ~5 minutes (via GitHub Actions)
