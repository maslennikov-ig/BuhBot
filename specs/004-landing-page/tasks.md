# Tasks: BuhBot Landing Page

**Input**: Design documents from `/specs/004-landing-page/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not requested in feature specification - tests are OPTIONAL for MVP.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/src/`, `backend/prisma/`
- **Frontend**: `frontend/src/`
- Web application structure per plan.md

---

## Phase 0: Planning

**Purpose**: Prepare for implementation by analyzing requirements, creating necessary agents, and assigning executors.

- [x] P001 Analyze all tasks and identify required agent types and capabilities
- [x] P002 Create missing agents using meta-agent-v3 (launch N calls in single message, 1 per agent), then ask user restart
- [x] P003 Assign executors to all tasks: MAIN (trivial only), existing agents (100% match), or specific agent names
- [x] P004 Resolve research tasks: simple (solve with tools now), complex (create prompts in research/)

**Rules**:
- **MAIN executor**: ONLY for trivial tasks (1-2 line fixes, simple imports, single npm install)
- **Existing agents**: ONLY if 100% capability match after thorough examination
- **Agent creation**: Launch all meta-agent-v3 calls in single message for parallel execution
- **After P002**: Must restart claude-code before proceeding to P003

**Artifacts**:
- Updated tasks.md with [EXECUTOR: name], [SEQUENTIAL]/[PARALLEL-GROUP-X] annotations
- .claude/agents/{domain}/{type}/{name}.md (if new agents created)
- research/*.md (if complex research identified)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database migration and shared components that all user stories depend on

- [x] T001 Add ContactRequestStatus enum and ContactRequest model to backend/prisma/schema.prisma
- [x] T002 Run Prisma migration: `prisma migrate dev --name add_contact_requests` in backend/
- [x] T003 Regenerate Prisma client: `prisma generate` in backend/
- [x] T004 [P] Create landing components directory: frontend/src/components/landing/
- [x] T005 [P] Create login page directory: frontend/src/app/login/
- [x] T006-A [P] Install framer-motion dependency for animations: `npm install framer-motion` in frontend/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend API and notification infrastructure that MUST be complete before form submission works

**CRITICAL**: User Story 2 (Contact Form) cannot function until this phase is complete

- [x] T006 Create contact tRPC router with submit mutation in backend/src/api/trpc/routers/contact.ts
- [x] T007 Register contact router in backend/src/api/trpc/router.ts
- [x] T008 Implement Telegram notification for contact submissions in backend/src/services/notification/contact.ts
- [x] T009 Create shared types for contact form in frontend: copy Zod schema to frontend/src/lib/schemas/contact.ts

**Checkpoint**: Backend ready - form submissions can now be processed

---

## Phase 3: User Story 1 - First-Time Visitor Explores Product (Priority: P1) MVP

**Goal**: Visitor lands on page and understands BuhBot's value proposition through hero, features, how-it-works, and benefits sections

**Independent Test**: Visitor can understand BuhBot's value proposition within 30 seconds of page load

### Implementation for User Story 1

- [x] T010 [P] [US1] Create Header component with logo and navigation in frontend/src/components/landing/Header.tsx
- [x] T011 [P] [US1] Create Hero section with headline, subheadline, CTAs in frontend/src/components/landing/Hero.tsx
- [x] T012 [P] [US1] Create Features section with 6 feature cards in frontend/src/components/landing/Features.tsx
- [x] T013 [P] [US1] Create HowItWorks section with 4 steps in frontend/src/components/landing/HowItWorks.tsx
- [x] T014 [P] [US1] Create Benefits section with 4 stats in frontend/src/components/landing/Benefits.tsx
- [x] T015 [P] [US1] Create Footer component with links and copyright in frontend/src/components/landing/Footer.tsx
- [x] T016 [US1] Create landing page barrel export in frontend/src/components/landing/index.ts
- [x] T017 [US1] Replace default page with landing page layout in frontend/src/app/page.tsx
- [x] T018 [US1] Add responsive styles and mobile breakpoints to all landing components

**Checkpoint**: Landing page displays all sections, fully responsive - can be demoed

---

## Phase 4: User Story 2 - Lead Requests Demo (Priority: P1)

**Goal**: Visitor fills out contact form to request demo, form validates and submits, business team receives Telegram notification

**Independent Test**: Visitor can successfully submit contact form with valid information

**Dependencies**: Phase 2 (backend) must be complete

### Implementation for User Story 2

- [x] T019 [US2] Create ContactForm component with React Hook Form in frontend/src/components/landing/ContactForm.tsx
- [x] T020 [US2] Implement form validation with Zod schema from frontend/src/lib/schemas/contact.ts
- [x] T021 [US2] Add honeypot field (hidden) for spam protection in ContactForm.tsx
- [x] T022 [US2] Implement tRPC mutation call for form submission in ContactForm.tsx
- [x] T023 [US2] Add success/error states and user feedback in Russian in ContactForm.tsx
- [x] T024 [US2] Add ContactForm to landing page between Benefits and Footer in frontend/src/app/page.tsx
- [x] T025 [US2] Add CTA button in Hero that scrolls to contact form section

**Checkpoint**: Contact form works end-to-end - form submits, Telegram notification received

---

## Phase 5: User Story 3 - Existing User Accesses Dashboard (Priority: P1)

**Goal**: Existing users can navigate to login page from landing page header

**Independent Test**: Existing user can reach login page within 2 clicks from landing page

### Implementation for User Story 3

- [x] T026 [P] [US3] Create login page with Supabase auth redirect in frontend/src/app/login/page.tsx
- [x] T027 [US3] Add Login button to Header component with /login link in frontend/src/components/landing/Header.tsx
- [x] T028 [US3] Add Login link to mobile navigation menu in Header.tsx
- [x] T029 [US3] Ensure existing /dashboard route redirects unauthenticated users to /login

**Checkpoint**: Login flow works - clicking Login navigates to auth page

---

## Phase 6: User Story 4 - Visitor Navigates Page Sections (Priority: P2)

**Goal**: Navigation links in header scroll smoothly to corresponding page sections

**Independent Test**: Navigation links scroll smoothly to corresponding page sections

### Implementation for User Story 4

- [x] T030 [US4] Add section IDs to all landing page sections (features, how-it-works, benefits, contact)
- [x] T031 [US4] Implement smooth scroll behavior for navigation links in Header.tsx
- [x] T032 [US4] Add sticky header behavior with scroll detection in Header.tsx
- [x] T033 [US4] Implement mobile hamburger menu with section links in Header.tsx
- [x] T034 [US4] Add close-on-click behavior for mobile menu when navigating to section

**Checkpoint**: Navigation fully functional - all section links work, mobile menu works

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Performance optimization, accessibility, and final validation

- [x] T035 [P] Optimize images with Next.js Image component in all landing sections
- [x] T036 [P] Add meta tags and SEO optimization in frontend/src/app/layout.tsx
- [x] T037 Add keyboard navigation support to all interactive elements
- [x] T038 Run Lighthouse audit and address performance issues
- [x] T039 Verify all content is in Russian language
- [x] T040 Run type-check and build verification
- [x] T041 Run quickstart.md validation checklist
- [x] T042 Verify existing authenticated routes work unchanged (/dashboard, /feedback, /settings/*) - FR-016
- [x] T043 Add robots.txt and sitemap.xml for SEO per TZ requirements

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup (Prisma migration)
- **User Story 1 (Phase 3)**: Can start after Setup (parallel with Phase 2)
- **User Story 2 (Phase 4)**: Depends on Phase 2 (backend API)
- **User Story 3 (Phase 5)**: Can start after Setup (parallel with Phase 2-4)
- **User Story 4 (Phase 6)**: Depends on Phase 3 (needs sections to exist)
- **Polish (Phase 7)**: Depends on all user stories

### User Story Dependencies

```
Phase 1 (Setup)
    │
    ├──► Phase 2 (Backend) ──► Phase 4 (US2: Contact Form)
    │         │
    │         └──────────────────────┐
    ├──► Phase 3 (US1: Sections) ───┴──► Phase 6 (US4: Navigation)
    │                                          │
    └──► Phase 5 (US3: Login) ────────────────┴──► Phase 7 (Polish)
```

### Within Each User Story

- Components marked [P] can be built in parallel
- Integration tasks (barrel exports, page assembly) must wait for components
- Mobile responsiveness included in each component

### Parallel Opportunities

**Phase 1 (Setup)**:
```
T004 Create landing components directory    [PARALLEL-GROUP-1]
T005 Create login page directory            [PARALLEL-GROUP-1]
```

**Phase 3 (User Story 1)**:
```
T010 Header.tsx     [PARALLEL-GROUP-2]
T011 Hero.tsx       [PARALLEL-GROUP-2]
T012 Features.tsx   [PARALLEL-GROUP-2]
T013 HowItWorks.tsx [PARALLEL-GROUP-2]
T014 Benefits.tsx   [PARALLEL-GROUP-2]
T015 Footer.tsx     [PARALLEL-GROUP-2]
```

**Cross-Phase Parallel**:
- Phase 3 (US1) and Phase 5 (US3) can run in parallel after Setup
- Phase 2 (Backend) can run in parallel with Phase 3 component creation

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (Prisma, directories)
2. Complete Phase 3: User Story 1 (landing page sections)
3. **STOP and VALIDATE**: Page displays correctly, responsive
4. Deploy/demo static landing page (no form yet)

### Incremental Delivery

1. **MVP**: Phase 1 + Phase 3 → Landing page visible
2. **+ Lead Capture**: Phase 2 + Phase 4 → Form works, notifications sent
3. **+ Login Flow**: Phase 5 → Users can access dashboard
4. **+ Navigation**: Phase 6 → Smooth scroll, sticky header
5. **+ Polish**: Phase 7 → Performance optimized, accessible

### Single Developer Strategy

Execute in order: 1 → 3 → 2 → 4 → 5 → 6 → 7

Build visible UI first (Phase 3), then backend (Phase 2, 4), then supporting features.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Tests not included (not requested in spec)
- All content in Russian language
- Type-check and build must pass before each commit