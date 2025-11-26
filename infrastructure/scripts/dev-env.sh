#!/bin/bash

# Infrastructure Dev Runner
# Starts a temporary Redis container on a dedicated port (6380) to avoid conflicts
# and launches the app configured to use it.

CONTAINER_NAME="buhbot-redis-dev"
REDIS_PORT=6380

echo "🚀 Starting Dev Environment..."

# 1. Cleanup previous container if exists
docker rm -f $CONTAINER_NAME 2>/dev/null

# 2. Start Redis on dedicated port 6380
echo "📦 Starting temporary Redis container on port $REDIS_PORT..."
docker run -d --name $CONTAINER_NAME -p $REDIS_PORT:6379 redis:7-alpine > /dev/null

# Wait for Redis to be ready (actually verify connectivity)
echo "⏳ Waiting for Redis to be ready..."
for i in {1..10}; do
  if docker exec $CONTAINER_NAME redis-cli ping 2>/dev/null | grep -q PONG; then
    break
  fi
  sleep 1
done

echo "✅ Redis started on localhost:$REDIS_PORT"

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Stopping Redis container..."
    docker stop $CONTAINER_NAME > /dev/null
    docker rm $CONTAINER_NAME > /dev/null
    echo "👋 Bye!"
    exit 0
}

# Trap Ctrl+C (SIGINT)
trap cleanup SIGINT SIGTERM

# 3. Start App (Backend on fixed port, Frontend auto-selects)
BACKEND_PORT=3333

# Check if backend port is available (critical - BACKEND_URL depends on it)
if lsof -i :$BACKEND_PORT > /dev/null 2>&1; then
    echo "❌ ERROR: Port $BACKEND_PORT is already in use!"
    echo "   Backend MUST run on this port (BACKEND_URL depends on it)."
    echo "   Please free the port: lsof -i :$BACKEND_PORT"
    cleanup
    exit 1
fi

echo "⚡ Starting Backend on port $BACKEND_PORT, Frontend on auto-selected port..."
echo "   Redis: 127.0.0.1:$REDIS_PORT"

# Export common env vars
export REDIS_HOST=127.0.0.1
export REDIS_PORT=$REDIS_PORT
export BACKEND_URL="http://localhost:$BACKEND_PORT"

# Force IPv4 for DNS resolution (fixes WSL2 + Supabase IPv6 connectivity issues)
export NODE_OPTIONS="--dns-result-order=ipv4first"

# Start services:
# - Backend: explicit PORT (critical - BACKEND_URL depends on it)
# - Frontend: NO PORT - let Next.js auto-select (default 3000, auto-increment if busy)
concurrently \
  --names "backend,frontend" \
  --prefix-colors "blue,green" \
  "PORT=$BACKEND_PORT npm run dev:backend" \
  "npm run dev:frontend"

# Cleanup on exit
cleanup
