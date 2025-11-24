# Implementation Plan: BuhBot Landing Page

**Branch**: `004-landing-page` | **Date**: 2025-11-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature spec from `/specs/004-landing-page/spec.md`

**Note**: Template filled by `/speckit.plan` command.

## Summary

Build a marketing landing page for BuhBot at the root URL (/) with hero section, features, how-it-works, benefits, contact form, and footer. The contact form stores submissions to PostgreSQL via Prisma and sends Telegram notifications via existing Telegraf bot infrastructure. The page replaces the default Next.js template and must be fully responsive with Russian language content.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20.x LTS
**Primary Dependencies**: Next.js 16.x, React 19.x, Tailwind CSS 4.x, shadcn/ui, Zod 3.x, tRPC 11.x
**Storage**: PostgreSQL 15+ (Supabase Cloud) via Prisma 7.x
**Testing**: Vitest 4.x (frontend)
**Target Platform**: Web (responsive 320px-1920px)
**Project Type**: Web application (frontend + backend)
**Performance Goals**: Page load <3s, Lighthouse score 90+
**Constraints**: Russian language only, no authentication required for viewing
**Scale/Scope**: Marketing landing page with lead capture functionality

## Constitution Check

*GATE: Must pass before Phase 0. Re-check after Phase 1.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Context-First Development | PASS | Existing codebase analyzed (Prisma schema, tRPC patterns, frontend structure) |
| II. Agent-Based Orchestration | PASS | Complex tasks will be delegated to specialized subagents |
| III. Test-Driven Development | N/A | Tests not explicitly required in spec; optional for MVP |
| IV. Atomic Task Execution | PASS | Tasks will be atomic and independently committable |
| V. User Story Independence | PASS | 4 user stories identified with P1/P2 priorities |
| VI. Quality Gates | PASS | Type-check and build must pass before commits |
| VII. Progressive Specification | PASS | Following spec → plan → tasks → implement flow |

**Security Requirements:**
- No hardcoded credentials
- Contact form validation (Zod)
- Honeypot spam protection
- Rate limiting consideration for form endpoint

## Project Structure

### Documentation (this feature)

```text
specs/004-landing-page/
├── plan.md          # This file
├── research.md      # Phase 0 output
├── data-model.md    # Phase 1 output
├── quickstart.md    # Phase 1 output
├── contracts/       # Phase 1 output
│   └── contact.ts   # Contact form tRPC contract
├── checklists/      # Quality checklists
│   └── requirements.md
└── tasks.md         # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
# Web application (frontend + backend)
backend/
├── prisma/
│   └── schema.prisma     # Add ContactRequest model
├── src/
│   └── api/trpc/routers/
│       └── contact.ts    # New contact router
│
frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Landing page (replace default)
│   │   └── login/page.tsx        # Login page (new route)
│   ├── components/
│   │   └── landing/              # Landing page components
│   │       ├── Header.tsx        # Navigation header
│   │       ├── Hero.tsx          # Hero section
│   │       ├── Features.tsx      # Features grid
│   │       ├── HowItWorks.tsx    # Steps section
│   │       ├── Benefits.tsx      # Stats/benefits section
│   │       ├── ContactForm.tsx   # Contact form
│   │       └── Footer.tsx        # Footer section
│   └── lib/
│       └── actions/
│           └── contact.ts        # Form submission action
```

**Structure Decision**: Use existing frontend/backend monorepo structure. Landing components go in `frontend/src/components/landing/`. New tRPC router `contact` for form submission.

## Complexity Tracking

> No constitution violations - all principles followed.

*No entries needed.*
