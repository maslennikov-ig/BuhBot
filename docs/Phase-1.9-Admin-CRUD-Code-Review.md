# Admin CRUD Pages - Code Review Report

**Date**: 2025-11-29
**Reviewer**: Code Review Agent
**Feature**: 007-admin-crud-pages

---

## Context for Executing Agent

### Project Structure

```
/home/me/code/bobabuh/
├── backend/src/api/trpc/routers/   # tRPC routes (auth.ts, faq.ts, templates.ts)
├── frontend/src/
│   ├── app/settings/               # Next.js pages (faq/, templates/, users/)
│   ├── components/
│   │   ├── layout/GlassCard.tsx    # Glassmorphism card component
│   │   ├── requests/RequestsTable.tsx  # REFERENCE for premium table design
│   │   ├── settings/               # Components to fix (faq/, templates/, users/)
│   │   └── ui/                     # shadcn components
│   └── styles/design-system.css    # CSS variables (--buh-*)
└── frontend/STYLE-GUIDE.md         # Design system documentation
```

### Key Design System Classes

- `buh-hover-lift` — translateY(-2px) + shadow on hover (150ms)
- `buh-shimmer` — loading skeleton animation
- `buh-animate-fade-in-up` — entrance animation (use with `animationDelay`)
- `GlassCard` — glassmorphism container component

### Task Execution Order (Dependencies)

```
Task 1 (Critical) — No dependencies, execute first
Tasks 2-5 (High) — Can run in parallel after Task 1
Task 6 (Medium) — Installs sonner, must complete before Tasks 7-8
Tasks 7-8 (Medium) — Depend on Task 6
Task 9 (Medium) — Creates ConfirmDialog, no dependencies
Tasks 10-11 (Low) — No dependencies
```

### Important Notes for Agent

1. **Line numbers are approximate** — code may have shifted. Search by code patterns.
2. **Use `trpc.auth.me.useQuery()` for current user** — already available in tRPC client.
3. **Toast library**: Install `sonner` (not react-hot-toast) — it's lighter and works with App Router.
4. **After changes**: Run `pnpm type-check` to verify no TypeScript errors.

### Reference Code: Premium Table Pattern (from RequestsTable.tsx)

**Gradient accent bar on hover:**

```tsx
<GlassCard className="group relative overflow-hidden">
  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
  {/* ... content */}
</GlassCard>
```

**Icon header with gradient background:**

```tsx
<div className="flex items-center gap-3">
  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-accent)]/10 to-[var(--buh-primary)]/10">
    <MessageSquare className="h-5 w-5 text-[var(--buh-primary)]" />
  </div>
  <div>
    <h3 className="text-base font-semibold">Title</h3>
    <p className="text-xs text-[var(--buh-foreground-subtle)]">Description</p>
  </div>
</div>
```

**Table header styling:**

```tsx
<th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]">
```

**Staggered row animation:**

```tsx
<tr
  className="transition-colors hover:bg-[var(--buh-surface-elevated)]/50 buh-animate-fade-in-up"
  style={{ animationDelay: `${index * 0.05}s` }}
>
```

---

## Executive Summary

Comprehensive review of Admin CRUD pages implementation completed. **11 issues found**:

- **Critical Issues**: 1 (FAQ/Templates delete permission mismatch)
- **High Priority Issues**: 4 (design system compliance, UX improvements)
- **Medium Priority Issues**: 4 (code quality, consistency)
- **Low Priority Issues**: 2 (minor improvements)

**Overall Status**: Implementation is functional but needs design system compliance improvements and UX enhancements.

---

## Issues Found

### Critical Issues

#### 1. Permission Mismatch: Delete Operations

**File(s)**:

- `/home/me/code/bobabuh/frontend/src/components/settings/faq/FaqList.tsx` (lines 25-34)
- `/home/me/code/bobabuh/frontend/src/components/settings/templates/TemplateList.tsx` (lines 33-42)

**Problem**:
Frontend allows **all authenticated users** to delete FAQ/Templates via `trpc.faq.delete` and `trpc.templates.delete`, but backend routers require **admin-only** permission (`adminProcedure`). This will cause runtime errors when non-admin users attempt deletion.

