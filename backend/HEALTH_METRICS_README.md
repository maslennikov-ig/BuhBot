# Health Check and Metrics Endpoints

This document describes the health check and metrics endpoints implemented for BuhBot backend monitoring.

## Overview

The backend now includes comprehensive health monitoring and Prometheus metrics collection:

- **Health Check Endpoint**: `/health` - Monitors critical service dependencies
- **Metrics Endpoint**: `/metrics` - Exposes Prometheus metrics for monitoring

## Health Check Endpoint

### Endpoint Details

- **URL**: `GET /health`
- **Authentication**: None (public endpoint)
- **Response Format**: JSON

### Response Structure

```json
{
  "status": "ok" | "degraded" | "down",
  "uptime": 12345.67,
  "timestamp": "2025-11-20T10:00:00.000Z",
  "checks": {
    "database": {
      "status": "ok" | "down",
      "latency_ms": 15
    },
    "redis": {
      "status": "ok" | "down",
      "latency_ms": 3
    }
  }
}
```

### Status Codes

- **200 OK**: All checks passed (status: "ok")
- **503 Service Unavailable**: One or more checks failed (status: "degraded" or "down")

### Health States

1. **ok**: All checks passed, service fully operational
2. **degraded**: Redis down (non-critical, app can function with reduced features)
3. **down**: Database down (critical, app cannot function)

### Individual Checks

#### Database Check
- Tests PostgreSQL/Supabase connection via Prisma
- Query: `SELECT 1`
- Timeout: 5 seconds
- **Critical**: Service cannot function without database

#### Redis Check
- Tests Redis connection via `PING` command
- Timeout: 5 seconds
- **Non-critical**: Service can function with degraded features (no caching, no queues)

### Usage Examples

```bash
# Check service health
curl http://localhost:3000/health

# Use in Docker healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Use in Kubernetes liveness probe
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 40
  periodSeconds: 30
  timeoutSeconds: 3
  failureThreshold: 3
```

## Metrics Endpoint

### Endpoint Details

- **URL**: `GET /metrics`
- **Authentication**: None (should be restricted to internal network)
- **Response Format**: Prometheus text format

### Metrics Categories

#### 1. Node.js Runtime Metrics (Default)

Automatically collected by `prom-client`:

- `nodejs_heap_size_total_bytes` - Total heap size
- `nodejs_heap_size_used_bytes` - Used heap size
- `nodejs_external_memory_bytes` - External memory usage
- `nodejs_heap_space_size_*` - Heap space statistics
- `nodejs_version_info` - Node.js version information
- `process_cpu_*` - CPU usage statistics
- `process_resident_memory_bytes` - RSS memory
- `nodejs_eventloop_lag_*` - Event loop lag histogram
- `nodejs_gc_duration_seconds` - Garbage collection duration

#### 2. Bot Application Metrics

**bot_messages_received_total** (Counter)
- Total incoming messages received by the bot
- Labels: `chat_type` (private|group|supergroup), `user_type` (client|accountant|unknown)

**bot_message_processing_duration** (Histogram)
- Message processing duration in seconds
- Labels: `chat_type`, `user_type`
- Buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]

**bot_webhook_signature_failures** (Counter)
- Number of webhook requests with invalid signatures
- No labels

#### 3. Redis Queue Metrics (BullMQ)

**redis_queue_length** (Gauge)
- Number of pending jobs in BullMQ queue
- Labels: `queue_name`

**redis_connection_errors** (Counter)
- Number of Redis connection errors
- No labels

#### 4. Supabase/Database Metrics

**supabase_query_duration** (Histogram)
- Database query duration in seconds
- Labels: `query_type` (select|insert|update|delete), `model` (table name)
- Buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1]

**supabase_connection_errors** (Counter)
- Number of database connection errors
- No labels

**supabase_connection_pool_size** (Gauge)
- Number of active database connections
- No labels

### Prometheus Scrape Configuration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'buhbot-backend'
    scrape_interval: 15s
    static_configs:
      - targets: ['backend:3000']
    metrics_path: '/metrics'
