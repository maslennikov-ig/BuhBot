# ============================================================================
# Build Stage
# ============================================================================
# Using Node 18 Debian Slim for OpenSSL 1.1 compatibility with Prisma
FROM node:18-slim AS builder

# Install build dependencies (Python for native modules like bcrypt)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ openssl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci --prefer-offline --no-audit

# Copy Prisma schema for code generation
COPY prisma ./prisma

# Generate Prisma Client (required before TypeScript compilation)
RUN npx prisma generate

# Copy TypeScript configuration and source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript → JavaScript (output to dist/)
RUN npm run build

# ============================================================================
# Runtime Stage (Production)
# ============================================================================
# Using Node 18 Debian Slim for OpenSSL 1.1 compatibility with Prisma
FROM node:18-slim AS runtime

# Install dumb-init for proper signal handling (PID 1 problem)
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init curl openssl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs nodejs

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies (no devDependencies)
RUN npm ci --only=production --prefer-offline --no-audit && \
    npm cache clean --force

# Copy Prisma schema and generated client from builder stage
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy compiled JavaScript from builder stage
COPY --from=builder /app/dist ./dist

# Create logs directory with proper permissions
RUN mkdir -p logs && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose application port (bot webhook + tRPC API)
EXPOSE 3000

# Health check configuration
# Checks /health endpoint every 30s, timeout 3s, start after 10s, 3 retries
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Set production environment
ENV NODE_ENV=production

# Use dumb-init to handle signals properly (SIGTERM for graceful shutdown)
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]