**Evidence**:

- Backend: `faq.ts` line 292 uses `adminProcedure`
- Backend: `templates.ts` line 230 uses `adminProcedure`
- Frontend: Both components use `trpc.faq.delete.useMutation()` and `trpc.templates.delete.useMutation()` without role checks

**Impact**: Non-admin users will see delete buttons, click them, confirm deletion, and receive an authorization error. Poor UX and confusing permissions model.

---

### High Priority Issues

#### 2. Missing Premium Table Design Pattern

**File(s)**:

- `/home/me/code/bobabuh/frontend/src/components/settings/faq/FaqList.tsx` (lines 72-125)
- `/home/me/code/bobabuh/frontend/src/components/settings/users/UserList.tsx` (lines 66-122)

**Problem**:
Tables use basic styling instead of premium design pattern from `RequestsTable.tsx`. Missing:

- Gradient accent bar on hover (top border)
- Icon header with gradient background
- Staggered fade-in animations (`buh-animate-fade-in-up` with delays)
- Uppercase, tracked table headers
- Proper empty state with centered icon

**Reference**: `/home/me/code/bobabuh/frontend/src/components/requests/RequestsTable.tsx` lines 95-233

**Impact**: Inconsistent UI, less polished feel compared to other admin pages.

---

#### 3. Missing Hover Lift Effect on Interactive Elements

**File(s)**:

- `/home/me/code/bobabuh/frontend/src/components/settings/templates/TemplateList.tsx` (line 88)

**Problem**:
Template cards use `hover:shadow-md` instead of `buh-hover-lift` utility class. Style guide (section 6.3) specifies:

> `.buh-hover-lift`: translateY(-2px) + shadow | 150ms

**Current Code**:

```tsx
className = '... hover:border-[var(--buh-primary)] hover:shadow-md';
```

**Expected**:

```tsx
className = '... buh-hover-lift';
```

**Impact**: Inconsistent micro-interactions, missing the signature "lift" animation.

---

#### 4. Missing Loading State Shimmer

**File(s)**:

- `/home/me/code/bobabuh/frontend/src/components/settings/faq/FaqList.tsx` (line 50)
- `/home/me/code/bobabuh/frontend/src/components/settings/templates/TemplateList.tsx` (line 57)
- `/home/me/code/bobabuh/frontend/src/components/settings/users/UserList.tsx` (line 48)

**Problem**:
Loading states use generic `buh-shimmer` div without proper structure. Style guide recommends skeleton UI matching final content layout.

**Current**:

```tsx
if (isLoading) {
  return <div className="buh-shimmer h-64 w-full rounded-xl" />;
}
```

**Better Approach**: Skeleton table rows or skeleton cards (see `RecentRequestsTable.tsx` for reference pattern).

**Impact**: Jarring layout shift when data loads, poor perceived performance.

---

#### 5. Variable Chip Insertion UX Issue

**File(s)**: `/home/me/code/bobabuh/frontend/src/components/settings/templates/TemplateForm.tsx` (lines 93-110)

**Problem**:
Variable insertion implementation is correct (cursor position preserved), but **no visual feedback** when chip is clicked. Users don't know if the click registered.

**Current Behavior**: Silent insertion at cursor position.

**Better UX**:

- Add brief highlight animation on textarea after insertion
- Or show toast notification: "Переменная {{variable}} добавлена"

**Impact**: Users may click multiple times thinking it didn't work, leading to duplicate variables.

---

### Medium Priority Issues

#### 6. Inconsistent Empty State Messaging

**File(s)**:

- `/home/me/code/bobabuh/frontend/src/components/settings/faq/FaqList.tsx` (line 87)
- `/home/me/code/bobabuh/frontend/src/components/settings/templates/TemplateList.tsx` (line 82)
- `/home/me/code/bobabuh/frontend/src/components/settings/users/UserList.tsx` (line 80)

**Problem**:
Empty states show generic "Нет данных" without actionable guidance. Compare to `RequestsTable.tsx` which provides context-specific messages.

**Current**: "Нет данных"

**Better**:

