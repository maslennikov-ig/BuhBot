# BuhBot Disaster Recovery Runbook

**Version**: 1.0.0
**Last Updated**: 2025-11-22
**Target Audience**: Operations team, system administrators, on-call engineers
**Classification**: Internal - Operations Critical

---

## Table of Contents

1. [Overview](#overview)
2. [Recovery Objectives](#recovery-objectives)
3. [Emergency Contact Information](#emergency-contact-information)
4. [Prerequisites](#prerequisites)
5. [Scenario 1: VDS Complete Failure](#scenario-1-vds-complete-failure)
6. [Scenario 2: Database Corruption (Supabase)](#scenario-2-database-corruption-supabase)
7. [Scenario 3: SSL Certificate Expired](#scenario-3-ssl-certificate-expired)
8. [Post-Recovery Checklist](#post-recovery-checklist)
9. [Testing DR Procedures](#testing-dr-procedures)
10. [Appendix: Quick Reference Commands](#appendix-quick-reference-commands)

---

## Overview

This document provides step-by-step disaster recovery procedures for BuhBot infrastructure. It covers three primary failure scenarios and includes verification steps to ensure complete recovery.

### Architecture Summary

```
                    Internet
                       |
                       v
              +----------------+
              |   FirstVDS     |
              |   (VDS Server) |
              +----------------+
                       |
        +--------------+--------------+
        |              |              |
        v              v              v
   +--------+    +----------+   +---------+
   | Docker |    |  Nginx   |   |  Redis  |
   |Services|    |  (SSL)   |   | (Cache) |
   +--------+    +----------+   +---------+
        |
        v
   +------------------+
   | External: Supabase|
   | (PostgreSQL DB)   |
   +------------------+
```

### Critical Services

| Service       | Priority      | Impact of Failure                      |
| ------------- | ------------- | -------------------------------------- |
| Bot Backend   | P1 - Critical | Telegram bot completely non-functional |
| Supabase (DB) | P1 - Critical | No data persistence, auth failures     |
| Redis         | P2 - High     | Session loss, degraded performance     |
| Frontend      | P2 - High     | Admin panel inaccessible               |
| Nginx         | P2 - High     | All HTTPS traffic blocked              |
| Monitoring    | P3 - Medium   | No visibility, alerts non-functional   |

---

## Recovery Objectives

### Recovery Time Objective (RTO): 4 hours

Maximum acceptable downtime before critical business functions are restored.

| Scenario                | Target RTO | Maximum RTO |
| ----------------------- | ---------- | ----------- |
| VDS Complete Failure    | 2 hours    | 4 hours     |
| Database Corruption     | 1 hour     | 2 hours     |
| SSL Certificate Expired | 10 minutes | 30 minutes  |

### Recovery Point Objective (RPO): 24 hours

Maximum acceptable data loss measured in time.

| Data Type           | Backup Frequency         | RPO             |
| ------------------- | ------------------------ | --------------- |
| Supabase Database   | Daily (automatic)        | 24 hours        |
| Redis State         | Weekly (manual/optional) | 7 days          |
| Configuration Files | Per deployment           | Immediate (git) |
| SSL Certificates    | N/A (regeneratable)      | N/A             |

### SLA Targets

- **Monthly Uptime Target**: 99.9% (approximately 43 minutes downtime/month)
- **Alert Response Time**: 15 minutes (critical), 4 hours (warning)
- **Communication to Stakeholders**: Within 30 minutes of incident start

---

## Emergency Contact Information

### Internal Contacts

| Role             | Name           | Contact          | Backup Contact    |
| ---------------- | -------------- | ---------------- | ----------------- |
| On-Call Engineer | [Primary Name] | [Phone/Telegram] | [Secondary Phone] |
| DevOps Lead      | [Name]         | [Phone/Telegram] | [Email]           |
| Security Lead    | [Name]         | [Phone/Telegram] | [Email]           |
| Project Manager  | [Name]         | [Phone/Telegram] | [Email]           |

### External Service Contacts

| Service       | Support URL                        | Response Time  |
| ------------- | ---------------------------------- | -------------- |
| FirstVDS.ru   | https://firstvds.ru/support        | 24/7 Live Chat |
| Supabase      | support@supabase.com               | Business hours |
| Let's Encrypt | https://community.letsencrypt.org  | Community      |
| Telegram API  | https://core.telegram.org/bots/faq | Community      |

### Escalation Matrix

| Time Elapsed | Action                                                    |
| ------------ | --------------------------------------------------------- |
| 0-15 min     | On-call engineer acknowledges and begins diagnosis        |
| 15-30 min    | Escalate to DevOps Lead if unresolved                     |
| 30-60 min    | Escalate to Security Lead (if security-related)           |
| 60+ min      | Notify Project Manager, prepare stakeholder communication |

---

## Prerequisites

### Required Access

Before starting any recovery procedure, ensure you have:

- [ ] **SSH access** to new/existing VDS (key-based authentication)
- [ ] **FirstVDS.ru account credentials** (for provisioning)
- [ ] **Supabase dashboard access** (project owner or admin role)
- [ ] **DNS management access** (domain registrar)
- [ ] **GitHub repository access** (clone BuhBot repository)
- [ ] **Backup storage access** (S3/local backups at `/var/backups/`)
- [ ] **Environment file contents** (backend/.env, frontend/.env.local)

### Required Tools

Ensure your local machine has:

```bash
# Verify required tools
ssh -V          # OpenSSH client
git --version   # Git
curl --version  # cURL (for testing)
```

### Backup Locations

| Backup Type       | Primary Location                                            | Secondary Location        |
| ----------------- | ----------------------------------------------------------- | ------------------------- |
| Docker volumes    | `/var/backups/buhbot-*`                                     | S3 (if configured)        |
| Environment files | `/var/backups/buhbot-pre-deploy-*/`                         | Local password manager    |
| Redis data        | `/var/backups/buhbot-pre-deploy-*/buhbot-redis-data.tar.gz` | N/A                       |
| Supabase DB       | Supabase Dashboard > Backups                                | N/A (managed service)     |
| SSL Certificates  | `/etc/letsencrypt/`                                         | Regeneratable via certbot |

---

## Scenario 1: VDS Complete Failure

### Description

The VDS server is completely inaccessible due to:

- Hardware failure
- Datacenter outage
- VDS account suspension
- Catastrophic OS failure

### Estimated Recovery Time: ~2 hours

| Phase                           | Duration | Cumulative |
| ------------------------------- | -------- | ---------- |
| Provision New VDS               | 30 min   | 0:30       |
| Install Docker + Docker Compose | 10 min   | 0:40       |
| Restore Configurations          | 15 min   | 0:55       |
| Deploy Application              | 20 min   | 1:15       |
| Restore Redis State             | 10 min   | 1:25       |
| Update DNS (if needed)          | 5 min    | 1:30       |
| Verify Services                 | 30 min   | 2:00       |

---

### Phase 1: Provision New VDS (30 minutes)

**Step 1.1: Log into FirstVDS Control Panel**

1. Navigate to https://firstvds.ru/panel
2. Log in with account credentials
3. Click "Order VDS" or "Create New Server"

**Step 1.2: Configure VDS Instance**

Select the following specifications:

| Parameter | Value                 | Notes                              |
| --------- | --------------------- | ---------------------------------- |
| CPU       | 2-4 vCPU              | Recommended: 4 vCPU for production |
| RAM       | 4-8 GB                | Recommended: 8 GB for production   |
| Disk      | 50-100 GB SSD         | Recommended: 100 GB                |
| OS        | **Ubuntu 22.04 LTS**  | CRITICAL: Must be Ubuntu 22.04     |
| Location  | Moscow/St. Petersburg | Lowest latency to Russia           |

**Step 1.3: Complete Order and Save Credentials**

1. Complete the order (wait ~5-10 minutes for provisioning)
2. Save credentials sent to email:
   ```
   IP Address: XXX.XXX.XXX.XXX
   Root Password: [AUTO_GENERATED_PASSWORD]
   ```
3. **IMMEDIATELY** store these in password manager

**Expected Output:**

```
VDS Status: Running
IP: XXX.XXX.XXX.XXX
OS: Ubuntu 22.04 LTS
```

---

### Phase 2: Install Docker + Docker Compose (10 minutes)

**Step 2.1: Access VDS via SSH**

```bash
# From your local machine
ssh root@XXX.XXX.XXX.XXX
```

Enter root password when prompted.

**Step 2.2: Change Root Password**

```bash
passwd
```

Enter new secure password (minimum 16 characters, mixed case, numbers, symbols).

**Step 2.3: Set Hostname and Timezone**

```bash
# Set hostname
hostnamectl set-hostname buhbot-prod

# Set timezone (Moscow)
timedatectl set-timezone Europe/Moscow

# Verify
hostnamectl && timedatectl
```

**Expected Output:**

```
   Static hostname: buhbot-prod
         Icon name: computer-vm
           Chassis: vm
...
                Time zone: Europe/Moscow (MSK, +0300)
```

**Step 2.4: Download and Run Bootstrap Script**

```bash
# Create temp directory
mkdir -p /tmp/buhbot-recovery

# Download bootstrap script (or copy from backup/repository)
curl -o /tmp/buhbot-recovery/bootstrap-vds.sh \
  https://raw.githubusercontent.com/maslennikov-ig/BuhBot/main/infrastructure/scripts/bootstrap-vds.sh

# Make executable
chmod +x /tmp/buhbot-recovery/bootstrap-vds.sh

# Run bootstrap script
cd /tmp/buhbot-recovery
sudo ./bootstrap-vds.sh
```

**Expected Output:**

```
[SUCCESS] ========================================
[SUCCESS] Bootstrap completed successfully!
[SUCCESS] ========================================

Next steps:
1. Test SSH access as buhbot BEFORE closing this session
2. Clone BuhBot repository to /home/buhbot/BuhBot
...
```

**Step 2.5: Verify Docker Installation**

```bash
docker --version
docker compose version
```

**Expected Output:**

```
Docker version 24.0+
Docker Compose version v2.20+
```

**Step 2.6: Test SSH as buhbot User (NEW TERMINAL)**

```bash
# In a NEW terminal window
ssh buhbot@XXX.XXX.XXX.XXX
```

**CRITICAL**: Only proceed if SSH as `buhbot` user succeeds. Root login will be disabled.

---

### Phase 3: Restore Configurations (15 minutes)

**Step 3.1: Clone Repository**

```bash
# SSH as buhbot user
ssh buhbot@XXX.XXX.XXX.XXX

# Clone repository
cd ~
git clone https://github.com/maslennikov-ig/BuhBot.git
cd BuhBot
```

**Step 3.2: Restore Environment Files from Backup**

**Option A: Restore from S3/backup storage**

```bash
# Download backup from S3 (if configured)
# aws s3 cp s3://buhbot-backups/latest/backend.env backend/.env
# aws s3 cp s3://buhbot-backups/latest/frontend.env.local frontend/.env.local

# OR restore from local backup (if available)
BACKUP_DIR="/var/backups/buhbot-pre-deploy-YYYYMMDD-HHMMSS"
cp "$BACKUP_DIR/backend.env" backend/.env
cp "$BACKUP_DIR/frontend.env.local" frontend/.env.local
```

**Option B: Recreate from password manager**

```bash
# Copy example files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Edit backend/.env
nano backend/.env
```

Fill in ALL required values from password manager:

```bash
# Required backend/.env values
NODE_ENV=production
PORT=3000
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
DATABASE_URL=postgresql://postgres.YOUR-PROJECT-REF:YOUR_PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR-PROJECT-REF.supabase.co:5432/postgres
REDIS_HOST=redis
REDIS_PORT=6379
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN
JWT_SECRET=GENERATE_RANDOM_32_CHARS
ENCRYPTION_KEY=GENERATE_RANDOM_32_CHARS
```

```bash
# Edit frontend/.env.local
nano frontend/.env.local
```

Fill in frontend values:

```bash
# Required frontend/.env.local values
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

**Step 3.3: Set Secure Permissions**

```bash
chmod 600 backend/.env frontend/.env.local
ls -l backend/.env frontend/.env.local
```

**Expected Output:**

```
-rw------- 1 buhbot buhbot XXX backend/.env
-rw------- 1 buhbot buhbot XXX frontend/.env.local
```

---

### Phase 4: Deploy Application (20 minutes)

**Step 4.1: Run Deployment Script (Dry Run First)**

```bash
cd /home/buhbot/BuhBot

# Make deploy script executable
chmod +x infrastructure/scripts/deploy.sh

# Dry run to verify configuration
./infrastructure/scripts/deploy.sh --dry-run
```

**Expected Output:**

```
[INFO] Pre-flight checks passed
[INFO] Dry run complete - no changes made
```

**Step 4.2: Execute Production Deployment**

```bash
./infrastructure/scripts/deploy.sh
```

When prompted: Type `yes` and press Enter.

**Expected Output (after 5-10 minutes):**

```
[SUCCESS] ========================================
[SUCCESS] Deployment completed successfully!
[SUCCESS] ========================================

Container Status:
NAME                STATUS              PORTS
buhbot-bot-backend  Up 45 seconds       0.0.0.0:3000->3000/tcp (healthy)
buhbot-frontend     Up 45 seconds       0.0.0.0:3001->3000/tcp (healthy)
buhbot-redis        Up 60 seconds       6379/tcp (healthy)
buhbot-monitoring-stack Up 60 seconds   0.0.0.0:9090->9090/tcp, ...
buhbot-nginx        Up 45 seconds       0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp (healthy)
```

**Step 4.3: Verify Container Status**

```bash
docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.prod.yml ps
```

All containers must show:

- Status: `Up`
- Health: `(healthy)` where applicable

---

### Phase 5: Restore Redis State (10 minutes)

**Step 5.1: Check for Redis Backup**

```bash
# List available backups
ls -la /var/backups/buhbot-pre-deploy-*/buhbot-redis-data.tar.gz 2>/dev/null || echo "No Redis backups found"
```

**Step 5.2: Restore Redis Data (if backup exists)**

```bash
# Stop Redis container
docker compose -f infrastructure/docker-compose.yml stop redis

# Find latest backup
BACKUP_FILE=$(ls -t /var/backups/buhbot-pre-deploy-*/buhbot-redis-data.tar.gz 2>/dev/null | head -1)

if [ -n "$BACKUP_FILE" ]; then
    echo "Restoring from: $BACKUP_FILE"

    # Restore Redis volume
    docker run --rm \
        -v buhbot-redis-data:/data \
        -v $(dirname "$BACKUP_FILE"):/backup \
        alpine sh -c "rm -rf /data/* && tar xzf /backup/buhbot-redis-data.tar.gz -C /data"

    echo "Redis data restored successfully"
else
    echo "No backup found - Redis will start with empty state"
fi

# Start Redis container
docker compose -f infrastructure/docker-compose.yml start redis

# Verify Redis health
docker exec buhbot-redis redis-cli ping
```

**Expected Output:**

```
PONG
```

**Note:** If no backup exists, Redis will start fresh. User sessions will be lost, but the bot will remain functional.

---

### Phase 6: Update DNS (5 minutes)

**Only required if VDS IP address changed.**

**Step 6.1: Determine if DNS Update Needed**

```bash
# Get new VDS IP
NEW_IP=$(curl -s ifconfig.me)
echo "New VDS IP: $NEW_IP"

# Check current DNS (from external machine)
# dig bot.example.com +short
```

If IP addresses match, skip to Phase 7.

**Step 6.2: Update DNS A Record**

1. Log into your DNS provider (domain registrar)
2. Find A record for `bot.example.com` (or your domain)
3. Update value to new VDS IP: `XXX.XXX.XXX.XXX`
4. Set TTL to 300 (5 minutes) for faster propagation
5. Save changes

**Step 6.3: Verify DNS Propagation**

```bash
# Wait 2-5 minutes, then verify
dig bot.example.com +short
```

**Expected Output:**

```
XXX.XXX.XXX.XXX  (new VDS IP)
```

Use https://dnschecker.org for global propagation check.

---

### Phase 7: Generate SSL Certificate (10 minutes)

**Step 7.1: Install Certbot**

```bash
sudo apt-get update
sudo apt-get install certbot -y
certbot --version
```

**Step 7.2: Create Webroot Directory**

```bash
sudo mkdir -p /var/www/certbot
```

**Step 7.3: Generate Certificate**

```bash
sudo certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d bot.example.com \
  --email admin@example.com \
  --agree-tos \
  --no-eff-email
```

Replace:

- `bot.example.com` with your actual domain
- `admin@example.com` with your email

**Expected Output:**

```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/bot.example.com/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/bot.example.com/privkey.pem
```

**Step 7.4: Copy Certificates to Nginx**

```bash
# Create SSL directory
sudo mkdir -p /home/buhbot/BuhBot/infrastructure/nginx/ssl

# Copy certificates
sudo cp /etc/letsencrypt/live/bot.example.com/fullchain.pem \
        /home/buhbot/BuhBot/infrastructure/nginx/ssl/fullchain.pem

sudo cp /etc/letsencrypt/live/bot.example.com/privkey.pem \
        /home/buhbot/BuhBot/infrastructure/nginx/ssl/privkey.pem

# Set permissions
sudo chown -R buhbot:buhbot /home/buhbot/BuhBot/infrastructure/nginx/ssl
sudo chmod 600 /home/buhbot/BuhBot/infrastructure/nginx/ssl/*.pem
```

**Step 7.5: Reload Nginx**

```bash
cd /home/buhbot/BuhBot
docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.prod.yml restart nginx

# Check Nginx logs for SSL errors
docker logs buhbot-nginx --tail=20
```

---

### Phase 8: Verify Services (30 minutes)

**Step 8.1: Health Check - All Containers**

```bash
docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.prod.yml ps
```

**Expected:** All containers show `Up` and `(healthy)`

**Step 8.2: Health Check - Internal Endpoints**

```bash
# Bot backend health
curl http://localhost:3000/health
# Expected: {"status":"healthy"}

# Frontend
curl -s http://localhost:3001 | head -5
# Expected: HTML response

# Prometheus
curl http://localhost:9090/-/healthy
# Expected: Prometheus Server is Healthy.
```

**Step 8.3: Health Check - External HTTPS**

```bash
# Test HTTPS (from external machine or curl)
curl -I https://bot.example.com/health
```

**Expected Output:**

```
HTTP/2 200
server: nginx/1.25
content-type: application/json
strict-transport-security: max-age=31536000; includeSubDomains; preload
```

**Step 8.4: Test Telegram Bot**

1. Open Telegram
2. Find your bot by username
3. Send `/start` command
4. Verify bot responds

**Step 8.5: Test Admin Panel**

1. Open browser: `https://bot.example.com`
2. Log in with Supabase credentials
3. Verify dashboard loads correctly

**Step 8.6: Test Monitoring**

1. Grafana: `https://bot.example.com/grafana`
2. Uptime Kuma: `https://bot.example.com/uptime`

**Step 8.7: Setup Auto-Renewal Cron**

```bash
# Create renewal script
sudo nano /usr/local/bin/renew-letsencrypt.sh
```

Add content:

```bash
#!/bin/bash
certbot renew --quiet --webroot -w /var/www/certbot

cp /etc/letsencrypt/live/bot.example.com/fullchain.pem \
   /home/buhbot/BuhBot/infrastructure/nginx/ssl/fullchain.pem

cp /etc/letsencrypt/live/bot.example.com/privkey.pem \
   /home/buhbot/BuhBot/infrastructure/nginx/ssl/privkey.pem

chown buhbot:buhbot /home/buhbot/BuhBot/infrastructure/nginx/ssl/*.pem
chmod 600 /home/buhbot/BuhBot/infrastructure/nginx/ssl/*.pem

cd /home/buhbot/BuhBot
docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.prod.yml restart nginx
```

```bash
sudo chmod +x /usr/local/bin/renew-letsencrypt.sh

# Add cron job
sudo crontab -e
```

Add line:

```
0 0,12 * * * /usr/local/bin/renew-letsencrypt.sh >> /var/log/letsencrypt-renewal.log 2>&1
```

---

## Scenario 2: Database Corruption (Supabase)

### Description

Supabase PostgreSQL database has corrupted data due to:

- Application bug causing bad writes
- Failed migration
- Accidental data deletion
- External attack

### Estimated Recovery Time: ~1 hour

| Phase                               | Duration | Cumulative |
| ----------------------------------- | -------- | ---------- |
| Identify Last Good Backup           | 10 min   | 0:10       |
| Restore Database                    | 30 min   | 0:40       |
| Verify Data Integrity               | 20 min   | 1:00       |
| Replay Lost Transactions (optional) | Variable | Variable   |

---

### Phase 1: Identify Last Good Backup (10 minutes)

**Step 1.1: Access Supabase Dashboard**

1. Navigate to https://supabase.com/dashboard
2. Log in with account credentials
3. Select your BuhBot project

**Step 1.2: Check Available Backups**

1. Go to **Settings** > **Database** > **Backups**
2. Review available daily backups
3. Note timestamp of last backup before corruption

**Step 1.3: Determine Corruption Timeline**

```bash
# On VDS, check application logs for first error
docker logs buhbot-bot-backend --since="24h" 2>&1 | grep -i "error\|failed\|corrupt" | head -20
```

Identify the timestamp when issues started.

**Step 1.4: Select Backup Point**

Select the most recent backup **BEFORE** the corruption timestamp.

| Backup Time      | Corruption Time  | Action                      |
| ---------------- | ---------------- | --------------------------- |
| 2025-11-21 03:00 | 2025-11-22 14:30 | Use Nov 21 backup           |
| 2025-11-22 03:00 | 2025-11-22 14:30 | Use Nov 22 backup (morning) |

---

### Phase 2: Restore Database (30 minutes)

**WARNING: This will overwrite current database state. Ensure you have identified the correct backup.**

**Step 2.1: Stop Application (Prevent Further Writes)**

```bash
ssh buhbot@XXX.XXX.XXX.XXX
cd /home/buhbot/BuhBot

# Stop bot backend to prevent writes
docker compose -f infrastructure/docker-compose.yml stop bot-backend frontend
```

**Step 2.2: Initiate Restore in Supabase Dashboard**

1. Go to **Settings** > **Database** > **Backups**
2. Find the selected backup
3. Click **Restore** button
4. Confirm restore operation

**Step 2.3: Wait for Restore Completion**

- Restore typically takes 15-30 minutes depending on database size
- Monitor progress in Supabase Dashboard
- Status will change from "Restoring" to "Available"

**Expected Dashboard Status:**

```
Backup: 2025-11-21 03:00:00 UTC
Status: Restored successfully
```

**Step 2.4: Restart Application**

```bash
cd /home/buhbot/BuhBot
docker compose -f infrastructure/docker-compose.yml start bot-backend frontend

# Wait for containers to become healthy
sleep 30
docker compose -f infrastructure/docker-compose.yml ps
```

---

### Phase 3: Verify Data Integrity (20 minutes)

**Step 3.1: Check Critical Table Row Counts**

Connect to database and verify expected data:

```bash
# Using psql (if DATABASE_URL is set)
source backend/.env

psql "$DATABASE_URL" -c "
SELECT
    schemaname,
    tablename,
    n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY tablename;
"
```

**Expected Output (example):**

```
 schemaname |   tablename    | row_count
------------+----------------+-----------
 public     | broadcasts     |       150
 public     | messages       |     12500
 public     | organizations  |        25
 public     | templates      |        75
 public     | users          |      1200
```

Compare with expected values or previous metrics.

**Step 3.2: Verify Application Functionality**

```bash
# Test bot backend health
curl http://localhost:3000/health

# Check backend logs for database errors
docker logs buhbot-bot-backend --tail=50 | grep -i "error\|database"
```

**Step 3.3: Test Core Functionality**

1. **Telegram Bot**: Send `/start` command, verify response
2. **Admin Panel**: Log in, verify data displays correctly
3. **User Data**: Spot-check a few user records

---

### Phase 4: Replay Lost Transactions (Optional)

**Only if RPO < 24h is critical and you have transaction logs.**

**Step 4.1: Identify Missing Data**

If you have application-level audit logs:

```bash
# Check backend logs for transactions between backup and corruption
docker logs buhbot-bot-backend --since="BACKUP_TIME" --until="CORRUPTION_TIME" 2>&1 | grep -i "created\|updated\|message"
```

**Step 4.2: Manual Data Recovery**

Based on log analysis, manually re-apply critical transactions via:

- Admin panel
- Direct database queries
- Re-processing message queue

**Note:** This step is highly situation-dependent. Document what was recovered.

---

## Scenario 3: SSL Certificate Expired

### Description

Let's Encrypt SSL certificate has expired, causing:

- HTTPS connections failing
- Browser security warnings
- API calls rejected

### Estimated Recovery Time: ~10 minutes

| Phase                        | Duration | Cumulative |
| ---------------------------- | -------- | ---------- |
| Manual Certificate Renewal   | 5 min    | 0:05       |
| Reload Nginx                 | 1 min    | 0:06       |
| Verify HTTPS                 | 2 min    | 0:08       |
| Fix Auto-Renewal (if broken) | 5 min    | 0:13       |

---

### Phase 1: Manual Certificate Renewal (5 minutes)

**Step 1.1: Check Current Certificate Status**

```bash
ssh buhbot@XXX.XXX.XXX.XXX
sudo certbot certificates
```

**Expected Output (expired certificate):**

```
Certificate Name: bot.example.com
    Expiry Date: 2025-11-20 (EXPIRED)
    ...
```

**Step 1.2: Renew Certificate**

```bash
sudo certbot renew --force-renewal
```

**Expected Output:**

```
Congratulations, all renewals succeeded:
  /etc/letsencrypt/live/bot.example.com/fullchain.pem (success)
```

**If Renewal Fails:**

Try standalone mode (temporarily stop nginx):

```bash
cd /home/buhbot/BuhBot
docker compose -f infrastructure/docker-compose.yml stop nginx

sudo certbot certonly --standalone -d bot.example.com

docker compose -f infrastructure/docker-compose.yml start nginx
```

**Step 1.3: Copy Renewed Certificates**

```bash
sudo cp /etc/letsencrypt/live/bot.example.com/fullchain.pem \
        /home/buhbot/BuhBot/infrastructure/nginx/ssl/fullchain.pem

sudo cp /etc/letsencrypt/live/bot.example.com/privkey.pem \
        /home/buhbot/BuhBot/infrastructure/nginx/ssl/privkey.pem

sudo chown buhbot:buhbot /home/buhbot/BuhBot/infrastructure/nginx/ssl/*.pem
sudo chmod 600 /home/buhbot/BuhBot/infrastructure/nginx/ssl/*.pem
```

---

### Phase 2: Reload Nginx (1 minute)

**Step 2.1: Restart Nginx Container**

```bash
cd /home/buhbot/BuhBot
docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.prod.yml restart nginx
```

**Step 2.2: Check Nginx Logs**

```bash
docker logs buhbot-nginx --tail=20
```

Verify no SSL errors appear.

---

### Phase 3: Verify HTTPS (2 minutes)

**Step 3.1: Test HTTPS Endpoint**

```bash
curl -I https://bot.example.com/health
```

**Expected Output:**

```
HTTP/2 200
server: nginx/1.25
strict-transport-security: max-age=31536000; includeSubDomains; preload
```

**Step 3.2: Verify Certificate Details**

```bash
echo | openssl s_client -servername bot.example.com -connect bot.example.com:443 2>/dev/null | openssl x509 -noout -dates
```

**Expected Output:**

```
notBefore=Nov 22 00:00:00 2025 GMT
notAfter=Feb 20 23:59:59 2026 GMT
```

**Step 3.3: Browser Verification**

Open `https://bot.example.com` in browser - verify green padlock icon.

---

### Phase 4: Fix Auto-Renewal (5 minutes)

**Step 4.1: Verify Renewal Script Exists**

```bash
ls -la /usr/local/bin/renew-letsencrypt.sh
cat /usr/local/bin/renew-letsencrypt.sh
```

**Step 4.2: Test Renewal Script**

```bash
sudo /usr/local/bin/renew-letsencrypt.sh
```

**Step 4.3: Verify Cron Job**

```bash
sudo crontab -l | grep renew
```

**Expected:**

```
0 0,12 * * * /usr/local/bin/renew-letsencrypt.sh >> /var/log/letsencrypt-renewal.log 2>&1
```

If missing, add cron job:

```bash
sudo crontab -e
```

Add line:

```
0 0,12 * * * /usr/local/bin/renew-letsencrypt.sh >> /var/log/letsencrypt-renewal.log 2>&1
```

**Step 4.4: Check Renewal Logs**

```bash
sudo tail -20 /var/log/letsencrypt-renewal.log
```

Investigate any errors.

---

## Post-Recovery Checklist

Complete this checklist after ANY disaster recovery:

### Immediate (within 1 hour)

- [ ] All containers running and healthy
- [ ] Bot responding to Telegram messages
- [ ] Admin panel accessible via HTTPS
- [ ] Monitoring dashboards operational
- [ ] No errors in application logs

### Short-term (within 24 hours)

- [ ] Backup verification completed
- [ ] Monitoring alerts functioning
- [ ] SSL certificate expiration checked (> 30 days)
- [ ] Firewall rules verified
- [ ] Resource usage normal (CPU, Memory, Disk)

### Documentation (within 48 hours)

- [ ] Incident report created
- [ ] Timeline documented
- [ ] Root cause identified (if applicable)
- [ ] Recovery steps documented
- [ ] Lessons learned recorded
- [ ] Runbook updated (if gaps found)

### Follow-up Actions

- [ ] Schedule post-mortem meeting
- [ ] Update emergency contacts (if needed)
- [ ] Test DR procedures on schedule
- [ ] Review backup strategy
- [ ] Implement preventive measures

---

## Testing DR Procedures

### Testing Schedule

| Test Type                     | Frequency           | Last Tested | Next Test |
| ----------------------------- | ------------------- | ----------- | --------- |
| Backup Restore (Supabase)     | Quarterly           | [DATE]      | [DATE]    |
| VDS Recovery (Staging)        | Semi-annually       | [DATE]      | [DATE]    |
| SSL Renewal                   | Monthly (automated) | [DATE]      | [DATE]    |
| Failover Documentation Review | Quarterly           | [DATE]      | [DATE]    |

### Quarterly Backup Restore Test

1. Create test database in Supabase (separate project)
2. Restore latest backup to test database
3. Verify data integrity
4. Document results and any issues
5. Delete test database

### Semi-Annual VDS Recovery Test

1. Provision new VDS (staging environment)
2. Follow Scenario 1 procedures
3. Deploy application
4. Run full verification suite
5. Document timing and issues
6. Terminate staging VDS

### Monthly SSL Verification

```bash
# Run monthly
sudo certbot certificates
sudo certbot renew --dry-run
```

### DR Test Report Template

```markdown
## DR Test Report

**Date**: YYYY-MM-DD
**Test Type**: [Backup Restore / VDS Recovery / SSL Renewal]
**Conducted By**: [Name]

### Summary

- **Status**: [Pass / Partial / Fail]
- **Duration**: [Actual time vs. expected]
- **Issues Found**: [Count]

### Steps Executed

1. [Step description] - [Pass/Fail]
2. [Step description] - [Pass/Fail]
   ...

### Issues and Resolutions

| Issue         | Impact            | Resolution     |
| ------------- | ----------------- | -------------- |
| [Description] | [High/Medium/Low] | [Action taken] |

### Recommendations

- [Improvement suggestion 1]
- [Improvement suggestion 2]

### Sign-off

- Tested By: [Name]
- Reviewed By: [Name]
- Date: YYYY-MM-DD
```

---

## Appendix: Quick Reference Commands

### Container Management

```bash
# View all container status
docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.prod.yml ps

# Restart all services
docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.prod.yml restart

# Restart specific service
docker compose -f infrastructure/docker-compose.yml restart bot-backend

# View logs
docker logs buhbot-bot-backend --tail=100 -f

# Stop all services
docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.prod.yml down

# Start all services
docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.prod.yml up -d
```

### Health Checks

```bash
# Bot backend
curl http://localhost:3000/health

# Frontend
curl http://localhost:3001/api/health

# Redis
docker exec buhbot-redis redis-cli ping

# Prometheus
curl http://localhost:9090/-/healthy

# External HTTPS
curl -I https://bot.example.com/health
```

### SSL Commands

```bash
# Check certificate status
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal

# Copy certificates
sudo cp /etc/letsencrypt/live/bot.example.com/fullchain.pem /home/buhbot/BuhBot/infrastructure/nginx/ssl/
sudo cp /etc/letsencrypt/live/bot.example.com/privkey.pem /home/buhbot/BuhBot/infrastructure/nginx/ssl/
```

### Backup Commands

```bash
# List backups
ls -la /var/backups/buhbot-*

# Create manual backup
BACKUP_DIR="/var/backups/buhbot-manual-$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p "$BACKUP_DIR"
for volume in $(docker volume ls --filter "name=buhbot-" -q); do
    sudo docker run --rm \
        -v "$volume:/data" \
        -v "$BACKUP_DIR:/backup" \
        alpine tar czf "/backup/${volume}.tar.gz" -C /data .
done
```

### System Information

```bash
# Disk usage
df -h

# Memory usage
free -h

# Docker resource usage
docker stats --no-stream

# Network connectivity
curl -I https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe
```

---

## Document Information

- **Document Owner**: BuhBot Infrastructure Team
- **Version**: 1.0.0
- **Created**: 2025-11-22
- **Review Schedule**: Quarterly
- **Classification**: Internal - Operations Critical

### Related Documentation

- [VDS Setup Guide](./vds-setup.md)
- [Security Checklist](./security-checklist.md)
- [Monitoring Guide](./monitoring-guide.md)

### Revision History

| Version | Date       | Author      | Changes         |
| ------- | ---------- | ----------- | --------------- |
| 1.0.0   | 2025-11-22 | BuhBot Team | Initial version |
