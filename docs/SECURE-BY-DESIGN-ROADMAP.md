# Secure-by-Design Roadmap

**Project:** BuhBot  
**Version:** 1.2
**Effective Date:** February 21, 2026  
**Last Updated:** February 22, 2026  
**Status:** Active

---

## Executive Summary

Following the remediation effort completed **February 17, 2026** (commit [`b443db66`](https://github.com/aidevteam-labs/BuhBot/commit/b443db66b6eedcace5b127d59482dfc10e55c59c)), BuhBot has transitioned from reactive to proactive security.

#### Journey Summary

| Phase | Period | Issues Found | Issues Resolved |
|-------|--------|--------------|-----------------|
| Initial Audit | Nov 2024 | 77 total (8 Critical, 16 High, 30 Medium, 23 Low) | 0 |
| Remediation | Feb 2026 | 7 carryover vulnerabilities | 7 resolved |
| Current Assessment | Feb 2026 | 1 Medium, 7 Low | In progress |

#### Key Milestone: February 17, 2026

All 7 previously identified vulnerabilities have been confirmed as resolved:

| Issue ID | Description | Status |
|----------|-------------|--------|
| GH-185 | Observer role could access all chats | ✅ RESOLVED |
| GH-111 | Race condition in chat updates | ✅ RESOLVED |
| GH-127 | TLS verification bypass risk | ✅ RESOLVED |
| GH-117 | Rate limit race condition | ✅ RESOLVED |
| GH-97 | Rate limit fail-open | ✅ RESOLVED |
| GH-93 | Non-atomic data deletion | ✅ RESOLVED |
| GH-73 | Classification feedback validation | ✅ RESOLVED |

### Vision: Security Embedded in Development Lifecycle

Security is integrated at each stage: **Design** (threat modeling) → **Develop** (secure coding) → **Test** (security testing) → **Deploy** (security gates) → **Monitor** (security monitoring) → **Improve** (security feedback).

---

## 1. Security Practices

As a small-team project (1-2 developers), BuhBot maintains security awareness through:
- Documented secure coding patterns in this roadmap and assessment reports
- Pre-commit hooks enforcing code quality (ESLint, Prettier, commitlint)
- Periodic security assessments (bi-annual target)
- Code review on all pull requests

---

## 2. Architectural Changes Implemented

### 2.1 Authentication Architecture

**Auth flow:** Frontend (Next.js) sends JWT → Backend (tRPC) validates via Supabase Auth → RBAC enforcement via `authedProcedure` / `managerProcedure` / `adminProcedure` middleware.

#### Components

| Component | Implementation | Location | Security Features |
|-----------|----------------|----------|-------------------|
| JWT Validation | Supabase Auth | [`context.ts`](../backend/src/api/trpc/context.ts) | Token extraction, expiry check |
| RBAC | tRPC Middleware | [`trpc.ts`](../backend/src/api/trpc/trpc.ts) | Three-tier access control |
| Observer Restriction | Authorization Helper | [`authorization.ts`](../backend/src/api/trpc/authorization.ts) | Chat-scoped access |
| Telegram Login Widget | HMAC-SHA256 | [`auth.service.ts`](../backend/src/services/telegram/auth.service.ts) | Widget verification, timing-safe comparison |
| Telegram Webhook | Secret Token comparison | [`telegram-signature.ts`](../backend/src/middleware/telegram-signature.ts) | Constant-time `safeCompare()`, fail-closed |

#### RBAC Authorization Matrix

| Role | Chats | Requests | Settings | Analytics | Users |
|------|-------|----------|----------|-----------|-------|
| Admin | Full | Full | Full | Full | Full |
| Manager | Assigned | Assigned | Read | Full | Read |
| Observer | Assigned Only | Assigned Only | None | Limited | None |

### 2.2 Defense in Depth Strategy

BuhBot implements four defense layers: **Network** (TLS, rate limiting, webhook signatures) → **Application** (tRPC auth, Zod validation) → **Database** (RLS, Prisma ORM) → **Data** (encryption at rest, retention, audit logging).

#### Layer Implementation Details

| Layer | Control | Implementation | Status |
|-------|---------|----------------|--------|
| Network | TLS | Enforced for all connections | ✅ Active |
| Network | Rate Limiting | Multi-layer: Redis (bot), Nginx (HTTP), in-memory (API) | ✅ Active |
| Network | Webhook Signature | Constant-time comparison | ✅ Active |
| Application | Authentication | JWT + Supabase Auth | ✅ Active |
| Application | Authorization | Three-tier RBAC | ✅ Active |
| Application | Input Validation | Zod schemas on all procedures | ✅ Active |
| Database | SQL Injection Prevention | Prisma ORM + parameterized queries | ✅ Active |
| Database | Row-Level Security | RLS policies on sensitive tables | ✅ Active |
| Data | Audit Trail | Request history, error capture | ✅ Active |
| Data | Data Retention | Configurable retention with cleanup | ✅ Active |

### 2.3 API Security Patterns

#### Telegram Webhook Security

```typescript
// Implementation in middleware/telegram-signature.ts
// Telegram sends the configured secret as X-Telegram-Bot-Api-Secret-Token header
// Constant-time comparison prevents timing attacks
const receivedToken = req.headers['x-telegram-bot-api-secret-token'];

if (!receivedToken || !safeCompare(receivedToken, secret)) {
  res.status(401).json({ error: 'Unauthorized', code: 'INVALID_WEBHOOK_SIGNATURE' });
  return;
}
```

#### Rate Limiting Implementation

| Component | Algorithm | Storage | Default Limit | Failure Mode |
|-----------|-----------|---------|---------------|-------------|
| Bot middleware (Telegraf) | Sliding Window (ZADD before ZCARD) | Redis ZSET | 30 req/min | Fail-closed (deny on Redis error) |
| HTTP API (Nginx) | Fixed window (`limit_req_zone`) | Nginx shared memory | Configurable | 429 response |
| Express middleware | Fixed window | In-memory Map | Configurable | N/A (single instance) |
| Telegram link auth | Sliding window | In-memory Map | Per-user | N/A (single instance) |

### 2.4 Queue and Job Security

#### BullMQ Security Configuration

| Setting | Value | Purpose |
|---------|-------|---------|
| Exponential Backoff | Enabled | Prevents thundering herd |
| Job Retention (Completed) | 100 jobs | Limits data exposure |
| Job Retention (Failed) | 1000 jobs | Forensic analysis |
| Graceful Shutdown | 30s timeout | Clean job completion |
| Concurrency | Single for retention | Prevents overlap |

### 2.5 Docker and Deployment Security

#### Container Hardening

| Control | Frontend | Backend | Purpose |
|---------|----------|---------|---------|
| Non-root User | nextjs:1001 | nodejs:1001 | Privilege limitation |
| Multi-stage Build | Yes | Yes | Attack surface reduction |
| Health Check | HTTP /api/health | HTTP /health | Availability monitoring |
| Signal Handling | dumb-init | dumb-init | Graceful shutdown |
| Dependencies | Production only | Production only | Minimal attack surface |

---

## 3. Implementation Phases

### Phase Overview

| Phase | Timeline | Focus | Status |
|-------|----------|-------|--------|
| Phase 0: Foundation | Feb 2026 | Remediation of critical/high vulnerabilities | **COMPLETE** |
| Phase 0.5: Post-Assessment | Feb 2026 | Address post-assessment findings | **COMPLETE** |
| Phase 1: Enhancement | Q2 2026 | Address medium/low findings | Planned |
| Phase 2: Automation | Q3 2026 | CI/CD security gates, SAST, secret scanning | Planned |
| Phase 3: Maturity | Q4 2026 | Documentation audit, assessment follow-up | Planned |
| Phase 4: Excellence | 2027+ | Future consideration if project scales | Deferred |

### Phase 0: Foundation (COMPLETED - February 17, 2026)

All critical and high-severity vulnerabilities remediated, secure architecture baseline established.

#### Completed Actions

| Action | Status | Evidence |
|--------|--------|----------|
| Observer role restriction | ✅ Complete | [`authorization.ts`](../backend/src/api/trpc/authorization.ts) |
| Race condition fixes | ✅ Complete | SELECT FOR UPDATE in [`chats.ts`](../backend/src/api/trpc/routers/chats.ts) |
| TLS enforcement | ✅ Complete | Never disabled in production |
| Rate limit race condition | ✅ Complete | Pipeline atomic in [`rate-limit.ts`](../backend/src/bot/middleware/rate-limit.ts) |
| Rate limit fail-closed | ✅ Complete | Deny on Redis error |
| Atomic data deletion | ✅ Complete | Transaction-based in [`data-retention.job.ts`](../backend/src/jobs/data-retention.job.ts) |
| Input validation | ✅ Complete | Zod validation on all procedures |

#### Deliverables

| Deliverable | Location | Status |
|-------------|----------|--------|
| Security Assessment (Full Stack) | [`SECURITY-ASSESSMENT.md`](./reports/security/2026-02-21/SECURITY-ASSESSMENT.md) | ✅ Complete |
| Archived Audit Reports | [`archive/reports/security/2026-02-16/`](./archive/reports/security/2026-02-16/) | ✅ Complete |
| Remediation Commit | `b443db66b6eedcace5b127d59482dfc10e55c59c` | ✅ Complete |

### Phase 0.5: Post-Assessment Updates (February 22, 2026)

#### Completed Improvements

The following security-relevant changes were implemented after the February 21, 2026 assessment:

| Commit | Change | Security Impact | Status |
|--------|--------|-----------------|--------|
| `aa78ca4` | Fixed Winston logger BigInt format | **Audit logging restored** - logs were being silently discarded | ✅ Complete |
| `e48bc88` | Added EmptyResponseError for retry | Improved classifier resilience, better error handling | ✅ Complete |
| `3daf71a` | Changed default AI model | Model changed to `xiaomi/mimo-v2-flash` - review data policies | ⚠️ Review needed |
| `958a932` | CI concurrency fix + feature branch workflow | Improved CI reliability, better branch protection enforcement | ✅ Complete |

**Action required:** Verify xiaomi/mimo data handling policies (model changed to `xiaomi/mimo-v2-flash`). Add logging smoke test to deployment verification.

**Updated findings:** L-03 partially addressed (backend logging now functional). Audit logging issue fixed.

### Phase 1: Enhancement (Q2 2026)

Address remaining findings (see [Section 6: Risk Register](#6-risk-register) for full details).

#### Phase 1 Action Items

| Task | Success Criteria | Dependencies |
|------|------------------|--------------|
| Implement random DEV_MODE tokens | Tokens unique per session | None |
| Add DEV_MODE startup warning | Warning logged on startup | None |
| Reduce config cache TTL to 2 min | TTL configurable, default 2 min | None |
| Replace console.error with error tracking | Errors tracked centrally | Error tracking setup |
| Remove `continue-on-error` from audit | CI fails on critical findings | None |
| Add audit result comment to PR | Findings visible in PR | CI workflow update |

### Phase 2: Automation (Q3 2026)

#### Objectives
- Implement CI/CD security gates
- Deploy SAST/DAST tooling
- Automate dependency vulnerability management

**Target pipeline:** Commit → Build → Test → Security Scan (SAST, dependency scan, secret detection, container scan, DAST) → Deploy. Gate: block on Critical/High findings.

#### Phase 2 Action Items

| Task | Success Criteria | Dependencies |
|------|------------------|--------------|
| Integrate SAST tool (CodeQL or Semgrep) | Runs in CI on every PR | Tool selection |
| Configure secret scanning (Gitleaks) | Blocks PRs with secrets | None |
| Add container scanning (Trivy) | Runs in build pipeline | Docker setup |
| Enable Dependabot | Auto PRs for vulnerabilities | GitHub config |

### Phase 3: Maturity (Q4 2026)

#### Objectives
- Validate security posture through documentation review
- Address findings from assessments

#### Phase 3 Action Items

| Task | Success Criteria | Dependencies |
|------|------------------|--------------|
| Security documentation audit | All docs current, complete | None |
| Address assessment findings | All Critical/High resolved | Assessment complete |

### Phase 4: Excellence (2027+)

Future consideration if project scales significantly. Focus on maintaining Phase 2 automation and keeping dependencies updated.

---

## 4. Actionable Implementation Steps

### 4.1 Immediate Actions (Next 30 Days)

| Priority | Task | Effort | Status |
|----------|------|--------|--------|
| P1 | Implement M-01 (DEV_MODE token randomization) | 2h | Pending |
| P1 | Add DEV_MODE startup warning (L-01) | 1h | Pending |
| P2 | Reduce config cache TTL (L-02) | 1h | Pending |
| P2 | Setup frontend error tracking (L-03) | 4h | Pending |
| P2 | Remove audit continue-on-error (L-05) | 1h | Pending |

### 4.2 Short-term Actions (Next 90 Days)

| Priority | Task | Effort | Status |
|----------|------|--------|--------|
| P1 | Integrate SAST in CI (CodeQL or Semgrep) | 8h | Pending |
| P1 | Configure secret scanning (Gitleaks) | 4h | Pending |
| P2 | Add container scanning (Trivy) | 4h | Pending |
| P2 | Enable Dependabot | 2h | Pending |

### 4.3 Development Lifecycle Integration

**PR Security Checklist** (add to PR template):
- [ ] Input validation added/verified
- [ ] Authentication/Authorization checked
- [ ] No secrets in code
- [ ] Dependency changes reviewed

**Security Gates** (target for Phase 2):

| Gate | Stage | Blocking Condition |
|------|-------|--------------------|
| SAST | PR | Critical finding |
| Dependency Scan | PR | Critical vulnerability |
| Secret Scan | PR | Any finding (hard block) |
| Container Scan | Build | Critical vulnerability |

---

## 5. Current Security Status

| Domain | Status |
|--------|--------|
| Authentication & Authorization | Strong (JWT + RBAC + RLS) |
| Input Validation | Excellent (Zod on all endpoints) |
| Data Protection | Strong (encryption, retention, audit logging) |
| Monitoring | Basic (Prometheus metrics, error capture) |
| CI/CD Security | Strong (approval gates, secret management) |

### Compliance Checklist

| Requirement | Status | Evidence | Review Date |
|-------------|--------|----------|-------------|
| Authentication required | ✅ | All tRPC procedures | Feb 2026 |
| Role-based access control | ✅ | Three-tier RBAC | Feb 2026 |
| Input validation | ✅ | Zod schemas | Feb 2026 |
| SQL injection prevention | ✅ | Prisma ORM | Feb 2026 |
| XSS prevention | ✅ | React auto-escaping | Feb 2026 |
| CSRF protection | ✅ | SameSite cookies | Feb 2026 |
| Rate limiting | ✅ | Multi-layer: Redis + Nginx + in-memory | Feb 2026 |
| Secrets management | ✅ | Environment variables | Feb 2026 |
| Error handling | ✅ | Generic messages | Feb 2026 |
| Audit logging | ✅ | Request history | Feb 2026 |
| Data retention | ✅ | Configurable cleanup | Feb 2026 |
| TLS in production | ✅ | Enforced | Feb 2026 |
| Docker security | ✅ | Non-root users | Feb 2026 |
| CI/CD security | ✅ | Approval gates | Feb 2026 |

---

## 6. Risk Register

### 6.1 Remaining Risks

#### Medium Severity

| ID | Risk | Description | Likelihood | Impact | Risk Score |
|----|------|-------------|------------|--------|------------|
| M-01 | DEV_MODE Token Predictability | Static token could be exploited in misconfigured environments | Low | Medium | Medium |

#### Low Severity

| ID | Risk | Description | Likelihood | Impact | Risk Score |
|----|------|-------------|------------|--------|------------|
| L-01 | DEV_MODE Warning Missing | Developers may not notice DEV_MODE is active | Low | Low | Low |
| L-02 | Config Cache Staleness | 5-minute cache may cause temporary inconsistency | Medium | Low | Low |
| L-03 | Console Error Logging | Information leakage in browser console | Low | Low | Low |
| L-04 | Supabase Anon Key Exposure | Key visible to clients (by design) | N/A | N/A | Informational |
| L-05 | Audit Continue-on-Error | CI may pass with vulnerabilities | Medium | Low | Low |
| L-06 | Telegram CI Secrets | Secrets used in CI notifications | Low | Low | Low |
| L-07 | TypeScript Build Tolerance | Build continues on type errors | Low | Low | Low |

### 6.2 Mitigation Strategies

| Risk ID | Mitigation Strategy | Target Date | Status |
|---------|---------------------|-------------|--------|
| M-01 | Implement random session tokens | Q2 2026 | Planned |
| L-01 | Add startup warning banner | Q2 2026 | Planned |
| L-02 | Reduce cache TTL to 2 minutes | Q2 2026 | Planned |
| L-03 | Integrate error tracking for frontend | Q2 2026 | Partially Complete |
| L-04 | Accept (RLS protects data) | N/A | Accepted |
| L-05 | Remove continue-on-error | Q2 2026 | Planned |
| L-06 | Accept (GitHub secrets properly used) | N/A | Accepted |
| L-07 | Accept (CI catches type errors) | N/A | Accepted |
| **New** | Verify xiaomi/mimo data policies | Mar 2026 | Pending |
| **New** | Add logging smoke test | Mar 2026 | Pending |

---

## 7. References

### 7.1 Security Assessment Reports

| Report | Date | Location |
|--------|------|----------|
| Security Assessment (Full Stack) | Feb 21, 2026 | [`SECURITY-ASSESSMENT.md`](./reports/security/2026-02-21/SECURITY-ASSESSMENT.md) |
| Original Security Audit | Feb 16, 2026 | [`archive/reports/security/2026-02-16/`](./archive/reports/security/2026-02-16/) |

### 7.2 Key Security Files

| File | Purpose |
|------|---------|
| [`authorization.ts`](../backend/src/api/trpc/authorization.ts) | Authorization helpers |
| [`trpc.ts`](../backend/src/api/trpc/trpc.ts) | RBAC middleware |
| [`context.ts`](../backend/src/api/trpc/context.ts) | Authentication context |
| [`rate-limit.ts`](../backend/src/bot/middleware/rate-limit.ts) | Rate limiting middleware |
| [`telegram-signature.ts`](../backend/src/middleware/telegram-signature.ts) | Webhook validation |
| [`env.ts`](../backend/src/config/env.ts) | Environment validation |

### 7.3 External Standards

| Standard | Relevance |
|----------|-----------|
| OWASP Top 10 | Web application security baseline |
| OWASP ASVS | Application security verification |
| NIST Cybersecurity Framework | Risk management approach |
| ISO 27001 | Security management system (future target) |

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Feb 21, 2026 | Security Audit Team | Initial release |
| 1.1 | Feb 22, 2026 | Security Audit Team | Added Phase 0.5 post-assessment updates, new risk items for AI model change and logging verification |
| 1.2 | Feb 22, 2026 | Security Audit Team | Trimmed to realistic 1-2 developer project scale: removed enterprise sections (training curriculum, RACI matrix, 5-level maturity model, governance framework, incident response procedures), condensed Phase 3-4, moved compliance checklist to Section 5 |

**Next Review:** May 21, 2026 (quarterly)

---

*This roadmap is a living document and should be updated as security initiatives progress and new requirements emerge.*