- FAQ: "Нет вопросов в базе знаний. Создайте первый вопрос для автоответов бота."
- Templates: "Нет шаблонов сообщений. Создайте шаблон для быстрых ответов."
- Users: "Нет пользователей" (acceptable, rare case)

**Impact**: Missed opportunity to guide new users.

---

#### 7. Missing Confirmation Feedback After Delete

**File(s)**:

- `/home/me/code/bobabuh/frontend/src/components/settings/faq/FaqList.tsx` (lines 31-34)
- `/home/me/code/bobabuh/frontend/src/components/settings/templates/TemplateList.tsx` (lines 39-42)

**Problem**:
After successful deletion, no visual confirmation (toast, snackbar, or temporary message). User sees item disappear but no acknowledgment.

**Current**: Silent deletion after confirmation dialog.

**Better**: Add toast notification on success:

```tsx
onSuccess: () => {
  utils.faq.list.invalidate();
  toast.success('Вопрос удален');
};
```

**Impact**: Users may be unsure if deletion succeeded or if there was a network issue.

---

#### 8. Hardcoded Strings (i18n Readiness)

**File(s)**: All frontend components

**Problem**:
All user-facing strings are hardcoded in Russian. While acceptable for Russia-only deployment (as per CLAUDE.md), missing i18n keys makes future internationalization harder.

**Examples**:

- "Вопрос обязателен"
- "Поиск по вопросам..."
- "Добавить вопрос"

**Recommendation**: No immediate action required, but document this as known limitation for future multilingual support.

**Impact**: Low (meets current requirements, but technical debt).

---

#### 9. Missing Keyboard Accessibility on Delete Confirmation

**File(s)**:

- `/home/me/code/bobabuh/frontend/src/components/settings/faq/FaqList.tsx` (line 32)
- `/home/me/code/bobabuh/frontend/src/components/settings/templates/TemplateList.tsx` (line 40)

**Problem**:
Uses browser `confirm()` dialog which:

- Is not styleable (breaks design system)
- Doesn't match BuhBot aesthetics
- Limited keyboard accessibility

**Better**: Use custom modal dialog component (similar to `UserRoleDialog.tsx`).

**Impact**: Inconsistent UX, accessibility concerns.

---

#### 10. AdminLayout Sidebar Link Issue

**File(s)**: `/home/me/code/bobabuh/frontend/src/components/layout/AdminLayout.tsx` (lines 50-107)

**Problem**:
Task mentioned fixing `/clients` -> `/chats`, but current code shows correct `/chats` link (line 70). **No issue found** - likely already fixed.

**Status**: ✅ **Verified correct** - No action needed.

---

### Low Priority Issues

#### 11. Missing ARIA Labels on Icon-Only Buttons

**File(s)**:

- `/home/me/code/bobabuh/frontend/src/components/settings/faq/FaqList.tsx` (lines 112-117)
- `/home/me/code/bobabuh/frontend/src/components/settings/templates/TemplateList.tsx` (lines 96-101)

**Problem**:
Edit and Delete icon buttons in tables don't have `aria-label` attributes. Screen reader users won't know button purpose.

**Current**:

```tsx
<Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
  <Edit2 className="h-4 w-4" />
</Button>
```

**Better**:

```tsx
<Button variant="ghost" size="icon" onClick={() => onEdit(item)} aria-label="Редактировать вопрос">
  <Edit2 className="h-4 w-4" />
</Button>
```

**Impact**: Accessibility issue for screen reader users.

---

#### 12. Category Dropdown Not Using shadcn Select Component

**File(s)**: `/home/me/code/bobabuh/frontend/src/components/settings/templates/TemplateForm.tsx` (lines 141-150)

**Problem**:
Uses native `<select>` element instead of shadcn/ui `Select` component. Inconsistent with design system.

**Current**:

```tsx
<select className="flex h-10 w-full rounded-md border..." {...field}>
```

**Better**: Use `@/components/ui/select` from shadcn/ui for consistent styling.

**Impact**: Minor visual inconsistency.

---

## Fix Tasks

### Task 1: Add Role-Based Delete Button Visibility

