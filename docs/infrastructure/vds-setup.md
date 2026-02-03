# BuhBot VDS Setup Guide

**Version**: 1.0.1
**Last Updated**: 2025-11-22
**Target Environment**: FirstVDS.ru production deployment
**Estimated Time**: 2.5 hours (initial setup) | 15 minutes (subsequent updates)

---

> **Note**: This guide contains placeholder values that you must replace with your actual production values before deployment:
>
> - `YOUR_VDS_IP` - Your VDS server IP address (e.g., `123.45.67.89`)
> - `YOUR_DOMAIN` or `bot.example.com` - Your actual domain name
> - `YOUR_PROJECT.supabase.co` - Your Supabase project reference
> - `YOUR_*` placeholders - Your actual credentials and configuration values
>
> **Never commit actual credentials to version control.**

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [VDS Provisioning](#vds-provisioning)
4. [SSH Setup](#ssh-setup)
5. [Docker Installation (Bootstrap Script)](#docker-installation-bootstrap-script)
6. [Docker Compose Deployment](#docker-compose-deployment)
7. [SSL Certificate Setup](#ssl-certificate-setup)
8. [Post-Deployment Verification](#post-deployment-verification)
9. [Troubleshooting](#troubleshooting)
10. [Maintenance](#maintenance)
11. [Security Best Practices](#security-best-practices)

---

## Prerequisites

Before starting, ensure you have:

- ✅ **FirstVDS.ru account** with access to control panel
- ✅ **Domain name** with DNS access (e.g., `bot.example.com`)
- ✅ **SSH client** (OpenSSH on Linux/macOS, PuTTY on Windows)
- ✅ **Git** installed locally (for cloning repository)
- ✅ **Configured backend and frontend** `.env` files (see [Environment Configuration](#environment-configuration))
- ✅ **Minimum 5GB free disk space** on VDS
- ✅ **Basic Linux command-line knowledge**

**Optional**:

- Password manager for storing credentials
- Local copy of this documentation for offline reference

---

## Architecture Overview

The BuhBot application runs on a single VDS server with the following containerized services:

```
┌─────────────────────────────────────────────────────────────────┐
│                      Internet / Clients                          │
│                (Telegram API, Admin Panel Users)                 │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ HTTPS (443) / HTTP (80)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     First VDS Server (Ubuntu 22.04)              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Nginx Reverse Proxy (Let's Encrypt SSL)                   │  │
│  │ - HTTPS termination                                       │  │
│  │ - Rate limiting (100 req/min webhook, 10 req/s general)  │  │
│  │ - Security headers (HSTS, CSP, X-Frame-Options)          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                               │                                  │
│         ┌─────────────────────┼─────────────────────┐           │
│         │                     │                     │           │
│         ▼                     ▼                     ▼           │
│  ┌─────────────┐    ┌─────────────────┐    ┌────────────────┐ │
│  │Bot Backend  │    │   Frontend      │    │ Monitoring     │ │
│  │(Node.js 20) │    │   (Next.js)     │    │ Stack          │ │
│  │- Telegram   │    │- Admin Panel    │    │- Prometheus    │ │
│  │- tRPC API   │    │- Auth (Supabase)│    │- Grafana       │ │
│  │Port: 3000   │    │Port: 3001       │    │- Uptime Kuma   │ │
│  └──────┬──────┘    └─────────────────┘    │Ports: 9090,    │ │
│         │                                    │3002, 3003      │ │
│         ▼                                    └────────────────┘ │
│  ┌─────────────┐                                                │
│  │   Redis     │                                                │
│  │(Cache/Queue)│                                                │
│  │Port: 6379   │                                                │
│  └─────────────┘                                                │
│                                                                  │
│  Docker Volumes: redis-data, prometheus-data, grafana-data,     │
│                  uptime-kuma-data, certbot-data                 │
└─────────────────┬────────────────────────────────────────────────┘
                  │
                  │ PostgreSQL connection (TLS)
                  ▼
         [External: Supabase Cloud]
         (Database, Auth, Storage)
```

**Resource Allocation** (VDS: 2-4 vCPU, 4-8 GB RAM):

- Bot Backend: 1.5-2.0 cores, 1.5-2.0 GB RAM (highest priority)
- Frontend: 0.5-1.0 cores, 512 MB-1 GB RAM
- Redis: 0.25-0.5 cores, 256-512 MB RAM
- Monitoring Stack: 1.0-1.5 cores, 1.5-2.5 GB RAM
- Nginx: 0.25-0.5 cores, 128-256 MB RAM

---

## VDS Provisioning

### Estimated Time: 20 minutes

### Step 1.1: Create VDS Instance on FirstVDS.ru

1. **Log in** to [FirstVDS.ru control panel](https://firstvds.ru/panel)

2. **Navigate** to "Order VDS" or "Create New Server"

3. **Select configuration**:
   - **CPU**: 2-4 vCPU (recommended: 4 vCPU for production)
   - **RAM**: 4-8 GB (recommended: 8 GB for production)
   - **Disk**: 50-100 GB SSD (recommended: 100 GB)
   - **OS**: **Ubuntu 22.04 LTS** (64-bit) ⚠️ **CRITICAL: Must be Ubuntu 22.04**
   - **Location**: Moscow or St. Petersburg data center (for lowest latency to Russia)

4. **Complete order** and wait for provisioning (~5-10 minutes)

5. **Save server credentials** (sent to email):

   ```
   IP Address: YOUR_VDS_IP (replace with your actual VDS IP)
   Root Password: [AUTO_GENERATED_PASSWORD]
   ```

   ⚠️ **IMPORTANT**: Store these credentials in a password manager immediately

### Step 1.2: Initial Access via Web Console

If you don't have SSH configured yet, use the VDS control panel's web console:

1. In FirstVDS control panel, find your VDS instance
2. Click "Console" or "VNC Console"
3. Log in as `root` with the password from email
4. **Change root password immediately**:
   ```bash
   passwd
   ```
   Enter new secure password (minimum 16 characters, mixed case, numbers, symbols)

### Step 1.3: Configure Server Hostname and Timezone

Set hostname:

```bash
hostnamectl set-hostname buhbot-prod
```

Set timezone (Moscow):

```bash
timedatectl set-timezone Europe/Moscow
```

Verify configuration:

```bash
hostnamectl
timedatectl
```

✅ **Expected output**:

```
Static hostname: buhbot-prod
Timezone: Europe/Moscow (MSK, +0300)
```

---

## SSH Setup

### Estimated Time: 15 minutes

### Step 2.1: Generate SSH Key Pair (Local Machine)

If you don't have an SSH key pair, generate one on your **local machine**:

```bash
ssh-keygen -t ed25519 -C "buhbot-production-deploy"
```

**Prompts**:

- **File location**: Press Enter (default: `~/.ssh/id_ed25519`)
- **Passphrase**: Enter strong passphrase (recommended) or leave empty

✅ **Expected output**:

```
Your identification has been saved in /home/user/.ssh/id_ed25519
Your public key has been saved in /home/user/.ssh/id_ed25519.pub
The key fingerprint is:
SHA256:abc123... buhbot-production-deploy
```

### Step 2.2: Copy SSH Public Key to VDS

From your **local machine**, copy the public key to the VDS:

```bash
ssh-copy-id root@YOUR_VDS_IP
```

**Prompt**: Enter root password (from Step 1.1)

✅ **Expected output**:

```
Number of key(s) added: 1
```

### Step 2.3: Test SSH Connection

Test passwordless SSH login:

```bash
ssh root@YOUR_VDS_IP
```

✅ **Success**: You should be logged in **without** entering a password

If successful, exit and continue to next step:

```bash
exit
```

⚠️ **IMPORTANT**: Keep this terminal session open until you've verified SSH access works after bootstrap script (Step 3)

### Step 2.4: Disable Password Authentication (Handled by Bootstrap)

Password authentication will be disabled automatically by the bootstrap script in Step 3. This ensures:

- ✅ Only SSH key-based authentication allowed
- ✅ Root login disabled (after `buhbot` user created)
- ✅ Protection against brute-force attacks

---

## Docker Installation (Bootstrap Script)

### Estimated Time: 10 minutes

The bootstrap script (`infrastructure/scripts/bootstrap-vds.sh`) automates:

1. System package updates
2. Docker CE and Docker Compose installation
3. UFW firewall configuration (ports 22, 80, 443)
4. `buhbot` system user creation with Docker access
5. SSH key setup for `buhbot` user
6. SSH hardening (disable root login, password auth)
7. fail2ban installation for intrusion prevention

### Step 3.1: Download Bootstrap Script

On your **local machine**, clone the repository:

```bash
git clone https://github.com/maslennikov-ig/BuhBot.git
cd BuhBot
```

### Step 3.2: Copy Bootstrap Script to VDS

From your **local machine** (replace `YOUR_VDS_IP` with your actual VDS IP):

```bash
scp infrastructure/scripts/bootstrap-vds.sh root@YOUR_VDS_IP:/tmp/
```

### Step 3.3: Run Bootstrap Script on VDS

SSH into VDS and execute (replace `YOUR_VDS_IP` with your actual VDS IP):

```bash
ssh root@YOUR_VDS_IP
cd /tmp
chmod +x bootstrap-vds.sh
sudo ./bootstrap-vds.sh
```

⚠️ **IMPORTANT**: The script will prompt for confirmation before certain operations (Docker reinstall, firewall reset). Answer carefully.

✅ **Expected output** (final lines):

```
[SUCCESS] ========================================
[SUCCESS] Bootstrap completed successfully!
[SUCCESS] ========================================

Next steps:
1. Test SSH access as buhbot BEFORE closing this session
2. Clone BuhBot repository to /home/buhbot/BuhBot
3. Configure environment variables (.env files)
4. Run deployment script: ./infrastructure/scripts/deploy.sh

Application directory: /home/buhbot/BuhBot
Log file: /var/log/buhbot-bootstrap-YYYYMMDD-HHMMSS.log
```

### Step 3.4: Verify Docker Installation

Check Docker version:

```bash
docker --version
docker compose version
```

✅ **Expected output**:

```
Docker version 24.0+
Docker Compose version v2.20+
```

Test Docker (hello-world container):

```bash
docker run --rm hello-world
```

✅ **Expected output**:

```
Hello from Docker!
This message shows that your installation appears to be working correctly.
```

### Step 3.5: Verify buhbot User Created

Check user exists:

```bash
id buhbot
```

✅ **Expected output**:

```
uid=1001(buhbot) gid=1001(buhbot) groups=1001(buhbot),999(docker)
```

Verify buhbot home directory:

```bash
ls -la /home/buhbot/
```

✅ **Expected**: `.ssh/` directory exists with correct permissions (700)

### Step 3.6: Test SSH Access as buhbot User

⚠️ **CRITICAL**: Before closing root session, test SSH as `buhbot` user from **another terminal**:

```bash
ssh buhbot@YOUR_VDS_IP
```

✅ **Success**: Passwordless login works (using same SSH key)

If successful:

1. Exit `buhbot` session
2. Exit `root` session
3. All future access will be as `buhbot` user

⚠️ **WARNING**: Root login is now **disabled**. If `buhbot` SSH fails, you'll need to use FirstVDS web console to fix it.

### Step 3.7: Review Bootstrap Logs (Optional)

If any issues occurred, review detailed logs:

```bash
sudo tail -n 100 /var/log/buhbot-bootstrap-*.log
```

---

## Docker Compose Deployment

### Estimated Time: 30 minutes

The deployment script (`infrastructure/scripts/deploy.sh`) automates:

1. Pre-flight checks (Docker, files, disk space)
2. Backup of current deployment state
3. Docker image pulling
4. Service deployment with health checks
5. Endpoint verification
6. Automatic rollback on failure

### Step 4.1: Clone Repository to VDS

SSH as `buhbot` user:

```bash
ssh buhbot@YOUR_VDS_IP
```

Clone repository:

```bash
cd ~
git clone https://github.com/maslennikov-ig/BuhBot.git
cd BuhBot
```

✅ **Verify**: Repository cloned to `/home/buhbot/BuhBot`

### Step 4.2: Environment Configuration

Create environment files from examples:

```bash
# Backend environment
cp backend/.env.example backend/.env
nano backend/.env
```

**Fill in backend/.env** (replace placeholders):

```bash
# Node Environment
NODE_ENV=production
PORT=3000

# Supabase Configuration (replace YOUR_PROJECT with your Supabase project reference)
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

# Database Configuration (replace YOUR_PROJECT and YOUR_DB_PASSWORD with actual values)
DATABASE_URL=postgresql://postgres.YOUR_PROJECT:YOUR_DB_PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:YOUR_DB_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN

# Logging
LOG_LEVEL=warn

# Security (generate with: openssl rand -base64 32)
JWT_SECRET=YOUR_JWT_SECRET
ENCRYPTION_KEY=YOUR_ENCRYPTION_KEY

# Metrics & Monitoring
PROMETHEUS_PORT=9090
ENABLE_METRICS=true
ENABLE_SENTRY=false
```

**Frontend environment**:

```bash
cp frontend/.env.example frontend/.env.local
nano frontend/.env.local
```

**Fill in frontend/.env.local**:

```bash
# Supabase Configuration (replace YOUR_PROJECT with your Supabase project reference)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY

# API Configuration (points to backend service)
NEXT_PUBLIC_API_URL=http://bot-backend:3000
```

**Infrastructure environment** (optional, for custom ports):

```bash
cp infrastructure/.env.example infrastructure/.env
# Edit only if you need custom ports (not recommended)
```

**Secure environment files**:

```bash
chmod 600 backend/.env frontend/.env.local infrastructure/.env
```

✅ **Verify**:

```bash
ls -l backend/.env frontend/.env.local
```

Output should show `-rw-------` (read/write owner only)

### Step 4.3: Run Deployment Script

Navigate to repository root:

```bash
cd /home/buhbot/BuhBot
```

Make deployment script executable:

```bash
chmod +x infrastructure/scripts/deploy.sh
```

**Dry run** (recommended first time):

```bash
./infrastructure/scripts/deploy.sh --dry-run
```

✅ **Expected output**: All pre-flight checks pass, no actual changes made

**Production deployment**:

```bash
./infrastructure/scripts/deploy.sh
```

**Prompts**:

- **Continue with deployment?**: Type `yes` and press Enter

⏱️ **Deployment time**: 5-10 minutes (depends on image pull speed)

✅ **Expected output** (final lines):

```
[SUCCESS] ========================================
[SUCCESS] Deployment completed successfully!
[SUCCESS] ========================================

Container Status:
NAME                STATUS              PORTS
buhbot-bot-backend  Up 45 seconds       0.0.0.0:3000->3000/tcp (healthy)
buhbot-frontend     Up 45 seconds       0.0.0.0:3001->3000/tcp (healthy)
buhbot-redis        Up 60 seconds       6379/tcp (healthy)
buhbot-monitoring-stack Up 60 seconds   0.0.0.0:9090->9090/tcp, 0.0.0.0:3002->3000/tcp
buhbot-nginx        Up 45 seconds       0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp (healthy)

Backup Location: /var/backups/buhbot-pre-deploy-YYYYMMDD-HHMMSS
Log File: /var/log/buhbot-deploy-YYYYMMDD-HHMMSS.log
```

### Step 4.4: Verify All Containers Running

Check container status:

```bash
docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.prod.yml ps
```

✅ **All containers** should show `Up` status and `(healthy)` where applicable

Check container logs:

```bash
# Bot backend logs
docker logs buhbot-bot-backend --tail=50

# Frontend logs
docker logs buhbot-frontend --tail=50

# Nginx logs
docker logs buhbot-nginx --tail=50
```

✅ **No errors** should appear in logs

### Step 4.5: Test Endpoints (Internal)

From VDS, test internal endpoints:

```bash
# Bot backend health
curl http://localhost:3000/health
```

✅ **Expected output**: `{"status":"healthy"}` or similar JSON response

```bash
# Frontend
curl http://localhost:3001
```

✅ **Expected output**: HTML response (Next.js page)

```bash
# Prometheus metrics (monitoring stack)
curl http://localhost:9100/metrics
```

✅ **Expected output**: Prometheus metrics in text format

⚠️ **If any endpoint fails**, check logs and troubleshooting section

---

## SSL Certificate Setup

### Estimated Time: 20 minutes

Let's Encrypt provides free SSL certificates with automatic renewal.

### Step 5.1: Configure Domain DNS

Before obtaining SSL certificate, configure DNS A record:

1. **Log in** to your domain registrar/DNS provider
2. **Add A record**:
   - **Type**: A
   - **Name**: `bot` (or `@` for root domain)
   - **Value**: `YOUR_VDS_IP` (replace with your actual VDS IP)
   - **TTL**: 300 (5 minutes)

3. **Wait for DNS propagation** (5-15 minutes)

**Verify DNS propagation** (replace `YOUR_DOMAIN` with your actual domain):

```bash
dig YOUR_DOMAIN +short
```

✅ **Expected output**: Your VDS IP address

Alternatively, use online tool: https://dnschecker.org

### Step 5.2: Install Certbot

On VDS, install Certbot:

```bash
sudo apt-get update
sudo apt-get install certbot -y
```

✅ **Verify installation**:

```bash
certbot --version
```

Expected: `certbot 1.21.0` or higher

### Step 5.3: Generate SSL Certificate

Run Certbot with webroot plugin (replace placeholders with your actual values):

```bash
sudo certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d YOUR_DOMAIN \
  --email YOUR_EMAIL \
  --agree-tos \
  --no-eff-email
```

**Replace**:

- `YOUR_DOMAIN` - your actual domain (e.g., `bot.example.com`)
- `YOUR_EMAIL` - your email for renewal notifications

**Prompts**:

- **Terms of Service**: Accept
- **Share email**: Optional (recommend: No)

⏱️ **Generation time**: 1-2 minutes

✅ **Expected output**:

```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/YOUR_DOMAIN/privkey.pem
This certificate expires on YYYY-MM-DD.
```

### Step 5.4: Copy Certificates to Nginx Directory

Create SSL directory structure:

```bash
sudo mkdir -p /home/buhbot/BuhBot/infrastructure/nginx/ssl
```

Copy certificates (replace `YOUR_DOMAIN` with your actual domain):

```bash
sudo cp /etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem \
        /home/buhbot/BuhBot/infrastructure/nginx/ssl/fullchain.pem

sudo cp /etc/letsencrypt/live/YOUR_DOMAIN/privkey.pem \
        /home/buhbot/BuhBot/infrastructure/nginx/ssl/privkey.pem
```

Set correct permissions:

```bash
sudo chown -R buhbot:buhbot /home/buhbot/BuhBot/infrastructure/nginx/ssl
sudo chmod 600 /home/buhbot/BuhBot/infrastructure/nginx/ssl/*.pem
```

✅ **Verify**:

```bash
ls -l /home/buhbot/BuhBot/infrastructure/nginx/ssl/
```

Expected: `fullchain.pem` and `privkey.pem` with `-rw-------` permissions

### Step 5.5: Update Nginx Configuration

The Nginx configuration (`infrastructure/nginx/nginx.conf`) already includes SSL settings. Verify paths are correct:

```bash
nano /home/buhbot/BuhBot/infrastructure/nginx/nginx.conf
```

**Check these lines** (around line 138-139):

```nginx
ssl_certificate /etc/nginx/ssl/fullchain.pem;
ssl_certificate_key /etc/nginx/ssl/privkey.pem;
```

These paths are correct because the volume mount in `docker-compose.yml` maps:

```yaml
volumes:
  - ./nginx/ssl:/etc/nginx/ssl:ro
```

Save and exit (Ctrl+O, Enter, Ctrl+X)

### Step 5.6: Reload Nginx

Restart Nginx container to load certificates:

```bash
cd /home/buhbot/BuhBot
docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.prod.yml restart nginx
```

✅ **Expected output**:

```
[+] Running 1/1
 ✔ Container buhbot-nginx  Started
```

Check Nginx logs for errors:

```bash
docker logs buhbot-nginx --tail=20
```

✅ **No SSL errors** should appear

### Step 5.7: Test HTTPS Access

From your **local machine** (or any external browser, replace `YOUR_DOMAIN`):

```bash
curl -I https://YOUR_DOMAIN/health
```

✅ **Expected output**:

```
HTTP/2 200
server: nginx/1.25
content-type: application/json
strict-transport-security: max-age=31536000; includeSubDomains; preload
```

**Browser test**: Open `https://YOUR_DOMAIN` in browser

✅ **Expected**: Valid SSL certificate (green padlock icon)

### Step 5.8: Configure Automatic Certificate Renewal

Let's Encrypt certificates expire after **90 days**. Configure automatic renewal:

**Create renewal script**:

```bash
sudo nano /usr/local/bin/renew-letsencrypt.sh
```

**Add content**:

```bash
#!/bin/bash
# Renew Let's Encrypt certificates and reload Nginx

certbot renew --quiet --webroot -w /var/www/certbot

# Copy renewed certificates to Nginx directory
# NOTE: Replace YOUR_DOMAIN with your actual domain in this script
cp /etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem \
   /home/buhbot/BuhBot/infrastructure/nginx/ssl/fullchain.pem

cp /etc/letsencrypt/live/YOUR_DOMAIN/privkey.pem \
   /home/buhbot/BuhBot/infrastructure/nginx/ssl/privkey.pem

# Fix permissions
chown buhbot:buhbot /home/buhbot/BuhBot/infrastructure/nginx/ssl/*.pem
chmod 600 /home/buhbot/BuhBot/infrastructure/nginx/ssl/*.pem

# Reload Nginx
cd /home/buhbot/BuhBot
docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.prod.yml restart nginx
```

**Make executable**:

```bash
sudo chmod +x /usr/local/bin/renew-letsencrypt.sh
```

**Test renewal** (dry run):

```bash
sudo certbot renew --dry-run
```

✅ **Expected output**: `Congratulations, all simulated renewals succeeded`

**Add cron job** (runs twice daily at midnight and noon):

```bash
sudo crontab -e
```

**Add line**:

```cron
0 0,12 * * * /usr/local/bin/renew-letsencrypt.sh >> /var/log/letsencrypt-renewal.log 2>&1
```

Save and exit

✅ **Verify cron job**:

```bash
sudo crontab -l
```

---

## Post-Deployment Verification

### Estimated Time: 15 minutes

### Step 6.1: Check All Container Health

View container status:

```bash
cd /home/buhbot/BuhBot
docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.prod.yml ps
```

✅ **Expected output**:

```
NAME                     STATUS              PORTS
buhbot-bot-backend       Up 10 minutes       0.0.0.0:3000->3000/tcp (healthy)
buhbot-frontend          Up 10 minutes       0.0.0.0:3001->3000/tcp (healthy)
buhbot-redis             Up 10 minutes       6379/tcp (healthy)
buhbot-monitoring-stack  Up 10 minutes       0.0.0.0:9090->9090/tcp, 0.0.0.0:3002->3000/tcp (healthy)
buhbot-nginx             Up 10 minutes       0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp (healthy)
```

All containers must show:

- **Status**: `Up` (not `Restarting` or `Exited`)
- **Health**: `(healthy)` where applicable

### Step 6.2: Test HTTPS Endpoints

From **external network** (local machine or browser):

**Health endpoint**:

```bash
curl https://YOUR_DOMAIN/health
```

✅ **Expected**: `{"status":"healthy"}` with HTTP 200

**Frontend (admin panel)**:

```bash
curl -I https://YOUR_DOMAIN/
```

✅ **Expected**: HTTP 200 response with HTML content

**Grafana dashboard**:

Open browser: `https://YOUR_DOMAIN/grafana`

✅ **Expected**: Grafana login page

**Uptime Kuma**:

Open browser: `https://YOUR_DOMAIN/uptime`

✅ **Expected**: Uptime Kuma dashboard

### Step 6.3: Check Container Logs

Review logs for errors:

```bash
# Bot backend
docker logs buhbot-bot-backend --tail=50

# Frontend
docker logs buhbot-frontend --tail=50

# Redis
docker logs buhbot-redis --tail=50

# Nginx
docker logs buhbot-nginx --tail=50

# Monitoring stack
docker logs buhbot-monitoring-stack --tail=50
```

✅ **No critical errors** (warnings acceptable for first run)

### Step 6.4: Monitor Resource Usage

Check CPU and memory consumption:

```bash
docker stats --no-stream
```

✅ **Expected resource usage** (for 4 vCPU / 8 GB RAM VDS):

```
CONTAINER                CPU %    MEM USAGE / LIMIT   MEM %
buhbot-bot-backend       5-15%    500MB / 2GB         25%
buhbot-frontend          2-8%     300MB / 1GB         30%
buhbot-redis             1-3%     50MB / 512MB        10%
buhbot-monitoring-stack  10-20%   800MB / 2.5GB       32%
buhbot-nginx             1-2%     20MB / 256MB        8%
```

⚠️ **WARNING**: If any container exceeds 80% of memory limit, consider upgrading VDS

### Step 6.5: Verify Disk Space

Check available disk space:

```bash
df -h
```

✅ **Expected**: At least **5 GB free space** on root partition

Check Docker disk usage:

```bash
docker system df
```

✅ **Monitor**:

- Images: < 5 GB
- Containers: < 1 GB
- Volumes: < 2 GB
- Build cache: < 500 MB

**Cleanup old images** (if needed):

```bash
docker image prune -a -f
```

### Step 6.6: Test Backup Exists

Verify deployment backup was created:

```bash
ls -lh /var/backups/buhbot-pre-deploy-*/
```

✅ **Expected**: Directory exists with backup files:

- `backend.env`
- `frontend.env.local`
- `buhbot-redis-data.tar.gz`
- `container-state.json`

### Step 6.7: Verify Firewall Rules

Check UFW status:

```bash
sudo ufw status verbose
```

✅ **Expected output**:

```
Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), disabled (routed)

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW IN    Anywhere
80/tcp                     ALLOW IN    Anywhere
443/tcp                    ALLOW IN    Anywhere
```

---

## Troubleshooting

### Container Not Starting

**Symptom**: Container status shows `Exited` or `Restarting`

**Diagnosis**:

```bash
docker logs <container_name> --tail=100
```

**Common causes**:

1. **Environment variable missing**: Check `.env` files

   ```bash
   # Verify all required variables set
   cat backend/.env | grep "SUPABASE_URL"
   cat backend/.env | grep "TELEGRAM_BOT_TOKEN"
   ```

2. **Port conflict**: Another service using port

   ```bash
   sudo netstat -tlnp | grep <port_number>
   ```

   Solution: Stop conflicting service or change port in `docker-compose.yml`

3. **Database connection failed**: Check `DATABASE_URL` and Supabase project status

   ```bash
   # Test database connection from VDS
   docker run --rm postgres:15 psql "$DATABASE_URL" -c "SELECT 1"
   ```

4. **Insufficient memory**: Check Docker stats
   ```bash
   docker stats --no-stream
   ```
   Solution: Increase VDS RAM or reduce resource limits in `docker-compose.prod.yml`

**Resolution**:

After fixing issue, restart container:

```bash
docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.prod.yml restart <service_name>
```

### Health Check Failing

**Symptom**: Container shows `Up` but not `(healthy)`

**Diagnosis**:

```bash
docker inspect <container_name> | grep -A 10 Health
```

**Common causes**:

1. **Service not listening on expected port**: Check application logs
2. **Health endpoint not responding**: Test manually
   ```bash
   docker exec <container_name> curl -f http://localhost:<port>/health
   ```

**Resolution**:

Increase health check timeout in `docker-compose.yml`:

```yaml
healthcheck:
  interval: 30s
  timeout: 10s # Increase from 3s to 10s
  start_period: 40s # Increase from 10s to 40s
  retries: 3
```

### SSL Certificate Issues

**Symptom**: HTTPS returns certificate error

**Diagnosis**:

```bash
# Check certificate files exist
ls -l /home/buhbot/BuhBot/infrastructure/nginx/ssl/

# Check Nginx logs
docker logs buhbot-nginx | grep ssl
```

**Common causes**:

1. **Certificate files missing**: Re-run certbot (Step 5.3)
2. **Permissions incorrect**: Fix with
   ```bash
   sudo chmod 600 /home/buhbot/BuhBot/infrastructure/nginx/ssl/*.pem
   ```
3. **Certificate expired**: Check expiration
   ```bash
   sudo certbot certificates
   ```

**Resolution**:

Force certificate renewal:

```bash
sudo certbot renew --force-renewal
sudo /usr/local/bin/renew-letsencrypt.sh
```

### High Memory Usage

**Symptom**: Container consuming > 80% of allocated memory

**Diagnosis**:

```bash
docker stats
free -h
```

**Resolution**:

1. **Restart container** to clear memory leaks:

   ```bash
   docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.prod.yml restart <service_name>
   ```

2. **Reduce heap size** (for Node.js services):

   Edit `docker-compose.prod.yml`:

   ```yaml
   bot-backend:
     environment:
       - NODE_OPTIONS=--max-old-space-size=1024 # Reduce from 1536 to 1024
   ```

3. **Upgrade VDS** if persistent (increase RAM from 4 GB to 8 GB)

### Deployment Rollback

**Symptom**: Deployment failed or application broken after update

**Resolution**:

Use automatic rollback from backup:

```bash
# Find latest backup
ls -lt /var/backups/ | grep buhbot-pre-deploy

# Restore from backup
cd /home/buhbot/BuhBot

# Stop current deployment
docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.prod.yml down

# Restore volumes
BACKUP_DIR=/var/backups/buhbot-pre-deploy-YYYYMMDD-HHMMSS

for backup_file in "$BACKUP_DIR"/*.tar.gz; do
    volume_name=$(basename "$backup_file" .tar.gz)
    echo "Restoring volume: $volume_name"

    docker volume create "$volume_name"
    docker run --rm \
        -v "$volume_name:/data" \
        -v "$BACKUP_DIR:/backup" \
        alpine sh -c "rm -rf /data/* && tar xzf /backup/${volume_name}.tar.gz -C /data"
done

# Restore environment files
cp "$BACKUP_DIR/backend.env" backend/.env
cp "$BACKUP_DIR/frontend.env.local" frontend/.env.local

# Restart services
docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.prod.yml up -d
```

### Log Files

**Locations**:

- **Bootstrap logs**: `/var/log/buhbot-bootstrap-*.log`
- **Deployment logs**: `/var/log/buhbot-deploy-*.log`
- **Certificate renewal logs**: `/var/log/letsencrypt-renewal.log`
- **Container logs**: `docker logs <container_name>`

**View logs**:

```bash
# Bootstrap
sudo tail -f /var/log/buhbot-bootstrap-*.log

# Deployment
sudo tail -f /var/log/buhbot-deploy-*.log

# Real-time container logs
docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.prod.yml logs -f
```

---

## Maintenance

### Update Application (Re-deployment)

**Frequency**: As needed (after code changes)

**Steps**:

```bash
ssh buhbot@YOUR_VDS_IP
cd /home/buhbot/BuhBot

# Pull latest code
git pull origin main

# Run deployment script (automatic backup + rollback on failure)
./infrastructure/scripts/deploy.sh
```

⏱️ **Time**: 5-10 minutes

### Backup Docker Volumes

**Frequency**: Weekly (automated via cron)

**Manual backup**:

```bash
# Create backup directory
BACKUP_DIR="/var/backups/buhbot-manual-$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p "$BACKUP_DIR"

# Backup each volume
for volume in $(docker volume ls --filter "name=buhbot-" -q); do
    echo "Backing up volume: $volume"
    sudo docker run --rm \
        -v "$volume:/data" \
        -v "$BACKUP_DIR:/backup" \
        alpine tar czf "/backup/${volume}.tar.gz" -C /data .
done

echo "Backup completed: $BACKUP_DIR"
```

**Automated weekly backup** (already configured if following quickstart):

```bash
sudo crontab -l
```

Expected cron entry:

```cron
0 3 * * 0 /opt/BuhBot/infrastructure/scripts/backup.sh >> /var/log/buhbot-backup.log 2>&1
```

### Certificate Renewal

**Frequency**: Automatic (twice daily via cron)

**Manual renewal** (if needed):

```bash
sudo /usr/local/bin/renew-letsencrypt.sh
```

**Verify renewal status**:

```bash
sudo certbot certificates
```

✅ **Expected output**:

```
Certificate Name: YOUR_DOMAIN
  Expiry Date: YYYY-MM-DD (VALID: XX days)
```

**WARNING**: Certificate expires in < 30 days → investigate why auto-renewal failed

### Monitor Disk Space

**Check disk usage**:

```bash
df -h
du -sh /var/lib/docker/
```

**Cleanup old Docker data**:

```bash
# Remove unused images
docker image prune -a -f

# Remove unused volumes (CAUTION: only if sure they're not needed)
docker volume prune -f

# Remove build cache
docker builder prune -a -f
```

### Review Security Updates

**Frequency**: Monthly

**Update system packages**:

```bash
sudo apt-get update
sudo apt-get upgrade -y
```

**Update Docker images** (rebuild from latest base images):

```bash
cd /home/buhbot/BuhBot
git pull origin main
./infrastructure/scripts/deploy.sh
```

---

## Security Best Practices

### Implemented Security Measures

- ✅ **SSH key-only authentication** (password auth disabled)
- ✅ **Root login disabled** (only `buhbot` user can SSH)
- ✅ **UFW firewall** enabled (only ports 22, 80, 443 open)
- ✅ **fail2ban** active (intrusion prevention)
- ✅ **Let's Encrypt SSL** with HSTS (HTTPS enforced)
- ✅ **Rate limiting** on webhooks (100 req/min) and general endpoints (10 req/s)
- ✅ **Security headers** (CSP, X-Frame-Options, X-Content-Type-Options)
- ✅ **Docker containers** run with minimal privileges (no-new-privileges, dropped capabilities)
- ✅ **Secrets management** (`.env` files not committed to git)
- ✅ **Regular backups** with 4-week retention

### Additional Recommendations

1. **Enable automatic security updates**:

   ```bash
   sudo apt-get install unattended-upgrades -y
   sudo dpkg-reconfigure -plow unattended-upgrades
   ```

2. **Configure fail2ban for Nginx**:

   ```bash
   sudo nano /etc/fail2ban/jail.local
   ```

   Add:

   ```ini
   [nginx-http-auth]
   enabled = true

   [nginx-limit-req]
   enabled = true
   logpath = /var/log/nginx/error.log
   ```

   Restart:

   ```bash
   sudo systemctl restart fail2ban
   ```

3. **Monitor failed login attempts**:

   ```bash
   sudo fail2ban-client status sshd
   ```

4. **Regular security audits**:

   ```bash
   # Check open ports
   sudo netstat -tlnp

   # Check running processes
   ps aux | grep -E "(docker|nginx|redis)"

   # Review auth logs
   sudo tail -f /var/log/auth.log
   ```

5. **Implement intrusion detection** (optional):
   ```bash
   sudo apt-get install aide -y
   sudo aideinit
   ```

---

## Summary

You have successfully deployed BuhBot on a FirstVDS production server with:

- ✅ **Automated infrastructure setup** (bootstrap script)
- ✅ **Containerized application stack** (Docker Compose)
- ✅ **HTTPS with auto-renewal** (Let's Encrypt)
- ✅ **Monitoring and observability** (Prometheus, Grafana, Uptime Kuma)
- ✅ **Security hardening** (firewall, SSH keys, rate limiting)
- ✅ **Automated backups and rollback** (disaster recovery ready)

**Next steps**:

1. Configure Telegram webhook (see [specs/001-infrastructure-setup/quickstart.md](../../specs/001-infrastructure-setup/quickstart.md#step-5-configure-telegram-webhook))
2. Set up monitoring alerts in Grafana
3. Test bot functionality with real Telegram messages
4. Review and customize monitoring dashboards
5. Document any custom configurations for your team

**Support resources**:

- **GitHub repository**: https://github.com/maslennikov-ig/BuhBot
- **Infrastructure documentation**: `/home/me/code/bobabuh/docs/infrastructure/`
- **Quickstart guide**: `/home/me/code/bobabuh/specs/001-infrastructure-setup/quickstart.md`
- **Troubleshooting logs**: `/var/log/buhbot-*.log`

---

**Document Version**: 1.0.1
**Tested on**: Ubuntu 22.04 LTS, Docker 24.0+, Docker Compose v2.20+
**Last Updated**: 2025-11-22
