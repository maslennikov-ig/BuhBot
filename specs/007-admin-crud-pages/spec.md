# Feature Specification: Admin Panel CRUD Pages & Polish

**Feature Branch**: `007-admin-crud-pages`
**Created**: 2025-11-27
**Status**: Draft
**Input**: [Phase 1.9 Prompt](../../docs/Phase-1.9-Admin-CRUD-Prompt.md)

## Problem Statement

The BuhBot backend API is nearly complete, with functional tRPC routers for FAQs, Templates, and User management. However, the frontend Admin Panel lacks the UI interfaces to interact with these APIs. Administrators currently cannot manage FAQs, Templates, or Users without direct database access. Additionally, several sidebar navigation links (`/clients`, `/sla`, `/reports`) lead to 404 errors, creating an unfinished product experience.

## User Stories

### User Story 1: FAQ Management
**As an** Administrator,
**I want to** create, edit, and delete FAQ items via a dedicated settings page,
**So that** I can keep the bot's auto-response knowledge base up to date without developer assistance.

### User Story 2: Template Management
**As a** Manager or Administrator,
**I want to** manage message templates and easily insert variables (like client name),
**So that** accountants have quick, standardized responses available in the bot.

### User Story 3: User Management
**As an** Administrator,
**I want to** view a list of all users and change their roles (Admin/Manager/Observer),
**So that** I can control access permissions within the system.

### User Story 4: Navigation & Polish
**As a** User,
**I want** all sidebar links to work (either taking me to the correct page or a "Coming Soon" placeholder),
**So that** I don't encounter broken links (404 errors) while navigating the application.

## Functional Requirements

### 1. FAQ Management (`/settings/faq`)
- **List View**:
  - Fetch data using `trpc.faq.list`.
  - Display columns: Question, Answer (truncated to ~50 chars), Keywords (as badges), Usage Count.
  - Search bar to filter results client-side or server-side.
- **Actions**:
  - Create: Opens modal/drawer. Calls `trpc.faq.create`.
  - Edit: Opens modal/drawer with pre-filled data. Calls `trpc.faq.update`.
  - Delete: Confirmation dialog. Calls `trpc.faq.delete`.
- **Form Validation**:
  - Question: Required, min 5 chars.
  - Answer: Required, min 10 chars.
  - Keywords: Array of strings (Tag input UI).

### 2. Template Management (`/settings/templates`)
- **List View**:
  - Fetch data using `trpc.templates.list`.
  - Display columns: Title, Category (colored badge), Content preview, Usage Count.
  - Filter dropdown for Categories (Greeting, Status, Document Request, Reminder, Closing).
- **Actions**:
  - Create/Edit/Delete similar to FAQ.
  - Calls `trpc.templates.create`, `trpc.templates.update`, `trpc.templates.delete`.
- **Variable Helper**:
  - In the Create/Edit form, provide clickable chips for available variables: `{{clientName}}`, `{{accountantName}}`, `{{date}}`, `{{time}}`.
  - Clicking a chip appends the variable string to the Content textarea cursor position.

### 3. User Management (`/settings/users`)
- **List View**:
  - Fetch data using `trpc.auth.listUsers`.
  - Display columns: Full Name, Email, Role, Telegram Connection Status (icon/badge based on `telegramId !== null`).
  - Search by Name or Email (client-side filtering).
- **Role Management**:
  - "Edit Role" action opens a modal.
  - Dropdown to select role (Admin, Manager, Observer).
  - Calls `trpc.auth.updateUserRole` (**requires implementation** — see T001 in tasks.md).

### 4. Navigation Polish
- **Client List**:
  - Update Sidebar link for "Clients" to point to `/chats` OR redirect `/clients` to `/chats`.
- **Placeholders**:
  - Create `ComingSoon` component using `GlassCard`.
  - Apply to `/sla` and `/reports` routes.

## UX/UI Requirements

- **Design System**: Strictly adhere to `frontend/STYLE-GUIDE.md`.
  - Use `GlassCard` for containers.
  - Use `buh-hover-lift` for interactive rows/cards.
  - Use `buh-shimmer` for loading states.
- **Tables**:
  - Use the premium table design from `RequestsTable` (transparent headers, hover effects on rows).
- **Animations**:
  - Staggered fade-in for list items using Framer Motion.
  - Smooth transitions for Modals/Drawers.

## Success Criteria

1.  **Zero 404s**: Clicking any link in the sidebar renders a valid page (or placeholder).
2.  **FAQ CRUD**: Can successfully add a question and see it in the list.
3.  **Template CRUD**: Can create a template with variables and use it.
4.  **User Roles**: Admin can change a user's role (UI updates immediately).
5.  **Visual Consistency**: New pages match the "Premium" look of the Dashboard and Landing page.

## Out of Scope

- User Registration/Invite flow (Users are created via Supabase Auth/Onboarding).
- Complex rich text editors for answers (Plain text/Markdown support only).
- Audit logs history view (P3 priority).
