# Tasks: SLA Monitoring System

**Input**: Design documents from `/specs/002-sla-monitoring/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are OPTIONAL - not explicitly requested in spec. TDD deferred.

**Organization**: Tasks grouped by user story (P1 first, then P2). Each story independently testable.

## Format: `[ID] [P?] [Story] Description [EXECUTOR: name]`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US6)
- **[EXECUTOR]**: Agent responsible for the task
- Paths: `backend/src/`, `frontend/src/` (monorepo structure)

---

## Phase 0: Planning

**Purpose**: Prepare for implementation by analyzing requirements, creating necessary agents, and assigning executors.

- [X] P001 Analyze all tasks and identify required agent types and capabilities [EXECUTOR: MAIN]
- [X] P002 Create missing agents using meta-agent-v3 [EXECUTOR: meta-agent-v3]
  → Artifacts: [sla-backend-specialist](.claude/agents/development/workers/sla-backend-specialist.md), [ai-classifier-specialist](.claude/agents/development/workers/ai-classifier-specialist.md)
- [X] P003 Assign executors to all tasks [EXECUTOR: MAIN]
- [X] P004 Resolve research tasks: all research completed in research.md [EXECUTOR: MAIN]

**Agents Created**:
- `sla-backend-specialist` - SLA services, Telegram bot handlers, BullMQ queues/workers, alerts
- `ai-classifier-specialist` - OpenRouter API, keyword classifier, cache service

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, dependencies, and folder structure

- [X] T001 Install backend dependencies (date-fns, date-fns-tz) in backend/package.json [EXECUTOR: MAIN] [SEQUENTIAL]
  → Artifacts: [package.json](backend/package.json)
- [X] T002 [P] Create backend directory structure in backend/src/bot/, backend/src/services/, backend/src/queues/, backend/src/api/ [EXECUTOR: MAIN] [PARALLEL-GROUP-1]
  → Artifacts: directories created
- [X] T003 [P] Create frontend directory structure in frontend/src/app/dashboard/, frontend/src/app/chats/, frontend/src/app/settings/ [EXECUTOR: MAIN] [PARALLEL-GROUP-1]
  → Artifacts: directories created
- [X] T004 [P] Configure Vitest for backend in backend/vitest.config.ts [EXECUTOR: MAIN] [PARALLEL-GROUP-1]
  → Artifacts: [vitest.config.ts](backend/vitest.config.ts)
- [X] T005 [P] Add tRPC client setup in frontend/src/lib/trpc.ts [EXECUTOR: MAIN] [PARALLEL-GROUP-1]
  → Artifacts: [trpc.ts](frontend/src/lib/trpc.ts), [trpc-provider.tsx](frontend/src/lib/trpc-provider.tsx), [trpc.d.ts](frontend/types/trpc.d.ts)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**CRITICAL**: No user story work can begin until this phase is complete

### Database Schema Extension

- [X] T006 Add new enums (MessageClassification, AlertDeliveryStatus, AlertAction) to backend/prisma/schema.prisma [EXECUTOR: database-architect] [SEQUENTIAL]
- [X] T007 Extend Chat model with SLA fields in backend/prisma/schema.prisma [EXECUTOR: database-architect] [SEQUENTIAL]
- [X] T008 Extend ClientRequest model with classification and SLA fields in backend/prisma/schema.prisma [EXECUTOR: database-architect] [SEQUENTIAL]
- [X] T009 Extend SlaAlert model with delivery and escalation fields in backend/prisma/schema.prisma [EXECUTOR: database-architect] [SEQUENTIAL]
- [X] T010 Extend WorkingSchedule model with timezone field in backend/prisma/schema.prisma [EXECUTOR: database-architect] [SEQUENTIAL]
- [X] T011 [P] Create GlobalSettings model in backend/prisma/schema.prisma [EXECUTOR: database-architect] [PARALLEL-GROUP-2]
- [X] T012 [P] Create GlobalHoliday model in backend/prisma/schema.prisma [EXECUTOR: database-architect] [PARALLEL-GROUP-2]
- [X] T013 [P] Create ChatHoliday model in backend/prisma/schema.prisma [EXECUTOR: database-architect] [PARALLEL-GROUP-2]
- [X] T014 [P] Create ClassificationCache model in backend/prisma/schema.prisma [EXECUTOR: database-architect] [PARALLEL-GROUP-2]
- [X] T015 Generate and run Prisma migration in backend/prisma/migrations/ [EXECUTOR: database-architect] [SEQUENTIAL]
  → Artifacts: [schema.prisma](backend/prisma/schema.prisma), [migration](backend/prisma/migrations/20251122215631_add_sla_monitoring_schema/)

### Core Services Foundation

- [X] T016 Create working hours calculator in backend/src/services/sla/working-hours.service.ts [EXECUTOR: sla-backend-specialist] [SEQUENTIAL]
  → Artifacts: [working-hours.service.ts](backend/src/services/sla/working-hours.service.ts)
- [X] T017 [P] Create keyword-based classifier (fallback) in backend/src/services/classifier/keyword-classifier.ts [EXECUTOR: ai-classifier-specialist] [PARALLEL-GROUP-3]
- [X] T018 [P] Create OpenRouter API client in backend/src/services/classifier/openrouter-client.ts [EXECUTOR: ai-classifier-specialist] [PARALLEL-GROUP-3]
- [X] T019 Create message classifier service in backend/src/services/classifier/classifier.service.ts (depends on T017, T018) [EXECUTOR: ai-classifier-specialist] [SEQUENTIAL]
- [X] T020 [P] Create classification cache service in backend/src/services/classifier/cache.service.ts [EXECUTOR: ai-classifier-specialist] [PARALLEL-GROUP-3]
  → Artifacts: [classifier/](backend/src/services/classifier/)
- [X] T021 Create BullMQ queue setup in backend/src/queues/setup.ts [EXECUTOR: sla-backend-specialist] [SEQUENTIAL]
  → Artifacts: [setup.ts](backend/src/queues/setup.ts)

### tRPC Infrastructure

- [X] T022 Create tRPC context and router base in backend/src/api/trpc.ts [EXECUTOR: MAIN] [SEQUENTIAL]
  → Artifacts: Already exists at [trpc.ts](backend/src/api/trpc/trpc.ts)
- [X] T023 [P] Implement settings.router in backend/src/api/routers/settings.router.ts (from contracts/settings.router.ts) [EXECUTOR: database-architect] [PARALLEL-GROUP-4]
  → Artifacts: [settings.ts](backend/src/api/trpc/routers/settings.ts)
- [X] T024 [P] Seed GlobalSettings and Russian holidays in backend/prisma/seed.ts [EXECUTOR: database-architect] [PARALLEL-GROUP-4]
  → Artifacts: [seed.ts](backend/prisma/seed.ts)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Client Sends Request (Priority: P1) MVP

**Goal**: System receives client message, classifies it, and starts SLA timer if REQUEST

**Independent Test**: Send "Где мой счёт?" to bot, verify SLA timer starts within 5 seconds

### Implementation for User Story 1

- [ ] T025 [US1] Create Telegraf bot instance in backend/src/bot/bot.ts [EXECUTOR: sla-backend-specialist] [SEQUENTIAL]
- [ ] T026 [US1] Implement message handler in backend/src/bot/handlers/message.handler.ts [EXECUTOR: sla-backend-specialist] [SEQUENTIAL]
- [ ] T027 [US1] Create SLA timer service in backend/src/services/sla/timer.service.ts [EXECUTOR: sla-backend-specialist] [SEQUENTIAL]
- [ ] T028 [US1] Create SLA timer BullMQ queue in backend/src/queues/sla-timer.queue.ts [EXECUTOR: sla-backend-specialist] [SEQUENTIAL]
- [ ] T029 [US1] Create SLA timer worker in backend/src/queues/sla-timer.worker.ts [EXECUTOR: sla-backend-specialist] [SEQUENTIAL]
- [ ] T030 [US1] Implement sla.router createRequest procedure in backend/src/api/routers/sla.router.ts [EXECUTOR: api-builder] [SEQUENTIAL]
- [ ] T031 [US1] Implement sla.router classifyMessage procedure in backend/src/api/routers/sla.router.ts [EXECUTOR: api-builder] [SEQUENTIAL]
- [ ] T032 [US1] Implement sla.router startTimer procedure in backend/src/api/routers/sla.router.ts [EXECUTOR: api-builder] [SEQUENTIAL]
- [ ] T033 [US1] Add webhook setup for Telegram bot in backend/src/bot/webhook.ts [EXECUTOR: sla-backend-specialist] [SEQUENTIAL]
- [ ] T034 [US1] Wire message flow: receive → classify → create request → start timer in backend/src/bot/handlers/message.handler.ts [EXECUTOR: sla-backend-specialist] [SEQUENTIAL]

**Checkpoint**: Client can send message, system classifies and starts SLA timer (FR-001 to FR-010)

---

## Phase 4: User Story 2 - Accountant Responds (Priority: P1)

**Goal**: Detect accountant response, stop SLA timer, calculate working hours response time

**Independent Test**: After client request, send response as accountant, verify timer stops

### Implementation for User Story 2

- [ ] T035 [US2] Create response detection handler in backend/src/bot/handlers/response.handler.ts [EXECUTOR: sla-backend-specialist] [SEQUENTIAL]
- [ ] T036 [US2] Implement SLA timer stop logic in backend/src/services/sla/timer.service.ts [EXECUTOR: sla-backend-specialist] [SEQUENTIAL]
- [ ] T037 [US2] Calculate working hours response time in backend/src/services/sla/working-hours.service.ts [EXECUTOR: sla-backend-specialist] [SEQUENTIAL]
- [ ] T038 [US2] Create request management service in backend/src/services/sla/request.service.ts (CRUD operations for ClientRequest) [EXECUTOR: sla-backend-specialist] [SEQUENTIAL]
- [ ] T039 [US2] Implement sla.router stopTimer procedure in backend/src/api/routers/sla.router.ts [EXECUTOR: api-builder] [SEQUENTIAL]
- [ ] T040 [US2] Update ClientRequest status on response in backend/src/services/sla/request.service.ts [EXECUTOR: sla-backend-specialist] [SEQUENTIAL]
- [ ] T041 [US2] Handle edge case: response outside working hours in backend/src/services/sla/timer.service.ts [EXECUTOR: sla-backend-specialist] [SEQUENTIAL]

**Checkpoint**: Accountant response stops timer, calculates accurate response time (FR-014, FR-015)

---

## Phase 5: User Story 3 - Manager Receives SLA Alert (Priority: P1)

**Goal**: Alert manager on SLA breach with Telegram message and inline buttons

**Independent Test**: Create request, wait 60 min working time, verify manager alert

### Implementation for User Story 3

- [ ] T042 [US3] Create alert service in backend/src/services/alerts/alert.service.ts [EXECUTOR: sla-backend-specialist] [SEQUENTIAL]
- [ ] T043 [US3] Implement alert message formatting in backend/src/services/alerts/format.service.ts [EXECUTOR: sla-backend-specialist] [SEQUENTIAL]
- [ ] T044 [US3] Create inline keyboard builder in backend/src/bot/keyboards/alert.keyboard.ts [EXECUTOR: sla-backend-specialist] [SEQUENTIAL]
- [ ] T045 [US3] Implement alert BullMQ queue in backend/src/queues/alert.queue.ts [EXECUTOR: sla-backend-specialist] [SEQUENTIAL]
- [ ] T046 [US3] Implement alert worker (send to Telegram) in backend/src/queues/alert.worker.ts [EXECUTOR: sla-backend-specialist] [SEQUENTIAL]
- [ ] T047 [US3] Create escalation scheduler in backend/src/services/alerts/escalation.service.ts [EXECUTOR: sla-backend-specialist] [SEQUENTIAL]
- [ ] T048 [US3] Implement alert callback handlers (Notify, Resolve) in backend/src/bot/handlers/alert-callback.handler.ts [EXECUTOR: sla-backend-specialist] [SEQUENTIAL]
- [ ] T049 [US3] Implement alert.router createAlert in backend/src/api/routers/alert.router.ts [EXECUTOR: api-builder] [SEQUENTIAL]
- [ ] T050 [US3] Implement alert.router resolveAlert in backend/src/api/routers/alert.router.ts [EXECUTOR: api-builder] [SEQUENTIAL]
- [ ] T051 [US3] Implement alert.router notifyAccountant in backend/src/api/routers/alert.router.ts [EXECUTOR: api-builder] [SEQUENTIAL]

**Checkpoint**: Manager receives breach alerts with working buttons (FR-016 to FR-020)

---

## Phase 6: User Story 4 - Admin Configures Working Hours (Priority: P2)

**Goal**: Admin panel page for working hours, holidays, per-chat overrides

**Independent Test**: Configure custom hours, verify SLA timer respects them

### Implementation for User Story 4

- [ ] T052 [P] [US4] Create settings page layout in frontend/src/app/settings/page.tsx [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-5]
- [ ] T053 [P] [US4] Create working hours form component in frontend/src/components/settings/WorkingHoursForm.tsx [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-5]
- [ ] T054 [P] [US4] Create holiday calendar component in frontend/src/components/settings/HolidayCalendar.tsx [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-5]
- [ ] T055 [US4] Implement chat.router updateWorkingSchedule in backend/src/api/routers/chat.router.ts [EXECUTOR: api-builder] [SEQUENTIAL]
- [ ] T056 [US4] Implement settings.router updateGlobalSettings in backend/src/api/routers/settings.router.ts [EXECUTOR: api-builder] [SEQUENTIAL]
- [ ] T057 [US4] Implement settings.router addGlobalHoliday in backend/src/api/routers/settings.router.ts [EXECUTOR: api-builder] [SEQUENTIAL]
- [ ] T058 [US4] Wire frontend settings page to tRPC in frontend/src/app/settings/page.tsx [EXECUTOR: fullstack-nextjs-specialist] [SEQUENTIAL]

**Checkpoint**: Admin can configure working hours, holidays respected (FR-011 to FR-015)

---

## Phase 7: User Story 5 - Admin Views SLA Dashboard (Priority: P2)

**Goal**: Dashboard with SLA compliance, response times, violations, real-time updates

**Independent Test**: Open dashboard, verify metrics display and update in real-time

### Implementation for User Story 5

- [ ] T059 [P] [US5] Create dashboard layout in frontend/src/app/dashboard/page.tsx [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-6]
- [ ] T060 [P] [US5] Create SLA compliance widget in frontend/src/components/dashboard/SlaComplianceWidget.tsx [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-6]
- [ ] T061 [P] [US5] Create average response time widget in frontend/src/components/dashboard/ResponseTimeWidget.tsx [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-6]
- [ ] T062 [P] [US5] Create violations counter widget in frontend/src/components/dashboard/ViolationsWidget.tsx [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-6]
- [ ] T063 [P] [US5] Create active alerts widget in frontend/src/components/dashboard/ActiveAlertsWidget.tsx [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-6]
- [ ] T064 [P] [US5] Create recent requests table in frontend/src/components/dashboard/RecentRequestsTable.tsx [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-6]
- [ ] T065 [US5] Implement analytics.router getDashboard in backend/src/api/routers/analytics.router.ts [EXECUTOR: api-builder] [SEQUENTIAL]
- [ ] T066 [US5] Implement analytics.router getAccountantStats in backend/src/api/routers/analytics.router.ts [EXECUTOR: api-builder] [SEQUENTIAL]
- [ ] T067 [US5] Implement analytics.router exportReport in backend/src/api/routers/analytics.router.ts [EXECUTOR: api-builder] [SEQUENTIAL]
- [ ] T068 [US5] Add real-time updates with Supabase Realtime in frontend/src/app/dashboard/page.tsx [EXECUTOR: fullstack-nextjs-specialist] [SEQUENTIAL]

**Checkpoint**: Dashboard shows all metrics with real-time updates (FR-021, FR-023, FR-024, FR-026)

---

## Phase 8: User Story 6 - Admin Manages Chats (Priority: P2)

**Goal**: Chat management page: add, assign accountant, set SLA, enable/disable

**Independent Test**: Add chat, assign accountant, set custom SLA, verify monitoring works

### Implementation for User Story 6

- [ ] T069 [P] [US6] Create chats list page in frontend/src/app/chats/page.tsx [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-7]
- [ ] T070 [P] [US6] Create chat details page in frontend/src/app/chats/[id]/page.tsx [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-7]
- [ ] T071 [P] [US6] Create chat settings form in frontend/src/components/chats/ChatSettingsForm.tsx [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-7]
- [ ] T072 [P] [US6] Create accountant assignment dropdown in frontend/src/components/chats/AccountantSelect.tsx [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-7]
- [ ] T073 [US6] Implement chat.router getChats in backend/src/api/routers/chat.router.ts [EXECUTOR: api-builder] [SEQUENTIAL]
- [ ] T074 [US6] Implement chat.router getChatById in backend/src/api/routers/chat.router.ts [EXECUTOR: api-builder] [SEQUENTIAL]
- [ ] T075 [US6] Implement chat.router updateChat in backend/src/api/routers/chat.router.ts [EXECUTOR: api-builder] [SEQUENTIAL]
- [ ] T076 [US6] Implement chat.router registerChat in backend/src/api/routers/chat.router.ts [EXECUTOR: api-builder] [SEQUENTIAL]
- [ ] T077 [US6] Wire frontend chat pages to tRPC in frontend/src/app/chats/page.tsx [EXECUTOR: fullstack-nextjs-specialist] [SEQUENTIAL]

**Checkpoint**: Admin can manage chats completely (FR-022, FR-025)

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Integration, optimization, and hardening

- [ ] T078 [P] Create app router root with tRPC routes in backend/src/api/index.ts [EXECUTOR: api-builder] [PARALLEL-GROUP-8]
- [ ] T079 [P] Add RLS policies for new tables via migration in backend/prisma/migrations/ [EXECUTOR: database-architect] [PARALLEL-GROUP-8]
- [ ] T080 [P] Create health check endpoint in backend/src/api/health.ts [EXECUTOR: api-builder] [PARALLEL-GROUP-8]
- [ ] T081 Add rate limiting middleware in backend/src/bot/middleware/rate-limit.ts [EXECUTOR: telegraf-bot-middleware-specialist] [SEQUENTIAL]
- [ ] T082 Add error handling middleware in backend/src/bot/middleware/error.ts [EXECUTOR: telegraf-bot-middleware-specialist] [SEQUENTIAL]
- [ ] T083 Configure Winston logging in backend/src/lib/logger.ts [EXECUTOR: sla-backend-specialist] [SEQUENTIAL]
- [ ] T084 Create Docker entrypoint in backend/Dockerfile updates [EXECUTOR: docker-compose-specialist] [SEQUENTIAL]
- [ ] T085 Run type-check and fix any errors [EXECUTOR: MAIN] [SEQUENTIAL]
- [ ] T086 Run quickstart.md validation manually [EXECUTOR: MAIN] [SEQUENTIAL]
- [ ] T087 [P] Create data retention job in backend/src/jobs/data-retention.job.ts (delete records older than 3 years, BullMQ repeatable daily 3:00 AM) [EXECUTOR: sla-backend-specialist] [PARALLEL-GROUP-8]

---

## Executor Summary

| Executor | Task Count | Domain |
|----------|------------|--------|
| **MAIN** | 8 | Trivial setup, validation |
| **database-architect** | 11 | Prisma schema, migrations, RLS, seed |
| **api-builder** | 18 | tRPC routers, procedures |
| **sla-backend-specialist** | 25 | SLA services, bot handlers, BullMQ queues |
| **ai-classifier-specialist** | 4 | OpenRouter, keyword classifier, cache |
| **fullstack-nextjs-specialist** | 17 | Next.js pages, components, tRPC client |
| **telegraf-bot-middleware-specialist** | 2 | Rate limit, error middleware |
| **docker-compose-specialist** | 1 | Dockerfile |

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - P1 stories (US1, US2, US3) should complete before P2 stories
  - US1 → US2 → US3 is recommended order (US2 depends on US1 timer logic)
  - US4, US5, US6 (P2) can run in parallel after P1 complete
- **Polish (Phase 9)**: Depends on all user stories complete

### Parallel Groups

| Group | Tasks | Executor(s) |
|-------|-------|-------------|
| PARALLEL-GROUP-1 | T002, T003, T004, T005 | MAIN, fullstack-nextjs-specialist |
| PARALLEL-GROUP-2 | T011, T012, T013, T014 | database-architect |
| PARALLEL-GROUP-3 | T017, T018, T020 | ai-classifier-specialist |
| PARALLEL-GROUP-4 | T023, T024 | api-builder, database-architect |
| PARALLEL-GROUP-5 | T052, T053, T054 | fullstack-nextjs-specialist |
| PARALLEL-GROUP-6 | T059-T064 | fullstack-nextjs-specialist |
| PARALLEL-GROUP-7 | T069-T072 | fullstack-nextjs-specialist |
| PARALLEL-GROUP-8 | T078, T079, T080, T087 | api-builder, database-architect, sla-backend-specialist |

---

## Implementation Strategy

### MVP First (User Stories 1-3 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: US1 - Client Sends Request
4. Complete Phase 4: US2 - Accountant Responds
5. Complete Phase 5: US3 - Manager Receives Alert
6. **STOP and VALIDATE**: Test via Telegram bot manually
7. Deploy MVP (core SLA monitoring works!)

### Incremental Delivery (P2 Features)

8. Add Phase 6: US4 - Working Hours Config
9. Add Phase 7: US5 - Dashboard
10. Add Phase 8: US6 - Chat Management
11. Complete Phase 9: Polish
12. Full feature deployment

---

## Summary

| Metric | Value |
|--------|-------|
| **Total Tasks** | 91 (P001-P004 + T001-T087) |
| **Setup Tasks** | 5 |
| **Foundational Tasks** | 19 |
| **US1 Tasks** | 10 |
| **US2 Tasks** | 7 |
| **US3 Tasks** | 10 |
| **US4 Tasks** | 7 |
| **US5 Tasks** | 10 |
| **US6 Tasks** | 9 |
| **Polish Tasks** | 10 |
| **Parallel Groups** | 8 |
| **MVP Scope** | Phase 1-5 (US1-US3) |

---

## Notes

- TDD deferred (not explicitly requested in spec)
- Frontend: Next.js 16.x LTS (App Router, Turbopack)
- Backend: Express 5.x + tRPC 11.x
- All paths relative to repository root
- Commit after each task or logical group
