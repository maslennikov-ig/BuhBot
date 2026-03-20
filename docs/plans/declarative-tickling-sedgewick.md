# Plan: Fix #213 — SlaManagerSettingsForm not rendered on /settings page

## Context

Issue #213 требует отображение поля `globalManagerIds` на странице `/settings`. Компонент `SlaManagerSettingsForm` полностью реализован (`frontend/src/components/settings/SlaManagerSettingsForm.tsx`), но **не подключён** в активной странице `frontend/src/app/settings/page.tsx`.

Существует мёртвый файл `frontend/src/app/settings/settings-page-content.tsx`, который содержит `SlaManagerSettingsForm`, но нигде не используется — Next.js рендерит `page.tsx` напрямую.

## Changes

### 1. Add SlaManagerSettingsForm to page.tsx

**File:** `frontend/src/app/settings/page.tsx`

- Add import: `import { SlaManagerSettingsForm } from '@/components/settings/SlaManagerSettingsForm';`
- Render `<SlaManagerSettingsForm />` inside the `schedule` tab (`TabsContent value="schedule"`), перед `<WorkingHoursForm />`

### 2. Delete dead code

**File:** `frontend/src/app/settings/settings-page-content.tsx`

- Delete this file — it's dead code, never imported anywhere

## Verification

1. `npx tsc --noEmit` — no TypeScript errors
2. `npm run build` — build passes
3. Open `/settings` → tab "Расписание и SLA" → verify `SlaManagerSettingsForm` is visible
4. Verify globalManagerIds can be added/removed via the multi-select
