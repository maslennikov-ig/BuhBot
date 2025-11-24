# Tasks: Client Feedback & Quick Wins

**Input**: Design documents from `/specs/003-client-feedback-quick-wins/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not requested in specification - test tasks omitted.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US8)
- Paths use web app convention: `backend/src/`, `frontend/src/`

---

## Phase 0: Planning ✓ COMPLETE

**Purpose**: Prepare for implementation by analyzing requirements, creating necessary agents, and assigning executors.

- [X] P001 Analyze all tasks and identify required agent types and capabilities
- [X] P002 Create missing agents (SKIPPED - all required agents exist)
- [X] P003 Assign executors to all tasks: sla-backend-specialist, api-builder, telegraf-bot-middleware-specialist, fullstack-nextjs-specialist, MAIN
- [X] P004 Resolve research tasks (SKIPPED - no complex research needed, all decisions in research.md)

**Agent Assignments**:
| Agent | Capabilities |
|-------|--------------|
| sla-backend-specialist | Prisma schema, BullMQ queues/workers, services, metrics |
| api-builder | tRPC routers with auth/authorization |
| telegraf-bot-middleware-specialist | Telegram bot handlers |
| fullstack-nextjs-specialist | Frontend pages and components |
| MAIN | Trivial tasks (type-check, build, imports) |

---

## Phase 1: Setup

**Purpose**: Database schema changes and shared infrastructure for feedback system

- [X] T001 [EXECUTOR: sla-backend-specialist] [PARALLEL-GROUP-1] Add SurveyStatus and DeliveryStatus enums to backend/prisma/schema.prisma
  → Artifacts: [schema.prisma](backend/prisma/schema.prisma)
- [X] T002 [EXECUTOR: sla-backend-specialist] [PARALLEL-GROUP-1] Add FeedbackSurvey model to backend/prisma/schema.prisma per data-model.md
  → Artifacts: [schema.prisma](backend/prisma/schema.prisma)
- [X] T003 [EXECUTOR: sla-backend-specialist] [PARALLEL-GROUP-1] Add SurveyDelivery model to backend/prisma/schema.prisma per data-model.md
  → Artifacts: [schema.prisma](backend/prisma/schema.prisma)
- [X] T004 [EXECUTOR: sla-backend-specialist] [PARALLEL-GROUP-1] Extend FeedbackResponse model with surveyId, deliveryId, clientUsername in backend/prisma/schema.prisma
  → Artifacts: [schema.prisma](backend/prisma/schema.prisma)
- [X] T005 [EXECUTOR: sla-backend-specialist] [PARALLEL-GROUP-1] Extend GlobalSettings model with survey config fields in backend/prisma/schema.prisma
  → Artifacts: [schema.prisma](backend/prisma/schema.prisma)
- [X] T006 [EXECUTOR: sla-backend-specialist] [PARALLEL-GROUP-1] Add User relation for SurveyClosedBy in backend/prisma/schema.prisma
  → Artifacts: [schema.prisma](backend/prisma/schema.prisma)
- [X] T007 [EXECUTOR: sla-backend-specialist] [PARALLEL-GROUP-1] Add Chat relation for SurveyDelivery in backend/prisma/schema.prisma
  → Artifacts: [schema.prisma](backend/prisma/schema.prisma)
- [X] T008 [EXECUTOR: MAIN] [SEQUENTIAL] Run prisma migrate dev to create migration in backend/prisma/migrations/
  → Artifacts: [migration.sql](backend/prisma/migrations/20241124130000_add_feedback_survey_system/migration.sql)
- [X] T009 [EXECUTOR: MAIN] [SEQUENTIAL] Run prisma generate to update generated client in backend/src/generated/prisma/
  → Artifacts: [generated/prisma/](backend/src/generated/prisma/)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core services and queues that all user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T010 [EXECUTOR: sla-backend-specialist] [PARALLEL-GROUP-2] Create survey queue configuration in backend/src/queues/survey.queue.ts
  → Artifacts: [survey.queue.ts](backend/src/queues/survey.queue.ts)
- [X] T011 [EXECUTOR: sla-backend-specialist] [PARALLEL-GROUP-2] Create survey keyboard builder in backend/src/bot/keyboards/survey.keyboard.ts
  → Artifacts: [survey.keyboard.ts](backend/src/bot/keyboards/survey.keyboard.ts)
- [X] T012 [EXECUTOR: sla-backend-specialist] [PARALLEL-GROUP-2] Create analytics service for NPS calculation in backend/src/services/feedback/analytics.service.ts
  → Artifacts: [analytics.service.ts](backend/src/services/feedback/analytics.service.ts)
- [X] T013 [EXECUTOR: MAIN] [SEQUENTIAL] Register survey queue in backend/src/queues/setup.ts (add to QUEUE_NAMES, create instance)
  → Artifacts: [setup.ts](backend/src/queues/setup.ts)
- [X] T014 [EXECUTOR: MAIN] [SEQUENTIAL] Add feedback and survey routers to backend/src/api/trpc/router.ts
  → Artifacts: [feedback.ts](backend/src/api/trpc/routers/feedback.ts), [survey.ts](backend/src/api/trpc/routers/survey.ts), [router.ts](backend/src/api/trpc/router.ts)

**Checkpoint**: Foundation ready - user story implementation can begin

---

## Phase 3: User Story 1 - Client Receives Quarterly Survey (Priority: P1) MVP

**Goal**: Clients receive quarterly satisfaction surveys via Telegram with 1-5 star rating buttons

**Independent Test**: Client can complete a survey in under 30 seconds by tapping rating buttons

### Implementation for User Story 1

- [X] T015 [EXECUTOR: sla-backend-specialist] [PARALLEL-GROUP-3] [US1] Create survey service with campaign logic in backend/src/services/feedback/survey.service.ts
  → Artifacts: [survey.service.ts](backend/src/services/feedback/survey.service.ts)
- [X] T016 [EXECUTOR: sla-backend-specialist] [PARALLEL-GROUP-3] [US1] Create survey worker for delivery processing in backend/src/queues/survey.worker.ts (include 5 retries over 1 hour with exponential backoff per NFR-006)
  → Artifacts: [survey.worker.ts](backend/src/queues/survey.worker.ts)
- [X] T017 [EXECUTOR: telegraf-bot-middleware-specialist] [SEQUENTIAL] [US1] Create survey callback handler for rating buttons in backend/src/bot/handlers/survey.handler.ts
  → Artifacts: [survey.handler.ts](backend/src/bot/handlers/survey.handler.ts)
- [X] T018 [EXECUTOR: api-builder] [SEQUENTIAL] [US1] Implement submitRating procedure in backend/src/api/trpc/routers/feedback.ts
  → Artifacts: [feedback.ts](backend/src/api/trpc/routers/feedback.ts)
- [X] T019 [EXECUTOR: api-builder] [SEQUENTIAL] [US1] Implement addComment procedure in backend/src/api/trpc/routers/feedback.ts
  → Artifacts: [feedback.ts](backend/src/api/trpc/routers/feedback.ts)
- [X] T020 [EXECUTOR: MAIN] [SEQUENTIAL] [US1] Register survey handler in backend/src/bot/handlers/index.ts
  → Artifacts: [index.ts](backend/src/bot/handlers/index.ts)
- [X] T021 [EXECUTOR: sla-backend-specialist] [SEQUENTIAL] [US1] Add survey reminder job scheduling in backend/src/queues/survey.worker.ts
  → Artifacts: [survey.worker.ts](backend/src/queues/survey.worker.ts) (included in T016)
- [X] T022 [EXECUTOR: sla-backend-specialist] [SEQUENTIAL] [US1] Implement manager notification for non-response in backend/src/queues/survey.worker.ts
  → Artifacts: [survey.worker.ts](backend/src/queues/survey.worker.ts) (included in T016)
- [X] T022a [EXECUTOR: sla-backend-specialist] [SEQUENTIAL] [US1] Configure quarterly cron job for automatic survey scheduling (first Monday of Jan/Apr/Jul/Oct) in backend/src/queues/survey.queue.ts
  → Artifacts: [survey.queue.ts](backend/src/queues/survey.queue.ts) - cron scheduling ready, job needs to be scheduled at startup

**Checkpoint**: Clients can receive surveys, rate, and add comments. Reminders, non-response notifications, and quarterly automation work.

---

## Phase 4: User Story 2 - Manager Views Full Feedback Details (Priority: P1)

**Goal**: Managers see complete feedback data with client identifiers, filters, and analytics

**Independent Test**: Manager can view individual feedback entries with client and accountant attribution

### Implementation for User Story 2

- [ ] T023 [EXECUTOR: api-builder] [PARALLEL-GROUP-4] [US2] Implement getAll procedure (manager only) in backend/src/api/trpc/routers/feedback.ts
- [ ] T024 [EXECUTOR: api-builder] [PARALLEL-GROUP-4] [US2] Implement getById procedure (manager only) in backend/src/api/trpc/routers/feedback.ts
- [ ] T025 [EXECUTOR: api-builder] [PARALLEL-GROUP-4] [US2] Implement exportCsv procedure in backend/src/api/trpc/routers/feedback.ts
- [ ] T026 [EXECUTOR: fullstack-nextjs-specialist] [SEQUENTIAL] [US2] Create FeedbackTable component for manager view in frontend/src/components/feedback/FeedbackTable.tsx
- [ ] T027 [EXECUTOR: fullstack-nextjs-specialist] [SEQUENTIAL] [US2] Create NPSWidget component with trend charts in frontend/src/components/feedback/NPSWidget.tsx
- [ ] T028 [EXECUTOR: fullstack-nextjs-specialist] [SEQUENTIAL] [US2] Create feedback dashboard page in frontend/src/app/feedback/page.tsx
- [ ] T029 [EXECUTOR: fullstack-nextjs-specialist] [SEQUENTIAL] [US2] Add role-based rendering logic to show manager view in frontend/src/app/feedback/page.tsx

**Checkpoint**: Managers can view full feedback details, filter, and export data.

---

## Phase 5: User Story 3 - Accountant Views Anonymous Aggregate Feedback (Priority: P1)

**Goal**: Accountants see only aggregate statistics without client-identifying information

**Independent Test**: Accountant sees aggregate stats without any client-identifying information

### Implementation for User Story 3

- [ ] T030 [EXECUTOR: api-builder] [SEQUENTIAL] [US3] Implement getAggregates procedure (all roles) in backend/src/api/trpc/routers/feedback.ts
- [ ] T031 [EXECUTOR: fullstack-nextjs-specialist] [SEQUENTIAL] [US3] Create FeedbackAggregates component for accountant view in frontend/src/components/feedback/FeedbackAggregates.tsx
- [ ] T032 [EXECUTOR: fullstack-nextjs-specialist] [SEQUENTIAL] [US3] Add role-based rendering logic to show accountant view in frontend/src/app/feedback/page.tsx
- [ ] T033 [EXECUTOR: api-builder] [SEQUENTIAL] [US3] Add RLS policy comments and tRPC middleware for role enforcement in backend/src/api/trpc/routers/feedback.ts

**Checkpoint**: Accountants see aggregate-only view, role enforcement prevents data leakage.

---

## Phase 6: User Story 4 - Manager Receives Low Rating Alert (Priority: P1)

**Goal**: Managers receive Telegram alerts within 60 seconds for ratings of 3 stars or below

**Independent Test**: Manager receives Telegram notification within 1 minute of low rating submission

### Implementation for User Story 4

- [ ] T034 [EXECUTOR: sla-backend-specialist] [SEQUENTIAL] [US4] Extend alert service for low-rating alerts in backend/src/services/feedback/alert.service.ts
- [ ] T035 [EXECUTOR: api-builder] [SEQUENTIAL] [US4] Add low-rating check in submitRating procedure in backend/src/api/trpc/routers/feedback.ts
- [ ] T036 [EXECUTOR: sla-backend-specialist] [SEQUENTIAL] [US4] Create alert keyboard with chat link in backend/src/bot/keyboards/alert.keyboard.ts (extend existing)
- [ ] T037 [EXECUTOR: sla-backend-specialist] [SEQUENTIAL] [US4] Queue low-rating alert job in backend/src/queues/alert.queue.ts

**Checkpoint**: Low ratings trigger immediate manager alerts with chat link.

---

## Phase 7: User Story 5 - Client Uses Inline Menu (Priority: P2)

**Goal**: Clients have persistent menu buttons for Document Status, Contact Accountant, Request Service

**Independent Test**: Client can access all menu options with a single tap

### Implementation for User Story 5

- [ ] T038 [EXECUTOR: sla-backend-specialist] [PARALLEL-GROUP-5] [US5] Create client menu keyboard in backend/src/bot/keyboards/client-menu.keyboard.ts
- [ ] T039 [EXECUTOR: telegraf-bot-middleware-specialist] [SEQUENTIAL] [US5] Create menu command handler in backend/src/bot/handlers/menu.handler.ts
- [ ] T040 [EXECUTOR: telegraf-bot-middleware-specialist] [SEQUENTIAL] [US5] Implement document status callback in backend/src/bot/handlers/menu.handler.ts
- [ ] T041 [EXECUTOR: telegraf-bot-middleware-specialist] [SEQUENTIAL] [US5] Implement contact accountant callback in backend/src/bot/handlers/menu.handler.ts
- [ ] T042 [EXECUTOR: telegraf-bot-middleware-specialist] [SEQUENTIAL] [US5] Implement request service callback in backend/src/bot/handlers/menu.handler.ts
- [ ] T043 [EXECUTOR: MAIN] [SEQUENTIAL] [US5] Register menu handler in backend/src/bot/handlers/index.ts
- [ ] T044 [EXECUTOR: sla-backend-specialist] [SEQUENTIAL] [US5] Set persistent menu on bot startup in backend/src/bot/index.ts

**Checkpoint**: Clients see persistent menu, all three buttons functional.

---

## Phase 8: User Story 6 - Accountant Uses Template Library (Priority: P2)

**Goal**: Accountants send pre-saved templates via /template command with variable substitution

**Independent Test**: Accountant sends a template with a single command

### Implementation for User Story 6

- [ ] T045 [EXECUTOR: sla-backend-specialist] [PARALLEL-GROUP-5] [US6] Create variable substitution service in backend/src/services/templates/variable.service.ts
- [ ] T046 [EXECUTOR: telegraf-bot-middleware-specialist] [SEQUENTIAL] [US6] Create template command handler in backend/src/bot/handlers/template.handler.ts
- [ ] T047 [EXECUTOR: telegraf-bot-middleware-specialist] [SEQUENTIAL] [US6] Implement /template list response in backend/src/bot/handlers/template.handler.ts
- [ ] T048 [EXECUTOR: telegraf-bot-middleware-specialist] [SEQUENTIAL] [US6] Implement template send with variable substitution in backend/src/bot/handlers/template.handler.ts
- [ ] T049 [EXECUTOR: MAIN] [SEQUENTIAL] [US6] Register template handler in backend/src/bot/handlers/index.ts

**Checkpoint**: /template command works, variables are substituted correctly.

---

## Phase 9: User Story 7 - Auto-File Confirmation (Priority: P2)

**Goal**: Bot automatically confirms document/file receipt with filename, size, and timestamp

**Independent Test**: Client sees confirmation message immediately after uploading a file

### Implementation for User Story 7

- [ ] T050 [EXECUTOR: telegraf-bot-middleware-specialist] [PARALLEL-GROUP-5] [US7] Create file handler for document/photo messages in backend/src/bot/handlers/file.handler.ts
- [ ] T051 [EXECUTOR: telegraf-bot-middleware-specialist] [SEQUENTIAL] [US7] Implement file metadata extraction (name, size, type) in backend/src/bot/handlers/file.handler.ts
- [ ] T052 [EXECUTOR: telegraf-bot-middleware-specialist] [SEQUENTIAL] [US7] Format confirmation message with Russian text in backend/src/bot/handlers/file.handler.ts
- [ ] T053 [EXECUTOR: MAIN] [SEQUENTIAL] [US7] Register file handler in backend/src/bot/handlers/index.ts

**Checkpoint**: File uploads trigger immediate confirmation with metadata.

---

## Phase 10: User Story 8 - FAQ Auto-Responses (Priority: P3)

**Goal**: Bot auto-responds to common questions using keyword matching

**Independent Test**: Client receives automatic answer to a common question within 5 seconds

### Implementation for User Story 8

- [ ] T054 [EXECUTOR: sla-backend-specialist] [PARALLEL-GROUP-5] [US8] Create FAQ matcher service with keyword search in backend/src/services/faq/matcher.service.ts
- [ ] T055 [EXECUTOR: telegraf-bot-middleware-specialist] [SEQUENTIAL] [US8] Create FAQ handler for message interception in backend/src/bot/handlers/faq.handler.ts
- [ ] T056 [EXECUTOR: sla-backend-specialist] [SEQUENTIAL] [US8] Implement keyword matching with usage_count tiebreaker in backend/src/services/faq/matcher.service.ts
- [ ] T057 [EXECUTOR: MAIN] [SEQUENTIAL] [US8] Register FAQ handler in backend/src/bot/handlers/index.ts (before message handler)
- [ ] T058 [EXECUTOR: sla-backend-specialist] [SEQUENTIAL] [US8] Increment FAQ usage count after match in backend/src/services/faq/matcher.service.ts

**Checkpoint**: FAQ keywords trigger auto-responses, usage tracking works.

---

## Phase 11: Survey Management (Admin Panel)

**Goal**: Managers can create, view, close surveys and configure settings

### Implementation

- [ ] T059 [EXECUTOR: api-builder] [PARALLEL-GROUP-6] Implement survey.list procedure in backend/src/api/trpc/routers/survey.ts
- [ ] T060 [EXECUTOR: api-builder] [PARALLEL-GROUP-6] Implement survey.getById procedure in backend/src/api/trpc/routers/survey.ts
- [ ] T061 [EXECUTOR: api-builder] [PARALLEL-GROUP-6] Implement survey.create procedure in backend/src/api/trpc/routers/survey.ts
- [ ] T062 [EXECUTOR: api-builder] [PARALLEL-GROUP-6] Implement survey.close procedure in backend/src/api/trpc/routers/survey.ts
- [ ] T063 [EXECUTOR: api-builder] [PARALLEL-GROUP-6] Implement survey.sendNow procedure in backend/src/api/trpc/routers/survey.ts
- [ ] T064 [EXECUTOR: api-builder] [PARALLEL-GROUP-6] Implement survey.getDeliveries procedure in backend/src/api/trpc/routers/survey.ts
- [ ] T065 [EXECUTOR: api-builder] [PARALLEL-GROUP-6] Implement survey.getSettings procedure in backend/src/api/trpc/routers/survey.ts
- [ ] T066 [EXECUTOR: api-builder] [PARALLEL-GROUP-6] Implement survey.updateSettings procedure in backend/src/api/trpc/routers/survey.ts
- [ ] T067 [EXECUTOR: fullstack-nextjs-specialist] [SEQUENTIAL] Create survey list page in frontend/src/app/settings/survey/page.tsx
- [ ] T068 [EXECUTOR: fullstack-nextjs-specialist] [SEQUENTIAL] Create survey detail page in frontend/src/app/settings/survey/[id]/page.tsx
- [ ] T069 [EXECUTOR: fullstack-nextjs-specialist] [SEQUENTIAL] Create survey settings form in frontend/src/app/settings/survey/settings.tsx

**Checkpoint**: Survey campaigns fully manageable from Admin Panel.

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements affecting multiple user stories

- [ ] T070 [EXECUTOR: sla-backend-specialist] [PARALLEL-GROUP-7] Add Prometheus metrics for survey delivery rate in backend/src/utils/metrics.ts
- [ ] T071 [EXECUTOR: sla-backend-specialist] [PARALLEL-GROUP-7] Add Prometheus metrics for feedback response rate in backend/src/utils/metrics.ts
- [ ] T072 [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-7] Add navigation link to Feedback page in frontend/src/components/layout/AdminLayout.tsx
- [ ] T073 [EXECUTOR: fullstack-nextjs-specialist] [PARALLEL-GROUP-7] Add navigation link to Survey settings in frontend/src/components/layout/AdminLayout.tsx
- [ ] T074 [EXECUTOR: MAIN] [SEQUENTIAL] Run type-check and fix any errors across all new files
- [ ] T075 [EXECUTOR: MAIN] [SEQUENTIAL] Run build verification for backend and frontend
- [ ] T076 [EXECUTOR: MAIN] [SEQUENTIAL] Validate quickstart.md scenarios manually

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-10)**: All depend on Foundational phase completion
  - US1-US4 (P1): Core feedback loop, should complete first
  - US5-US7 (P2): Client/Accountant tools, can run in parallel
  - US8 (P3): Nice-to-have FAQ feature
- **Survey Management (Phase 11)**: Depends on US1 completion
- **Polish (Phase 12)**: Depends on all desired user stories being complete

### User Story Dependencies

| Story | Priority | Depends On | Can Start After |
|-------|----------|------------|-----------------|
| US1 (Survey Delivery) | P1 | Foundation | Phase 2 |
| US2 (Manager View) | P1 | US1 (data exists) | T022 |
| US3 (Accountant View) | P1 | US2 (shares page) | T029 |
| US4 (Low Rating Alert) | P1 | US1 (rating flow) | T019 |
| US5 (Client Menu) | P2 | Foundation only | Phase 2 |
| US6 (Templates) | P2 | Foundation only | Phase 2 |
| US7 (File Confirm) | P2 | Foundation only | Phase 2 |
| US8 (FAQ) | P3 | Foundation only | Phase 2 |

### Parallel Opportunities

**Phase 2 (Foundation)**:
```
Parallel: T010, T011, T012 (different files)
Sequential: T013, T014 (modify setup.ts, router.ts)
```

**Phase 3-6 (P1 Stories)**:
```
US1: T015, T016 parallel → T017-T022 sequential
US2: T023, T024, T025 parallel → T026-T029 sequential
US3: T030 → T031-T033 sequential
US4: T034 → T035-T037 sequential
```

**Phase 7-10 (P2/P3 Stories)**:
```
All P2 stories (US5, US6, US7) can run fully in parallel
US8 can run in parallel with above
```

---

## Parallel Example: Phase 2 Foundation

```bash
# Launch parallel tasks:
Task: "Create survey queue configuration in backend/src/queues/survey.queue.ts"
Task: "Create survey keyboard builder in backend/src/bot/keyboards/survey.keyboard.ts"
Task: "Create analytics service for NPS calculation in backend/src/services/feedback/analytics.service.ts"