```

### Usage Examples

```bash
# View all metrics
curl http://localhost:3000/metrics

# Query specific metric via Prometheus API
curl 'http://localhost:9090/api/v1/query?query=bot_messages_received_total'

# Example PromQL queries
# - Message rate: rate(bot_messages_received_total[5m])
# - P95 processing time: histogram_quantile(0.95, rate(bot_message_processing_duration_bucket[5m]))
# - Error rate: rate(supabase_connection_errors[5m])
```

## Integration with Application Code

### Recording Bot Metrics

```typescript
import {
  botMessagesReceivedTotal,
  botMessageProcessingDuration,
  startTimer
} from '../utils/metrics.js';

// Record incoming message
botMessagesReceivedTotal.inc({
  chat_type: 'private',
  user_type: 'client'
});

// Measure processing duration
const end = startTimer(botMessageProcessingDuration, {
  chat_type: 'private',
  user_type: 'client'
});

// ... process message ...

end(); // Records duration automatically
```

### Recording Database Metrics

```typescript
import { supabaseQueryDuration, startTimer } from '../utils/metrics.js';

// Measure query duration
const end = startTimer(supabaseQueryDuration, {
  query_type: 'select',
  model: 'User'
});

const users = await prisma.user.findMany();

end(); // Records duration automatically
```

### Recording Redis Metrics

```typescript
import { redisQueueLength, setGauge } from '../utils/metrics.js';

// Update queue length
const queueCount = await queue.count();
setGauge(redisQueueLength, queueCount, { queue_name: 'messages' });
```

## Files Created

1. **`backend/src/api/health.ts`** - Health check endpoint implementation
2. **`backend/src/api/metrics.ts`** - Metrics endpoint implementation
3. **`backend/src/utils/metrics.ts`** - Prometheus metrics collection utility
4. **`backend/src/lib/prisma.ts`** - Prisma client singleton
5. **`backend/src/lib/redis.ts`** - Redis client singleton

## Files Modified

1. **`backend/src/index.ts`** - Integrated health and metrics endpoints
2. **`backend/src/api/trpc/context.ts`** - Updated to use shared Prisma client

## Testing

### Test Health Endpoint

```bash
# Start backend
npm run dev

# Test health endpoint
curl -i http://localhost:3000/health

# Expected output (healthy):
# HTTP/1.1 200 OK
# {
#   "status": "ok",
#   "uptime": 123.45,
#   "timestamp": "2025-11-20T10:00:00.000Z",
#   "checks": {
#     "database": { "status": "ok", "latency_ms": 15 },
#     "redis": { "status": "ok", "latency_ms": 3 }
#   }
# }
```

### Test Metrics Endpoint

```bash
# Test metrics endpoint
curl http://localhost:3000/metrics

# Expected output (truncated):
# TYPE nodejs_heap_size_total_bytes gauge
# nodejs_heap_size_total_bytes 12345678
# TYPE bot_messages_received_total counter
# bot_messages_received_total{chat_type="private",user_type="client"} 0
```

## Security Considerations

1. **Metrics Endpoint**: Should be restricted to internal network or monitoring services only
   - Use firewall rules to block public access
   - Or implement authentication if exposed

2. **Health Endpoint**: Can be public (no sensitive data exposed)
   - Returns only status information
   - Useful for load balancers and monitoring

3. **Secrets**: No hardcoded credentials in any files
   - Database URL from environment variables
   - Redis password from environment variables

## Future Enhancements

1. **Prisma Middleware**: Automatically track all database queries
2. **BullMQ Monitoring**: Integrate queue metrics collection
3. **Custom Dashboards**: Pre-built Grafana dashboards
4. **Alert Rules**: Prometheus alert rules for critical metrics
5. **Tracing**: Distributed tracing with OpenTelemetry

## References

- [Prometheus Client Documentation](https://github.com/siimon/prom-client)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [ioredis Documentation](https://github.com/redis/ioredis)
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
