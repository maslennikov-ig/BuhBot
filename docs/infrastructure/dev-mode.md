# DEV MODE — Local Development Without Supabase

**Version**: 1.0.0  
**Last Updated**: 2026-02-03  
**Target Audience**: Developers running BuhBot locally without Supabase credentials

---

## Overview

**DEV MODE** lets you run the BuhBot backend and frontend locally without configuring Supabase. Authentication is bypassed: a mock admin user is used for all requests. This is intended only for development; never enable DEV MODE in production.

### What DEV MODE does

- **Backend**: If `DEV_MODE=true` and `NODE_ENV=development`, the tRPC context returns a mock admin user instead of validating a Supabase JWT.
- **Frontend**: If `NEXT_PUBLIC_DEV_MODE=true` and `NODE_ENV=development`, the login flow skips Supabase and tRPC requests send a dev-mode token and `X-Dev-Mode: true` header.

---

## Prerequisites

- Node.js 18+
- Docker and Docker Compose (for local PostgreSQL and Redis)
- pnpm (or npm)

You do **not** need a Supabase project or Telegram webhook for basic local UI/API work. For full bot behavior you still need a Telegram Bot Token and, if you use queues, Redis.

---

## Step 1: Local PostgreSQL and Redis

From the repository root:

```bash
docker compose -f infrastructure/docker-compose.local.yml up -d
```

This starts:

- **PostgreSQL** on `localhost:5432` (user `postgres`, password `postgres`, database `buhbot`)
- **Redis** on `localhost:6379`

Verify:

```bash
docker compose -f infrastructure/docker-compose.local.yml ps
```

---

## Step 2: Backend configuration

1. Copy the example env file:
   ```bash
   cd backend
   cp .env.example .env
   ```

2. Edit `backend/.env` and set at least:
   - `NODE_ENV=development`
   - `DEV_MODE=true`
   - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/buhbot`
   - `DIRECT_URL=postgresql://postgres:postgres@localhost:5432/buhbot`
   - `REDIS_HOST=localhost`
   - `REDIS_PORT=6379`
   - `TELEGRAM_BOT_TOKEN=<your-bot-token>` (required by backend config; use a dev bot if needed)
   - Leave `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` unset (or omit) so the backend runs without Supabase.

3. Optional: set `DEV_USER_EMAIL=admin@buhbot.local` to match the mock user email shown in the UI.

4. Run migrations and seed (if applicable):
   ```bash
   pnpm prisma migrate deploy
   pnpm prisma db seed
   ```

5. Start the backend:
   ```bash
   pnpm dev
   ```

The API will be available at `http://localhost:3000` (or the port set in `PORT`). All tRPC requests are treated as authenticated under the DEV MODE mock user.

---

## Step 3: Frontend configuration

1. Copy the example env file:
   ```bash
   cd frontend
   cp .env.example .env.local
   ```

2. Edit `frontend/.env.local` and set:
   - `NEXT_PUBLIC_DEV_MODE=true`
   - `NEXT_PUBLIC_API_URL=http://localhost:3000` (or the URL where your backend runs)

   Leave `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` empty when using DEV MODE.

3. Optional: set `NEXT_PUBLIC_DEV_USER_EMAIL=admin@buhbot.local` to match the backend mock user.

4. Start the frontend:
   ```bash
   pnpm dev
   ```

Open the app in the browser; the login page will show a DEV MODE banner. Clicking “Sign In” will log you in as the mock user without Supabase.

---

## Summary of environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `DEV_MODE` | backend `.env` | Enable backend mock auth (use `true`). |
| `DEV_USER_EMAIL` | backend `.env` | Optional; email for mock user. |
| `NEXT_PUBLIC_DEV_MODE` | frontend `.env.local` | Enable frontend dev-mode login and headers. |
| `NEXT_PUBLIC_DEV_USER_EMAIL` | frontend `.env.local` | Optional; email shown in UI. |
| `DATABASE_URL` / `DIRECT_URL` | backend `.env` | Point to local Postgres (e.g. `localhost:5432/buhbot`). |
| `REDIS_HOST` / `REDIS_PORT` | backend `.env` | Point to local Redis. |
| `NEXT_PUBLIC_API_URL` | frontend `.env.local` | Backend URL for tRPC (e.g. `http://localhost:3000`). |

---

## Troubleshooting

- **Backend fails with “Missing required environment variable: SUPABASE_URL”**  
  Ensure `DEV_MODE=true` and `NODE_ENV=development` are set in `backend/.env`. Required env validation is relaxed only when DEV MODE is enabled.

- **Frontend still shows normal login**  
  Ensure `NEXT_PUBLIC_DEV_MODE=true` is in `frontend/.env.local` and restart the Next.js dev server so the env is picked up.

- **tRPC calls return 401 or unauthenticated**  
  Ensure both backend and frontend have DEV MODE enabled and that `NEXT_PUBLIC_API_URL` points to the running backend. The frontend sends `Authorization: Bearer dev-mode-token` and `X-Dev-Mode: true` when DEV MODE is on.

- **Database connection errors**  
  Ensure `docker compose -f infrastructure/docker-compose.local.yml up -d` is running and that `DATABASE_URL`/`DIRECT_URL` use host `localhost` (or `host.docker.internal` if the app runs inside Docker).

---

## Security reminder

**Never set `DEV_MODE` or `NEXT_PUBLIC_DEV_MODE` in production.** DEV MODE disables real authentication and is only for local development.
