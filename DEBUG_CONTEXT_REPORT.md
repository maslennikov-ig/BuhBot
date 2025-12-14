# Debug Context Report: Persistent Backend Latency & Timeout

**Date:** 2025-12-14
**Status:** Critical / Unresolved
**System:** BuhBot (Node.js 20, Prisma 7, Supabase PG 15, Docker, VDS Ubuntu 24)

## 🚨 The Core Problem
Specific "heavy" database queries (e.g., `user.list` with role filtering) **hang indefinitely** or take 20s+ to fail, while simple checks (`/health` -> `SELECT 1`) execute instantly (26ms).
The frontend shows endless loading or "No users found".

## 🛠️ Environment
- **Server:** VDS Ubuntu 24.04 (IP: 185.200.177.180).
- **Network:** Includes `amnezia-awg` (WireGuard) interface.
- **Database:** Supabase (EU Central). Direct connection (port 5432).
- **Backend:** Docker container `node:20-slim`.
- **ORM:** Prisma v7.0.0.

## 📜 Chronology & Attempts

1.  **Incident:** Detected crypto-miner (`WormBoner`) in frontend container (167% CPU).
    *   *Action:* Container stopped, rebuilt from scratch with security limits (ReadOnly Root, CPU limits).
    *   *Result:* Server load normal, frontend accessible, but DB queries hang.

2.  **Hypothesis: Connection Pooler Conflict**
    *   *Action:* Switched `DATABASE_URL` from Transaction Pooler (6543) to Direct Connection (5432).
    *   *Result:* No change. Hangs persist.

3.  **Hypothesis: Code Bug (Role Filtering)**
    *   *Action:* Updated `user.ts` router to handle array of roles. Added `console.log` debugging.
    *   *Observation:* Logs **do not appear** when frontend requests hang. This implies the request hangs **before** reaching the tRPC router (likely in `createContext` authentication middleware).

4.  **Hypothesis: MTU / Packet Fragmentation (Black Hole)**
    *   *Theory:* Small packets (`/health`) pass, large packets (SSL handshake, user list) dropped by VDS/WireGuard interface (MTU < 1500).
    *   *Action:* Applied `iptables -t mangle -A POSTROUTING -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu`.
    *   *Result:* **Did not fix the issue.**

## 🔍 Current Suspects for Next Session

1.  **IPv6 / Node.js 20 "Happy Eyeballs":**
    *   Node 20 prefers IPv6. If VDS has broken IPv6 routing, it might hang trying to connect to Supabase via IPv6 before falling back.
    *   *To Try:* `NODE_OPTIONS="--dns-result-order=ipv4first"` in docker-compose.

2.  **Prisma 7 Regression:**
    *   Prisma 7 is new. Might have issues with specific OpenSSL versions or Docker environments.

3.  **WireGuard Conflict:**
    *   The presence of `amnezia-awg` might be interfering with Docker networking in unexpected ways beyond just MTU.

4.  **SSL/TLS Handshake Freeze:**
    *   Could be related to MTU but `iptables` didn't catch it, or it's an OpenSSL issue inside the container (Alpine vs Debian). We switched from Alpine to Slim (Debian) recently in Dockerfile cache, check if that matters.

## 📂 Key Files Content

### `backend/src/api/trpc/context.ts` (Likely Hanging Point)
```typescript
export async function createContext({ req }: CreateExpressContextOptions): Promise<Context> {
  // ... extract token ...
  try {
    const { data, error } = await supabase.auth.getUser(token); // Request 1
    // ...
    // Request 2 - SUSPECTED HANG
    const dbUser = await prisma.user.findUnique({ where: { id: data.user.id } }); 
    // ...
  }
}
```

### `infrastructure/docker-compose.prod.yml` (Current Config)
```yaml
  bot-backend:
    image: infrastructure-bot-backend
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:...!@db.rfazttaomelzdiqmtlfr.supabase.co:5432/postgres
```

## 📝 Next Steps
1.  **Force IPv4:** Apply `NODE_OPTIONS="--dns-result-order=ipv4first"`.
2.  **Network Diagnostics:** Run `tcpdump` inside container (or host) to see if packets are being sent/received during the hang.
3.  **Prisma Downgrade (Optional):** If all else fails, try Prisma 5 to rule out v7 bugs.