**Priority**: Critical
**File(s)**:

- `/home/me/code/bobabuh/frontend/src/components/settings/faq/FaqList.tsx`
- `/home/me/code/bobabuh/frontend/src/components/settings/templates/TemplateList.tsx`

**Problem**: Non-admin users can see and click delete buttons, causing authorization errors.

**Prompt**:

```
In FaqList.tsx and TemplateList.tsx, hide the delete button for non-admin users.

1. Import the user profile from tRPC:
   - Add at top of component: `const { data: currentUser } = trpc.auth.me.useQuery();`

2. Conditionally render delete button only for admins:
   - Wrap the delete Button in: `{currentUser?.role === 'admin' && ( ... )}`

3. Apply to both files:
   - FaqList.tsx line 115-117
   - TemplateList.tsx line 99-101

Expected behavior: Only admin users see trash icon buttons. Managers can still create/edit.
```

---

### Task 2: Apply Premium Table Design to FAQ List

**Priority**: High
**File(s)**: `/home/me/code/bobabuh/frontend/src/components/settings/faq/FaqList.tsx`

**Problem**: Table uses basic styling instead of premium design pattern.

**Prompt**:

````
Upgrade FaqList table to match premium RequestsTable design pattern.

Reference: /home/me/code/bobabuh/frontend/src/components/requests/RequestsTable.tsx

Changes needed in FaqList.tsx:

1. Wrap GlassCard with gradient hover effect (add at line 54):
   - Add `className="relative overflow-hidden group"` to GlassCard
   - Add gradient bar: `<div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />`

2. Add icon header (before search bar):
   ```tsx
   <div className="flex items-center gap-3 mb-4">
     <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--buh-accent)]/10 to-[var(--buh-primary)]/10">
       <MessageSquare className="h-5 w-5 text-[var(--buh-primary)]" />
     </div>
     <div>
       <h3 className="text-base font-semibold text-[var(--buh-foreground)]">База знаний</h3>
       <p className="text-xs text-[var(--buh-foreground-subtle)]">Управление FAQ ботом</p>
     </div>
   </div>
````

3. Update table headers (line 74-81):
   - Add to th: `className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--buh-foreground-muted)]"`

4. Add staggered animations to rows (line 91):

   ```tsx
   <tr
     key={item.id}
     className="hover:bg-[var(--buh-surface-elevated)] transition-colors buh-animate-fade-in-up"
     style={{ animationDelay: `${index * 0.05}s` }}
   >
   ```

5. Improve empty state (lines 84-89):
   ```tsx
   <div className="flex flex-col items-center justify-center py-12">
     <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--buh-surface-elevated)]">
       <HelpCircle className="h-8 w-8 text-[var(--buh-foreground-subtle)]" />
     </div>
     <p className="mt-4 text-sm font-medium text-[var(--buh-foreground)]">
       Нет вопросов в базе знаний
     </p>
     <p className="mt-1 text-sm text-[var(--buh-foreground-subtle)]">
       Создайте первый вопрос для автоответов бота
     </p>
   </div>
   ```

Expected result: Table matches RequestsTable premium design with gradient accents, staggered animations, and proper header.

```

---

### Task 3: Apply Premium Table Design to User List
**Priority**: High
**File(s)**: `/home/me/code/bobabuh/frontend/src/components/settings/users/UserList.tsx`

**Problem**: Same as Task 2 but for Users table.

**Prompt**:
```

Apply the same premium table design pattern to UserList.tsx as described in Task 2.

Follow exact same steps but use:

- Icon: `<Users />` instead of MessageSquare
- Header title: "Пользователи системы"
- Header description: "Управление ролями и доступом"
- Empty state icon: `<Users />` (rare case, acceptable simple message)

Reference: /home/me/code/bobabuh/frontend/src/components/requests/RequestsTable.tsx
Apply to: /home/me/code/bobabuh/frontend/src/components/settings/users/UserList.tsx

```

---

### Task 4: Add Hover Lift Effect to Template Cards
**Priority**: High
**File(s)**: `/home/me/code/bobabuh/frontend/src/components/settings/templates/TemplateList.tsx`

**Problem**: Missing `buh-hover-lift` utility class.

**Prompt**:
```

