# BuhBot Monitoring Stack Configuration Summary

**Generated**: 2025-11-20
**Tasks Completed**: T035-T040
**Status**: ✓ Complete

---

## Files Created

### 1. Prometheus Configuration
- **File**: `infrastructure/monitoring/prometheus.yml`
- **Purpose**: Main Prometheus configuration with scrape targets and retention settings
- **Key Features**:
  - Global scrape interval: 15 seconds (per spec PM-006)
  - External labels for cluster/environment identification
  - Scrape configs for bot-backend (port 9100), prometheus self-monitoring
  - Redis exporter support (commented, ready to enable)
  - Data retention: 15 days (Free tier constraint)
  - Local TSDB storage (no remote write/read)

### 2. Prometheus Alert Rules
- **File**: `infrastructure/monitoring/prometheus/alerts.yml`
- **Purpose**: Alert rules for system resources, bot health, and Supabase connectivity
- **Alert Groups**:
  - **system_resources**: HighCPU (>80%, 5m), HighMemory (>80%, 5m), HighDisk (>85%, 10m)
  - **bot_health**: BotDown (1m), HighMessageLatency (p95 >5s, 5m)
  - **supabase_connectivity**: SupabaseErrors (>10 in 5m), HighSupabaseLatency (p95 >0.5s, 5m)
  - **redis_cache**: RedisHighMemory (>80%, 5m), RedisConnectionPoolSaturated (>80%, 5m)
- **Total Alert Rules**: 9 rules
- **Severity Levels**: warning, critical
- **Annotations**: Summary and actionable descriptions for each alert

### 3. Grafana Datasource
- **File**: `infrastructure/monitoring/grafana/datasources/prometheus.yml`
- **Purpose**: Auto-provisioned Prometheus datasource for Grafana
- **Configuration**:
  - Type: Prometheus
  - URL: http://localhost:9090 (internal, same container)
  - Access: proxy (server-side)
  - UID: `prometheus` (used in all dashboards)
  - Default: true
  - Query timeout: 60s
  - Time interval: 15s

### 4. Grafana Dashboard - Bot Performance
- **File**: `infrastructure/monitoring/grafana/dashboards/bot-performance.json`
- **UID**: `buhbot-bot-performance`
- **Purpose**: Monitor bot responsiveness and message processing
- **Panels** (5 total):
  1. **Messages Received** (rate over 5m) - Graph panel
  2. **Message Processing Duration** (p50, p95, p99) - Graph with percentiles and thresholds (3s warning, 5s critical)
  3. **Webhook Signature Failures** (last 5m) - Stat panel with alert thresholds (5 warning, 10 critical)
  4. **Active Conversations** (Redis Sessions) - Gauge panel (max 1000, alert at 700/900)
  5. **Error Rate** (% of failed messages) - Graph with threshold line (1% warning, 5% critical)
- **Variables**: $instance (multi-instance filtering)
- **Refresh**: 30 seconds
- **Time Range**: Last 24 hours (default)

### 5. Grafana Dashboard - System Health
- **File**: `infrastructure/monitoring/grafana/dashboards/system-health.json`
- **UID**: `buhbot-system-health`
- **Purpose**: Monitor VDS resource utilization and service health
- **Panels** (7 total):
  1. **CPU Usage** - Gauge (alert at 70% yellow, 80% orange, 90% red)
  2. **Memory Usage** - Gauge (alert at 70% yellow, 80% orange, 90% red)
  3. **Disk Usage** - Gauge (alert at 70% yellow, 85% orange, 95% red)
  4. **Container Status** - Stat panel (UP/DOWN for bot-backend, prometheus)
  5. **Redis Connection Pool** - Gauge (alert at 60% yellow, 80% red)
  6. **Supabase Query Latency** - Histogram (p95, p99, threshold at 100ms)
  7. **Network Traffic** - Graph (RX/TX with inverted RX for visual clarity)
- **Variables**: $instance
- **Refresh**: 30 seconds
- **Time Range**: Last 24 hours

### 6. Grafana Dashboard - SLA Metrics
- **File**: `infrastructure/monitoring/grafana/dashboards/sla-metrics.json`
- **UID**: `buhbot-sla-metrics`
- **Purpose**: Track SLA compliance (uptime, response times)
- **Panels** (6 total):
  1. **Uptime %** (last 7 days) - Stat panel with 99.5% target (99% red, 99.5% yellow, 99.9% green)
  2. **Response Time SLA Compliance** - Gauge (% of requests <1 hour working time, 80% yellow, 95% green)
  3. **Alert Response Time** - Histogram (p95, p99, thresholds at 15m, 30m)
  4. **Daily Request Volume** - Bar chart by channel (stacked)
  5. **Failed Requests by Type** - Pie chart (spam, errors, timeouts with custom colors)
  6. **Service Uptime Trend** - Line graph (1-hour rolling average, 99.5% target line)
- **Variables**: $instance
- **Refresh**: 30 seconds
- **Time Range**: Last 24 hours

---

## Validation Results

### YAML Syntax Validation
- ✓ `prometheus.yml` - Valid YAML
- ✓ `prometheus/alerts.yml` - Valid YAML
- ✓ `grafana/datasources/prometheus.yml` - Valid YAML

### JSON Syntax Validation
- ✓ `grafana/dashboards/bot-performance.json` - Valid JSON
- ✓ `grafana/dashboards/system-health.json` - Valid JSON
- ✓ `grafana/dashboards/sla-metrics.json` - Valid JSON

