# ================================
# Backend Types Stage - Build backend to generate Prisma client types
# ================================
FROM node:20-slim AS backend-types

# Install build dependencies (openssl for Prisma)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /backend

# Copy backend package files
COPY backend/package.json backend/package-lock.json ./

# Install backend dependencies (only for Prisma generation)
RUN npm ci

# Copy Prisma schema
COPY backend/prisma ./prisma

# Generate Prisma client (creates types in src/generated/prisma)
RUN npx prisma generate

# Copy backend source code (needed for tRPC type inference)
COPY backend/src ./src

# ================================
# Build Stage - Build Next.js application
# ================================
FROM node:20-slim AS build

# Set working directory
WORKDIR /app

# Copy backend with generated Prisma client and all node_modules for tRPC type imports
# TypeScript needs to resolve the full module graph including @supabase/supabase-js, @prisma/adapter-pg, etc.
COPY --from=backend-types /backend/src ../backend/src
COPY --from=backend-types /backend/node_modules ../backend/node_modules

# Copy frontend package files for dependency installation
COPY frontend/package.json frontend/package-lock.json ./

# Install dependencies (including devDependencies for build)
# Use --legacy-peer-deps for @tremor/react with React 19 compatibility
RUN npm ci --legacy-peer-deps

# Copy frontend source code and configuration files
COPY frontend/. .

# Build arguments for environment variables (required at build time)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_BOT_NAME

# Set environment variables for build
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_BOT_NAME=${NEXT_PUBLIC_BOT_NAME}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build Next.js application with standalone output
RUN npm run build

# ================================
# Runtime Stage
# ================================
FROM node:20-slim AS runtime

# Install dumb-init for proper signal handling
RUN apt-get update && apt-get install -y dumb-init && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user and group
RUN groupadd -g 1001 nodejs && \
    useradd -m -u 1001 -g nodejs nextjs

# Copy standalone output from build stage
# The standalone output includes all necessary dependencies
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# Switch to non-root user
USER nextjs

# Expose Next.js default port
EXPOSE 3000

# Health check endpoint (Next.js built-in)
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Use dumb-init to handle signals properly (graceful shutdown)
ENTRYPOINT ["dumb-init", "--"]

# Start Next.js server using standalone output
CMD ["node", "server.js"]
