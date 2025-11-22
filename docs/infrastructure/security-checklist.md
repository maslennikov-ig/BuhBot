# BuhBot Security Checklist

**Version**: 1.0.0
**Last Updated**: 2025-11-22
**Target Environment**: Production VDS deployment
**Compliance**: 152-FZ (Russian data protection law)

---

## Table of Contents

1. [Overview](#overview)
2. [Pre-Deployment Security Checklist](#pre-deployment-security-checklist)
3. [HTTPS Verification](#https-verification)
4. [Secrets Management](#secrets-management)
5. [RLS Policy Testing](#rls-policy-testing)
6. [Rate Limiting Validation](#rate-limiting-validation)
7. [Regular Security Audits](#regular-security-audits)
8. [Incident Response](#incident-response)

---

## Overview

This document provides a comprehensive security checklist for BuhBot infrastructure. It covers verification procedures, best practices, and testing guides for all security components.

### Security Architecture

```
                    Internet
                       |
                       v
              +----------------+
              |   Firewall     |  <- UFW (ports 22, 80, 443 only)
              |   (ufw)        |
              +----------------+
                       |
                       v
              +----------------+
              |   Nginx        |  <- HTTPS termination, rate limiting
              |   (SSL/TLS)    |     security headers
              +----------------+
                       |
            +----------+----------+
            |                     |
            v                     v
    +---------------+    +---------------+
    | Bot Backend   |    |   Frontend    |
    | (Node.js)     |    |   (Next.js)   |
    +---------------+    +---------------+
            |
            v
    +---------------+
    |   Supabase    |  <- RLS policies, encrypted connections
    |   (PostgreSQL)|
    +---------------+
```

---

## Pre-Deployment Security Checklist

Complete this checklist before any production deployment:

### Infrastructure Security

- [ ] **HTTPS configured with valid certificate**
  - Certificate issued by Let's Encrypt
  - Auto-renewal cron job active
  - HSTS headers enabled

- [ ] **All secrets in .env files (not committed to git)**
  - backend/.env contains production values
  - frontend/.env.local contains production values
  - File permissions set to 600 (owner read/write only)

- [ ] **RLS policies enabled on all Supabase tables**
  - All public schema tables have row-level security
  - Policies tested with test-rls-policies.sh

- [ ] **Rate limiting configured**
  - Nginx webhook limit: 100 req/min per IP
  - Nginx general limit: 10 req/sec per IP
  - Application rate limit: 10 messages/minute per user

- [ ] **Firewall active (ufw)**
  - Status: active
  - Only ports 22, 80, 443 allowed
  - Default deny incoming

- [ ] **Docker containers run as non-root**
  - All containers have USER directive
  - no-new-privileges security option enabled

- [ ] **Webhook signature validation enabled**
  - TELEGRAM_WEBHOOK_SECRET configured
  - Signature verification in webhook handler

### Application Security

- [ ] **Environment variables validated**
  - No hardcoded secrets in code
  - All sensitive values from environment

- [ ] **Dependencies up to date**
  - No critical vulnerabilities (npm audit)
  - Regular dependency updates scheduled

- [ ] **Logging configured properly**
  - No sensitive data in logs
  - Log rotation enabled
  - Appropriate log levels for production

### Network Security

- [ ] **SSH hardened**
  - Key-based authentication only
  - Root login disabled
  - fail2ban active

- [ ] **Internal services not exposed**
  - Redis bound to internal network
  - Prometheus metrics internal only
  - Grafana/monitoring behind auth

---

## HTTPS Verification

### Verify Certificate Installation

**Check certificate exists and is valid:**

```bash
# Check certificate files
ls -la /home/buhbot/BuhBot/infrastructure/nginx/ssl/

# Expected output:
# -rw------- 1 buhbot buhbot XXXX fullchain.pem
# -rw------- 1 buhbot buhbot XXXX privkey.pem
```

**Check certificate expiration:**

```bash
# Using openssl (on VDS)
openssl x509 -in /home/buhbot/BuhBot/infrastructure/nginx/ssl/fullchain.pem \
  -noout -dates

# Expected output:
# notBefore=Nov 20 00:00:00 2025 GMT
# notAfter=Feb 18 23:59:59 2026 GMT
```

**Check certificate chain:**

```bash
# Verify certificate chain is complete
openssl verify -CAfile /etc/ssl/certs/ca-certificates.crt \
  /home/buhbot/BuhBot/infrastructure/nginx/ssl/fullchain.pem
```

### Commands to Check SSL Status

**External verification (from any machine):**

```bash
# Check SSL certificate details
curl -vI https://bot.example.com 2>&1 | grep -E "(SSL|certificate|expire)"

# Check SSL grade (use external service)
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=bot.example.com
```

**Check HTTPS redirect:**

```bash
# HTTP should redirect to HTTPS
curl -I http://bot.example.com

# Expected: 301 or 302 redirect to https://
```

**Verify HSTS header:**

```bash
curl -sI https://bot.example.com | grep -i strict-transport

# Expected output:
# strict-transport-security: max-age=31536000; includeSubDomains; preload
```

### Renewal Monitoring

**Check certbot certificates:**

```bash
sudo certbot certificates

# Expected output:
# Certificate Name: bot.example.com
#   Expiry Date: YYYY-MM-DD (VALID: XX days)
#   Certificate Path: /etc/letsencrypt/live/bot.example.com/fullchain.pem
```

**Test renewal process (dry run):**

```bash
sudo certbot renew --dry-run

# Expected: "Congratulations, all simulated renewals succeeded"
```

**Check cron job for auto-renewal:**

```bash
sudo crontab -l | grep renew

# Expected:
# 0 0,12 * * * /usr/local/bin/renew-letsencrypt.sh >> /var/log/letsencrypt-renewal.log 2>&1
```

**Monitor renewal logs:**

```bash
sudo tail -f /var/log/letsencrypt-renewal.log
```

### Certificate Renewal Alert Thresholds

| Days Until Expiry | Action Required |
|-------------------|-----------------|
| > 30 days | Normal - no action needed |
| 15-30 days | Warning - verify auto-renewal working |
| 7-14 days | Critical - manually investigate |
| < 7 days | Emergency - renew immediately |

---

## Secrets Management

### Environment Variables List

**Backend (.env) - Required secrets:**

| Variable | Description | How to Generate |
|----------|-------------|-----------------|
| `SUPABASE_URL` | Supabase project URL | Supabase Dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin API key | Supabase Dashboard > API |
| `DATABASE_URL` | Connection pooler URL | Supabase Dashboard > Database |
| `DIRECT_URL` | Direct DB URL (migrations) | Supabase Dashboard > Database |
| `TELEGRAM_BOT_TOKEN` | Bot API token | @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook validation | `openssl rand -hex 32` |
| `JWT_SECRET` | JWT signing key | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | Data encryption | `openssl rand -base64 32` |
| `REDIS_PASSWORD` | Redis auth (if enabled) | `openssl rand -base64 32` |

**Frontend (.env.local) - Required secrets:**

| Variable | Description | Source |
|----------|-------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key | Supabase Dashboard > API |

### How to Rotate Secrets

**Step 1: Generate new secret**

```bash
# Generate strong random secret
openssl rand -base64 32
```

**Step 2: Update environment file**

```bash
# SSH to VDS
ssh buhbot@your-vds-ip

# Edit backend environment
nano /home/buhbot/BuhBot/backend/.env

# Update the specific variable, save and exit
```

**Step 3: Restart affected services**

```bash
cd /home/buhbot/BuhBot
docker compose -f infrastructure/docker-compose.yml \
  -f infrastructure/docker-compose.prod.yml restart bot-backend
```

**Step 4: Verify service health**

```bash
curl http://localhost:3000/health
# Expected: {"status":"healthy"}
```

### Secret Rotation Schedule

| Secret | Rotation Frequency | Notes |
|--------|-------------------|-------|
| `TELEGRAM_BOT_TOKEN` | On compromise only | Requires BotFather regeneration |
| `JWT_SECRET` | Quarterly | Invalidates existing sessions |
| `ENCRYPTION_KEY` | Annually | Requires data re-encryption |
| `SUPABASE_SERVICE_ROLE_KEY` | On compromise | Regenerate in Supabase Dashboard |
| `DATABASE_URL` password | On compromise | Update in Supabase Dashboard |

### .env.example Usage

**Purpose:** Document required environment variables without exposing secrets.

**Best practices:**

1. Keep .env.example updated with all required variables
2. Use placeholder values like `your-value-here`
3. Add comments explaining how to obtain each value
4. Commit .env.example to git (it contains no secrets)

**Creating .env from example:**

```bash
# Copy example to actual env file
cp backend/.env.example backend/.env

# Edit and fill in real values
nano backend/.env

# Set secure permissions
chmod 600 backend/.env
```

---

## RLS Policy Testing

### How to Run test-rls-policies.sh

**Prerequisites:**

- PostgreSQL client (psql) installed
- DATABASE_URL configured in environment
- Access to Supabase database

**Running the test script:**

```bash
# From project root on VDS
cd /home/buhbot/BuhBot

# Make script executable (if needed)
chmod +x infrastructure/scripts/test-rls-policies.sh

# Run RLS policy tests
./infrastructure/scripts/test-rls-policies.sh
```

**Alternative: Manual RLS verification:**

```bash
# Connect to database and check RLS status
psql "$DATABASE_URL" -c "
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
"
```

### Expected Results

**All tables should show `rowsecurity = t` (true):**

```
 schemaname |   tablename   | rowsecurity
------------+---------------+-------------
 public     | organizations | t
 public     | users         | t
 public     | messages      | t
 public     | broadcasts    | t
 public     | templates     | t
```

**Check policies exist on each table:**

```bash
psql "$DATABASE_URL" -c "
SELECT
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
"
```

### Common Issues and Solutions

**Issue: Table has RLS disabled**

```sql
-- Enable RLS on table
ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owner too
ALTER TABLE public.table_name FORCE ROW LEVEL SECURITY;
```

**Issue: Missing policy for operation**

```sql
-- Example: Add SELECT policy
CREATE POLICY "Users can view own data"
ON public.table_name
FOR SELECT
USING (auth.uid() = user_id);
```

**Issue: Policy allows too much access**

```sql
-- Review existing policy
SELECT * FROM pg_policies WHERE tablename = 'your_table';

-- Drop and recreate with stricter rules
DROP POLICY "policy_name" ON public.table_name;
CREATE POLICY "policy_name" ON public.table_name ...
```

### RLS Testing Checklist

- [ ] All public tables have RLS enabled
- [ ] SELECT policies restrict to user's own data
- [ ] INSERT policies validate user ownership
- [ ] UPDATE policies prevent unauthorized modifications
- [ ] DELETE policies (if allowed) validate ownership
- [ ] Service role can bypass RLS when needed
- [ ] Anon role has minimal access

---

## Rate Limiting Validation

### Nginx Rate Limits

**Configuration location:** `infrastructure/nginx/nginx.conf`

**Current limits:**

| Zone | Limit | Burst | Purpose |
|------|-------|-------|---------|
| `webhook_limit` | 100 req/min | 20 | Telegram webhook protection |
| `general_limit` | 10 req/sec | 20 | General API protection |
| `conn_limit` | 10 connections | - | Connection limiting per IP |

### Application Rate Limits

**Configuration location:** `backend/src/middleware/rate-limit.ts`

**Current limits:**

| Parameter | Value | Description |
|-----------|-------|-------------|
| `windowMs` | 60000ms | Time window (1 minute) |
| `limit` | 10 | Messages per user per window |
| `skipUsers` | [] | Admin users to skip (optional) |

### Testing Commands (curl examples)

**Test webhook rate limit (100 req/min):**

```bash
# Send 105 requests rapidly to trigger limit
for i in {1..105}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://bot.example.com/webhook/telegram \
    -H "Content-Type: application/json" \
    -d '{"test": true}'
done | sort | uniq -c

# Expected: ~100 responses with 200/4xx, ~5 with 429
```

**Test general rate limit (10 req/sec):**

```bash
# Send 15 requests per second
for i in {1..15}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    https://bot.example.com/api/health &
done
wait

# Expected: ~10 with 200, ~5 with 429
```

**Verify rate limit headers:**

```bash
curl -I https://bot.example.com/api/health

# Look for rate limit related headers
# Note: Default nginx doesn't send X-RateLimit headers
# Status 429 indicates rate limited
```

**Check rate limit logs:**

```bash
# On VDS, check nginx logs for rate limiting
docker logs buhbot-nginx 2>&1 | grep -E "limit_req|429"
```

### Rate Limit Verification Checklist

- [ ] Webhook endpoint returns 429 after 100+ requests/minute
- [ ] API endpoints return 429 after 10+ requests/second
- [ ] Application rate limit returns friendly Russian message
- [ ] Prometheus metrics record rate limit hits
- [ ] Logs capture rate limited requests

---

## Regular Security Audits

### How to Run security-audit.sh

**Location:** `infrastructure/scripts/security-audit.sh`

**Running the audit:**

```bash
# SSH to VDS
ssh buhbot@your-vds-ip

# Navigate to project
cd /home/buhbot/BuhBot

# Run security audit
./infrastructure/scripts/security-audit.sh

# Run with verbose output
./infrastructure/scripts/security-audit.sh --verbose
```

**Audit checks performed:**

1. HTTPS certificate validation
2. Hardcoded secrets detection
3. Webhook signature configuration
4. RLS policies verification
5. Firewall (UFW) status
6. Docker non-root user verification
7. Exposed ports analysis
8. Docker Compose security settings
9. Sensitive file permissions

### Monthly Security Checklist

**Perform monthly:**

- [ ] Run `security-audit.sh` and review results
- [ ] Check SSL certificate expiration (> 30 days remaining)
- [ ] Review failed login attempts (`fail2ban-client status sshd`)
- [ ] Check for unusual network activity (`docker stats`)
- [ ] Verify firewall rules unchanged (`ufw status`)
- [ ] Review container logs for errors (`docker logs`)
- [ ] Check disk space (`df -h`)
- [ ] Update system packages (`apt update && apt upgrade`)

**Commands:**

```bash
# Monthly security check script
echo "=== Monthly Security Audit ==="
echo ""

echo "1. Running security audit..."
./infrastructure/scripts/security-audit.sh

echo ""
echo "2. Certificate expiration check..."
sudo certbot certificates | grep -E "(Certificate|Expiry)"

echo ""
echo "3. Failed SSH attempts..."
sudo fail2ban-client status sshd | grep -E "(Banned|Total)"

echo ""
echo "4. Firewall status..."
sudo ufw status numbered

echo ""
echo "5. Disk usage..."
df -h /

echo ""
echo "6. Docker resource usage..."
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo ""
echo "7. System updates available..."
apt list --upgradable 2>/dev/null | head -10
```

### Quarterly Security Checklist

**Perform quarterly (every 3 months):**

- [ ] Rotate JWT_SECRET and re-deploy
- [ ] Review and update npm dependencies
- [ ] Audit Supabase RLS policies
- [ ] Review user access and permissions
- [ ] Test disaster recovery procedures
- [ ] Update documentation if needed
- [ ] Review rate limit thresholds
- [ ] Check for new security advisories

### Remediation Procedures

**If security audit fails:**

1. **Certificate issues:**
   ```bash
   # Force renewal
   sudo certbot renew --force-renewal
   sudo /usr/local/bin/renew-letsencrypt.sh
   ```

2. **Hardcoded secrets found:**
   - Remove secret from code immediately
   - Rotate the exposed secret
   - Add to .gitignore if needed
   - Review git history and clean if necessary

3. **RLS not enabled:**
   ```bash
   # Enable via Supabase Dashboard or SQL
   psql "$DATABASE_URL" -c "ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;"
   ```

4. **Firewall inactive:**
   ```bash
   sudo ufw enable
   sudo ufw default deny incoming
   sudo ufw default allow outgoing
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```

5. **Docker containers running as root:**
   - Update Dockerfile with USER directive
   - Rebuild and redeploy containers

---

## Incident Response

### Security Incident Checklist

**Immediate actions (first 15 minutes):**

- [ ] Identify the scope of the incident
- [ ] Preserve logs and evidence
- [ ] Isolate affected systems if needed
- [ ] Notify team lead / security contact

**Short-term actions (first hour):**

- [ ] Rotate all potentially compromised secrets
- [ ] Review access logs for unauthorized access
- [ ] Block suspicious IP addresses
- [ ] Document timeline of events

**Recovery actions:**

- [ ] Restore from clean backup if needed
- [ ] Apply security patches
- [ ] Verify system integrity
- [ ] Monitor for ongoing threats

### Emergency Contacts

| Role | Contact |
|------|---------|
| Security Lead | [Your contact] |
| DevOps Lead | [Your contact] |
| Supabase Support | support@supabase.com |

### Log Locations for Investigation

```bash
# Application logs
docker logs buhbot-bot-backend

# Nginx access/error logs
docker logs buhbot-nginx
cat /var/log/nginx/access.log
cat /var/log/nginx/error.log

# System auth logs
sudo cat /var/log/auth.log

# fail2ban logs
sudo cat /var/log/fail2ban.log

# Deployment logs
cat /var/log/buhbot-deploy-*.log
```

---

## Document Information

- **Author:** BuhBot Infrastructure Team
- **Version:** 1.0.0
- **Created:** 2025-11-22
- **Review Schedule:** Quarterly

**Related Documentation:**

- [VDS Setup Guide](./vds-setup.md)
- [Deployment Scripts README](../../infrastructure/scripts/README.md)
- [Nginx Configuration](../../infrastructure/nginx/README.md)
