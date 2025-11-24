# ================================
# Backend Types Stage - Build backend to generate Prisma client types
# ================================
FROM node:20-alpine AS backend-types

# Install pnpm and build dependencies
RUN npm install -g pnpm@9 && \
    apk add --no-cache libc6-compat openssl

# Set working directory
WORKDIR /backend

# Copy backend package files
COPY backend/package.json backend/pnpm-lock.yaml ./

# Install backend dependencies (only for Prisma generation)
RUN pnpm install --frozen-lockfile

# Copy Prisma schema
COPY backend/prisma ./prisma

# Generate Prisma client (creates types in src/generated/prisma)
RUN pnpm prisma generate

# Copy backend source code (needed for tRPC type inference)
COPY backend/src ./src

# ================================
# Build Stage - Build Next.js application
# ================================
FROM node:20-alpine AS build

# Install pnpm and build dependencies
RUN npm install -g pnpm@9 && \
    apk add --no-cache libc6-compat

# Set working directory
WORKDIR /app

# Copy backend with generated Prisma client and all node_modules for tRPC type imports
# TypeScript needs to resolve the full module graph including @supabase/supabase-js, @prisma/adapter-pg, etc.
COPY --from=backend-types /backend/src ../backend/src
COPY --from=backend-types /backend/node_modules ../backend/node_modules

# Copy frontend package files for dependency installation
COPY frontend/package.json frontend/pnpm-lock.yaml ./

# Install dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy frontend source code and configuration files
COPY frontend/. .

# Build arguments for environment variables (required at build time)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

# Set environment variables for build
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build Next.js application with standalone output
RUN pnpm build

# ================================
# Runtime Stage
# ================================
FROM node:20-alpine AS runtime

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user and group
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

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
