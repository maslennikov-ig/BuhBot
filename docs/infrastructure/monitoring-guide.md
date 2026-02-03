# BuhBot Monitoring Guide

**Version**: 1.0.0
**Last Updated**: 2025-11-22
**Target Audience**: Operations team, system administrators, on-call engineers

---

## Table of Contents

1. [Overview](#overview)
2. [Monitoring Stack Architecture](#monitoring-stack-architecture)
3. [Access URLs](#access-urls)
4. [Grafana Dashboard Guide](#grafana-dashboard-guide)
5. [Understanding Alerts](#understanding-alerts)
6. [Alert Acknowledgment Procedures](#alert-acknowledgment-procedures)
7. [Uptime Kuma Configuration](#uptime-kuma-configuration)
8. [Prometheus Queries](#prometheus-queries)
9. [Troubleshooting](#troubleshooting)

---

## Overview

BuhBot uses a unified monitoring stack running in a single Docker container (`buhbot-monitoring-stack`) that includes:

- **Prometheus**: Time-series metrics collection and alerting
- **Grafana**: Visualization and dashboards
- **Uptime Kuma**: Uptime monitoring and status pages

The monitoring stack provides visibility into:

- Bot performance (message throughput, processing latency, errors)
- System health (CPU, memory, disk usage)
- SLA compliance (uptime, response times)
- Service availability (health checks, endpoint monitoring)

---

## Monitoring Stack Architecture

```
                                 +-----------------------+
                                 |   External Access     |
                                 |   (via Nginx proxy)   |
                                 +-----------+-----------+
                                             |
              +------------------------------+------------------------------+
              |                              |                              |
              v                              v                              v
+-------------+--------------+  +------------+-------------+  +------------+-------------+
|     /grafana               |  |    /prometheus           |  |    /uptime               |
|     Port 3002 (host)       |  |    Port 9090 (host)      |  |    Port 3003 (host)      |
+-------------+--------------+  +------------+-------------+  +------------+-------------+
              |                              |                              |
              +------------------------------+------------------------------+
                                             |
                            +----------------+----------------+
                            |    monitoring-stack container   |
                            |       (supervisord-managed)     |
                            |                                 |
                            |  +----------+  +-----------+   |
                            |  | Prometheus|  |  Grafana  |   |
                            |  | :9090     |  |  :3000    |   |
                            |  +----------+  +-----------+   |
                            |                                 |
                            |  +---------------------------+ |
                            |  |      Uptime Kuma          | |
                            |  |        :3001              | |
                            |  +---------------------------+ |
                            +---------------------------------+
                                             |
                                             | Scrapes metrics
                                             v
                            +----------------+----------------+
                            |    bot-backend:9100/metrics    |
                            +--------------------------------+
```

**Resource Allocation** (from docker-compose.prod.yml):

- Reserved: 1.0 cores, 1.5 GB RAM
- Limits: 1.5 cores, 2.5 GB RAM

---

## Access URLs

### Production Environment

| Service     | Internal URL                   | External URL (via Nginx)             | Host Port |
| ----------- | ------------------------------ | ------------------------------------ | --------- |
| Grafana     | `http://monitoring-stack:3000` | `https://bot.example.com/grafana`    | 3002      |
| Prometheus  | `http://monitoring-stack:9090` | `https://bot.example.com/prometheus` | 9090      |
| Uptime Kuma | `http://monitoring-stack:3001` | `https://bot.example.com/uptime`     | 3003      |

### Direct Access (from VDS)

```bash
# Grafana
curl http://localhost:3002

# Prometheus
curl http://localhost:9090

# Uptime Kuma
curl http://localhost:3003
```

### Default Credentials

| Service     | Username | Default Password | Change Required            |
| ----------- | -------- | ---------------- | -------------------------- |
| Grafana     | admin    | admin            | YES - on first login       |
| Uptime Kuma | -        | Set on first run | YES - create admin account |

---

## Grafana Dashboard Guide

### Login and Authentication

1. Navigate to `https://bot.example.com/grafana`
2. Enter credentials:
   - **Username**: `admin`
   - **Password**: Your configured password (default: `admin`)
3. On first login, you will be prompted to change the password

**Session Settings** (from grafana.ini):

- Maximum inactive lifetime: 7 days
- Maximum session lifetime: 30 days

### Available Dashboards

BuhBot includes three pre-configured dashboards:

#### 1. Bot Performance Dashboard (`buhbot-bot-performance`)

**Purpose**: Monitor Telegram bot message processing and errors

**Panels**:

| Panel                       | Description                         | Key Metrics                                      |
| --------------------------- | ----------------------------------- | ------------------------------------------------ |
| Messages Received (rate)    | Message throughput over 5m window   | `bot_messages_received_total`                    |
| Message Processing Duration | Latency percentiles (p50, p95, p99) | `bot_message_processing_duration_bucket`         |
| Webhook Signature Failures  | Security validation failures        | `bot_webhook_signature_failures_total`           |
| Active Conversations        | Current Redis session count         | `redis_sessions_count`                           |
| Error Rate                  | Percentage of failed messages       | `bot_errors_total / bot_messages_received_total` |

**Thresholds**:

- Processing duration: Green < 3s, Yellow 3-5s, Red > 5s
- Error rate: Green < 1%, Yellow 1-5%, Red > 5%

#### 2. System Health Dashboard (`buhbot-system-health`)

**Purpose**: Monitor infrastructure resource utilization

**Panels**:

| Panel            | Description                        | Alert Threshold |
| ---------------- | ---------------------------------- | --------------- |
| CPU Usage        | Per-core and total CPU utilization | Warning > 80%   |
| Memory Usage     | RAM consumption vs available       | Warning > 80%   |
| Disk Usage       | Root filesystem utilization        | Critical > 85%  |
| Container Status | Health state of all containers     | -               |
| Network I/O      | Bytes in/out per interface         | -               |

#### 3. SLA Metrics Dashboard (`buhbot-sla-metrics`)

**Purpose**: Track service level agreement compliance

**Panels**:

| Panel          | Description                     | SLA Target  |
| -------------- | ------------------------------- | ----------- |
| Uptime         | Service availability percentage | 99.9%       |
| Response Time  | API endpoint latency            | p95 < 500ms |
| Error Budget   | Remaining error margin          | -           |
| Incident Count | Number of outages               | -           |

### How to Customize Dashboards

1. **Navigate to Dashboard**: Click dashboard title in sidebar
2. **Enter Edit Mode**: Click gear icon > "Make editable" (if read-only)
3. **Edit Panel**: Click panel title > "Edit"
4. **Modify Query**: Update PromQL in "Queries" tab
5. **Adjust Visualization**: Configure in "Panel options" tab
6. **Save**: Click "Apply" then "Save dashboard"

**Best Practices**:

- Create copies before modifying default dashboards
- Use variables (`$instance`) for reusable filters
- Set appropriate time ranges for each panel type

### Time Range Selection

**Predefined Ranges** (top-right picker):

- Last 15 minutes, 1 hour, 6 hours, 24 hours
- Last 7 days, 30 days
- Custom range with date picker

**Recommended Ranges by Use Case**:

| Use Case               | Recommended Range                |
| ---------------------- | -------------------------------- |
| Real-time monitoring   | Last 15 minutes                  |
| Daily review           | Last 24 hours                    |
| Trend analysis         | Last 7 days                      |
| Capacity planning      | Last 30 days                     |
| Incident investigation | Custom (incident window + 30min) |

**Auto-Refresh**:

- Default: 30 seconds
- Available intervals: 10s, 30s, 1m, 5m, 15m, 30m, 1h, 2h, 1d

---

## Understanding Alerts

### Alert Severity Levels

| Severity | Color  | Response Time        | Notification Channel | Examples                |
| -------- | ------ | -------------------- | -------------------- | ----------------------- |
| Critical | Red    | Immediate (< 15 min) | PagerDuty, SMS, Call | Service down, disk full |
| Warning  | Yellow | Within 4 hours       | Telegram, Email      | High CPU, slow queries  |
| Info     | Blue   | Next business day    | Dashboard only       | Routine maintenance     |

### Configured Alert Rules

Alerts are defined in `/infrastructure/monitoring/prometheus/alerts.yml`:

#### System Resources Group

| Alert      | Condition    | Duration   | Severity |
| ---------- | ------------ | ---------- | -------- |
| HighCPU    | CPU > 80%    | 5 minutes  | Warning  |
| HighMemory | Memory > 80% | 5 minutes  | Warning  |
| HighDisk   | Disk > 85%   | 10 minutes | Critical |

#### Bot Health Group

| Alert              | Condition            | Duration  | Severity |
| ------------------ | -------------------- | --------- | -------- |
| BotDown            | Health check failing | 1 minute  | Critical |
| HighMessageLatency | p95 latency > 5s     | 5 minutes | Warning  |

#### Supabase Connectivity Group

| Alert               | Condition            | Duration  | Severity |
| ------------------- | -------------------- | --------- | -------- |
| SupabaseErrors      | > 10 errors in 5 min | 5 minutes | Warning  |
| HighSupabaseLatency | p95 query > 0.5s     | 5 minutes | Warning  |

#### Redis Cache Group

| Alert                        | Condition         | Duration  | Severity |
| ---------------------------- | ----------------- | --------- | -------- |
| RedisHighMemory              | Memory > 80%      | 5 minutes | Warning  |
| RedisConnectionPoolSaturated | Connections > 80% | 5 minutes | Warning  |

### Alert Notification Flow

```
Prometheus Alert Triggered
         |
         v
+--------+--------+
|  Alert State:   |
|    Pending      |
|  (for: duration)|
+--------+--------+
         |
         v (duration elapsed)
+--------+--------+
|  Alert State:   |
|    Firing       |
+--------+--------+
         |
         v
+--------+--------+
|  Alertmanager   |
|  (if configured)|
+--------+--------+
         |
    +----+----+
    |         |
    v         v
+------+  +-------+
|Email |  |Telegram|
+------+  +-------+
```

### Alert Message Format

Alerts include the following information:

```
Alert: [AlertName]
Severity: [critical|warning|info]
Service: [service-name]
Instance: [instance-address]

Summary: [Short description]

Description:
[Detailed description with current value]
[Threshold that was exceeded]
[Recommended action]

Duration: [How long condition persisted]
```

**Example Alert**:

```
Alert: HighMemory
Severity: warning
Service: system
Instance: buhbot-bot-backend:9100

Summary: High memory usage on buhbot-bot-backend:9100

Description:
Memory usage is 85% (threshold: 80%).
Instance: buhbot-bot-backend:9100
Duration: 5 minutes
Action: Check memory-intensive processes, investigate memory leaks.
```

---

## Alert Acknowledgment Procedures

### How to Acknowledge Alerts in Grafana

1. **View Active Alerts**: Navigate to Alerting > Alert rules
2. **Find Alert**: Filter by state "Firing" or search by name
3. **View Details**: Click alert name to see history and labels
4. **Silence Alert** (temporary acknowledgment):
   - Click "Silence" button
   - Set duration (e.g., 2 hours)
   - Add comment explaining reason
   - Click "Create silence"

### How to Silence Alerts Temporarily

**Via Grafana UI**:

1. Go to Alerting > Silences
2. Click "New Silence"
3. Configure matchers:
   - `alertname = HighCPU` (specific alert)
   - `severity = warning` (all warnings)
   - `service = bot-backend` (all bot alerts)
4. Set time range:
   - Start: Now
   - End: Custom duration
5. Add creator name and comment
6. Click "Submit"

**Silence Duration Guidelines**:

| Scenario                     | Recommended Duration           |
| ---------------------------- | ------------------------------ |
| Investigating issue          | 30 minutes - 1 hour            |
| Planned maintenance          | Duration of maintenance window |
| Known issue with ETA         | Until fix deployment           |
| False positive investigation | 4 hours                        |

**Removing a Silence**:

1. Go to Alerting > Silences
2. Find active silence
3. Click "Expire" to remove immediately

### Escalation Procedures

#### Level 1: On-Call Engineer (0-15 minutes)

1. Acknowledge alert within 15 minutes
2. Check dashboard for context
3. Review container logs:
   ```bash
   docker logs buhbot-bot-backend --tail=100
   ```
4. Attempt standard remediation (restart service)
5. If unresolved, escalate to Level 2

#### Level 2: Senior Engineer (15-60 minutes)

1. Deep investigation of root cause
2. Review metrics history
3. Check recent deployments
4. Coordinate with database/infrastructure teams if needed
5. If unresolved, escalate to Level 3

#### Level 3: Team Lead / Architect (60+ minutes)

1. Assess business impact
2. Coordinate incident response
3. Make decisions on major changes
4. Communicate with stakeholders

### Post-Incident Procedures

1. **Create Incident Report**: Document timeline, impact, resolution
2. **Update Runbook**: Add new remediation steps if discovered
3. **Review Thresholds**: Adjust alert thresholds if too sensitive/insensitive
4. **Add Monitoring**: Create new alerts if blind spots discovered

---

## Uptime Kuma Configuration

### Initial Setup

1. **Access Uptime Kuma**: Navigate to `https://bot.example.com/uptime`
2. **Create Admin Account**:
   - Enter username
   - Set strong password (minimum 12 characters)
   - Click "Create"
3. **Configure Settings**: Settings > General
   - Set timezone: Europe/Moscow
   - Enable/disable features as needed

### Adding New Monitors

1. Click "+ Add New Monitor"
2. Configure monitor:

**HTTP Monitor Example (Bot Health)**:

| Field                 | Value                            |
| --------------------- | -------------------------------- |
| Monitor Type          | HTTP(s)                          |
| Friendly Name         | Bot Backend Health               |
| URL                   | `http://bot-backend:3000/health` |
| Heartbeat Interval    | 60 seconds                       |
| Retries               | 3                                |
| Accepted Status Codes | 200-299                          |

**TCP Monitor Example (Redis)**:

| Field              | Value         |
| ------------------ | ------------- |
| Monitor Type       | TCP Port      |
| Friendly Name      | Redis Service |
| Hostname           | redis         |
| Port               | 6379          |
| Heartbeat Interval | 60 seconds    |

**Docker Monitor Example**:

| Field          | Value                  |
| -------------- | ---------------------- |
| Monitor Type   | Docker Container       |
| Friendly Name  | Bot Backend Container  |
| Container Name | buhbot-bot-backend     |
| Docker Host    | `/var/run/docker.sock` |

3. Click "Save"

### Recommended Monitors for BuhBot

| Monitor Name       | Type | Target                             | Interval |
| ------------------ | ---- | ---------------------------------- | -------- |
| Bot Backend Health | HTTP | `http://bot-backend:3000/health`   | 60s      |
| Frontend Health    | HTTP | `http://frontend:3000/api/health`  | 60s      |
| Redis              | TCP  | `redis:6379`                       | 60s      |
| Prometheus         | HTTP | `http://localhost:9090/-/healthy`  | 120s     |
| Grafana            | HTTP | `http://localhost:3000/api/health` | 120s     |
| Nginx HTTPS        | HTTP | `https://bot.example.com/health`   | 60s      |

### Configuring Notifications

1. Go to Settings > Notifications
2. Click "Setup Notification"
3. Choose notification type:

**Telegram Bot Notification**:

| Field             | Value                       |
| ----------------- | --------------------------- |
| Notification Type | Telegram                    |
| Bot Token         | `YOUR_MONITORING_BOT_TOKEN` |
| Chat ID           | `YOUR_ADMIN_CHAT_ID`        |

**Email Notification**:

| Field             | Value                |
| ----------------- | -------------------- |
| Notification Type | Email (SMTP)         |
| SMTP Host         | `smtp.example.com`   |
| SMTP Port         | 587                  |
| Security          | STARTTLS             |
| Username          | `alerts@example.com` |
| Password          | `[SMTP_PASSWORD]`    |
| From Email        | `alerts@example.com` |
| To Email          | `oncall@example.com` |

4. Test notification: Click "Test"
5. Save configuration

### Status Page Setup

1. Go to Status Pages
2. Click "New Status Page"
3. Configure:

| Field       | Value                      |
| ----------- | -------------------------- |
| Name        | BuhBot Status              |
| Slug        | status                     |
| Description | BuhBot service status page |
| Theme       | Auto                       |

4. Add monitors to status page:
   - Drag monitors from left panel
   - Group by category (Bot, Infrastructure, External)

5. Publish: Click "Save"

**Public Status Page URL**: `https://bot.example.com/uptime/status/status`

---

## Prometheus Queries

### Useful PromQL Queries for Debugging

#### Bot Performance Queries

```promql
# Message throughput (messages per second)
rate(bot_messages_received_total[5m])

# Message processing latency percentiles
histogram_quantile(0.50, rate(bot_message_processing_duration_bucket[5m]))  # p50
histogram_quantile(0.95, rate(bot_message_processing_duration_bucket[5m]))  # p95
histogram_quantile(0.99, rate(bot_message_processing_duration_bucket[5m]))  # p99

# Error rate percentage
rate(bot_errors_total[5m]) / rate(bot_messages_received_total[5m]) * 100

# Webhook signature failures
increase(bot_webhook_signature_failures_total[1h])

# Active Redis sessions
redis_sessions_count
```

#### System Resource Queries

```promql
# CPU usage percentage (if node_exporter available)
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memory usage percentage
(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100

# Disk usage percentage
(node_filesystem_size_bytes{mountpoint="/"} - node_filesystem_avail_bytes{mountpoint="/"}) / node_filesystem_size_bytes{mountpoint="/"} * 100
```

#### Supabase Queries

```promql
# Connection errors rate
rate(supabase_connection_errors_total[5m]) * 300

# Query latency percentiles
histogram_quantile(0.95, rate(supabase_query_duration_bucket[5m]))
```

#### Redis Queries

```promql
# Memory usage percentage
redis_memory_used_bytes / redis_memory_max_bytes * 100

# Connected clients percentage
redis_connected_clients / redis_config_maxclients * 100
```

### How to Explore Metrics

1. **Access Prometheus UI**: `https://bot.example.com/prometheus`
2. **Navigate to Graph**: Click "Graph" tab
3. **Enter Query**: Type PromQL in expression field
4. **Execute**: Click "Execute" or press Enter
5. **Switch View**: Toggle between "Table" and "Graph" view
6. **Adjust Time Range**: Use time picker at top

**Tips**:

- Use autocomplete for metric names
- Start with `bot_` prefix for application metrics
- Use `rate()` for counter metrics
- Use `histogram_quantile()` for histogram metrics

### Creating Custom Alerts from Queries

1. Test query in Prometheus UI
2. Verify threshold makes sense
3. Add to `alerts.yml`:

```yaml
- alert: CustomAlertName
  expr: |
    your_promql_query > threshold
  for: 5m
  labels:
    severity: warning
    service: your-service
  annotations:
    summary: 'Short description'
    description: |
      Detailed description with {{ $value }}.
      Action: What to do.
```

4. Restart Prometheus to load new rules:

```bash
docker compose -f infrastructure/docker-compose.yml restart monitoring-stack
```

---

## Troubleshooting

### Common Issues and Solutions

#### Grafana Not Loading

**Symptom**: Grafana page returns 502 Bad Gateway or timeout

**Diagnosis**:

```bash
# Check container status
docker ps | grep monitoring-stack

# Check Grafana logs
docker exec buhbot-monitoring-stack supervisorctl tail grafana
```

**Solutions**:

1. **Container not running**: Restart monitoring stack

   ```bash
   docker compose -f infrastructure/docker-compose.yml restart monitoring-stack
   ```

2. **Grafana crashed**: Check memory limits

   ```bash
   docker stats buhbot-monitoring-stack
   ```

   If near memory limit, increase in `docker-compose.prod.yml`

3. **Database corrupted**: Reset Grafana data (loses dashboards)
   ```bash
   docker compose -f infrastructure/docker-compose.yml down
   docker volume rm buhbot-grafana-data
   docker compose -f infrastructure/docker-compose.yml up -d
   ```

#### Prometheus Not Scraping Metrics

**Symptom**: Dashboards show "No data" or stale metrics

**Diagnosis**:

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check bot-backend metrics endpoint
curl http://localhost:3000/metrics
```

**Solutions**:

1. **Target down**: Check target service is running

   ```bash
   docker logs buhbot-bot-backend --tail=50
   ```

2. **Network issue**: Verify container network

   ```bash
   docker network inspect buhbot-network
   ```

3. **Scrape config error**: Check prometheus.yml syntax
   ```bash
   docker exec buhbot-monitoring-stack promtool check config /etc/prometheus/prometheus.yml
   ```

#### Alerts Not Firing

**Symptom**: Condition met but no alert

**Diagnosis**:

```bash
# Check alert rules loaded
curl http://localhost:9090/api/v1/rules

# Check alert status
curl http://localhost:9090/api/v1/alerts
```

**Solutions**:

1. **Rules not loaded**: Check alerts.yml exists and is valid

   ```bash
   docker exec buhbot-monitoring-stack promtool check rules /etc/prometheus/alerts.yml
   ```

2. **"for" duration not elapsed**: Wait for duration to pass

3. **Expression returns no data**: Test query in Prometheus UI

#### Uptime Kuma Monitor Failures

**Symptom**: All monitors showing down despite services working

**Diagnosis**:

```bash
# Check Uptime Kuma logs
docker exec buhbot-monitoring-stack supervisorctl tail uptime-kuma

# Test connectivity from container
docker exec buhbot-monitoring-stack curl -f http://bot-backend:3000/health
```

**Solutions**:

1. **DNS resolution**: Use container names, not localhost
2. **Port mismatch**: Verify internal ports (3000, not 3001)
3. **Network isolation**: Ensure monitor on same Docker network

### Log Locations

| Component   | Location         | Access Command                                                       |
| ----------- | ---------------- | -------------------------------------------------------------------- |
| Prometheus  | Container stdout | `docker exec buhbot-monitoring-stack supervisorctl tail prometheus`  |
| Grafana     | Container stdout | `docker exec buhbot-monitoring-stack supervisorctl tail grafana`     |
| Uptime Kuma | Container stdout | `docker exec buhbot-monitoring-stack supervisorctl tail uptime-kuma` |
| Bot Backend | Container logs   | `docker logs buhbot-bot-backend`                                     |
| Nginx       | Container logs   | `docker logs buhbot-nginx`                                           |

### Health Check Commands

```bash
# Check all container health
docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.prod.yml ps

# Check monitoring stack processes
docker exec buhbot-monitoring-stack supervisorctl status

# Test Prometheus health
curl http://localhost:9090/-/healthy

# Test Grafana health
curl http://localhost:3002/api/health

# Test Uptime Kuma health
curl http://localhost:3003/

# Test bot-backend metrics
curl http://localhost:3000/metrics

# Check Prometheus targets status
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'
```

### Monitoring Stack Recovery

If the entire monitoring stack is unresponsive:

```bash
# 1. Stop monitoring stack
docker compose -f infrastructure/docker-compose.yml stop monitoring-stack

# 2. Check for volume issues
docker volume inspect buhbot-prometheus-data
docker volume inspect buhbot-grafana-data
docker volume inspect buhbot-uptime-kuma-data

# 3. Start with fresh logs
docker compose -f infrastructure/docker-compose.yml up -d monitoring-stack

# 4. Watch startup
docker logs -f buhbot-monitoring-stack

# 5. Verify all processes running
docker exec buhbot-monitoring-stack supervisorctl status
```

Expected supervisor status:

```
grafana                          RUNNING   pid 123, uptime 0:01:00
prometheus                       RUNNING   pid 124, uptime 0:01:00
uptime-kuma                      RUNNING   pid 125, uptime 0:01:00
```

---

## Quick Reference

### Key URLs (Production)

| Service          | URL                                        |
| ---------------- | ------------------------------------------ |
| Grafana          | `https://bot.example.com/grafana`          |
| Prometheus       | `https://bot.example.com/prometheus`       |
| Uptime Kuma      | `https://bot.example.com/uptime`           |
| Bot Health       | `https://bot.example.com/health`           |
| Metrics Endpoint | `http://localhost:3000/metrics` (internal) |

### Essential Commands

```bash
# View container status
docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.prod.yml ps

# View all logs
docker compose -f infrastructure/docker-compose.yml logs -f

# Restart monitoring
docker compose -f infrastructure/docker-compose.yml restart monitoring-stack

# Check resource usage
docker stats --no-stream
```

### Contact Information

- **On-Call**: Check team rotation schedule
- **Escalation**: See [Alert Acknowledgment Procedures](#escalation-procedures)
- **Documentation**: `/home/me/code/bobabuh/docs/infrastructure/`

---

**Document Version**: 1.0.0
**Tested Components**: Prometheus, Grafana 10.x, Uptime Kuma
**Last Updated**: 2025-11-22
