# DEV MODE Implementation Plan

**Date**: 2026-01-30
**Based on**: PR #18 by Dahgoth
**Status**: PLANNING

---

## Goal

Реализовать DEV MODE — режим локальной разработки без Supabase, с лучшими практиками:
- Явная активация через env variable (не автоопределение)
- Non-nullable types (без breaking changes)
- Использование существующего logger вместо console.log
- Интеграция с существующим seed скриптом

---

## Architecture Decision

### Подход PR #18 (отклоняем)
```typescript
// Проблема: nullable client ломает типы везде
export const supabase: SupabaseClient | null = isConfigured ? createClient() : null;
```

### Наш подход (лучшая практика)
```typescript
// Явный env flag, client всегда non-null, bypass на уровне context
if (process.env.DEV_MODE === 'true') {
  // Bypass auth in context.ts, клиент создаётся с placeholder values
}
```

**Преимущества:**
1. Нет breaking TypeScript changes
2. Явный контроль через `DEV_MODE=true`
3. Работает даже когда Supabase частично настроен (staging)

---

## Implementation Tasks

### Task 1: Backend — ENV Configuration

**File**: `backend/src/config/env.ts`

```typescript
const envSchema = z.object({
  // ... existing
  DEV_MODE: z.enum(['true', 'false']).optional().default('false'),
  DEV_USER_EMAIL: z.string().email().optional().default('admin@buhbot.local'),
});

export const isDevMode = env.DEV_MODE === 'true' && env.NODE_ENV === 'development';
```

**File**: `backend/.env.example` (add)
```bash
# DEV MODE (local development without Supabase)
# DEV_MODE=true
# DEV_USER_EMAIL=admin@buhbot.local
```

---

### Task 2: Backend — Context Auth Bypass

**File**: `backend/src/api/trpc/context.ts`

```typescript
import { isDevMode, env } from '../../config/env.js';
import logger from '../../utils/logger.js';

const DEV_MODE_USER: ContextUser = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  email: env.DEV_USER_EMAIL || 'admin@buhbot.local',
  role: 'admin',
  fullName: 'DEV Admin',
};

export async function createContext({ req }: CreateExpressContextOptions): Promise<Context> {
  // DEV MODE: Bypass all auth
  if (isDevMode) {
    logger.debug('[context] DEV MODE: Using mock admin user');
    return {
      prisma,
      user: DEV_MODE_USER,
      session: { accessToken: 'dev-mode-token', expiresAt: Math.floor(Date.now() / 1000) + 86400 },
    };
  }
  // ... existing code
}
```

---

### Task 3: Backend — Supabase Client (Keep Non-Nullable)

**File**: `backend/src/lib/supabase.ts`

```typescript
import logger from '../utils/logger.js';
import { isDevMode } from '../config/env.js';

const supabaseUrl = process.env['SUPABASE_URL'] || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] || 'placeholder-key';

if (isDevMode && !process.env['SUPABASE_URL']) {
  logger.warn('[Supabase] DEV MODE: Auth bypassed in context.ts');
}

if (!isDevMode && (!process.env['SUPABASE_URL'] || !process.env['SUPABASE_SERVICE_ROLE_KEY'])) {
  throw new Error('Missing: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
```

---

### Task 4: Backend — Prisma Improvements (From PR)

**File**: `backend/src/lib/prisma.ts`

```typescript
import '../config/env.js'; // Ensure env loaded first

function createPool(): pg.Pool {
  const isDev = process.env['NODE_ENV'] === 'development';
  const connectionString = isDev
    ? process.env['DATABASE_URL'] || process.env['DIRECT_URL']
    : process.env['DIRECT_URL'] || process.env['DATABASE_URL'];

  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: isDev ? 15000 : 5000,
    // @ts-expect-error - IPv4 fix for WSL2
    family: 4,
  });
}
```

---

### Task 5: Frontend — Config Module

