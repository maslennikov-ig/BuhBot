# Implementation Plan: Onboarding & Real-Time Dashboard

**Branch**: `005-onboarding-dashboard` | **Date**: 2025-11-25 | **Spec**: [/specs/005-onboarding-dashboard/spec.md](specs/005-onboarding-dashboard/spec.md)
**Input**: Feature specification from `/specs/005-onboarding-dashboard/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement a guided onboarding wizard for new users (Bot Token, Working Hours, SLA) and a real-time dashboard powered by live database queries. Also includes polishing the authentication UI and adding Settings/Legal pages.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js 20+)
**Primary Dependencies**: Next.js 16 (App Router), tRPC v11, Prisma 7, Tailwind CSS 4, Framer Motion
**Storage**: PostgreSQL (via Supabase), Redis (optional for caching, likely not needed for MVP)
**Testing**: Vitest (Unit/Integration), Playwright (E2E - optional for this phase)
**Target Platform**: Web (Modern Browsers)
**Project Type**: Web application (Full-stack Monorepo)
**Performance Goals**: Dashboard widgets load < 2s
**Constraints**: Must match existing "Premium" design system (Aurora gradients)
**Scale/Scope**: Single-tenant view per user (Admin Panel context)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Library-First
- **Status**: Pass
- **Check**: Feature uses existing libraries (Prisma, tRPC routers) and adds new modular components (OnboardingWizard, AnalyticsRouter).

### II. CLI Interface
- **Status**: Pass
- **Check**: N/A for this UI-heavy feature, but backend logic is testable via tRPC procedures.

### III. Test-First (NON-NEGOTIABLE)
- **Status**: Pass
- **Check**: Plan includes defining tRPC contracts and component props before implementation.

### IV. Integration Testing
- **Status**: Pass
- **Check**: Integration tests required for:
    - Onboarding flow (state transitions).
    - Analytics queries (accuracy against known dataset).

### V. Observability
- **Status**: Pass
- **Check**: Standard logging for API errors and onboarding failures.

## Project Structure

### Documentation (this feature)

```text
specs/005-onboarding-dashboard/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── api/trpc/routers/
│   │   ├── analytics.ts        # NEW: Real-time dashboard queries
│   │   ├── settings.ts         # UPDATE: Add wizard-related mutations
│   │   └── auth.ts             # UPDATE: Onboarding status check
│   └── services/
│       └── telegram/           # UPDATE: Token validation logic
└── prisma/schema.prisma        # UPDATE: Onboarding fields

frontend/
├── src/
│   ├── app/
│   │   ├── (auth)/login/       # UPDATE: Premium UI
│   │   ├── dashboard/          # UPDATE: Connect real data
│   │   ├── onboarding/         # NEW: Wizard page
│   │   └── settings/           # NEW: Settings page
│   ├── components/
│   │   ├── onboarding/         # NEW: Wizard steps
│   │   ├── dashboard/          # UPDATE: Widgets with data fetching
│   │   └── settings/           # NEW: Settings forms
│   └── lib/api/                # tRPC hooks (auto-generated)
```

**Structure Decision**: Standard Next.js App Router structure with tRPC backend.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |