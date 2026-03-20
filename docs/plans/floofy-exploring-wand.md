# Plan: Users Page Overhaul + Role "Accountant" + Responsible Persons Fix

## Context

Тестер (Сергей Соловьёв) сообщил о 3 проблемах:

1. **Нет роли "Бухгалтер"** — при создании/редактировании пользователя доступны только 3 роли (Администратор, Менеджер, Наблюдатель). Роль `accountant` существует в Prisma schema и полностью поддерживается бэкендом, но фронтенд UI её не отображает.
2. **Пустой список "Ответственных бухгалтеров"** — в настройках чата компонент `AccountantSelect` запрашивает `trpc.user.list({ role: 'accountant' })`, но пользователей с такой ролью нет (т.к. невозможно назначить через UI). Кроме того, Менеджеры и Администраторы тоже должны быть доступны как "Ответственные".
3. **Страница пользователей неюзабельна** — из действий: только создание/удаление, смена роли, привязка Telegram ID. Нет редактирования имени/email, деактивации, назначения менеджеров бухгалтерам, фильтрации по ролям.

## Root Cause

- Массив `ROLES` в `UserCreateDialog.tsx:22-34` и `UserRoleDialog.tsx:24-36` не содержит `accountant`.
- `ROLE_LABELS` и `ROLE_COLORS` в `UserList.tsx:25-35` не содержат `accountant`.
- `AccountantSelect.tsx:68-69` фильтрует только `role: 'accountant'` — нужно расширить на `['accountant', 'manager', 'admin']`.
- Страница `users/page.tsx` не предоставляет UI для редактирования профиля, деактивации, назначения менеджеров.

---

## Tasks

### Task 1: Add "Бухгалтер" role to all UI components (Simple — MAIN)

**Files:**
- `frontend/src/components/settings/users/UserCreateDialog.tsx` — добавить `accountant` в массив `ROLES` (line 22-34)
- `frontend/src/components/settings/users/UserRoleDialog.tsx` — добавить `accountant` в массив `ROLES` (line 24-36)
- `frontend/src/components/settings/users/UserList.tsx` — добавить `accountant` в `ROLE_LABELS` (line 25-29) и `ROLE_COLORS` (line 31-35)

**Changes:**
```typescript
// Add to ROLES arrays in UserCreateDialog and UserRoleDialog:
{
  value: 'accountant',
  label: 'Бухгалтер',
  description: 'Ответственный за чаты с клиентами. Получает SLA-уведомления.'
}

// Add to ROLE_LABELS in UserList:
accountant: 'Бухгалтер',

// Add to ROLE_COLORS in UserList:
accountant: 'text-[var(--buh-success)] bg-[var(--buh-success)]/10',
```

### Task 2: Fix "Ответственный бухгалтер" dropdown — expand to all assignable roles (Simple — MAIN)

**Files:**
- `frontend/src/components/chats/AccountantSelect.tsx` — изменить запрос (line 68-69)

**Changes:**
Изменить `{ role: 'accountant' }` на `{ role: ['accountant', 'manager', 'admin'] }` в запросе `trpc.user.list.useQuery`.

Переименовать label "Бухгалтеры не найдены" на "Ответственные не найдены" (line 343).

Опционально: переименовать компонент в `ResponsibleSelect` — но это breaking change, поэтому оставляем `AccountantSelect` и меняем только поведение.

### Task 3: Add backend `auth.updateUser` procedure for admin editing (Medium — subagent)

**Files:**
- `backend/src/api/trpc/routers/auth.ts` — добавить `updateUser` adminProcedure

**Procedure:**
```typescript
updateUser: adminProcedure
  .input(z.object({
    userId: z.string().uuid(),
    fullName: z.string().min(1).optional(),
    email: z.string().email().optional(),
    isActive: z.boolean().optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    // Validate user exists
    // Update only provided fields
    // If email changed + not dev mode, update in Supabase Auth too
    return { success: true };
  })
```

### Task 4: Create `UserEditDialog` component (Medium — subagent)

**Files:**
- `frontend/src/components/settings/users/UserEditDialog.tsx` — NEW

**Features:**
- Редактирование fullName и email
- Переключатель isActive (деактивация/активация)
- Для роли `accountant`: показать и управлять назначенными менеджерами (через `userManager.listByAccountant` + `userManager.assign`/`unassign`)
- Для роли `manager`/`admin`: показать подчинённых бухгалтеров (через `userManager.listByManager`)
- Использовать существующие стили GlassCard + BuhBot design system

### Task 5: Enhance UserList with filters and inline actions (Medium — subagent)

**Files:**
- `frontend/src/components/settings/users/UserList.tsx` — модификация

**Changes:**
- Добавить фильтр по ролям (chips/tabs: Все / Администраторы / Менеджеры / Бухгалтеры / Наблюдатели)
- Добавить колонку "Статус" (активен/деактивирован) с цветным badge
- Заменить кнопку "Изменить роль" на иконку-кнопку "Редактировать" (pencil), которая открывает `UserEditDialog`
- Добавить callback `onEditUser` в props

### Task 6: Wire UserEditDialog into UsersPage (Simple — MAIN)

**Files:**
- `frontend/src/app/settings/users/page.tsx` — добавить состояние и обработчики для `UserEditDialog`

---

## Dependency Graph

```
Task 1 (roles in UI) ── independent
Task 2 (AccountantSelect) ── independent
Task 3 (backend updateUser) ── blocks Task 4
Task 4 (UserEditDialog) ── blocks Task 6, depends on Task 3
Task 5 (UserList filters) ── blocks Task 6
Task 6 (wire into page) ── depends on Tasks 4, 5
```

### Execution Order:
1. **Parallel**: Task 1 + Task 2 + Task 3 + Task 5
2. **Sequential**: Task 4 (after Task 3)
3. **Sequential**: Task 6 (after Tasks 4, 5)

---

## Existing Code to Reuse

- `GlassCard` — `frontend/src/components/layout/GlassCard.tsx` (dialog container)
- `Button` — `frontend/src/components/ui/button.tsx`
- `trpc.user.list` — `backend/src/api/trpc/routers/user.ts:142` (already supports role filter + array)
- `trpc.userManager.*` — `backend/src/api/trpc/routers/userManager.ts` (assign/unassign/listByManager/listByAccountant)
- `trpc.auth.updateUserRole` — `backend/src/api/trpc/routers/auth.ts:235` (already works)
- `trpc.auth.setUserTelegramId` — `backend/src/api/trpc/routers/auth.ts:262`
- `UserRoleSchema` — `backend/src/api/trpc/routers/auth.ts:22` (already includes `accountant`)
- `UserTelegramDialog` pattern — reuse dialog structure from existing dialogs
- `ManagerMultiSelect` — `frontend/src/components/chats/ManagerMultiSelect.tsx` (can reuse for manager assignment in UserEditDialog)

---

## Verification

1. `npm run type-check` в backend и frontend
2. `npm run build` в обоих пакетах
3. Визуальная проверка через Playwright:
   - Открыть /settings/users → убедиться что роль "Бухгалтер" доступна при создании пользователя
   - Создать пользователя с ролью "Бухгалтер" → убедиться что отображается в таблице с правильным label/color
   - Изменить роль существующего пользователя на "Бухгалтер" → убедиться что сохраняется
   - Открыть настройки чата → "Ответственный бухгалтер" → убедиться что список НЕ пуст (показывает всех admin/manager/accountant)
   - Фильтры по ролям работают
   - Редактирование имени/email через UserEditDialog работает
   - Деактивация пользователя работает
4. Существующие тесты: `npm test` (ChatSettingsForm.test.tsx и другие)