Replace custom hover effect with design system utility class in TemplateList.tsx.

Line 88 - Change:
FROM:

```tsx
className =
  'group relative flex flex-col justify-between rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface-subtle)] p-4 transition-all hover:border-[var(--buh-primary)] hover:shadow-md';
```

TO:

```tsx
className =
  'group relative flex flex-col justify-between rounded-lg border border-[var(--buh-border)] bg-[var(--buh-surface-subtle)] p-4 buh-hover-lift hover:border-[var(--buh-primary)]';
```

Expected behavior: Cards lift 2px on hover with smooth 150ms transition, matching design system standard.

```

---

### Task 5: Improve Loading State Skeletons
**Priority**: High
**File(s)**:
- `/home/me/code/bobabuh/frontend/src/components/settings/faq/FaqList.tsx`
- `/home/me/code/bobabuh/frontend/src/components/settings/templates/TemplateList.tsx`
- `/home/me/code/bobabuh/frontend/src/components/settings/users/UserList.tsx`

**Problem**: Generic shimmer div causes layout shift.

**Prompt**:
```

Replace loading shimmer with proper skeleton UI matching final layout.

For FAQ and Users (table layouts):

```tsx
if (isLoading) {
  return (
    <GlassCard variant="default" padding="md" className="flex flex-col gap-4">
      <div className="buh-shimmer h-9 w-64 rounded-lg" /> {/* Search bar skeleton */}
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <div className="buh-shimmer h-4 w-32 rounded" />
            <div className="buh-shimmer h-4 w-48 rounded" />
            <div className="buh-shimmer h-4 w-24 rounded" />
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
```

For Templates (card grid layout):

```tsx
if (isLoading) {
  return (
    <GlassCard variant="default" padding="md" className="flex flex-col gap-4">
      <div className="buh-shimmer h-9 w-64 rounded-lg" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="buh-shimmer h-40 w-full rounded-lg" />
        ))}
      </div>
    </GlassCard>
  );
}
```

Apply to all three files at their respective isLoading checks.

```

---

### Task 6: Add Visual Feedback for Variable Chip Insertion
**Priority**: Medium
**File(s)**: `/home/me/code/bobabuh/frontend/src/components/settings/templates/TemplateForm.tsx`

**Problem**: No visual feedback when variable chip is clicked.

**Prompt**:
```

Add brief highlight animation when variable is inserted in TemplateForm.tsx.

1. Install sonner for toast notifications (if not already):

   ```bash
   cd frontend && pnpm add sonner
   ```

2. Import at top of TemplateForm.tsx:

   ```tsx
   import { toast } from 'sonner';
   ```

3. Update insertVariable function (line 93-110):
   Add after line 109 (after textarea.setSelectionRange):

   ```tsx
   toast.success(`Переменная ${variable} добавлена`, {
     duration: 1500,
     position: 'bottom-right',
   });
   ```

4. Add Toaster to app layout:
   In `/home/me/code/bobabuh/frontend/src/app/layout.tsx`, add:

   ```tsx
   import { Toaster } from 'sonner';

   // Inside <body>:
   <Toaster />;
   ```

Expected behavior: Brief toast notification appears when chip is clicked, confirming insertion.

```

---

### Task 7: Improve Empty State Messages
**Priority**: Medium
**File(s)**:
- `/home/me/code/bobabuh/frontend/src/components/settings/faq/FaqList.tsx`
- `/home/me/code/bobabuh/frontend/src/components/settings/templates/TemplateList.tsx`

**Problem**: Generic "Нет данных" message lacks guidance.

**Prompt**:
```

Update empty state messages to be more helpful and actionable.

FaqList.tsx (line 87):
FROM: "Нет данных"
TO: "Нет вопросов в базе знаний. Создайте первый вопрос для автоответов бота."

TemplateList.tsx (line 82):
FROM: "Нет данных"
TO: "Нет шаблонов сообщений. Создайте шаблон для быстрых ответов."

Keep UserList.tsx as is (rare empty case).

Expected: Users understand why list is empty and what action to take.

