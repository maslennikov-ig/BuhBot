# BuhBot Infrastructure

Production-ready Docker Compose orchestration for all BuhBot services.

## Services Overview

| Service              | Port             | Description                        | Health Check                           |
| -------------------- | ---------------- | ---------------------------------- | -------------------------------------- |
| **bot-backend**      | 3000             | Telegram bot + tRPC API            | `curl -f http://localhost:3000/health` |
| **frontend**         | 3001             | Next.js admin panel                | Node.js HTTP health check              |
| **redis**            | 6379             | Cache and queue (internal)         | `redis-cli ping`                       |
| **monitoring-stack** | 9090, 3002, 3003 | Prometheus + Grafana + Uptime Kuma | Custom script                          |
| **nginx**            | 80, 443          | HTTPS reverse proxy                | `curl -f http://localhost/health`      |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                         Nginx                           │
│                 (Reverse Proxy + HTTPS)                 │
│                      Ports: 80, 443                     │
└────────┬────────────────┬────────────────┬──────────────┘
         │                │                │
         ▼                ▼                ▼
┌────────────────┐ ┌─────────────┐ ┌───────────────────┐
│  bot-backend   │ │  frontend   │ │ monitoring-stack  │
│   Port: 3000   │ │ Port: 3001  │ │ Ports: 9090,3002,3003 │
└────────┬───────┘ └─────────────┘ └───────────────────┘
         │
         ▼
    ┌─────────┐
    │  Redis  │
    │  Cache  │
    └─────────┘
```

## Network and Volumes

**Network**: `buhbot-network` (bridge)

**Volumes**:

- `redis-data`: Redis persistent storage (AOF enabled)
- `prometheus-data`: Prometheus TSDB metrics
- `grafana-data`: Grafana database and dashboards
- `uptime-kuma-data`: Uptime Kuma monitors database
- `certbot-data`: Let's Encrypt SSL certificates

## Prerequisites

1. **Docker** (v20.10+) and **Docker Compose** (v2.0+)
2. **Environment Files**:
   - `backend/.env` (see `backend/.env.example`) — must contain at least `DATABASE_URL` and `TELEGRAM_BOT_TOKEN`. For GitHub-triggered deploys, the workflow does not sync `.env` to the VDS; the server must have this file configured before deploy.
   - `frontend/.env.local` (see `frontend/.env.example`)
   - `infrastructure/.env` (see `infrastructure/.env.example`)

3. **Configuration Files**:
   - `infrastructure/monitoring/prometheus.yml`
   - `infrastructure/monitoring/grafana.ini`
   - `infrastructure/nginx/nginx.conf`
   - `infrastructure/nginx/ssl/` (SSL certificates)

## Quick Start

### 1. Setup Environment

```bash
# Copy environment files
cp infrastructure/.env.example infrastructure/.env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Edit environment files with your values
nano infrastructure/.env
nano backend/.env
nano frontend/.env.local
```

### 2. Build Images

```bash
cd infrastructure

# Build all services
docker compose build

# Or build specific service
docker compose build bot-backend
docker compose build frontend
docker compose build monitoring-stack
```

### 3. Start Services

```bash
# Start all services in background
docker compose up -d

# Or start with logs visible
docker compose up

# Start specific service
docker compose up -d bot-backend
```

### 4. Check Status

```bash
# View running containers
docker compose ps

# Check health status
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}"

# View logs
docker compose logs -f

# View logs for specific service
docker compose logs -f bot-backend
docker compose logs -f frontend
```

## Service Dependencies

**Startup Order**:

1. `redis` → Must be healthy before bot-backend
2. `monitoring-stack` → Starts immediately
3. `bot-backend` → Waits for redis health check
4. `frontend` → Waits for bot-backend health check
5. `nginx` → Waits for bot-backend and frontend health checks

**Health Checks**:

- All services have health checks configured
- `depends_on` with `condition: service_healthy` ensures proper startup order
- Restart policy: `unless-stopped` (survives host reboot)

## Management Commands

### Service Control

```bash
# Stop all services
docker compose down

# Stop and remove volumes (WARNING: deletes data)
docker compose down -v

# Restart specific service
docker compose restart bot-backend

# Stop specific service
docker compose stop frontend

# Start specific service
docker compose start frontend
```

### Logs and Monitoring

```bash
# Follow logs for all services
docker compose logs -f