# Then sequential:
Task: "Register survey queue in backend/src/queues/setup.ts"
Task: "Add feedback and survey routers to backend/src/api/trpc/router.ts"
```

---

## Implementation Strategy

### MVP First (P1 Stories Only)

1. Complete Phase 1: Setup (T001-T009)
2. Complete Phase 2: Foundational (T010-T014)
3. Complete Phase 3: US1 - Survey Delivery (T015-T022)
4. Complete Phase 4: US2 - Manager View (T023-T029)
5. Complete Phase 5: US3 - Accountant View (T030-T033)
6. Complete Phase 6: US4 - Low Rating Alert (T034-T037)
7. **STOP and VALIDATE**: All P1 stories work independently
8. Deploy MVP with core feedback functionality

### Incremental Delivery

1. **MVP**: Setup + Foundation + US1-US4 → Deploy
2. **Enhancement 1**: Add US5 (Client Menu) → Deploy
3. **Enhancement 2**: Add US6 (Templates) → Deploy
4. **Enhancement 3**: Add US7 (File Confirm) → Deploy
5. **Enhancement 4**: Add US8 (FAQ) → Deploy
6. **Admin Panel**: Phase 11 (Survey Management) → Deploy
7. **Polish**: Phase 12 → Final Release

---

## Notes

- Total tasks: 76
- P1 tasks: 37 (Setup + Foundation + US1-US4)
- P2 tasks: 22 (US5-US7)
- P3 tasks: 5 (US8)
- Admin/Polish: 12
- Each user story is independently testable after completion
- Commit after each task or logical group
- Run type-check before each commit
