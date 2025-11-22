# BuhBot Infrastructure Troubleshooting Guide

**Version**: 1.0.0
**Last Updated**: 2025-11-22
**Target Audience**: Operations team, system administrators, on-call engineers

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Bot Issues](#bot-issues)
   - [Bot Not Responding to Messages](#bot-not-responding-to-messages)
   - [Bot Slow Response Times](#bot-slow-response-times)
3. [SSL/HTTPS Issues](#sslhttps-issues)
   - [SSL Certificate Expired](#ssl-certificate-expired)
   - [SSL Certificate Not Working](#ssl-certificate-not-working)
4. [Monitoring Stack Issues](#monitoring-stack-issues)
   - [Prometheus Not Scraping](#prometheus-not-scraping)
   - [Grafana Not Loading](#grafana-not-loading)
   - [Alerts Not Firing](#alerts-not-firing)
5. [Database Issues](#database-issues)
   - [Connection Pool Exhausted](#connection-pool-exhausted)
   - [Slow Queries](#slow-queries)
6. [Docker Issues](#docker-issues)
   - [Container Won't Start](#container-wont-start)
   - [Out of Disk Space](#out-of-disk-space)
7. [Redis Issues](#redis-issues)
8. [Network Issues](#network-issues)
9. [Log Locations](#log-locations)

---

## Quick Reference

### Essential Diagnostic Commands

```bash
# Check all container status
docker compose -f /home/buhbot/BuhBot/infrastructure/docker-compose.yml \
  -f /home/buhbot/BuhBot/infrastructure/docker-compose.prod.yml ps

# View all container logs (real-time)
docker compose -f /home/buhbot/BuhBot/infrastructure/docker-compose.yml logs -f

# Check resource usage
docker stats --no-stream

# Check disk space
df -h

# Check system memory
free -h
```

### Service Health Endpoints

| Service | Health Check Command |
|---------|---------------------|
| Bot Backend | `curl http://localhost:3000/health` |
| Frontend | `curl http://localhost:3001/api/health` |
| Redis | `docker exec buhbot-redis redis-cli ping` |
| Prometheus | `curl http://localhost:9090/-/healthy` |
| Grafana | `curl http://localhost:3002/api/health` |
| Nginx | `curl http://localhost/health` |

---

## Bot Issues

### Bot Not Responding to Messages

**Symptoms**:
- Telegram messages sent to bot receive no response
- Webhook errors in Telegram Bot API
- Users report bot is "offline"

**Step 1: Check Webhook Status**

```bash
# Replace $TOKEN with your actual bot token
curl https://api.telegram.org/bot$TOKEN/getWebhookInfo
```

**Expected Response**:
```json
{
  "ok": true,
  "result": {
    "url": "https://bot.example.com/webhook/telegram",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "last_error_date": null,
    "last_error_message": null
  }
}
```

**Problem Indicators**:

| Field | Problem | Solution |
|-------|---------|----------|
| `url` is empty | Webhook not set | Run webhook setup command |
| `pending_update_count` > 100 | Bot not processing | Check container health |
| `last_error_message` present | Webhook delivery failing | Check error message |

**Fix webhook URL**:
```bash
curl -X POST "https://api.telegram.org/bot$TOKEN/setWebhook" \
  -d "url=https://bot.example.com/webhook/telegram"
```

**Step 2: Check Container Logs**

```bash
# View bot backend logs
docker logs buhbot-bot-backend --tail=100

# Follow logs in real-time
docker logs buhbot-bot-backend -f
```

**Common Log Errors and Solutions**:

| Error Pattern | Cause | Solution |
|---------------|-------|----------|
| `ECONNREFUSED` to Redis | Redis not running | Restart Redis container |
| `ENOTFOUND` for Supabase | DNS/network issue | Check network connectivity |
| `401 Unauthorized` | Invalid bot token | Verify `TELEGRAM_BOT_TOKEN` in `.env` |
| `429 Too Many Requests` | Rate limited | Wait or check for message loops |

**Step 3: Verify Environment Variables**

```bash
# Check if all required variables are set
docker exec buhbot-bot-backend env | grep -E "(TELEGRAM|SUPABASE|REDIS)"
```

**Required Variables**:
- `TELEGRAM_BOT_TOKEN` - Bot token from BotFather
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key
- `REDIS_HOST` - Should be `redis`
- `REDIS_PORT` - Should be `6379`

**Step 4: Check Redis Connection**

```bash
# Test Redis connectivity
docker exec buhbot-redis redis-cli ping
# Expected: PONG

# Check Redis info
docker exec buhbot-redis redis-cli info clients
```

**Step 5: Restart Bot Backend**

```bash
cd /home/buhbot/BuhBot
docker compose -f infrastructure/docker-compose.yml \
  -f infrastructure/docker-compose.prod.yml restart bot-backend

# Wait for healthy status
sleep 30
docker ps | grep bot-backend
```

---

### Bot Slow Response Times

**Symptoms**:
- Users report delays > 5 seconds before receiving responses
- Messages eventually arrive but are slow
- Monitoring shows high latency alerts

**Step 1: Check Database Connection Pool**

```bash
# View Supabase connection metrics in logs
docker logs buhbot-bot-backend 2>&1 | grep -i "connection\|pool"
```

**Check active database connections** (requires psql access):
```bash
source /home/buhbot/BuhBot/backend/.env
psql "$DATABASE_URL" -c "
SELECT
  state,
  count(*) as connections
FROM pg_stat_activity
WHERE datname = 'postgres'
GROUP BY state;
"
```

**Connection States**:

| State | Normal Range | Action if High |
|-------|--------------|----------------|
| `active` | 1-5 | Check for long-running queries |
| `idle` | 5-20 | Normal |
| `idle in transaction` | 0-2 | Possible connection leak |

**Step 2: Review Prometheus Metrics**

Access Prometheus: `http://localhost:9090` or `https://bot.example.com/prometheus`

**Key Queries**:

```promql
# Message processing latency (p95)
histogram_quantile(0.95, rate(bot_message_processing_duration_bucket[5m]))

# Message throughput
rate(bot_messages_received_total[5m])

# Error rate
rate(bot_errors_total[5m]) / rate(bot_messages_received_total[5m]) * 100
```

**Latency Thresholds**:

| P95 Latency | Status | Action |
|-------------|--------|--------|
| < 1s | Normal | No action needed |
| 1-3s | Warning | Monitor trends |
| 3-5s | Degraded | Investigate database/external calls |
| > 5s | Critical | Immediate investigation required |

**Step 3: Check Redis Queue Backlog**

```bash
# Check Redis memory and keys
docker exec buhbot-redis redis-cli info memory
docker exec buhbot-redis redis-cli dbsize

# Check for stuck jobs (if using Bull queues)
docker exec buhbot-redis redis-cli keys "bull:*:waiting" | head -20
```

**High queue backlog indicators**:
- `dbsize` > 10000 keys
- Memory usage > 80% of limit

**Resolution**: Scale workers or clear stuck jobs

**Step 4: Check Container Resources**

```bash
# Real-time resource usage
docker stats --no-stream

# Check if bot-backend is CPU/memory limited
docker inspect buhbot-bot-backend | grep -A 10 "Memory\|Cpu"
```

**Resource Limits** (from docker-compose.prod.yml):
- Bot Backend: 2.0 cores, 2.0 GB RAM
- If usage near limits: consider increasing resources

---

## SSL/HTTPS Issues

### SSL Certificate Expired

**Symptoms**:
- Browser shows "Certificate expired" error
- HTTPS connections fail with SSL errors
- Webhook deliveries from Telegram fail

**Step 1: Check Certificate Expiration**

```bash
# View certificate status
sudo certbot certificates
```

**Expected Output** (valid certificate):
```
Certificate Name: bot.example.com
  Expiry Date: 2026-02-20 (VALID: 89 days)
```

**Step 2: Renew Certificate**

```bash
# Force certificate renewal
sudo certbot renew --force-renewal
```

**Expected Output**:
```
Congratulations, all renewals succeeded:
  /etc/letsencrypt/live/bot.example.com/fullchain.pem (success)
```

**Step 3: Copy New Certificates**

```bash
# Copy to nginx SSL directory
sudo cp /etc/letsencrypt/live/bot.example.com/fullchain.pem \
  /home/buhbot/BuhBot/infrastructure/nginx/ssl/fullchain.pem

sudo cp /etc/letsencrypt/live/bot.example.com/privkey.pem \
  /home/buhbot/BuhBot/infrastructure/nginx/ssl/privkey.pem

# Fix permissions
sudo chown buhbot:buhbot /home/buhbot/BuhBot/infrastructure/nginx/ssl/*.pem
sudo chmod 600 /home/buhbot/BuhBot/infrastructure/nginx/ssl/*.pem
```

**Step 4: Restart Nginx**

```bash
cd /home/buhbot/BuhBot
docker compose -f infrastructure/docker-compose.yml \
  -f infrastructure/docker-compose.prod.yml restart nginx
```

**Step 5: Verify HTTPS Works**

```bash
# Test HTTPS endpoint
curl -I https://bot.example.com/health

# Check certificate expiry
echo | openssl s_client -servername bot.example.com \
  -connect bot.example.com:443 2>/dev/null | openssl x509 -noout -dates
```

**Step 6: Verify Auto-Renewal Cron**

```bash
# Check cron job exists
sudo crontab -l | grep renew

# Expected:
# 0 0,12 * * * /usr/local/bin/renew-letsencrypt.sh >> /var/log/letsencrypt-renewal.log 2>&1
```

---

### SSL Certificate Not Working

**Symptoms**:
- Browser shows "Certificate not valid" or "Security warning"
- `curl` returns SSL handshake errors
- Certificate chain incomplete

**Step 1: Verify DNS Records**

```bash
# Check DNS resolution
dig bot.example.com +short
```

**Expected**: Your VDS IP address (e.g., `123.45.67.89`)

**If DNS doesn't resolve**:
1. Log into DNS provider
2. Verify A record points to correct VDS IP
3. Wait 5-15 minutes for propagation
4. Use https://dnschecker.org to verify globally

**Step 2: Check Certbot Logs**

```bash
# View recent certbot activity
sudo tail -50 /var/log/letsencrypt/letsencrypt.log

# Check for rate limit issues
grep -i "rate limit\|too many" /var/log/letsencrypt/letsencrypt.log
```

**Common Certbot Errors**:

| Error | Cause | Solution |
|-------|-------|----------|
| `DNS problem` | Domain doesn't resolve | Fix DNS A record |
| `Rate limit` | Too many certificate requests | Wait 1 hour and retry |
| `Timeout` | Firewall blocking port 80 | Check UFW rules |
| `Connection refused` | Nginx not running | Start nginx container |

**Step 3: Review Nginx SSL Configuration**

```bash
# Check SSL certificate paths in nginx config
grep -A 5 "ssl_certificate" /home/buhbot/BuhBot/infrastructure/nginx/nginx.conf

# Verify certificate files exist
ls -la /home/buhbot/BuhBot/infrastructure/nginx/ssl/
```

**Expected Files**:
- `fullchain.pem` - Certificate chain
- `privkey.pem` - Private key

**Step 4: Test SSL Configuration**

```bash
# Test nginx configuration
docker exec buhbot-nginx nginx -t

# Check nginx error logs
docker logs buhbot-nginx --tail=50 | grep -i ssl
```

**Step 5: Regenerate Certificate (if corrupted)**

```bash
# Stop nginx temporarily
cd /home/buhbot/BuhBot
docker compose -f infrastructure/docker-compose.yml stop nginx

# Generate new certificate
sudo certbot certonly --standalone -d bot.example.com

# Copy and restart (follow Steps 3-4 from "SSL Certificate Expired")
```

---

## Monitoring Stack Issues

### Prometheus Not Scraping

**Symptoms**:
- Grafana dashboards show "No data"
- Prometheus targets show "down" status
- Metrics are stale or missing

**Step 1: Check Prometheus Targets**

```bash
# View targets status
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health, lastError: .lastError}'
```

**Expected Output** (healthy):
```json
{
  "job": "bot-backend",
  "health": "up",
  "lastError": ""
}
```

**Step 2: Verify Service Discovery**

```bash
# Check prometheus.yml configuration
cat /home/buhbot/BuhBot/infrastructure/monitoring/prometheus.yml | grep -A 5 "job_name"
```

**Current Scrape Targets**:
- `prometheus` - localhost:9090
- `bot-backend` - bot-backend:9100

**Step 3: Test Metrics Endpoint**

```bash
# Test bot-backend metrics from host
curl http://localhost:3000/metrics

# Test from within monitoring container
docker exec buhbot-monitoring-stack curl -f http://bot-backend:9100/metrics
```

**If metrics endpoint fails**:
1. Check bot-backend is running
2. Verify metrics port (9100) is exposed
3. Check network connectivity between containers

**Step 4: Review Scrape Configs**

```bash
# Validate prometheus configuration
docker exec buhbot-monitoring-stack promtool check config /etc/prometheus/prometheus.yml
```

**Expected**: `SUCCESS: prometheus.yml is valid prometheus config file`

**Step 5: Check Network Connectivity**

```bash
# List containers on network
docker network inspect buhbot-network | jq '.[0].Containers | to_entries[] | {name: .value.Name, ip: .value.IPv4Address}'

# Test connectivity from monitoring stack
docker exec buhbot-monitoring-stack ping -c 3 bot-backend
```

**Step 6: Restart Prometheus**

```bash
cd /home/buhbot/BuhBot
docker compose -f infrastructure/docker-compose.yml \
  -f infrastructure/docker-compose.prod.yml restart monitoring-stack
```

---

### Grafana Not Loading

**Symptoms**:
- Grafana page returns 502 Bad Gateway
- Page loads but shows connection errors
- Dashboard login fails

**Step 1: Check Container Status**

```bash
# Check monitoring stack status
docker ps | grep monitoring-stack

# Check supervisor processes inside container
docker exec buhbot-monitoring-stack supervisorctl status
```

**Expected Supervisor Output**:
```
grafana                          RUNNING   pid 123, uptime 0:01:00
prometheus                       RUNNING   pid 124, uptime 0:01:00
uptime-kuma                      RUNNING   pid 125, uptime 0:01:00
```

**Step 2: Verify Datasource Configuration**

```bash
# Check Grafana datasource config
cat /home/buhbot/BuhBot/infrastructure/monitoring/grafana/datasources/prometheus.yml
```

**Datasource URL should be**: `http://localhost:9090`

**Step 3: Review Permissions**

```bash
# Check Grafana data volume
docker exec buhbot-monitoring-stack ls -la /var/lib/grafana/

# Check Grafana logs
docker exec buhbot-monitoring-stack supervisorctl tail grafana
```

**Common Permission Issues**:

| Error | Solution |
|-------|----------|
| `Permission denied` on grafana.db | Fix volume permissions |
| `Database locked` | Stop Grafana, fix db, restart |

**Step 4: Check Memory Usage**

```bash
# Check container resource usage
docker stats --no-stream buhbot-monitoring-stack
```

**If memory > 80%**: Consider increasing limits in `docker-compose.prod.yml`

**Step 5: Reset Grafana (Last Resort)**

```bash
# WARNING: This will delete dashboards and settings
cd /home/buhbot/BuhBot
docker compose -f infrastructure/docker-compose.yml down monitoring-stack
docker volume rm buhbot-grafana-data
docker compose -f infrastructure/docker-compose.yml up -d monitoring-stack
```

---

### Alerts Not Firing

**Symptoms**:
- Known conditions exist but no alerts triggered
- Alertmanager not sending notifications
- Alert rules show "inactive"

**Step 1: Check Alertmanager Configuration**

```bash
# View alert rules status
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | {name: .name, state: .state, health: .health}'

# View active alerts
curl -s http://localhost:9090/api/v1/alerts | jq '.data.alerts[] | {alertname: .labels.alertname, state: .state}'
```

**Alert States**:

| State | Meaning |
|-------|---------|
| `inactive` | Condition not met |
| `pending` | Condition met, waiting for `for` duration |
| `firing` | Alert is active |

**Step 2: Validate Alert Rules**

```bash
# Check alerts.yml syntax
docker exec buhbot-monitoring-stack promtool check rules /etc/prometheus/alerts.yml
```

**Expected**: `SUCCESS: alerts.yml is valid prometheus rule file`

**Step 3: Test Alert Expression**

Access Prometheus UI at `http://localhost:9090/graph` and test the alert expression:

```promql
# Example: Test HighCPU alert
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
```

**Step 4: Verify Telegram Bot Token (for notifications)**

```bash
# Test Telegram bot token
curl "https://api.telegram.org/bot$ALERTMANAGER_BOT_TOKEN/getMe"
```

**Expected**: Bot information returned

**Step 5: Check Notification Logs**

```bash
# View Uptime Kuma logs (if using for alerts)
docker exec buhbot-monitoring-stack supervisorctl tail uptime-kuma

# Check if notifications are queued
docker exec buhbot-monitoring-stack ls -la /app/data/
```

**Step 6: Force Alert Test**

Lower threshold temporarily to trigger alert:

```bash
# Edit alerts.yml temporarily (backup first)
sudo cp /home/buhbot/BuhBot/infrastructure/monitoring/prometheus/alerts.yml \
  /home/buhbot/BuhBot/infrastructure/monitoring/prometheus/alerts.yml.bak

# Change HighCPU threshold from 80 to 1
sudo sed -i 's/> 80/> 1/' /home/buhbot/BuhBot/infrastructure/monitoring/prometheus/alerts.yml

# Reload Prometheus
docker exec buhbot-monitoring-stack kill -HUP $(docker exec buhbot-monitoring-stack pgrep prometheus)

# Wait and check alerts
sleep 60
curl -s http://localhost:9090/api/v1/alerts | jq '.data.alerts'

# Restore original
sudo cp /home/buhbot/BuhBot/infrastructure/monitoring/prometheus/alerts.yml.bak \
  /home/buhbot/BuhBot/infrastructure/monitoring/prometheus/alerts.yml
```

---

## Database Issues

### Connection Pool Exhausted

**Symptoms**:
- `Too many connections` errors in logs
- Database queries timing out
- Application becomes unresponsive

**Step 1: Check Max Connections**

```bash
source /home/buhbot/BuhBot/backend/.env

# Check connection limit
psql "$DATABASE_URL" -c "SHOW max_connections;"

# Check current connections
psql "$DATABASE_URL" -c "
SELECT count(*) as total_connections,
       count(*) FILTER (WHERE state = 'active') as active,
       count(*) FILTER (WHERE state = 'idle') as idle
FROM pg_stat_activity
WHERE datname = 'postgres';
"
```

**Typical Limits**:

| Environment | Max Connections |
|-------------|-----------------|
| Supabase Free | 60 |
| Supabase Pro | 200-500 |

**Step 2: Review Connection Leaks**

```bash
# Check for idle in transaction (potential leaks)
psql "$DATABASE_URL" -c "
SELECT pid, state, query_start, query
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND query_start < now() - interval '5 minutes'
ORDER BY query_start;
"
```

**Connections idle > 5 minutes** indicate leaks.

**Step 3: Kill Long-Running Connections**

```bash
# Kill connections idle > 10 minutes (use carefully!)
psql "$DATABASE_URL" -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND query_start < now() - interval '10 minutes';
"
```

**Step 4: Monitor Active Connections**

```bash
# Watch connections in real-time
watch -n 5 'psql "$DATABASE_URL" -c "SELECT state, count(*) FROM pg_stat_activity WHERE datname = '\''postgres'\'' GROUP BY state;"'
```

**Step 5: Restart Application**

```bash
# Restart bot-backend to reset connection pool
cd /home/buhbot/BuhBot
docker compose -f infrastructure/docker-compose.yml \
  -f infrastructure/docker-compose.prod.yml restart bot-backend
```

---

### Slow Queries

**Symptoms**:
- High latency on specific operations
- Dashboard pages load slowly
- Prometheus shows high query latency

**Step 1: Check Supabase Dashboard**

1. Navigate to https://supabase.com/dashboard
2. Select your project
3. Go to **Reports** > **Database** > **Query Performance**
4. Review "Slowest Queries"

**Step 2: Review Query Plans**

```bash
source /home/buhbot/BuhBot/backend/.env

# Example: Analyze a slow query
psql "$DATABASE_URL" -c "
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM messages WHERE created_at > now() - interval '1 day';
"
```

**Key Indicators**:

| Metric | Good | Bad |
|--------|------|-----|
| Execution time | < 100ms | > 500ms |
| Rows examined vs returned | Close to 1:1 | > 100:1 |
| Seq Scan on large table | N/A | Needs index |

**Step 3: Add Indexes If Needed**

```bash
# Check existing indexes
psql "$DATABASE_URL" -c "
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'messages';
"

# Create index example (run via Supabase SQL Editor)
# CREATE INDEX idx_messages_created_at ON messages(created_at);
```

**Step 4: Check Table Statistics**

```bash
psql "$DATABASE_URL" -c "
SELECT
  relname as table_name,
  n_live_tup as row_count,
  n_dead_tup as dead_rows,
  last_vacuum,
  last_autovacuum
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
"
```

**High dead_rows** indicates need for VACUUM.

---

## Docker Issues

### Container Won't Start

**Symptoms**:
- Container shows `Exited` or `Restarting` status
- `docker ps` shows container not running
- Health checks failing

**Step 1: Check Container Logs**

```bash
# Replace <container_name> with actual name
docker logs buhbot-bot-backend --tail=200

# For crash loops, check last logs before exit
docker logs buhbot-bot-backend 2>&1 | tail -100
```

**Step 2: Review Resource Limits**

```bash
# Check current resource usage
docker stats --no-stream

# Check container resource limits
docker inspect buhbot-bot-backend | jq '.[0].HostConfig.Memory, .[0].HostConfig.CpuShares'
```

**Resource Limits** (from docker-compose.prod.yml):

| Service | Memory Limit | CPU Limit |
|---------|--------------|-----------|
| bot-backend | 2GB | 2.0 cores |
| frontend | 1GB | 1.0 core |
| monitoring-stack | 2.5GB | 1.5 cores |
| redis | 512MB | 0.5 cores |

**Step 3: Check Dependencies**

```bash
# View container dependencies
docker compose -f infrastructure/docker-compose.yml config | grep -A 5 "depends_on"

# Verify dependent containers are healthy
docker ps --format "table {{.Names}}\t{{.Status}}"
```

**Dependency Chain**:
1. `redis` must be healthy
2. `monitoring-stack` must be started
3. `bot-backend` can start (depends on redis, monitoring-stack)
4. `frontend` can start (depends on bot-backend)
5. `nginx` can start (depends on bot-backend, frontend, monitoring-stack)

**Step 4: Force Recreate Container**

```bash
cd /home/buhbot/BuhBot
docker compose -f infrastructure/docker-compose.yml \
  -f infrastructure/docker-compose.prod.yml up -d --force-recreate bot-backend
```

**Step 5: Check Environment Variables**

```bash
# Verify env file exists and has content
cat /home/buhbot/BuhBot/backend/.env | head -20

# Check for syntax errors (no spaces around =)
grep -n " = \| =" /home/buhbot/BuhBot/backend/.env
```

---

### Out of Disk Space

**Symptoms**:
- `No space left on device` errors
- Containers failing to start
- Logs not being written

**Step 1: Check Disk Usage**

```bash
# Overall disk usage
df -h

# Find largest directories
du -sh /* 2>/dev/null | sort -hr | head -10

# Docker-specific usage
docker system df
```

**Step 2: Clean Old Docker Images**

```bash
# Remove unused images (safe)
docker image prune -a -f

# View space recovered
docker system df
```

**Step 3: Check Backup Retention**

```bash
# List backup files sorted by size
ls -lhS /var/backups/buhbot-* | head -20

# Check total backup size
du -sh /var/backups/
```

**Retention Policy**:
- Keep 4 most recent backups
- Delete backups older than 4 weeks

```bash
# Remove old backups (keep last 4)
cd /var/backups
ls -dt buhbot-pre-deploy-* | tail -n +5 | xargs rm -rf
```

**Step 4: Clean Docker Build Cache**

```bash
# Remove build cache
docker builder prune -a -f

# Remove dangling volumes (careful - verify first)
docker volume ls -qf dangling=true
# docker volume rm $(docker volume ls -qf dangling=true)
```

**Step 5: Rotate Container Logs**

```bash
# Check log sizes
docker ps -q | xargs docker inspect --format='{{.Name}}: {{.LogPath}}' | \
  while read line; do
    name=$(echo $line | cut -d: -f1)
    path=$(echo $line | cut -d: -f2)
    size=$(du -sh $path 2>/dev/null | cut -f1)
    echo "$name: $size"
  done

# Truncate large log files (if needed)
# sudo truncate -s 0 /var/lib/docker/containers/<container_id>/<container_id>-json.log
```

**Step 6: Add Log Rotation**

Docker daemon configuration for log rotation (`/etc/docker/daemon.json`):

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

After editing, restart Docker:
```bash
sudo systemctl restart docker
```

---

## Redis Issues

### Redis Memory High

**Symptoms**:
- `RedisHighMemory` alert firing
- Slow response times
- OOM errors in logs

**Step 1: Check Redis Memory**

```bash
# Memory info
docker exec buhbot-redis redis-cli info memory

# Key metrics:
# - used_memory_human: Current usage
# - maxmemory_human: Limit (512MB)
# - mem_fragmentation_ratio: Should be ~1.0
```

**Step 2: Analyze Key Distribution**

```bash
# Count keys by pattern
docker exec buhbot-redis redis-cli keys "*" | cut -d: -f1 | sort | uniq -c | sort -rn | head -10

# Check big keys
docker exec buhbot-redis redis-cli --bigkeys
```

**Step 3: Clear Old Sessions**

```bash
# List session keys
docker exec buhbot-redis redis-cli keys "session:*" | wc -l

# Delete sessions older than TTL (if not auto-expiring)
# This depends on your session key structure
```

**Step 4: Configure Eviction Policy**

Current policy: `allkeys-lru` (evict least recently used keys)

```bash
# Check current policy
docker exec buhbot-redis redis-cli config get maxmemory-policy

# Verify maxmemory
docker exec buhbot-redis redis-cli config get maxmemory
```

---

## Network Issues

### Container DNS Resolution Failing

**Symptoms**:
- `getaddrinfo ENOTFOUND` errors
- Services can't connect by hostname
- Works by IP but not by name

**Step 1: Check Docker Network**

```bash
# List networks
docker network ls

# Inspect buhbot network
docker network inspect buhbot-network
```

**Step 2: Test DNS Resolution**

```bash
# From within a container
docker exec buhbot-bot-backend nslookup redis
docker exec buhbot-bot-backend ping -c 3 redis
```

**Step 3: Verify Nginx Resolver**

Nginx config should have Docker DNS resolver:
```nginx
resolver 127.0.0.11 valid=30s ipv6=off;
```

**Step 4: Restart Docker Network**

```bash
cd /home/buhbot/BuhBot
docker compose -f infrastructure/docker-compose.yml down
docker network rm buhbot-network
docker compose -f infrastructure/docker-compose.yml up -d
```

---

## Log Locations

### Application Logs

| Component | Location | Access Command |
|-----------|----------|----------------|
| Bot Backend | Container stdout | `docker logs buhbot-bot-backend` |
| Frontend | Container stdout | `docker logs buhbot-frontend` |
| Nginx | Container stdout | `docker logs buhbot-nginx` |
| Nginx access log | Container internal | `docker exec buhbot-nginx tail /var/log/nginx/access.log` |
| Nginx error log | Container internal | `docker exec buhbot-nginx tail /var/log/nginx/error.log` |
| Webhook rate limit | Container internal | `docker exec buhbot-nginx tail /var/log/nginx/webhook_rate_limit.log` |

### System Logs

| Log | Location | Access Command |
|-----|----------|----------------|
| Bootstrap | VDS | `sudo tail /var/log/buhbot-bootstrap-*.log` |
| Deployment | VDS | `sudo tail /var/log/buhbot-deploy-*.log` |
| SSL Renewal | VDS | `sudo tail /var/log/letsencrypt-renewal.log` |
| System auth | VDS | `sudo tail /var/log/auth.log` |

### Monitoring Logs

| Component | Access Command |
|-----------|----------------|
| Prometheus | `docker exec buhbot-monitoring-stack supervisorctl tail prometheus` |
| Grafana | `docker exec buhbot-monitoring-stack supervisorctl tail grafana` |
| Uptime Kuma | `docker exec buhbot-monitoring-stack supervisorctl tail uptime-kuma` |

### Log Analysis Commands

```bash
# Search for errors across all containers
docker compose -f infrastructure/docker-compose.yml logs 2>&1 | grep -i error | tail -50

# Count errors by type
docker logs buhbot-bot-backend 2>&1 | grep -i error | cut -d: -f3 | sort | uniq -c | sort -rn

# View logs from specific time range
docker logs buhbot-bot-backend --since="2025-11-22T10:00:00" --until="2025-11-22T12:00:00"
```

---

## Emergency Recovery Commands

### Full Stack Restart

```bash
cd /home/buhbot/BuhBot
docker compose -f infrastructure/docker-compose.yml \
  -f infrastructure/docker-compose.prod.yml down
docker compose -f infrastructure/docker-compose.yml \
  -f infrastructure/docker-compose.prod.yml up -d
```

### Single Service Restart

```bash
cd /home/buhbot/BuhBot
docker compose -f infrastructure/docker-compose.yml restart <service_name>
# Services: bot-backend, frontend, redis, monitoring-stack, nginx
```

### Force Rebuild

```bash
cd /home/buhbot/BuhBot
docker compose -f infrastructure/docker-compose.yml build --no-cache <service_name>
docker compose -f infrastructure/docker-compose.yml up -d <service_name>
```

### Health Check All Services

```bash
#!/bin/bash
# Save as /home/buhbot/BuhBot/scripts/health-check.sh

echo "=== Container Status ==="
docker ps --format "table {{.Names}}\t{{.Status}}"

echo ""
echo "=== Health Endpoints ==="
echo "Bot Backend: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/health)"
echo "Frontend: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api/health)"
echo "Prometheus: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:9090/-/healthy)"
echo "Grafana: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3002/api/health)"

echo ""
echo "=== Redis ==="
docker exec buhbot-redis redis-cli ping

echo ""
echo "=== Resource Usage ==="
docker stats --no-stream
```

---

## Related Documentation

- [VDS Setup Guide](./vds-setup.md) - Initial server setup
- [Monitoring Guide](./monitoring-guide.md) - Grafana, Prometheus, alerts
- [Disaster Recovery](./disaster-recovery.md) - Full recovery procedures
- [Security Checklist](./security-checklist.md) - Security hardening

---

**Document Version**: 1.0.0
**Last Updated**: 2025-11-22
