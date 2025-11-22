# BuhBot Frontend - Docker Deployment Guide

This guide explains how to build and deploy the BuhBot Next.js frontend using Docker.

## Prerequisites

- Docker 20.10+ installed
- Docker Compose 2.0+ (optional, for docker-compose deployment)
- Environment variables for Supabase connection

## Quick Start

### 1. Build the Docker Image

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  -t buhbot-frontend:latest \
  -f Dockerfile .
```

### 2. Run the Container

```bash
docker run -d \
  --name buhbot-frontend \
  -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  buhbot-frontend:latest
```

### 3. Verify Health

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-20T15:49:56.290Z",
  "uptime": 123.45
}
```

## Docker Compose Deployment

### 1. Create Environment File

Create `.env` file in the `frontend/` directory:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Copy Example Compose File

```bash
cp docker-compose.example.yml docker-compose.yml
```

### 3. Start Services

```bash
docker-compose up -d
```

### 4. View Logs

```bash
docker-compose logs -f frontend
```

### 5. Stop Services

```bash
docker-compose down
```

## Production Deployment

### Optimization Tips

1. **Use Multi-Stage Build**: The Dockerfile already implements multi-stage builds for optimal image size.

2. **Build Cache**: Use Docker BuildKit for better caching:
   ```bash
   DOCKER_BUILDKIT=1 docker build -t buhbot-frontend:latest .
   ```

3. **Image Size**: The final image is ~291MB (optimized with Alpine Linux and standalone output).

4. **Resource Limits**: Adjust CPU/memory limits in docker-compose.yml based on your needs.

### Security Best Practices

- **Non-Root User**: Container runs as `nextjs` user (UID 1001)
- **Secrets Management**: Never commit `.env` files. Use Docker secrets or environment variables.
- **Read-Only Filesystem**: Consider adding `read_only: true` to docker-compose.yml
- **Network Isolation**: Use Docker networks to isolate frontend from other services

### Health Checks

The Dockerfile includes a built-in health check:
- **Endpoint**: `http://localhost:3000/api/health`
- **Interval**: 30 seconds
- **Timeout**: 3 seconds
- **Start Period**: 40 seconds
- **Retries**: 3

To check container health:
```bash
docker inspect --format='{{.State.Health.Status}}' buhbot-frontend
```

### Graceful Shutdown

The container uses `dumb-init` to properly handle signals (SIGTERM, SIGINT) for graceful shutdown:

```bash
# Gracefully stop container (sends SIGTERM)
docker stop buhbot-frontend

# Force stop after 10 seconds (sends SIGKILL)
docker stop -t 10 buhbot-frontend
```

## Dockerfile Architecture

### Build Stage
- **Base**: `node:20-alpine`
- **Purpose**: Compile Next.js application with all dependencies
- **Output**: Standalone Next.js server in `.next/standalone/`

### Runtime Stage
- **Base**: `node:20-alpine`
- **Purpose**: Run production server with minimal dependencies
- **User**: `nextjs` (UID 1001, non-root)
- **Size**: ~291MB (includes Node.js runtime + standalone output)

### Key Features
- Multi-stage build for minimal image size
- Non-root user for security
- Health check endpoint
- Graceful shutdown with dumb-init
- Standalone output (no node_modules in runtime)
- Layer caching optimization

## Troubleshooting

### Build Fails

**Error**: `npm ci` fails during build
```bash
# Clear Docker cache and rebuild
docker build --no-cache -t buhbot-frontend:latest .
```

### Container Exits Immediately

**Error**: Container starts but exits
```bash
# Check logs
docker logs buhbot-frontend

# Common causes:
# - Missing environment variables
# - Port 3000 already in use
# - Invalid Supabase credentials
```

### Health Check Fails

**Error**: Container marked as unhealthy
```bash
# Check health status
docker inspect --format='{{json .State.Health}}' buhbot-frontend

# Test health endpoint manually
docker exec buhbot-frontend wget -qO- http://localhost:3000/api/health
```

### High Memory Usage

**Solution**: Adjust memory limits in docker-compose.yml:
```yaml
deploy:
  resources:
    limits:
      memory: 512M  # Reduce from 1G
```

## Environment Variables

### Build-Time Variables (Required)
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key

### Runtime Variables (Optional)
- `PORT`: Server port (default: 3000)
- `HOSTNAME`: Bind address (default: 0.0.0.0)
- `NODE_ENV`: Environment mode (default: production)
- `NEXT_TELEMETRY_DISABLED`: Disable Next.js telemetry (default: 1)

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Docker Image
        run: |
          docker build \
            --build-arg NEXT_PUBLIC_SUPABASE_URL=${{ secrets.SUPABASE_URL }} \
            --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=${{ secrets.SUPABASE_ANON_KEY }} \
            -t buhbot-frontend:latest \
            -f frontend/Dockerfile \
            ./frontend

      - name: Run Container
        run: docker run -d -p 3000:3000 buhbot-frontend:latest

      - name: Test Health Endpoint
        run: |
          sleep 10
          curl -f http://localhost:3000/api/health
```

## Yandex Cloud Deployment

For deployment to Yandex Cloud Container Registry:

```bash
# Login to Yandex Container Registry
docker login cr.yandex

# Tag image
docker tag buhbot-frontend:latest cr.yandex/your-registry-id/buhbot-frontend:latest

# Push to registry
docker push cr.yandex/your-registry-id/buhbot-frontend:latest
```

## Support

For issues or questions:
- Check logs: `docker logs buhbot-frontend`
- Inspect container: `docker inspect buhbot-frontend`
- Open issue on GitHub: https://github.com/maslennikov-ig/BuhBot

## License

See main repository LICENSE file.
