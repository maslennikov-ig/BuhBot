# Implementation Plan: Telegram Login Integration

**Branch**: `006-telegram-login` | **Date**: 2025-11-27 | **Spec**: [specs/006-telegram-login/spec.md](../spec.md)
**Input**: Feature specification from `/specs/006-telegram-login/spec.md`

## Summary

Integrate official Telegram Login Widget to securely link Telegram accounts to existing system users.
**Key Tech**: Telegram Widget (frontend), HMAC-SHA256 verification (backend), Prisma schema update (store telegram_id), tRPC mutations.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js 20+)
**Primary Dependencies**:

- Backend: `@trpc/server`, `zod`, `crypto` (built-in), `prisma`
- Frontend: `@trpc/client`, `react`, `next`
  **Storage**: PostgreSQL (via Prisma)
  **Testing**: `vitest` (Backend & Frontend)
  **Target Platform**: Web (Next.js App Router)
  **Project Type**: Full-stack Web Application (Next.js + Express/Node Backend)
  **Performance Goals**: Verification < 200ms
  **Constraints**: Security critical (must verify hash), 24h expiry for auth data.
  **Scale/Scope**: Single feature, affects User model and Profile page.

## Constitution Check

_GATE: Passed._ (Standard Best Practices assumed)

## Project Structure

### Documentation (this feature)

```text
specs/006-telegram-login/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (tRPC routers - conceptual)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── modules/
│   │   └── user/            # Update user service/controller
│   └── trpc/
│       └── routers/         # Add/Update user router
└── prisma/
    └── schema.prisma        # Update User model

frontend/
├── src/
│   ├── app/
│   │   └── (dashboard)/
│   │       └── settings/    # Profile settings page
│   └── components/
│       └── telegram/        # Telegram Login Widget component
```

**Structure Decision**: Option 2: Web application (frontend + backend).

## Complexity Tracking

N/A