### File Structure
```
infrastructure/monitoring/
├── prometheus.yml                          (T035 - Prometheus config)
├── prometheus/
│   └── alerts.yml                          (T036 - Alert rules)
├── grafana/
│   ├── datasources/
│   │   └── prometheus.yml                  (T037 - Datasource)
│   └── dashboards/
│       ├── bot-performance.json            (T038 - Bot Performance dashboard)
│       ├── system-health.json              (T039 - System Health dashboard)
│       └── sla-metrics.json                (T040 - SLA Metrics dashboard)
```

### Promtool Validation
Note: `promtool` validation requires Prometheus to be installed. Run the following commands after Prometheus deployment:

```bash
# Validate Prometheus configuration
promtool check config infrastructure/monitoring/prometheus.yml

# Validate alert rules
promtool check rules infrastructure/monitoring/prometheus/alerts.yml
```

---

## Metrics Reference

### Bot Backend Metrics (Expected)
- `bot_messages_received_total` - Counter of messages received by channel
- `bot_message_processing_duration_bucket` - Histogram of message processing time
- `bot_webhook_signature_failures_total` - Counter of webhook signature failures
- `bot_errors_total` - Counter of bot errors
- `bot_failed_requests_total{reason}` - Counter of failed requests by reason (spam, errors, timeouts)

### Redis Metrics (via redis_exporter)
- `redis_sessions_count` - Gauge of active session count
- `redis_connected_clients` - Gauge of connected clients
- `redis_memory_used_bytes` - Gauge of memory usage
- `redis_memory_max_bytes` - Gauge of max memory
- `redis_config_maxclients` - Gauge of max clients config

### Supabase Metrics (Expected from bot-backend)
- `supabase_query_duration_bucket` - Histogram of query latency
- `supabase_connection_errors_total` - Counter of connection errors

### Node Exporter Metrics (System)
- `node_cpu_seconds_total` - Counter of CPU time by mode
- `node_memory_MemTotal_bytes` - Gauge of total memory
- `node_memory_MemAvailable_bytes` - Gauge of available memory
- `node_filesystem_size_bytes` - Gauge of filesystem size
- `node_filesystem_avail_bytes` - Gauge of available disk space
- `node_network_receive_bytes_total` - Counter of received network bytes
- `node_network_transmit_bytes_total` - Counter of transmitted network bytes

### SLA Metrics (Expected from bot-backend)
- `sla_alert_response_duration_bucket` - Histogram of alert response time

---

## Next Steps

### 1. Deploy Monitoring Stack
```bash
# Start monitoring containers
docker-compose up -d prometheus grafana

# Verify Prometheus targets
curl http://localhost:9090/api/v1/targets

# Access Grafana UI
# URL: http://localhost:3000
# Default credentials: admin/admin (change on first login)
```

### 2. Configure Grafana
- Import dashboards (auto-provisioned from JSON files)
- Verify Prometheus datasource connection
- Setup notification channels (Telegram, email, etc.)
- Create additional custom dashboards as needed

### 3. Instrument Bot Backend
Add Prometheus metrics to bot-backend application:
- Install `prom-client` (Node.js) or equivalent
- Expose `/metrics` endpoint on port 9100
- Implement required metrics (see Metrics Reference above)
- Add custom business metrics as needed

### 4. Deploy Exporters
- **redis_exporter**: Monitor Redis cache performance
- **node_exporter**: Collect system-level metrics (CPU, memory, disk, network)

### 5. Configure Alerting
- Deploy Alertmanager (optional)
- Configure notification channels (Telegram, email)
- Test alert rules by simulating threshold breaches
- Setup on-call rotation and escalation policies

### 6. Tune and Optimize
- Adjust scrape intervals based on load
- Add recording rules for frequently-queried metrics
- Implement proper service discovery for multi-instance deployments
- Configure long-term storage if needed (remote write to Yandex Monitoring)

---

## Dashboard Access

After deployment, dashboards will be accessible at:
- **Bot Performance**: http://localhost:3000/d/buhbot-bot-performance
- **System Health**: http://localhost:3000/d/buhbot-system-health
- **SLA Metrics**: http://localhost:3000/d/buhbot-sla-metrics

---

## Configuration Notes

### Prometheus Retention
- **Setting**: 15 days
- **Reason**: Free tier disk space constraints
- **Recommendation**: Monitor disk usage, adjust if needed

### Scrape Interval
- **Setting**: 15 seconds
- **Reason**: Spec PM-006 requirement
- **Trade-off**: Higher resolution = more disk usage

### Alert Thresholds
All thresholds are configurable in `prometheus/alerts.yml`:
- **CPU**: 80% (5 minutes)
- **Memory**: 80% (5 minutes)
- **Disk**: 85% (10 minutes)
- **Message Latency**: 5 seconds (5 minutes)
- **Supabase Errors**: 10 in 5 minutes

### Dashboard Variables
All dashboards include `$instance` variable for multi-instance filtering.
Default: "All" (shows data from all instances)

---

## Troubleshooting

### Prometheus Not Scraping Targets
1. Check target status: http://localhost:9090/targets
2. Verify network connectivity between containers
3. Check service ports are exposed correctly
4. Review Prometheus logs: `docker logs prometheus`

### Grafana Dashboards Not Loading
1. Verify datasource connection in Grafana UI
2. Check provisioning logs: `docker logs grafana`
3. Ensure dashboard JSON files are mounted correctly
4. Refresh browser cache

### Alerts Not Firing
1. Verify alert rules loaded: http://localhost:9090/rules
2. Check metric data is being scraped
3. Test alert expressions in Prometheus UI
4. Review Alertmanager configuration (if deployed)

### Missing Metrics
1. Verify exporter is running and reachable
2. Check scrape configuration in `prometheus.yml`
3. Review exporter logs for errors
4. Test metrics endpoint directly: `curl http://bot-backend:9100/metrics`

---

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/)
- [PromQL Queries](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Alert Rule Best Practices](https://prometheus.io/docs/practices/alerting/)
