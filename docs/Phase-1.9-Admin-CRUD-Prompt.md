# Prompt for Feature Specification: Admin Panel CRUD Pages & Polish

**Context:**
We are finishing Phase 1 of "BuhBot". The Backend/API layer is 90% complete (tRPC routers exist), but the Frontend UI for several management pages is missing or currently mocked. We also recently upgraded the UI to a "Premium" design (Aurora backgrounds, Glassmorphism, Framer Motion), and the new pages must strictly follow this design system.

**Goal:**
Generate a comprehensive **Feature Specification (`specs/007-admin-crud-pages/spec.md`)** to implement the missing UI pages for FAQ, Templates, and User Management, and to fix broken sidebar navigation links.

**Existing Resources (Input):**
- **Design System:** `frontend/STYLE-GUIDE.md` (Follow strict rules for tables, cards, and animations).
- **Layout:** `frontend/src/components/layout/AdminLayout.tsx` (Sidebar navigation is defined here).
- **Existing APIs (Backend is READY):**
  - `backend/src/api/trpc/routers/faq.ts` (CRUD for FAQs)
  - `backend/src/api/trpc/routers/templates.ts` (CRUD for Templates)
  - `backend/src/api/trpc/routers/auth.ts` (User listing & profile updates)

---

## Requirements for the Specification

Please generate a specification that covers the following user stories and technical tasks:

### 1. FAQ Management Page (`/settings/faq`)
*Target URL currently missing in sidebar, needs to be added or placed under Settings.*
- **List View:**
  - Table displaying Question, Answer (truncated), Keywords, Usage Count.
  - Search/Filter bar.
- **Actions:**
  - "Add FAQ" button (opens Modal/Drawer).
  - "Edit" and "Delete" actions per row.
- **Create/Edit Form:**
  - Fields: Question, Answer (Textarea), Keywords (Tag input/Array).
  - Validation using Zod.

### 2. Templates Management Page (`/settings/templates`)
*Target URL currently missing in sidebar.*
- **List View:**
  - Table/Grid displaying Title, Category (badge), Content preview, Usage Count.
  - Filter by Category (Greeting, Status, Document Request, etc.).
- **Actions:**
  - "Create Template" button.
  - "Edit" and "Delete" actions.
- **Create/Edit Form:**
  - Fields: Title, Category (Select), Content (Textarea).
  - **UX Requirement:** Helper buttons/chips to insert variables like `{{clientName}}`, `{{date}}`, `{{accountantName}}` into the content textarea.

### 3. User Management Page (`/settings/users`)
*Target URL currently missing in sidebar.*
- **List View:**
  - Table displaying Name, Email, Role (Admin/Manager/Observer), Telegram Connection Status (Connected/Not Connected).
  - Search by name/email.
- **Actions:**
  - "Edit Role" (Modal to change role).
  - *Note:* No "Create User" needed yet (users come from Auth provider), but "Invite" mock button is acceptable.

### 4. Sidebar & Navigation Cleanup
- **Fix `/clients`:** The sidebar link points to a 404. It should redirect to `/chats` (which is the actual client list) OR we should rename the sidebar item to match.
- **Fix `/sla` and `/reports`:** These are future features.
  - *Requirement:* Create "Coming Soon" placeholder pages for these routes so links don't 404. Use the `GlassCard` component and a "Construction" illustration.

### 5. Design Guidelines (Mandatory)
- **Visual Style:** All pages must use `GlassCard` components, `buh-shimmer` loading states, and `buh-hover-lift` effects defined in `global.css`.
- **Tables:** Use the premium table design from `RequestsTable` (transparent headers, hover effects on rows).
- **Animations:** Use `Framer Motion` for page transitions and list rendering (staggered fade-in).

---

## Output Structure

Generate the file `specs/007-admin-crud-pages/spec.md` containing:
1.  **Problem Statement**: Missing UI for existing APIs.
2.  **User Stories**: As an Admin, I want to manage FAQs/Templates/Users...
3.  **Functional Requirements**: Detailed field mappings to tRPC inputs.
4.  **UX/UI Requirements**: Reference to the Premium Design System.
5.  **Success Criteria**: All CRUD operations work, no 404s in sidebar.
6.  **Out of Scope**: modifying backend logic (unless critical bugs found).

*After generating the spec, please prompt to run the planning command.*