```

---

### Task 8: Add Delete Success Confirmation
**Priority**: Medium
**File(s)**:
- `/home/me/code/bobabuh/frontend/src/components/settings/faq/FaqList.tsx`
- `/home/me/code/bobabuh/frontend/src/components/settings/templates/TemplateList.tsx`

**Problem**: No feedback after successful deletion.

**Prompt**:
```

Add success toast after delete operation completes.

Prerequisites: Task 6 must be completed first (sonner installed).

In both FaqList.tsx and TemplateList.tsx:

1. Import toast:

   ```tsx
   import { toast } from 'sonner';
   ```

2. Update deleteMutation onSuccess:

FaqList.tsx (line 26):

```tsx
onSuccess: () => {
  utils.faq.list.invalidate();
  toast.success('Вопрос удален');
};
```

TemplateList.tsx (line 34):

```tsx
onSuccess: () => {
  utils.templates.list.invalidate();
  toast.success('Шаблон удален');
};
```

Expected: Brief success message appears after deletion completes.

```

---

### Task 9: Replace Browser Confirm with Custom Modal
**Priority**: Medium
**File(s)**:
- `/home/me/code/bobabuh/frontend/src/components/settings/faq/FaqList.tsx`
- `/home/me/code/bobabuh/frontend/src/components/settings/templates/TemplateList.tsx`

**Problem**: Browser `confirm()` dialog breaks design consistency.

**Prompt**:
```

Create reusable ConfirmDialog component and replace browser confirm().

1. Create new file: `/home/me/code/bobabuh/frontend/src/components/ui/ConfirmDialog.tsx`

```tsx
'use client';

import * as React from 'react';
import { GlassCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import { X, AlertCircle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <GlassCard
        variant="elevated"
        padding="lg"
        className="w-full max-w-md relative animate-in fade-in zoom-in duration-200"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-[var(--buh-foreground-muted)] hover:text-[var(--buh-foreground)]"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start gap-4 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--buh-error-muted)] text-[var(--buh-error)]">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[var(--buh-foreground)]">{title}</h2>
            <p className="text-sm text-[var(--buh-foreground-muted)] mt-1">{description}</p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            {cancelText}
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
```

2. Update FaqList.tsx:

Add state:

```tsx
const [deleteConfirm, setDeleteConfirm] = React.useState<{ open: boolean; id: string | null }>({
  open: false,
  id: null,
});
```

Replace handleDelete function (line 31-34):

```tsx
const handleDelete = async () => {
  if (!deleteConfirm.id) return;
  await deleteMutation.mutateAsync({ id: deleteConfirm.id });
  setDeleteConfirm({ open: false, id: null });
};
```

Update delete button onClick (line 115):

```tsx
onClick={() => setDeleteConfirm({ open: true, id: item.id })}
```

Add dialog before closing </GlassCard>:

```tsx
<ConfirmDialog
  open={deleteConfirm.open}
  onClose={() => setDeleteConfirm({ open: false, id: null })}
  onConfirm={handleDelete}
  title="Удалить вопрос?"
  description="Это действие нельзя отменить. Вопрос будет удален из базы знаний."
  confirmText="Удалить"
/>
```

3. Apply same pattern to TemplateList.tsx with appropriate messaging.

Expected: Custom modal matching BuhBot design replaces browser confirm dialog.

```

---

### Task 10: Add ARIA Labels to Icon Buttons
**Priority**: Low
**File(s)**:
- `/home/me/code/bobabuh/frontend/src/components/settings/faq/FaqList.tsx`
- `/home/me/code/bobabuh/frontend/src/components/settings/templates/TemplateList.tsx`

**Problem**: Screen readers can't identify button purpose.

**Prompt**:
```

Add aria-label attributes to all icon-only buttons.

FaqList.tsx:

- Line 112: Add `aria-label="Редактировать вопрос"` to Edit Button
- Line 115: Add `aria-label="Удалить вопрос"` to Delete Button

TemplateList.tsx:

- Line 96: Add `aria-label="Редактировать шаблон"` to Edit Button
- Line 99: Add `aria-label="Удалить шаблон"` to Delete Button

