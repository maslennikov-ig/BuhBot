# Nginx Configuration - BuhBot Production

## Overview

This directory contains the production Nginx configuration for BuhBot, providing HTTPS termination, reverse proxy, rate limiting, and security headers for all services.

## Files

- **`nginx.conf`**: Main Nginx configuration file with all server blocks, SSL settings, and reverse proxy rules
- **`ssl/`**: Directory for SSL certificates (Let's Encrypt)
  - `fullchain.pem`: SSL certificate chain
  - `privkey.pem`: SSL private key

## Configuration Summary

### Services Proxied

| Path | Upstream | Description |
|------|----------|-------------|
| `/webhook/telegram` | `bot-backend:3000` | Telegram webhook endpoint (rate limited: 100 req/min) |
| `/` | `frontend:3000` | Next.js admin panel (rate limited: 10 req/s) |
| `/grafana` | `monitoring-stack:3000` | Grafana monitoring dashboard |
| `/uptime` | `monitoring-stack:3001` | Uptime Kuma status page |
| `/health` | `bot-backend:3000` | Health check endpoint (no rate limit) |

### Rate Limiting

- **Webhook**: 100 requests/minute per IP, burst 20 (nodelay)
- **General**: 10 requests/second per IP, burst 20
- **Error Response**: 429 Too Many Requests with JSON body

### SSL/TLS Configuration

- **Protocols**: TLSv1.2, TLSv1.3 only (TLSv1.0/1.1 disabled)
- **Cipher Suite**: Mozilla Intermediate compatibility (ECDHE, GCM)
- **HSTS**: Enabled with max-age 1 year, includeSubDomains, preload
- **OCSP Stapling**: Enabled for faster certificate validation

### Security Headers

- `Strict-Transport-Security`: Force HTTPS for 1 year
- `X-Content-Type-Options`: Prevent MIME type sniffing
- `X-Frame-Options`: Prevent clickjacking (DENY)
- `X-XSS-Protection`: XSS protection for legacy browsers
- `Referrer-Policy`: No referrer sent
- `Content-Security-Policy`: Strict CSP policy

## Usage

### Testing Configuration Syntax

```bash
# Test in Docker (requires containers to be running)
docker exec buhbot-nginx nginx -t

# Or using Docker run (without running containers)
docker run --rm -v $(pwd)/nginx.conf:/etc/nginx/nginx.conf:ro nginx:1.25-alpine nginx -t
```

### Reloading Configuration

```bash
# Graceful reload (no downtime)
docker exec buhbot-nginx nginx -s reload

# Or restart container
docker restart buhbot-nginx
```

### Viewing Logs

```bash
# Access logs
docker exec buhbot-nginx tail -f /var/log/nginx/access.log

# Error logs
docker exec buhbot-nginx tail -f /var/log/nginx/error.log

# Or from Docker logs
docker logs -f buhbot-nginx
```

### SSL Certificate Setup

#### Option 1: Certbot (Recommended)

```bash
# 1. Start Nginx without SSL (comment out HTTPS server block temporarily)

# 2. Run certbot
docker run --rm -v certbot-data:/etc/letsencrypt \
  -v certbot-www:/var/www/certbot \
  certbot/certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  -d buhbot.example.com \
  -d www.buhbot.example.com \
  --email admin@example.com \
  --agree-tos \
  --non-interactive

# 3. Copy certificates to nginx ssl directory
docker run --rm -v certbot-data:/etc/letsencrypt \
  -v $(pwd)/ssl:/ssl \
  alpine sh -c 'cp /etc/letsencrypt/live/buhbot.example.com/fullchain.pem /ssl/ && \
                 cp /etc/letsencrypt/live/buhbot.example.com/privkey.pem /ssl/'

# 4. Uncomment HTTPS server block and reload Nginx
docker exec buhbot-nginx nginx -s reload
```

#### Option 2: Manual Certificate Upload

```bash
# Place your certificates in the ssl directory
mkdir -p ssl
cp /path/to/your/fullchain.pem ssl/
cp /path/to/your/privkey.pem ssl/
chmod 600 ssl/privkey.pem
```

### Certificate Renewal

#### Automated Renewal (Cron Job)

```bash
# Add to crontab (renew every 12 hours)
0 0,12 * * * docker run --rm -v certbot-data:/etc/letsencrypt -v certbot-www:/var/www/certbot certbot/certbot renew --quiet && docker exec buhbot-nginx nginx -s reload
```

#### Manual Renewal

```bash
# Run certbot renew
docker run --rm -v certbot-data:/etc/letsencrypt \
  -v certbot-www:/var/www/certbot \
  certbot/certbot renew

# Reload Nginx
docker exec buhbot-nginx nginx -s reload
```

## Troubleshooting

### Issue: "Connection refused" errors

**Cause**: Upstream services (bot-backend, frontend, monitoring-stack) not running

**Solution**:
```bash
# Check if services are running
docker ps | grep buhbot

# Start all services
cd infrastructure
docker compose up -d
```

### Issue: "SSL certificate not found" errors

**Cause**: SSL certificates not present in `/etc/nginx/ssl/`

**Solution**:
1. Follow "SSL Certificate Setup" instructions above
2. Or temporarily disable HTTPS by commenting out the HTTPS server block

### Issue: Rate limiting too aggressive

**Cause**: Burst values too low for legitimate traffic

**Solution**:
```nginx
# Edit nginx.conf - increase burst values
location /webhook/telegram {
    limit_req zone=webhook_limit burst=50 nodelay;  # Was: burst=20
    # ...
}
```

### Issue: WebSocket connections failing for Grafana/Uptime Kuma

**Cause**: Missing WebSocket upgrade headers

**Solution**: Configuration already includes WebSocket support. Check browser console for errors:
```javascript
// Should see "Connection: upgrade" in response headers
// If not, verify Upgrade headers in proxy configuration
```

### Issue: HTTPS redirect loop

**Cause**: Load balancer already terminating SSL and forwarding HTTP to Nginx

**Solution**: Check `X-Forwarded-Proto` header and conditionally redirect:
```nginx
# Add to HTTPS server block
if ($http_x_forwarded_proto = "http") {
    return 301 https://$host$request_uri;
}
```

## Performance Tuning

### For High Traffic

```nginx
# Increase worker connections
events {
    worker_connections 4096;  # Was: 1024
}

# Increase keepalive connections
upstream bot_backend {
    server bot-backend:3000;
    keepalive 64;  # Was: 32
}

# Enable caching for static assets (if using Nginx for static files)
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### For Memory-Constrained VDS

```nginx
# Reduce worker processes
worker_processes 2;  # Was: auto

# Reduce keepalive connections
keepalive 16;  # Was: 32

# Disable gzip for very small responses
gzip_min_length 1024;
```

## Security Hardening

### IP Whitelisting (Optional)

```nginx
# Restrict admin panel to specific IPs
location / {
    allow 203.0.113.0/24;  # Office network
    allow 198.51.100.42;   # Admin VPN
    deny all;

    proxy_pass http://frontend_app;
    # ...
}
```

### Webhook Secret Path (Recommended)

Instead of `/webhook/telegram`, use a secret path:

```nginx
# Generate random path: openssl rand -hex 16
location /webhook/a3f7b8c2e9d4f1a6b5c8e2d9f4a7b3c6 {
    limit_req zone=webhook_limit burst=20 nodelay;
    proxy_pass http://bot_backend/webhook/telegram;
    # ...
}
```

Then update Telegram webhook URL:
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://buhbot.example.com/webhook/a3f7b8c2e9d4f1a6b5c8e2d9f4a7b3c6"
```

## Monitoring

### Key Metrics to Monitor

1. **Request Rate**: Monitor for sudden spikes (DDoS attacks)
2. **Error Rate**: Track 4xx/5xx responses
3. **Response Time**: Monitor `request_time` in access logs
4. **SSL Certificate Expiry**: Alert 30 days before expiration
5. **Rate Limit Violations**: Track 429 responses

### Prometheus Metrics (Future Enhancement)

Consider installing `nginx-prometheus-exporter`:
```bash
docker run -d -p 9113:9113 nginx/nginx-prometheus-exporter:latest \
  -nginx.scrape-uri=http://buhbot-nginx:80/stub_status
```

## Configuration Best Practices

1. **Always test before reload**: `nginx -t` before `nginx -s reload`
2. **Use version control**: Commit `nginx.conf` changes to git
3. **Monitor logs**: Check error logs after configuration changes
4. **Rate limits**: Start conservative, adjust based on legitimate traffic patterns
5. **SSL certificates**: Monitor expiry dates, set up auto-renewal
6. **Security headers**: Test with https://securityheaders.com/
7. **Backups**: Keep backups of working configurations

## Reference Links

- **Nginx Documentation**: https://nginx.org/en/docs/
- **Mozilla SSL Configuration**: https://ssl-config.mozilla.org/
- **SSL Labs Test**: https://www.ssllabs.com/ssltest/
- **Security Headers Test**: https://securityheaders.com/
- **Let's Encrypt**: https://letsencrypt.org/docs/

## Support

For issues or questions about this configuration:
1. Check troubleshooting section above
2. Review Nginx error logs
3. Consult project documentation in `docs/`
4. Check `research.md` for design decisions

## Changelog

- **2025-11-20**: Initial production configuration created
  - HTTPS with TLSv1.2/1.3
  - Rate limiting for webhook (100 req/min)
  - All 5 services proxied
  - Security headers configured
  - Let's Encrypt ACME challenge support
