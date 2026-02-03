# Monitoring Stack

**Multi-service monitoring container**: Prometheus + Grafana + Uptime Kuma

## Architecture

This container bundles three monitoring services managed by supervisord:

1. **Prometheus** (port 9090) - Metrics collection and time-series database
2. **Grafana** (port 3000) - Visualization and dashboards
3. **Uptime Kuma** (port 3001) - Uptime monitoring and status page

## Quick Start

### Build Image

```bash
cd infrastructure/monitoring
docker build -t buhbot-monitoring:latest .
```

### Run Container

```bash
docker run -d \
  --name monitoring-stack \
  -p 9090:9090 \
  -p 3000:3000 \
  -p 3001:3001 \
  -v prometheus-data:/prometheus \
  -v grafana-data:/var/lib/grafana \
  -v uptime-kuma-data:/app/data \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  -v $(pwd)/grafana.ini:/etc/grafana/grafana.ini \
  buhbot-monitoring:latest
```

### Access Services

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (default credentials: admin/admin)
- **Uptime Kuma**: http://localhost:3001

## Production Deployment

In production, use docker-compose (see `infrastructure/docker-compose/docker-compose.yml`):

```yaml
monitoring-stack:
  build: ./monitoring
  ports:
    - '9090:9090'
    - '3000:3000'
    - '3001:3001'
  volumes:
    - prometheus-data:/prometheus
    - grafana-data:/var/lib/grafana
    - uptime-kuma-data:/app/data
    - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
    - ./monitoring/grafana.ini:/etc/grafana/grafana.ini:ro
  restart: unless-stopped
  healthcheck:
    test: ['/usr/local/bin/healthcheck.sh']
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 60s
```

## Configuration

### Prometheus

Edit `prometheus.yml` to configure scrape targets:

```yaml
scrape_configs:
  - job_name: 'bot-backend'
    static_configs:
      - targets: ['bot-backend:9100']
```

Reload configuration without restart:

```bash
docker exec monitoring-stack kill -HUP $(pgrep prometheus)
```

### Grafana

Edit `grafana.ini` for server settings. Key settings:

- `admin_password`: Change default password before production
- `root_url`: Set to your domain (e.g., https://yourdomain.com/grafana)
- `serve_from_sub_path`: Set to `true` if serving from reverse proxy subpath

### Uptime Kuma

Configuration is done via web UI at http://localhost:3001. Data persists in `/app/data` volume.

## Health Check

The container includes a health check script that verifies all three services:

```bash
docker exec monitoring-stack /usr/local/bin/healthcheck.sh
```

Returns exit code 0 if all services are healthy.

## Logs

View logs for all services:

```bash
docker logs -f monitoring-stack
```

View specific service logs via supervisorctl:

```bash
docker exec monitoring-stack supervisorctl tail -f prometheus
docker exec monitoring-stack supervisorctl tail -f grafana
docker exec monitoring-stack supervisorctl tail -f uptime-kuma
```

## Troubleshooting

### Service not starting

Check supervisor status:

```bash
docker exec monitoring-stack supervisorctl status
```

Restart specific service:

```bash
docker exec monitoring-stack supervisorctl restart prometheus
```

### Permission issues

All services run as `nobody:nogroup` user. Ensure volumes have correct permissions:

```bash
docker exec monitoring-stack chown -R nobody:nogroup /prometheus /var/lib/grafana /app/data
```

## Resource Requirements

Recommended VDS resources (all 3 services):

- **CPU**: 1-2 vCPU
- **RAM**: 1-2 GB
- **Disk**: 10 GB (for time-series data retention)

## Security Notes

1. **Change Grafana admin password** before production deployment
2. **Configure Prometheus authentication** if exposing externally (use reverse proxy)
3. **Use HTTPS** via Nginx reverse proxy (see `infrastructure/nginx/`)
4. **Restrict port access** - only expose via reverse proxy, not direct access

## Versions

- Prometheus: 2.48.1
- Grafana: 10.2.3
- Uptime Kuma: 1.23.11
- Node.js: 20.x LTS
- Base Image: Ubuntu 22.04

## Next Steps

1. Configure Prometheus scrape targets in `prometheus.yml`
2. Create Grafana dashboards (see `specs/001-infrastructure-setup/research.md` for dashboard designs)
3. Setup Uptime Kuma monitors via web UI
4. Configure Nginx reverse proxy (see `infrastructure/nginx/`)
5. Setup alerting rules (Prometheus alert rules + Grafana notification channels)