Example:

```tsx
<Button variant="ghost" size="icon" onClick={() => onEdit(item)} aria-label="Редактировать вопрос">
  <Edit2 className="h-4 w-4" />
</Button>
```

Expected: Screen readers announce button purpose when focused.

```

---

### Task 11: Replace Native Select with shadcn Select Component
**Priority**: Low
**File(s)**: `/home/me/code/bobabuh/frontend/src/components/settings/templates/TemplateForm.tsx`

**Problem**: Native select element doesn't match design system.

**Prompt**:
```

Replace native <select> with shadcn/ui Select component in TemplateForm.tsx.

1. Import Select components:

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
```

2. Replace FormField for category (lines 134-155):

```tsx
<FormField
  control={form.control}
  name="category"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Категория</FormLabel>
      <Select onValueChange={field.onChange} defaultValue={field.value}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Выберите категорию" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          {CATEGORIES.map((cat) => (
            <SelectItem key={cat.value} value={cat.value}>
              {cat.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

Expected: Dropdown matches shadcn/ui design with proper animations and keyboard navigation.

```

---

## Verification Checklist

After completing fix tasks:

- [ ] Run `pnpm type-check` - passes? (Currently ✅ passes)
- [ ] Run `pnpm build` - passes? (Not tested yet)
- [ ] Manual test: FAQ CRUD works? (Backend routes verified ✅)
- [ ] Manual test: Template CRUD works? (Backend routes verified ✅)
- [ ] Manual test: User role change works? (Backend route verified ✅)
- [ ] Manual test: Non-admin users don't see delete buttons? (After Task 1)
- [ ] Manual test: Tables have premium design (gradient, animations)? (After Tasks 2-3)
- [ ] Manual test: Variable chip insertion shows toast? (After Task 6)
- [ ] Manual test: Delete operations show custom modal? (After Task 9)
- [ ] Manual test: Screen reader announces button labels? (After Task 10)

---

## Additional Observations

### Positive Aspects ✅

1. **Backend Implementation**: Excellent
   - Proper permission middleware (`adminProcedure`, `managerProcedure`)
   - Comprehensive validation with Zod schemas
   - Good documentation comments
   - Error handling with TRPCError

2. **Type Safety**: Excellent
   - Proper use of `inferRouterOutputs` for type inference
   - No TypeScript errors (type-check passes)
   - Zod validation on all forms

3. **Component Structure**: Good
   - Clean separation of List/Form components
   - Proper use of tRPC hooks and invalidation
   - State management with React.useState

4. **Design System Usage**: Partial
   - GlassCard component used correctly
   - Color variables used consistently
   - Missing some advanced patterns (hover-lift, staggered animations)

### Technical Debt

1. **No i18n**: All strings hardcoded in Russian (acceptable per CLAUDE.md, but limits future expansion)
2. **No unit tests**: No test coverage for components or backend routes
3. **No E2E tests**: Manual testing required for all flows
4. **Browser confirm()**: Will be addressed in Task 9

---

## Execution Priority

**Critical (Immediate)**:
1. Task 1 - Role-based delete visibility (security/UX issue)

**High (Before Production)**:
2. Task 2 - Premium table design for FAQ
3. Task 3 - Premium table design for Users
4. Task 4 - Hover lift effect on templates
5. Task 5 - Loading state skeletons

**Medium (Next Sprint)**:
6. Task 6 - Variable chip feedback
7. Task 7 - Empty state messages
8. Task 8 - Delete success confirmation
9. Task 9 - Custom confirm modal

**Low (Backlog)**:
10. Task 10 - ARIA labels
11. Task 11 - shadcn Select component

---

## Conclusion

Implementation is **functionally complete** with correct backend routes, type-safe frontend, and working CRUD operations. However, **design system compliance** needs improvement to match the premium aesthetic of other BuhBot admin pages (RequestsTable, Dashboard).

**Recommendation**: Complete Critical and High priority tasks before merging to main. Medium priority tasks can be addressed in Phase 1.10.

---

**Review completed**: 2025-11-29
**Next action**: Execute fix tasks in priority order
```
