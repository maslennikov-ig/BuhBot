# Plan: Process GitHub Issues #37, #38, #39

## Context

3 открытых GitHub issues требуют исправления. Все связаны с chat settings и admin panel. Проведен анализ комментариев (только traycerai bot), поиск похожих закрытых задач в Beads и GitHub, верификация кода.

---

## Summary

| # | Issue | Type | Priority | Complexity | Subagent |
|---|-------|------|----------|------------|----------|
| 1 | #37 — notifyInChatOnBreach не сохраняется | bug | P1 | Simple (1 line) | Direct |
| 2 | #39 — Версия в footer (0.9.19) не совпадает с Release Please (0.11.2) | bug | P2 | Simple (2 files) | Direct |
| 3 | #38-B — SLA save блокируется при отсутствии менеджеров | bug | P2 | Medium (1 line + тест) | Direct |
| 4 | #38-A — @username не верифицируется в Telegram/БД | enhancement | P3 | Deferred | -- |

---

## Fix 1: Issue #37 — notifyInChatOnBreach toggle (P1, Simple)

### Root Cause
`ChatSettingsForm.tsx:147-154` — `onSubmit` не включает `notifyInChatOnBreach` в payload `updateChat.mutate()`. Все остальные слои (Zod schema :67, defaults :81, UI toggle :231-278, backend input :306, Prisma update :369-370, response :404) корректно реализованы.

### Similar Issues
- `buh-7bc` (closed) — notifyInChatOnBreach default leak — другой аспект
- `buh-mpj` (closed) — notifyInChatOnBreach not set on creation — другой аспект

### Fix
**File**: `frontend/src/components/chats/ChatSettingsForm.tsx` line 153

Add `notifyInChatOnBreach: data.notifyInChatOnBreach,` to mutation payload:

```typescript
updateChat.mutate({
  id: chatId,
  slaEnabled: data.slaEnabled,
  slaThresholdMinutes: data.slaThresholdMinutes,
  assignedAccountantId: data.assignedAccountantId,
  accountantUsernames: data.accountantUsernames ?? [],
  notifyInChatOnBreach: data.notifyInChatOnBreach,  // <-- ADD
});
```

### Risk: VERY LOW
- Additive change, backend уже принимает это поле как optional

---

## Fix 2: Issue #39 — Version in admin footer (P2, Simple)

### Root Cause
`frontend/next.config.ts:2` импортирует `./package.json` (frontend, v0.9.19) вместо `../package.json` (root, v0.11.2). Release Please управляет только root `package.json`.

### Similar Issues
Нет похожих.

### Fix — 2 файла

**File 1**: `frontend/next.config.ts` line 2

```typescript
// WAS:
import packageJson from './package.json' with { type: 'json' };
// NOW:
import packageJson from '../package.json' with { type: 'json' };
```

**File 2**: `frontend/Dockerfile` after line 48 (after `COPY frontend/. .`)

```dockerfile
# Copy root package.json for version reference (managed by Release Please)
COPY package.json ../package.json
```

Build context = `..` (repo root, docker-compose.yml:59), WORKDIR = `/app`. Import `../package.json` resolves to `/package.json`.

### Risk: LOW
- Оба изменения должны быть в одном коммите — иначе Docker build сломается
- TypeScript резолвит parent paths корректно (tsconfig уже ссылается на `../backend/src/**`)

---

## Fix 3: Issue #38-B — SLA save blocked (P2, Medium)

### Root Cause
`backend/src/api/trpc/routers/chats.ts:336` — валидация `if (input.slaEnabled === true)` блокирует ВСЕ сохранения чат-настроек, если SLA включен и менеджеры не настроены. Даже если пользователь меняет только бухгалтера или threshold. При этом UI для добавления `managerTelegramIds` на странице чата отсутствует — dead-end.

### Similar Issues
- `buh-w1w` (P1, closed) — Global manager fallback added
- `buh-eg8` (P2, closed) — SLA breach alert when no managers

### Fix
**File**: `backend/src/api/trpc/routers/chats.ts` line 336

Блокировать только при **включении** SLA (переход false → true), не при уже включенном:

```typescript
// WAS:
if (input.slaEnabled === true) {
// NOW:
if (input.slaEnabled === true && existingChat.slaEnabled === false) {
```

`existingChat` уже загружен (line 324-326) и проверен на null (lines 328-333). Поле `slaEnabled` — Boolean, not nullable (schema.prisma:211).

### Issue #38-A (username validation) — DEFERRED (P3)
Telegram API не предоставляет публичного endpoint для проверки username. Проверка по БД неполная — бухгалтеры могут не быть зарегистрированы в системе. Текущая regex-валидация достаточна. Создадим отдельную Beads задачу на будущее.

### Risk: LOW
- Frontend warning banner (:215-228) уже информирует пользователя об отсутствии менеджеров
- При уже включенном SLA без менеджеров — алерты просто не отправятся (корректное поведение)

---

## Execution Order

1. **#37** (P1, Simple) — fix → type-check → commit
2. **#39** (P2, Simple) — fix next.config.ts + Dockerfile → type-check + build → commit
3. **#38-B** (P2, Medium) — fix backend → type-check → commit
4. Create Beads task for #38-A (deferred)

---

## Beads Tasks to Create

| Issue | Beads Type | Priority | External Ref |
|-------|-----------|----------|--------------|
| #37 | bug | P1 | gh-37 |
| #39 | bug | P2 | gh-39 |
| #38-B | bug | P2 | gh-38 |
| #38-A | feature | P3 | gh-38 |

---

## Verification

For each fix:
1. `npm run type-check` (frontend/backend)
2. `npm run build` (frontend — для #39)
3. Close GitHub issue with comment describing fix
4. Close Beads task

### End-to-end
- Admin footer shows `v0.11.2` (not `v0.9.19`)
- notifyInChatOnBreach toggle persists after save+reload
- Chat settings save succeeds when SLA already enabled without managers

---

## Files to Modify

- `frontend/src/components/chats/ChatSettingsForm.tsx` — add notifyInChatOnBreach to payload (#37)
- `frontend/next.config.ts` — change import path to root package.json (#39)
- `frontend/Dockerfile` — add COPY for root package.json (#39)
- `backend/src/api/trpc/routers/chats.ts` — relax SLA validation to enable-transition only (#38-B)