**File**: `frontend/src/lib/config.ts` (NEW)

```typescript
export const isDevMode =
  process.env.NEXT_PUBLIC_DEV_MODE === 'true' &&
  process.env.NODE_ENV === 'development';

export const devMockUser = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  email: 'admin@buhbot.local',
  role: 'admin',
};
```

**File**: `frontend/.env.example` (add)
```bash
# DEV MODE
# NEXT_PUBLIC_DEV_MODE=true
```

---

### Task 6: Frontend — tRPC Client

**File**: `frontend/src/lib/trpc.ts`

```typescript
import { isDevMode } from './config';

async headers() {
  if (isDevMode) {
    return { 'X-Dev-Mode': 'true', Authorization: 'Bearer dev-mode-token' };
  }
  // ... existing Supabase session code
}
```

---

### Task 7: Frontend — Login Form

**File**: `frontend/src/components/auth/LoginForm.tsx`

```tsx
import { isDevMode, devMockUser } from '@/lib/config';

// Before form:
{isDevMode && (
  <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900 rounded-md">
    <p className="text-sm font-medium">🛠️ DEV MODE</p>
    <p className="text-xs">Auth bypassed. Click login.</p>
  </div>
)}

// In onSubmit:
if (isDevMode) {
  toast.success('DEV MODE: ' + devMockUser.email);
  router.push('/dashboard');
  return;
}
```

---

### Task 8: Seed Script — Dev User

**File**: `backend/prisma/seed.ts`

```typescript
const DEV_ADMIN = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  email: 'admin@buhbot.local',
  fullName: 'DEV Admin',
  role: 'admin',
  isOnboardingComplete: true,
};

await prisma.user.upsert({
  where: { id: DEV_ADMIN.id },
  update: {},
  create: DEV_ADMIN,
});
```

---

### Task 9: docker-compose.local.yml (From PR)

**File**: `infrastructure/docker-compose.local.yml` (NEW)

```yaml
services:
  postgres:
    image: postgres:15-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: buhbot
    volumes:
      - postgres-local-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    command: redis-server --appendonly yes --maxmemory 256mb
    volumes:
      - redis-local-data:/data

volumes:
  postgres-local-data:
  redis-local-data:
```

---

## Files Summary

| File | Action |
|------|--------|
| `backend/src/config/env.ts` | Modify |
| `backend/src/api/trpc/context.ts` | Modify |
| `backend/src/lib/supabase.ts` | Modify |
| `backend/src/lib/prisma.ts` | Modify |
| `backend/.env.example` | Modify |
| `backend/prisma/seed.ts` | Modify |
| `frontend/.env.example` | Modify |
| `frontend/src/lib/config.ts` | Create |
| `frontend/src/lib/trpc.ts` | Modify |
| `frontend/src/components/auth/LoginForm.tsx` | Modify |
| `infrastructure/docker-compose.local.yml` | Create |

---

## Verification

```bash
# 1. Backend DEV MODE
cd backend && DEV_MODE=true npm run dev
curl http://localhost:3000/api/trpc/user.me
# → Returns dev user without auth

# 2. Frontend DEV MODE
cd frontend && NEXT_PUBLIC_DEV_MODE=true npm run dev
# → See DEV MODE banner on /login
# → Login redirects to /dashboard

# 3. Production safety
NODE_ENV=production npm run build
# → Fails if SUPABASE_URL not set

# 4. Type check
npm run type-check
# → Passes
```

---

## What We Don't Take from PR #18

| Feature | Reason |
|---------|--------|
| Nullable `supabase` client | Breaking TypeScript change |
| `NODE_TLS_REJECT_UNAUTHORIZED=0` | Security concern |
| Auto-detect dev mode | Prefer explicit flag |
| All UI component changes | Minimal scope |

---

## After Implementation

1. Close PR #18 with comment explaining our approach
2. Create GitHub Issue for follow-up improvements
3. Update README with DEV MODE instructions