# Follow logs with timestamps
docker compose logs -f -t

# View last 100 lines
docker compose logs --tail=100

# Monitor resource usage
docker stats
```

### Health Checks

```bash
# Check health status
docker compose ps

# Inspect health check details
docker inspect buhbot-bot-backend --format='{{json .State.Health}}'

# Test health endpoint manually
curl http://localhost:3000/health  # bot-backend
curl http://localhost:3001/api/health  # frontend
docker exec buhbot-redis redis-cli ping  # redis
```

## Volumes Management

```bash
# List volumes
docker volume ls | grep buhbot

# Inspect volume
docker volume inspect buhbot-redis-data

# Backup volume
docker run --rm -v buhbot-redis-data:/data -v $(pwd):/backup alpine tar czf /backup/redis-backup.tar.gz /data

# Restore volume
docker run --rm -v buhbot-redis-data:/data -v $(pwd):/backup alpine tar xzf /backup/redis-backup.tar.gz -C /

# Remove unused volumes (careful!)
docker volume prune
```

## Production Deployment

### 1. Pre-Deployment Checklist

- [ ] All environment variables set correctly
- [ ] SSL certificates installed in `nginx/ssl/`
- [ ] Database migrations applied
- [ ] Nginx configuration tested
- [ ] Monitoring dashboards configured

### 2. Deploy

```bash
cd infrastructure

# Pull latest images (if using registry)
docker compose pull

# Build fresh images
docker compose build --no-cache

# Start services
docker compose up -d

# Verify all services are healthy
docker compose ps
```

### 3. Post-Deployment

```bash
# Check logs for errors
docker compose logs -f --tail=100

# Verify health endpoints
curl https://yourdomain.com/health
curl https://yourdomain.com/api/health

# Monitor metrics
open http://yourdomain.com/grafana
open http://yourdomain.com/uptime
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker compose logs -f <service-name>

# Check health status
docker compose ps

# Restart service
docker compose restart <service-name>

# Rebuild and restart
docker compose up -d --build --force-recreate <service-name>
```

### Health Check Failing

```bash
# Check health check command
docker inspect <container-name> --format='{{json .State.Health}}'

# Execute health check manually
docker exec <container-name> <health-check-command>

# Example for bot-backend
docker exec buhbot-bot-backend curl -f http://localhost:3000/health
```

### Volume Issues

```bash
# Check volume permissions
docker exec <container-name> ls -la /path/to/volume

# Reset volume (WARNING: deletes data)
docker compose down
docker volume rm buhbot-<volume-name>
docker compose up -d
```

### Network Issues

```bash
# Inspect network
docker network inspect buhbot-network

# Check if service is connected
docker inspect <container-name> --format='{{json .NetworkSettings.Networks}}'

# Reconnect service to network
docker network connect buhbot-network <container-name>
```

## Security Best Practices

1. **Non-root users**: All services run as non-root (nodejs:1001, nextjs:1001, nobody)
2. **Read-only config**: Configuration files mounted as `:ro` (read-only)
3. **Secret management**: Use Docker secrets or env files (never commit `.env`)
4. **Network isolation**: Internal services not exposed to host (redis)
5. **HTTPS only**: Nginx terminates SSL, HTTP redirects to HTTPS

## Performance Tuning

### Resource Limits (add to docker-compose.prod.yml)

```yaml
services:
  bot-backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### Redis Tuning

```yaml
redis:
  command: >
    redis-server
    --appendonly yes
    --appendfsync everysec
    --maxmemory 512mb
    --maxmemory-policy allkeys-lru
    --save 900 1
    --save 300 10
    --save 60 10000
```

## Monitoring and Metrics

### Access Monitoring Services

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3002
- **Uptime Kuma**: http://localhost:3003

### Default Credentials

See individual service documentation for default credentials.

**IMPORTANT**: Change default passwords in production!

## CI/CD Integration

```yaml
# .github/workflows/deploy.yml
- name: Deploy to production
  run: |
    cd infrastructure
    docker compose pull
    docker compose up -d
    docker compose ps
```

## Related Documentation

- [Backend Setup](../backend/README.md)
- [Frontend Setup](../frontend/README.md)
- [Monitoring Stack](./monitoring/README.md)
- [Nginx Configuration](./nginx/README.md)

## License

MIT
