# Tasks: Onboarding & Real-Time Dashboard

**Input**: Design documents from `/specs/005-onboarding-dashboard/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are OPTIONAL - only include them if explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/src/`, `backend/prisma/`
- **Frontend**: `frontend/src/`
- **Contracts**: `specs/005-onboarding-dashboard/contracts/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and database schema updates

- [x] T001 Update User model with onboarding flag in backend/prisma/schema.prisma
- [x] T002 Update GlobalSettings model with bot fields in backend/prisma/schema.prisma
- [x] T003 Run Prisma migration: `npx prisma migrate dev --name add_onboarding_fields` in backend/
- [x] T004 Regenerate Prisma client: `npx prisma generate` in backend/
- [x] T005 [P] Create onboarding types in frontend/src/types/onboarding.ts
- [x] T006 [P] Create dashboard types in frontend/src/types/dashboard.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before user stories can be implemented

**⚠️ CRITICAL**: User Story 1 and 2 depend on these backend changes

- [x] T007 Implement Analytics tRPC router shell in backend/src/api/trpc/routers/analytics.ts
- [x] T008 Implement Settings tRPC router shell in backend/src/api/trpc/routers/settings.ts
- [x] T009 Register new routers in main app router backend/src/api/trpc/router.ts
- [x] T010 Implement Telegram Bot validation service in backend/src/services/telegram/validation.ts

**Checkpoint**: Foundation ready - routers registered, schema updated

---

## Phase 3: User Story 1 - New User Onboarding Wizard (Priority: P1) 🎯 MVP

**Goal**: Guide new users through initial workspace configuration

**Independent Test**: Fresh user is redirected to wizard, completes steps, and lands on dashboard

### Implementation for User Story 1

- [x] T011 [P] [US1] Create Onboarding Layout component in frontend/src/components/onboarding/OnboardingLayout.tsx
- [x] T012 [P] [US1] Create Step 1: Bot Token form in frontend/src/components/onboarding/StepBotToken.tsx
- [x] T013 [P] [US1] Create Step 2: Working Hours form in frontend/src/components/onboarding/StepWorkingHours.tsx
- [x] T014 [P] [US1] Create Step 3: SLA Thresholds form in frontend/src/components/onboarding/StepSla.tsx
- [x] T015 [US1] Implement `setupTelegramBot` mutation in backend/src/api/trpc/routers/settings.ts
- [x] T016 [US1] Implement `updateWorkingSchedule` mutation in backend/src/api/trpc/routers/settings.ts
- [x] T017 [US1] Implement `updateSlaThresholds` mutation in backend/src/api/trpc/routers/settings.ts
- [x] T018 [US1] Implement `completeOnboarding` mutation in backend/src/api/trpc/routers/settings.ts
- [x] T019 [US1] Create Onboarding Page container in frontend/src/app/onboarding/page.tsx
- [x] T020 [US1] Add redirection logic for new users in frontend/src/components/layout/AdminLayout.tsx

**Checkpoint**: New users are forced through wizard and settings are saved

---

## Phase 4: User Story 2 - Real-Time Dashboard Overview (Priority: P1)

**Goal**: Display live metrics instead of mock data

**Independent Test**: Dashboard widgets update when DB data changes

### Implementation for User Story 2

- [x] T021 [US2] Implement `getSlaCompliance` query in backend/src/api/trpc/routers/analytics.ts
- [x] T022 [US2] Implement `getResponseTime` query in backend/src/api/trpc/routers/analytics.ts
- [x] T023 [US2] Implement `getViolationsCount` query in backend/src/api/trpc/routers/analytics.ts
- [x] T024 [US2] Implement `getActiveAlerts` query in backend/src/api/trpc/routers/analytics.ts
- [x] T025 [P] [US2] Connect SlaComplianceWidget to real data in frontend/src/components/dashboard/SlaComplianceWidget.tsx
- [x] T026 [P] [US2] Connect ResponseTimeWidget to real data in frontend/src/components/dashboard/ResponseTimeWidget.tsx
- [x] T027 [P] [US2] Connect ViolationsWidget to real data in frontend/src/components/dashboard/ViolationsWidget.tsx
- [x] T028 [P] [US2] Connect ActiveAlertsWidget to real data in frontend/src/components/dashboard/ActiveAlertsWidget.tsx
- [x] T029 [US2] Update main dashboard page to fetch and pass data in frontend/src/app/dashboard/dashboard-content.tsx

**Checkpoint**: Dashboard shows real numbers from database

---

## Phase 5: User Story 3 - Settings Management (Priority: P2)

**Goal**: Allow administrators to update configuration after onboarding

**Independent Test**: Changing settings updates DB and affects subsequent logic

### Implementation for User Story 3

- [x] T030 [P] [US3] Create Settings Layout/Tabs in frontend/src/app/settings/page.tsx
- [x] T031 [P] [US3] Create General Settings form (Bot, SLA) in frontend/src/components/settings/GeneralSettingsForm.tsx
- [x] T032 [P] [US3] Create Schedule Settings form in frontend/src/components/settings/ScheduleSettingsForm.tsx
- [x] T033 [US3] Connect Settings forms to existing tRPC mutations in frontend/src/app/settings/page.tsx

**Checkpoint**: Settings page is functional and updates global config

---

## Phase 6: User Story 4 - Premium Authentication Experience (Priority: P2)

**Goal**: Match login UI to premium landing page style

**Independent Test**: Login page has Aurora background and glassmorphism

### Implementation for User Story 4

- [x] T034 [P] [US4] Create premium Login Layout with Aurora background in frontend/src/app/(auth)/layout.tsx
- [x] T035 [P] [US4] Create styled Login Form component in frontend/src/components/auth/LoginForm.tsx
- [x] T036 [US4] Integrate Supabase Auth with styled form in frontend/src/app/(auth)/login/page.tsx

**Checkpoint**: Login experience is visually consistent with landing page

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Legal pages and final cleanup

- [x] T037 [P] Create Privacy Policy page in frontend/src/app/privacy/page.tsx
- [x] T038 [P] Create Terms of Service page in frontend/src/app/terms/page.tsx
- [x] T039 Verify type safety across all new components
- [x] T040 Run build verification `npm run build` in frontend

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Phase 1 (Schema)
- **User Stories (Phase 3-6)**: Depend on Phase 2 (Routers)
- **Polish (Phase 7)**: Can run anytime, mostly static content

### User Story Dependencies

- **US1 (Onboarding)**: Depends on Settings Router (T008) and Bot Validation (T010)
- **US2 (Dashboard)**: Depends on Analytics Router (T007)
- **US3 (Settings)**: Depends on Settings Router (T008) - shares backend logic with US1
- **US4 (Auth)**: Independent, can run parallel to US1-3

### Parallel Opportunities

- Frontend components for US1, US2, US3, US4 can be built in parallel
- Backend routers for US1 and US2 can be built in parallel
- Legal pages (Phase 7) can be built in parallel with any phase

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Phase 1 & 2 (Schema + Routers)
2. Implement US1 (Onboarding) -> Users can configure system
3. Implement US2 (Dashboard) -> Users can see value
4. **STOP and VALIDATE**: System is usable end-to-end

### Incremental Delivery

1. **Setup**: Migrations + Base Routers
2. **Onboarding**: Wizard UI + Backend Mutations
3. **Dashboard**: Analytics Queries + Widget Integration
4. **Management**: Settings Page
5. **Polish**: Auth UI + Legal Pages