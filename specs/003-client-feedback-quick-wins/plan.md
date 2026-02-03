# Implementation Plan: Client Feedback & Quick Wins

**Branch**: `003-client-feedback-quick-wins` | **Date**: 2025-11-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature spec from `/specs/003-client-feedback-quick-wins/spec.md`

**Note**: Template filled by `/speckit.plan` command.

## Summary

Implement quarterly client satisfaction surveys with role-based access (managers see full data, accountants see aggregates), low-rating alerts, and productivity tools (inline client menu, template library, auto-file confirmation, FAQ auto-responses). Leverages existing BullMQ queues for scheduling, Telegraf bot for Telegram interactions, and tRPC for type-safe API.

## Technical Context

**Language/Version**: TypeScript 5.7.x (strict mode), Node.js 20.x LTS
**Primary Dependencies**: Telegraf 4.16.x, BullMQ 5.x, tRPC 11.x, Prisma 7.x, Next.js 16.x
**Storage**: PostgreSQL 15+ (Supabase Cloud), Redis 7.x (BullMQ queues)
**Testing**: Vitest (unit/integration)
**Target Platform**: VDS Linux server (FirstVDS.ru)
**Project Type**: Web application (monorepo: backend + frontend)
**Performance Goals**: Survey delivery < 4 hours for 10k clients, alerts < 60s, FAQ < 2s
**Constraints**: 152-ФЗ compliance, 5 retry attempts over 1 hour for failed messages
**Scale/Scope**: ~10k clients, quarterly survey campaigns

## Constitution Check

_GATE: Must pass before Phase 0. Re-check after Phase 1._

| Principle                      | Status   | Notes                                                                           |
| ------------------------------ | -------- | ------------------------------------------------------------------------------- |
| I. Context-First Development   | PASS     | Spec created after reviewing existing Prisma schema, bot handlers, tRPC routers |
| II. Agent-Based Orchestration  | PASS     | Tasks will be delegated to specialized agents                                   |
| III. Test-Driven Development   | DEFERRED | Tests optional unless specified in tasks                                        |
| IV. Atomic Task Execution      | PLANNED  | Each task independently completable and committable                             |
| V. User Story Independence     | PASS     | 8 user stories (P1-P3), each independently testable                             |
| VI. Quality Gates              | PLANNED  | type-check + build required before each commit                                  |
| VII. Progressive Specification | PASS     | Phase 0 (spec) complete, now in Phase 1 (plan)                                  |

**Security Requirements:**

- RLS policies for feedback data (managers see all, accountants see aggregates only)
- No hardcoded credentials
- Supabase Auth for Admin Panel access

## Project Structure

### Documentation (this feature)

```text
specs/003-client-feedback-quick-wins/
├── spec.md           # Feature specification (complete)
├── plan.md           # This file
├── research.md       # Phase 0 output
├── data-model.md     # Phase 1 output
├── quickstart.md     # Phase 1 output
├── contracts/        # Phase 1 output (tRPC routers)
│   ├── feedback.router.md
│   └── survey.router.md
├── checklists/       # Validation checklists
│   └── requirements.md
└── tasks.md          # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
# Web application (frontend + backend)
backend/
├── prisma/
│   └── schema.prisma          # Extend with FeedbackSurvey model
├── src/
│   ├── api/trpc/routers/
│   │   ├── feedback.ts        # NEW: Feedback analytics router
│   │   └── survey.ts          # NEW: Survey management router
│   ├── bot/
│   │   ├── handlers/
│   │   │   ├── survey.handler.ts      # NEW: Survey callback handler
│   │   │   ├── file.handler.ts        # NEW: Auto-file confirmation
│   │   │   ├── faq.handler.ts         # NEW: FAQ auto-response
│   │   │   └── template.handler.ts    # NEW: /template command
│   │   └── keyboards/
│   │       ├── survey.keyboard.ts     # NEW: Survey rating buttons
│   │       └── client-menu.keyboard.ts # NEW: Client inline menu
│   ├── queues/
│   │   ├── survey.queue.ts    # NEW: Survey delivery queue
│   │   └── survey.worker.ts   # NEW: Survey job processor
│   └── services/
│       ├── feedback/
│       │   ├── survey.service.ts      # NEW: Survey campaign logic
│       │   ├── analytics.service.ts   # NEW: NPS/aggregates
│       │   └── alert.service.ts       # Extend for low-rating alerts
│       └── templates/
│           └── variable.service.ts    # NEW: Template variable substitution
└── tests/

frontend/
├── src/
│   ├── app/
│   │   ├── feedback/
│   │   │   └── page.tsx       # NEW: Feedback dashboard
│   │   └── settings/
│   │       └── survey/        # NEW: Survey settings
│   └── components/
│       └── feedback/
│           ├── FeedbackTable.tsx      # NEW: Manager view
│           ├── FeedbackAggregates.tsx # NEW: Accountant view
│           └── NPSWidget.tsx          # NEW: NPS chart
└── tests/
```

**Structure Decision**: Extend existing monorepo structure (backend + frontend). No new packages needed.

## Complexity Tracking

> No Constitution violations identified. Standard feature implementation.

| Violation | Why Needed | Simpler Alternative Rejected |
| --------- | ---------- | ---------------------------- |
| None      | -          | -                            |
