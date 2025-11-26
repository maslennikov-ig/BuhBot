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

# 3. Start App (Concurrent Backend + Frontend)
# Force REDIS_PORT and REDIS_HOST (IPv4) env vars for backend
echo "⚡ Starting Frontend and Backend (REDIS_HOST=127.0.0.1, REDIS_PORT=$REDIS_PORT)..."
REDIS_HOST=127.0.0.1 REDIS_PORT=$REDIS_PORT npm run dev

# Cleanup on exit
cleanup
