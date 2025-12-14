# Troubleshooting Request: Persistent Database Timeouts with Prisma 7 + Supabase

## Objective
Diagnose and resolve persistent timeout/latency issues in a Node.js (tRPC) + Prisma 7 application connecting to Supabase PostgreSQL from a Docker container on a Linux VDS.

## Symptoms
1. **Slow Queries:** Specific tRPC procedures (e.g., `user.list`) hang indefinitely or take >20s to load.
2. **Empty Results:** When the query finally completes (or frontend gives up), lists are empty (though data exists).
3. **Context:**
   - Simple `/health` check (which pings DB) works instantly (26ms latency).
   - "Heavy" queries (fetching list of users with role filtering) hang.
   - Frontend was recently compromised by a miner (fixed/rebuilt), but backend sluggishness persists.

## Technical Stack
- **Backend:** Node.js v20 (Docker `node:20-slim`), Express, tRPC v11.
- **ORM:** Prisma v7.0.0.
- **Database:** Supabase (PostgreSQL 15+). Region: EU Central (Frankfurt).
- **Hosting:** VDS in Europe (Latency to Supabase is low ~26ms).
- **Connection:**
  - Initially: Transaction Pooler (port 6543, `pgbouncer=true`).
  - Current: Direct Connection (port 5432, standard string).
  - Issue persists in BOTH modes.

## Code Snippets

### 1. `backend/src/api/trpc/routers/user.ts` (The Hanging Procedure)
```typescript
list: authedProcedure
  .input(
    z.object({
      role: z.union([
        z.enum(['admin', 'manager', 'observer']),
        z.array(z.enum(['admin', 'manager', 'observer'])),
      ]).optional(),
    }).optional()
  )
  .query(async ({ ctx, input }) => {
    console.log('[DEBUG] user.list input:', input); // Never shows up in logs?
    const start = Date.now();
    
    const where: any = {};
    if (input?.role) {
      if (Array.isArray(input.role)) {
        where.role = { in: input.role };
      } else {
        where.role = input.role;
      }
    }

    // THIS HANGS
    const users = await ctx.prisma.user.findMany({
      where,
      select: { id: true, fullName: true, email: true, role: true },
      orderBy: { fullName: 'asc' },
    });

    console.log(`[DEBUG] finished in ${Date.now() - start}ms`);
    return users;
  }),
```

### 2. `backend/src/api/trpc/context.ts` (Authentication Middleware)
**Suspect:** This runs BEFORE every request. If this hangs, the router log never prints.
```typescript
export async function createContext({ req }: CreateExpressContextOptions): Promise<Context> {
  const token = extractToken(req.headers.authorization);
  if (!token) return { prisma, user: null, session: null };

  try {
    // 1. Validate JWT (Supabase Auth) - HTTP Request
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return { ... };

    // 2. Fetch User Profile (Database) - LIKELY HANGING HERE
    const dbUser = await prisma.user.findUnique({
      where: { id: data.user.id }, // UUID lookup
      select: { id: true, role: true, ... },
    });
    
    // ...
  } catch (error) {
    console.error('Error creating tRPC context:', error);
    return { ... };
  }
}
```

### 3. Prisma Configuration
```typescript
// backend/prisma/schema.prisma
datasource db {
  provider = "postgresql"
  schemas  = ["public", "auth"]
}

// Current .env connection string (Direct)
DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT_ID.supabase.co:5432/postgres"
```

## Observations & Hypothesis
1. **Network is fine:** `wget` from container to backend `/health` endpoint works and reports `database: ok` (26ms).
2. **Switching Connection Mode didn't help:** Moving from Transaction Pooler (6543) to Direct (5432) changed nothing.
3. **The "Hanging" nature:**
   - It feels like a "silent drop" or a deadlock.
   - `prisma.user.findUnique` in `createContext` is the most likely culprit for global slowness.
   - Since `/health` works (which does `SELECT 1` or similar simple check), but actual data queries hang, could it be related to **MTU / Packet Fragmentation**?
   - **Docker MTU issue?** Docker network default MTU is 1500. Some VDS/VPN providers use smaller MTU (e.g., WireGuard uses 1420). If query results are large (SSL handshake or data packet), they might be dropped silently if DF (Don't Fragment) bit is set.

## Questions for DeepThink
1. Why would Prisma queries hang indefinitely while simple connection checks pass?
2. Could this be an MTU issue with Docker + Supabase SSL? How to verify/fix?
3. Is there a known issue with Prisma 7 and Supabase Auth (RLS, schemas)?
4. What specific low-level diagnostics (tcpdump, trace) should be run inside the container to identify where the packet is lost?
