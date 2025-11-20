# Multi-service monitoring stack: Prometheus + Grafana + Uptime Kuma
# Base: Ubuntu 22.04 with supervisord for process management
FROM ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Europe/Moscow

# Install system dependencies
RUN apt-get update && apt-get install -y \
    supervisor \
    wget \
    curl \
    ca-certificates \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# ============================================
# Prometheus Installation
# ============================================
ARG PROMETHEUS_VERSION=2.48.1
RUN wget https://github.com/prometheus/prometheus/releases/download/v${PROMETHEUS_VERSION}/prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz \
    && tar xvfz prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz \
    && mv prometheus-${PROMETHEUS_VERSION}.linux-amd64 /opt/prometheus \
    && rm prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz \
    && ln -s /opt/prometheus/prometheus /usr/local/bin/prometheus \
    && ln -s /opt/prometheus/promtool /usr/local/bin/promtool

# Create Prometheus directories
RUN mkdir -p /prometheus /etc/prometheus \
    && chown -R nobody:nogroup /prometheus /etc/prometheus /opt/prometheus

# ============================================
# Grafana Installation
# ============================================
ARG GRAFANA_VERSION=10.2.3
RUN wget https://dl.grafana.com/oss/release/grafana-${GRAFANA_VERSION}.linux-amd64.tar.gz \
    && tar -zxvf grafana-${GRAFANA_VERSION}.linux-amd64.tar.gz \
    && mv grafana-v${GRAFANA_VERSION} /opt/grafana \
    && rm grafana-${GRAFANA_VERSION}.linux-amd64.tar.gz

# Create Grafana directories and provisioning structure
RUN mkdir -p /var/lib/grafana /var/log/grafana /etc/grafana \
    /etc/grafana/provisioning/datasources \
    /etc/grafana/provisioning/dashboards \
    /etc/grafana/provisioning/notifiers \
    /etc/grafana/provisioning/plugins \
    /etc/grafana/provisioning/alerting \
    && chown -R nobody:nogroup /var/lib/grafana /var/log/grafana /etc/grafana /opt/grafana

# ============================================
# Node.js & Uptime Kuma Installation
# ============================================
# Install Node.js 20.x (LTS) and git
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs git \
    && rm -rf /var/lib/apt/lists/*

# Install Uptime Kuma from GitHub
ARG UPTIME_KUMA_VERSION=1.23.11
RUN git clone --depth 1 --branch ${UPTIME_KUMA_VERSION} https://github.com/louislam/uptime-kuma.git /app/uptime-kuma \
    && cd /app/uptime-kuma \
    && npm install --global npm@latest \
    && npm ci \
    && npm run build \
    && npm prune --production \
    && chown -R nobody:nogroup /app/uptime-kuma

# Create Uptime Kuma data directory
RUN mkdir -p /app/data \
    && chown -R nobody:nogroup /app/data

# ============================================
# Supervisord Configuration
# ============================================
COPY supervisord.conf /etc/supervisor/conf.d/monitoring-stack.conf

# Create log directory for supervisor
RUN mkdir -p /var/log/supervisor \
    && chown -R nobody:nogroup /var/log/supervisor

# ============================================
# Configuration Files (to be mounted or copied)
# ============================================
# Placeholder files - will be overridden by docker-compose volumes
RUN echo "global:\n  scrape_interval: 15s\nscrape_configs:\n  - job_name: prometheus\n    static_configs:\n      - targets: ['localhost:9090']" > /etc/prometheus/prometheus.yml \
    && echo "[server]\nhttp_port = 3000\ndomain = localhost" > /etc/grafana/grafana.ini

# ============================================
# Health Check Script
# ============================================
RUN echo '#!/bin/bash\n\
# Check Prometheus\n\
curl -f http://localhost:9090/-/healthy || exit 1\n\
# Check Grafana\n\
curl -f http://localhost:3000/api/health || exit 1\n\
# Check Uptime Kuma\n\
curl -f http://localhost:3001/api/entry-page || exit 1\n\
exit 0' > /usr/local/bin/healthcheck.sh \
    && chmod +x /usr/local/bin/healthcheck.sh

# ============================================
# Expose Ports
# ============================================
# Prometheus: 9090 (internal)
# Grafana: 3000 (reverse proxy via Nginx at /grafana)
# Uptime Kuma: 3001 (reverse proxy via Nginx at /uptime)
EXPOSE 9090 3000 3001

# ============================================
# Health Check
# ============================================
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD /usr/local/bin/healthcheck.sh

# ============================================
# Start Supervisord
# ============================================
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
