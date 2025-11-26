# Feature Specification: Phase 2: Onboarding & Real-Time Dashboard

**Feature Branch**: `005-onboarding-dashboard`  
**Created**: 2025-11-25  
**Status**: Draft  
**Input**: User description: "Phase 2 Onboarding Dashboard"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - New User Onboarding Wizard (Priority: P1)

As a new user logging in for the first time, I want to be guided through the initial setup so that I can start using the platform without guessing what to do.

**Why this priority**: Without configuration (Bot Token, SLA rules), the system provides no value. This is the critical "first mile" for user activation.

**Independent Test**: A fresh user account logs in and is immediately redirected to the wizard. Completing the wizard enables the main dashboard.

**Acceptance Scenarios**:

1. **Given** a new user account with no configured workspace, **When** they log in, **Then** they are redirected to `/onboarding` (or a modal wizard) instead of `/dashboard`.
2. **Given** the "Connect Telegram Bot" step, **When** the user enters a valid Bot Token, **Then** the system validates it with Telegram API and sets up the webhook.
3. **Given** the "Working Hours" step, **When** the user selects Monday-Friday 09:00-18:00, **Then** these settings are saved as the default SLA schedule.
4. **Given** the "SLA Thresholds" step, **When** the user sets the "Red Zone" to 1 hour, **Then** this value is stored and used for alert logic.
5. **Given** a completed wizard, **When** the user clicks "Finish", **Then** they are redirected to the main `/dashboard` and see empty but active widgets.

---

### User Story 2 - Real-Time Dashboard Overview (Priority: P1)

As an administrator, I want to see real-time metrics on the dashboard so that I can make immediate decisions about my team's performance.

**Why this priority**: The core value proposition is "monitoring". Users need to see the current state of their SLA compliance instantly.

**Independent Test**: Sending a message to the bot updates the "Active Alerts" widget and "SLA Compliance" metrics on the dashboard without page refresh (or on next poll).

**Acceptance Scenarios**:

1. **Given** the dashboard loads, **When** I look at "Active Alerts", **Then** I see a list of currently unanswered requests fetched from the real database.
2. **Given** the "SLA Compliance" widget, **When** viewed, **Then** it displays the percentage of requests answered within the SLA threshold for the current day.
3. **Given** the "Response Time" widget, **When** viewed, **Then** it shows the average response time trend comparing today vs. yesterday.
4. **Given** the "Violations" widget, **When** viewed, **Then** it shows the accurate count of SLA breaches for the current day.

---

### User Story 3 - Settings Management (Priority: P2)

As an administrator, I want to be able to change my workspace configuration so that I can adapt to changing business hours or update my bot token.

**Why this priority**: Users make mistakes during onboarding or business needs change. They must be able to edit settings later.

**Independent Test**: Changing working hours in Settings affects new SLA calculations immediately.

**Acceptance Scenarios**:

1. **Given** the Settings page, **When** I update the "Working Hours", **Then** the new schedule is saved to the database.
2. **Given** the Settings page, **When** I verify the "Bot Token" section, **Then** I can update the token if the bot needs to be changed.
3. **Given** the Settings page, **When** I adjust SLA thresholds, **Then** new alerts follow the updated rules.

---

### User Story 4 - Premium Authentication Experience (Priority: P2)

As a user, I want a login experience that feels consistent with the premium landing page so that I trust the platform's quality.

**Why this priority**: Visual consistency builds trust. The jarring transition from a premium landing page to a default auth UI hurts brand perception.

**Independent Test**: Visiting `/login` shows a page with Aurora backgrounds and glassmorphism styles matching the home page.

**Acceptance Scenarios**:

1. **Given** an unauthenticated user, **When** they visit `/login`, **Then** they see a styled login page (not the default Supabase/Next.js unstyled form).
2. **Given** the login page, **When** they authenticate successfully, **Then** they are redirected to the Dashboard (or Onboarding if new).

---

### Edge Cases

- **Bot Token Invalid**: System must provide a clear error message if the Telegram API rejects the token during onboarding.
- **No Data**: Dashboard widgets must handle the "zero state" gracefully (e.g., "No requests yet today") without crashing or showing `NaN`.
- **Onboarding Abandonment**: If a user closes the browser during the wizard, they should return to the same step (or start of wizard) on next login, not the dashboard.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a multi-step Onboarding Wizard for users who have not completed initial setup.
- **FR-002**: System MUST validate the Telegram Bot Token against the Telegram API before saving.
- **FR-003**: System MUST allow configuring working hours (Start Time, End Time, Days of Week) and SLA response time threshold (in minutes).
- **FR-004**: Dashboard MUST display real-time data aggregated from the database, not mock data.
- **FR-005**: `SlaComplianceWidget` MUST calculate compliance percentage: `(Requests within SLA / Total Requests) * 100`.
- **FR-006**: `ResponseTimeWidget` MUST calculate average response time in minutes for the current period.
- **FR-007**: `ActiveAlertsWidget` MUST list `ClientRequest` items with status `pending` or `in_progress`.
- **FR-008**: Login page MUST utilize the design system (Aurora gradients, glassmorphism) defined in Phase 1.7.
- **FR-009**: Settings page MUST provide read/write access to Global Settings (Working Hours, SLA config).
- **FR-010**: System MUST serve static content for Privacy Policy and Terms of Service.

### Key Entities

- **OnboardingState**: Tracks whether a user/workspace has completed the setup wizard. (Can be a flag in `GlobalSettings` or `User`).
- **GlobalSettings**: Stores system-wide config: Bot Token (encrypted/securely stored reference), Working Hours, SLA Thresholds.
- **DashboardMetrics**: Aggregated data structure for frontend consumption (Compliance %, Avg Response Time, Violation Count).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of new users are forced through the Onboarding Wizard before accessing the Dashboard.
- **SC-002**: Dashboard widgets load real data in under 2 seconds on a standard connection.
- **SC-003**: Administrators can successfully update their Working Hours via Settings without database errors.
- **SC-004**: Visual regression testing confirms the Login page matches the Landing Page aesthetic (fonts, colors, gradients).
- **SC-005**: SLA Compliance calculation is accurate to within 1% based on stored request data.