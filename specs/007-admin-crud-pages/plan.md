# Implementation Plan: Admin Panel CRUD Pages & Polish

**Branch**: `007-admin-crud-pages` | **Date**: 2025-11-27 | **Spec**: [specs/007-admin-crud-pages/spec.md](../spec.md)
**Input**: Feature specification from `/specs/007-admin-crud-pages/spec.md`

## Summary

Implement missing Admin Panel UI pages for FAQ, Templates, and User management using the new Premium Design System (Glassmorphism, Framer Motion). Fix broken sidebar navigation links and add placeholders for future features.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js 20+)
**Primary Dependencies**:

- Backend: `@trpc/server`, `zod`, `prisma`
- Frontend: `@trpc/client`, `react-hook-form`, `framer-motion`, `lucide-react`
  **Storage**: PostgreSQL (via Prisma)
  **Target Platform**: Web (Next.js App Router)
  **Project Type**: Full-stack Web Application
  **Performance Goals**: Page load < 1s, UI interactions < 100ms
  **Constraints**: Must strictly follow `frontend/STYLE-GUIDE.md` visual patterns.
  **Scale/Scope**: Internal admin tool, low traffic volume.

## Constitution Check

_GATE: Passed._ (Standard Best Practices assumed)

## Project Structure

### Documentation (this feature)

```text
specs/007-admin-crud-pages/
├── plan.md              # This file
├── research.md          # Phase 0 output (Minimal needed)
├── data-model.md        # Phase 1 output (Visualizing existing schema)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (tRPC routers - existing + needed)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
backend/
├── src/
│   └── api/trpc/routers/ # Verify/Update auth.ts for role updates
frontend/
├── src/
│   ├── app/
│   │   └── settings/
│   │       ├── faq/         # NEW
│   │       ├── templates/   # NEW
│   │       └── users/       # NEW
│   └── components/
│       └── admin/           # New CRUD components
```

## Complexity Tracking

N/A
